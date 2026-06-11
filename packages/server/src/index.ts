import { GameDO } from './game-do';

export { GameDO };

export interface Env {
  GAME: DurableObjectNamespace;
}

/** Routes /games/:id/* to that game's Durable Object — one actor per game id. */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const parts = new URL(req.url).pathname.split('/').filter(Boolean);
    if (parts[0] !== 'games' || !parts[1]) {
      return new Response('Not found', { status: 404 });
    }
    const stub = env.GAME.get(env.GAME.idFromName(parts[1]));
    return stub.fetch(req);
  },
};
