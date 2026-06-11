import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';
import type { Command, GameConfig, GameEvent, ShipInit } from '@xwing/engine';
import { applyCommand, createLog, pendingPlayer, publicLog, viewFromLog } from './game-store';
import { json } from './http';
import type { Env } from './index';

const LOG_KEY = 'log';
const SEATS_KEY = 'seats'; // guestId -> side
const SIDES_KEY = 'sides'; // side -> ShipInit[]
const SEED_KEY = 'seed';
const SUBS_KEY = 'subs'; // side -> PushSubscription

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
  private async subs(): Promise<Record<string, PushSubscription>> {
    return (await this.state.storage.get<Record<string, PushSubscription>>(SUBS_KEY)) ?? {};
  }
  private async sides(): Promise<Record<string, ShipInit[]>> {
    return (await this.state.storage.get<Record<string, ShipInit[]>>(SIDES_KEY)) ?? {};
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const sub = url.pathname.split('/').filter(Boolean)[2]; // /games/:id[/join|/commands|/ws|/seat]
    const guestId = url.searchParams.get('guestId') ?? '';
    const code = url.pathname.split('/').filter(Boolean)[1] ?? '';

    if (sub === 'ws') return this.handleUpgrade(req, guestId);

    // Host opens a lobby with their side's ships; the game starts once both sides are in.
    if (req.method === 'POST' && !sub) {
      if (await this.log()) return json({ error: 'Game already exists' }, 409);
      const {
        guestId: host,
        side,
        ships,
        seed,
      } = (await req.json()) as {
        guestId: string;
        side: string;
        ships: ShipInit[];
        seed: string;
      };
      await this.state.storage.put(SEED_KEY, seed);
      await this.state.storage.put(SIDES_KEY, { [side]: ships });
      await this.state.storage.put(SEATS_KEY, { [host]: side });
      return json({ ok: true, playerId: side });
    }

    // Joiner brings the opposing side's ships; assemble + start when both are present.
    if (req.method === 'POST' && sub === 'join') {
      const { guestId: joiner, ships } = (await req.json()) as {
        guestId: string;
        ships: ShipInit[];
      };
      const seats = await this.seats();
      if (seats[joiner]) return json({ playerId: seats[joiner] });
      const sides = await this.sides();
      const hostSide = Object.keys(sides)[0];
      if (!hostSide) return json({ error: 'No such game' }, 404);
      const open = hostSide === 'rebel' ? 'imperial' : 'rebel';
      sides[open] = ships;
      seats[joiner] = open;
      await this.state.storage.put(SIDES_KEY, sides);
      await this.state.storage.put(SEATS_KEY, seats);
      await this.assembleIfReady(code, sides);
      return json({ playerId: open });
    }

    // Register a web-push subscription for the sender's seat.
    if (req.method === 'POST' && sub === 'subscribe') {
      const { guestId: gid, subscription } = (await req.json()) as {
        guestId: string;
        subscription: PushSubscription;
      };
      const seat = (await this.seats())[gid];
      if (!seat) return json({ error: 'Not seated' }, 409);
      const subs = await this.subs();
      subs[seat] = subscription;
      await this.state.storage.put(SUBS_KEY, subs);
      return json({ ok: true });
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

  /** Once both sides have submitted squads, build the game and notify connected sockets. */
  private async assembleIfReady(code: string, sides: Record<string, ShipInit[]>): Promise<void> {
    if (await this.log()) return;
    if (!sides.rebel || !sides.imperial) return;
    const seed = (await this.state.storage.get<string>(SEED_KEY)) ?? 's';
    const config: GameConfig = {
      id: code,
      seed,
      players: [
        { id: 'rebel', name: 'Rebel' },
        { id: 'imperial', name: 'Imperial' },
      ],
      ships: [...sides.rebel, ...sides.imperial],
    };
    const log = createLog(config);
    await this.state.storage.put(LOG_KEY, log);
    await this.indexGame(config);
    this.broadcast(log);
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
    server.send(
      log
        ? JSON.stringify({ type: 'view', view: viewFromLog(log, viewer), log: publicLog(log) })
        : JSON.stringify({ type: 'lobby' }),
    );
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
    await this.notifyNext(result.log);
    return undefined;
  }

  /** If the next player to act isn't connected, send them a "your turn" push. */
  private async notifyNext(log: GameEvent[]): Promise<void> {
    const next = pendingPlayer(log);
    if (!next) return;
    const connected = this.state
      .getWebSockets()
      .some((ws) => (ws.deserializeAttachment() as SocketMeta | null)?.viewer === next);
    if (connected) return; // they got the live view already
    const subscription = (await this.subs())[next];
    if (subscription) await this.sendPush(subscription);
  }

  private async sendPush(subscription: PushSubscription): Promise<void> {
    if (!this.env.VAPID_PRIVATE_KEY) return; // push not configured
    try {
      const payload = await buildPushPayload(
        { data: { title: 'X-Wing Online', body: 'Your turn!' } },
        subscription,
        {
          subject: this.env.VAPID_SUBJECT,
          publicKey: this.env.VAPID_PUBLIC_KEY,
          privateKey: this.env.VAPID_PRIVATE_KEY,
        },
      );
      await fetch(subscription.endpoint, {
        method: payload.method,
        headers: payload.headers,
        body: payload.body,
      });
    } catch {
      /* push is best-effort */
    }
  }

  private broadcast(log: GameEvent[]): void {
    const shared = publicLog(log);
    for (const ws of this.state.getWebSockets()) {
      const meta = ws.deserializeAttachment() as SocketMeta | null;
      try {
        ws.send(
          JSON.stringify({ type: 'view', view: viewFromLog(log, meta?.viewer ?? ''), log: shared }),
        );
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
