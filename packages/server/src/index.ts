import { handleAuth, handleMe } from './auth';
import { GameDO } from './game-do';
import { handleSquads } from './squads';
import { cors, json, withCors } from './http';

export { GameDO };

export interface Env {
  GAME: DurableObjectNamespace;
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  SESSION_SECRET: string;
  CLIENT_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
}

/**
 * Routes /games/:id/* to that game's Durable Object, and /index/:id to the
 * cross-game D1 metadata. Adds CORS so the browser client can call it cross-origin.
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const parts = new URL(req.url).pathname.split('/').filter(Boolean);

    if (parts[0] === 'auth') return handleAuth(req, env, parts);
    if (parts[0] === 'me') return withCors(await handleMe(req, env));
    if (parts[0] === 'squads') return withCors(await handleSquads(req, env, parts));

    if (parts[0] === 'index' && parts[1]) {
      const game = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(parts[1]).first();
      if (!game) return json({ error: 'No such game' }, 404);
      const players = await env.DB.prepare(
        'SELECT player_id, name FROM game_players WHERE game_id = ?',
      )
        .bind(parts[1])
        .all();
      return json({ game, players: players.results });
    }

    if (parts[0] === 'games' && parts[1]) {
      const stub = env.GAME.get(env.GAME.idFromName(parts[1]));
      const res = await stub.fetch(req);
      return res.status === 101 ? res : withCors(res); // don't wrap WebSocket upgrades
    }

    return withCors(new Response('Not found', { status: 404 }));
  },
};
