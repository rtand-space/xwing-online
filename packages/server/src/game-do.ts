import type { Command, GameConfig, GameEvent } from '@xwing/engine';
import { applyCommand, createLog, viewFromLog } from './game-store';

const LOG_KEY = 'log';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * One Durable Object per game: a single-threaded actor holding the authoritative
 * event log, persisted transactionally in its own SQLite-backed storage.
 */
export class GameDO {
  constructor(private readonly state: DurableObjectState) {}

  private log(): Promise<GameEvent[] | undefined> {
    return this.state.storage.get<GameEvent[]>(LOG_KEY);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const sub = url.pathname.split('/').filter(Boolean)[2]; // /games/:id[/commands]

    // Create the game.
    if (req.method === 'POST' && !sub) {
      if (await this.log()) return json({ error: 'Game already exists' }, 409);
      const { config } = (await req.json()) as { config: GameConfig };
      const log = createLog(config);
      await this.state.storage.put(LOG_KEY, log);
      return json({ ok: true });
    }

    // Submit a command (async HTTPS intake; the same path WebSockets will use in T5.2).
    if (req.method === 'POST' && sub === 'commands') {
      const log = await this.log();
      if (!log) return json({ error: 'No such game' }, 404);
      const { command } = (await req.json()) as { command: Command };
      const result = applyCommand(log, command);
      if (result.rejection) return json({ rejection: result.rejection }, 409);
      await this.state.storage.put(LOG_KEY, result.log);
      return json({ ok: true });
    }

    // Fetch a redacted snapshot for one viewer.
    if (req.method === 'GET') {
      const log = await this.log();
      if (!log) return json({ error: 'No such game' }, 404);
      return json({ view: viewFromLog(log, url.searchParams.get('viewer') ?? '') });
    }

    return json({ error: 'Method not allowed' }, 405);
  }
}
