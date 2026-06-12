import { userId } from './auth';
import { json } from './http';
import type { Env } from './index';

interface SquadRow {
  id: string;
  name: string;
  faction: string;
  xws: string;
  updated_at: number;
}

/** /squads — list/create the signed-in user's squads; /squads/:id — delete. */
export async function handleSquads(req: Request, env: Env, parts: string[]): Promise<Response> {
  const uid = await userId(req, env);
  if (!uid) return json({ error: 'unauthorized' }, 401);

  if (req.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id, name, faction, xws, updated_at FROM squads WHERE user_id = ? ORDER BY updated_at DESC',
    )
      .bind(uid)
      .all<SquadRow>();
    return json({ squads: rows.results.map((r) => ({ ...r, xws: JSON.parse(r.xws) })) });
  }

  if (req.method === 'POST') {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      faction?: string;
      xws?: unknown;
    };
    if (!body.name || !body.faction || !body.xws) return json({ error: 'missing fields' }, 400);
    const id = body.id ?? crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO squads (id, user_id, name, faction, xws, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, faction = excluded.faction,
         xws = excluded.xws, updated_at = excluded.updated_at
       WHERE squads.user_id = excluded.user_id`,
    )
      .bind(id, uid, body.name, body.faction, JSON.stringify(body.xws), Date.now())
      .run();
    return json({ id });
  }

  if (req.method === 'DELETE' && parts[1]) {
    await env.DB.prepare('DELETE FROM squads WHERE id = ? AND user_id = ?')
      .bind(parts[1], uid)
      .run();
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}
