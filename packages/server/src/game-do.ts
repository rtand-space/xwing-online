import type { Command, GameConfig, GameEvent } from '@xwing/engine';
import { applyCommand, createLog, viewFromLog } from './game-store';
import { json } from './http';
import type { Env } from './index';

const LOG_KEY = 'log';
const SEATS_KEY = 'seats'; // guestId -> playerId
const PLAYERS_KEY = 'players'; // playerId[]

interface SocketMeta {
  viewer: string;
}

/**
 * One Durable Object per game. Holds the authoritative event log (SQLite storage),
 * binds each guest identity to a player seat, and derives command ownership from the
 * seat — a client can never act as a side it didn't claim. Players sync over
 * hibernatable WebSockets; commands also accepted via HTTP.
 */
export class GameDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private log(): Promise<GameEvent[] | undefined> {
    return this.state.storage.get<GameEvent[]>(LOG_KEY);
  }
  private async seats(): Promise<Record<string, string>> {
    return (await this.state.storage.get<Record<string, string>>(SEATS_KEY)) ?? {};
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const sub = url.pathname.split('/').filter(Boolean)[2]; // /games/:id[/join|/commands|/ws|/seat]
    const guestId = url.searchParams.get('guestId') ?? '';

    if (sub === 'ws') return this.handleUpgrade(req, guestId);

    if (req.method === 'POST' && !sub) {
      if (await this.log()) return json({ error: 'Game already exists' }, 409);
      const { config, guestId: host } = (await req.json()) as {
        config: GameConfig;
        guestId: string;
      };
      const playerIds = config.players.map((p) => p.id);
      await this.state.storage.put(LOG_KEY, createLog(config));
      await this.state.storage.put(PLAYERS_KEY, playerIds);
      await this.state.storage.put(SEATS_KEY, host ? { [host]: playerIds[0]! } : {});
      await this.indexGame(config);
      return json({ ok: true, playerId: playerIds[0] ?? null });
    }

    if (req.method === 'POST' && sub === 'join') {
      const { guestId: joiner } = (await req.json()) as { guestId: string };
      return json(await this.seat(joiner));
    }

    if (req.method === 'GET' && sub === 'seat') {
      const seats = await this.seats();
      return json({ playerId: seats[guestId] ?? null });
    }

    if (req.method === 'POST' && sub === 'commands') {
      const { command } = (await req.json()) as { command: Command };
      const seats = await this.seats();
      const rejection = await this.applyAndBroadcast(seats[guestId] ?? '', command);
      return rejection ? json({ rejection }, 409) : json({ ok: true });
    }

    if (req.method === 'GET' && !sub) {
      const log = await this.log();
      if (!log) return json({ error: 'No such game' }, 404);
      const seats = await this.seats();
      return json({ view: viewFromLog(log, seats[guestId] ?? '') });
    }

    return json({ error: 'Method not allowed' }, 405);
  }

  /** Bind a guest to an open seat (idempotent); returns their player id or an error. */
  private async seat(guestId: string): Promise<{ playerId?: string; error?: string }> {
    if (!guestId) return { error: 'Missing guestId' };
    const seats = await this.seats();
    if (seats[guestId]) return { playerId: seats[guestId] };
    const players = (await this.state.storage.get<string[]>(PLAYERS_KEY)) ?? [];
    const taken = new Set(Object.values(seats));
    const open = players.find((p) => !taken.has(p));
    if (!open) return { error: 'Game is full' };
    seats[guestId] = open;
    await this.state.storage.put(SEATS_KEY, seats);
    return { playerId: open };
  }

  private async handleUpgrade(req: Request, guestId: string): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'Expected WebSocket upgrade' }, 426);
    }
    const seats = await this.seats();
    const viewer = seats[guestId] ?? '';
    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ viewer } satisfies SocketMeta);

    const log = await this.log();
    if (log) server.send(JSON.stringify({ type: 'view', view: viewFromLog(log, viewer) }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let msg: { type?: string; command?: Command };
    try {
      msg = JSON.parse(text) as typeof msg;
    } catch {
      return;
    }
    if (msg.type === 'command' && msg.command) {
      const { viewer } = (ws.deserializeAttachment() as SocketMeta | null) ?? { viewer: '' };
      const rejection = await this.applyAndBroadcast(viewer, msg.command);
      if (rejection) ws.send(JSON.stringify({ type: 'rejection', rejection }));
    }
  }

  webSocketClose(ws: WebSocket, code: number): void {
    try {
      ws.close(code);
    } catch {
      /* already closing */
    }
  }

  /** Apply a command as `playerId` (the sender's seat), persist, and broadcast views. */
  private async applyAndBroadcast(playerId: string, command: Command): Promise<string | undefined> {
    if (!playerId) return 'Not seated in this game';
    const log = await this.log();
    if (!log) return 'No such game';
    const result = applyCommand(log, { ...command, playerId });
    if (result.rejection) return result.rejection;
    await this.state.storage.put(LOG_KEY, result.log);
    this.broadcast(result.log);
    return undefined;
  }

  private broadcast(log: GameEvent[]): void {
    for (const ws of this.state.getWebSockets()) {
      const meta = ws.deserializeAttachment() as SocketMeta | null;
      try {
        ws.send(JSON.stringify({ type: 'view', view: viewFromLog(log, meta?.viewer ?? '') }));
      } catch {
        /* socket gone; ignore */
      }
    }
  }

  /** Best-effort cross-game index write; never blocks gameplay if D1 is absent. */
  private async indexGame(config: GameConfig): Promise<void> {
    try {
      await this.env.DB.prepare(
        'INSERT OR IGNORE INTO games (id, created_at, status) VALUES (?1, ?2, ?3)',
      )
        .bind(config.id, Date.now(), 'active')
        .run();
      const insert = this.env.DB.prepare(
        'INSERT OR IGNORE INTO game_players (game_id, player_id, name) VALUES (?1, ?2, ?3)',
      );
      await this.env.DB.batch(config.players.map((p) => insert.bind(config.id, p.id, p.name)));
    } catch {
      /* D1 not provisioned/migrated yet — index is auxiliary, game still runs */
    }
  }
}
