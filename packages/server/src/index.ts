import { GameDO } from './game-do';

export { GameDO };

export interface Env {
  GAME: DurableObjectNamespace;
  DB: D1Database;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Routes /games/:id/* to that game's Durable Object, and /index/:id to the
 * cross-game D1 metadata.
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const parts = new URL(req.url).pathname.split('/').filter(Boolean);

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
      return stub.fetch(req);
    }

    return new Response('Not found', { status: 404 });
  },
};
