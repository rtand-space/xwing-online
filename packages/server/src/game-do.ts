import type { Command, GameConfig, GameEvent } from '@xwing/engine';
import { applyCommand, createLog, viewFromLog } from './game-store';

const LOG_KEY = 'log';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface SocketMeta {
  viewer: string;
}

/**
 * One Durable Object per game: a single-threaded actor holding the authoritative
 * event log in SQLite-backed storage. Players connect over hibernatable WebSockets;
 * commands also accepted via HTTP. Every change broadcasts a redacted view per viewer.
 */
export class GameDO {
  constructor(private readonly state: DurableObjectState) {
    // Heartbeats are answered without waking the object from hibernation.
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private log(): Promise<GameEvent[] | undefined> {
    return this.state.storage.get<GameEvent[]>(LOG_KEY);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const sub = url.pathname.split('/').filter(Boolean)[2]; // /games/:id[/commands|/ws]

    if (sub === 'ws') return this.handleUpgrade(req, url);

    // Create the game.
    if (req.method === 'POST' && !sub) {
      if (await this.log()) return json({ error: 'Game already exists' }, 409);
      const { config } = (await req.json()) as { config: GameConfig };
      await this.state.storage.put(LOG_KEY, createLog(config));
      return json({ ok: true });
    }

    // Submit a command over HTTP (async intake; live sockets still get the broadcast).
    if (req.method === 'POST' && sub === 'commands') {
      const { command } = (await req.json()) as { command: Command };
      const rejection = await this.applyAndBroadcast(command);
      return rejection ? json({ rejection }, 409) : json({ ok: true });
    }

    // Redacted snapshot for one viewer.
    if (req.method === 'GET') {
      const log = await this.log();
      if (!log) return json({ error: 'No such game' }, 404);
      return json({ view: viewFromLog(log, url.searchParams.get('viewer') ?? '') });
    }

    return json({ error: 'Method not allowed' }, 405);
  }

  private async handleUpgrade(req: Request, url: URL): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'Expected WebSocket upgrade' }, 426);
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      viewer: url.searchParams.get('viewer') ?? '',
    } satisfies SocketMeta);

    const log = await this.log();
    if (log) {
      server.send(
        JSON.stringify({
          type: 'view',
          view: viewFromLog(log, url.searchParams.get('viewer') ?? ''),
        }),
      );
    }
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
      const rejection = await this.applyAndBroadcast(msg.command);
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

  /** Validate + persist a command, then push fresh redacted views to all sockets. */
  private async applyAndBroadcast(command: Command): Promise<string | undefined> {
    const log = await this.log();
    if (!log) return 'No such game';
    const result = applyCommand(log, command);
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
}
