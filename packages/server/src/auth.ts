import { json } from './http';
import type { Env } from './index';

// --- JWT (HS256) via WebCrypto — stateless sessions, no session table. ---
const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const b64urlStr = (s: string): string => b64url(enc.encode(s).buffer as ArrayBuffer);
const fromB64url = (s: string): Uint8Array =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const key = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSec: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlStr(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const data = `${head}.${body}`;
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const ok = await crypto.subtle.verify(
    'HMAC',
    await key(secret),
    fromB64url(s),
    enc.encode(`${h}.${p}`),
  );
  if (!ok) return null;
  const body = JSON.parse(new TextDecoder().decode(fromB64url(p))) as Record<string, unknown>;
  if (typeof body.exp === 'number' && body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}

const bearer = (req: Request): string | null => {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
};

/** The signed-in user id, or null. */
export async function userId(req: Request, env: Env): Promise<string | null> {
  const tok = bearer(req);
  const claims = tok ? await verifyJwt(tok, env.SESSION_SECRET) : null;
  return claims && typeof claims.sub === 'string' ? claims.sub : null;
}

// --- OAuth providers ---
interface Provider {
  authorize: string;
  token: string;
  userinfo: string;
  scope: string;
  parse: (u: Record<string, unknown>) => {
    id: string;
    email: string | null;
    name: string;
    avatar: string | null;
  };
}

const PROVIDERS: Record<string, Provider> = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    parse: (u) => ({
      id: String(u.sub),
      email: (u.email as string) ?? null,
      name: (u.name as string) ?? (u.email as string) ?? 'Pilot',
      avatar: (u.picture as string) ?? null,
    }),
  },
  discord: {
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    userinfo: 'https://discord.com/api/users/@me',
    scope: 'identify email',
    parse: (u) => ({
      id: String(u.id),
      email: (u.email as string) ?? null,
      name: (u.global_name as string) ?? (u.username as string) ?? 'Pilot',
      avatar: u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar as string}.png`
        : null,
    }),
  },
};

const creds = (provider: string, env: Env) =>
  provider === 'google'
    ? { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET }
    : { id: env.DISCORD_CLIENT_ID, secret: env.DISCORD_CLIENT_SECRET };

/** Only redirect back to the configured client origin (or localhost in dev). */
function safeRedirect(target: string, env: Env): string {
  try {
    const u = new URL(target);
    if (u.origin === env.CLIENT_ORIGIN || u.hostname === 'localhost') return target;
  } catch {
    /* fall through */
  }
  return env.CLIENT_ORIGIN;
}

/** Handles /auth/:provider/(login|callback). */
export async function handleAuth(req: Request, env: Env, parts: string[]): Promise<Response> {
  const provider = parts[1] ?? '';
  const action = parts[2];
  const p = PROVIDERS[provider];
  if (!p) return json({ error: 'unknown provider' }, 404);
  const { id: clientId, secret } = creds(provider, env);
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/auth/${provider}/callback`;

  if (action === 'login') {
    if (!clientId) return json({ error: `${provider} sign-in not configured` }, 501);
    const url = new URL(req.url);
    const clientRedirect = safeRedirect(url.searchParams.get('redirect') ?? env.CLIENT_ORIGIN, env);
    const state = await signJwt(
      { r: clientRedirect, g: url.searchParams.get('guest') ?? '', n: crypto.randomUUID() },
      env.SESSION_SECRET,
      600,
    );
    const auth = new URL(p.authorize);
    auth.searchParams.set('client_id', clientId);
    auth.searchParams.set('redirect_uri', redirectUri);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('scope', p.scope);
    auth.searchParams.set('state', state);
    if (provider === 'google') auth.searchParams.set('prompt', 'select_account');
    return Response.redirect(auth.toString(), 302);
  }

  if (action === 'callback') {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateRaw = url.searchParams.get('state');
    const state = stateRaw ? await verifyJwt(stateRaw, env.SESSION_SECRET) : null;
    if (!code || !state) return new Response('Auth failed', { status: 400 });

    const tokRes = await fetch(p.token, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tok = (await tokRes.json()) as { access_token?: string };
    if (!tok.access_token) return new Response('Token exchange failed', { status: 400 });

    const uRes = await fetch(p.userinfo, {
      headers: { authorization: `Bearer ${tok.access_token}` },
    });
    const info = p.parse((await uRes.json()) as Record<string, unknown>);
    const id = `${provider}:${info.id}`;
    await env.DB.prepare(
      `INSERT INTO users (id, provider, provider_id, email, name, avatar, guest_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email, name = excluded.name, avatar = excluded.avatar,
         guest_id = COALESCE(users.guest_id, excluded.guest_id)`,
    )
      .bind(id, provider, info.id, info.email, info.name, info.avatar, state.g || null, Date.now())
      .run();

    const session = await signJwt(
      { sub: id, name: info.name, picture: info.avatar },
      env.SESSION_SECRET,
      60 * 60 * 24 * 30,
    );
    const dest = new URL(safeRedirect(String(state.r), env));
    dest.hash = `session=${session}`;
    return Response.redirect(dest.toString(), 302);
  }

  return json({ error: 'unknown action' }, 404);
}

/** GET /me — returns the signed-in user from the bearer token. */
export async function handleMe(req: Request, env: Env): Promise<Response> {
  const tok = bearer(req);
  const claims = tok ? await verifyJwt(tok, env.SESSION_SECRET) : null;
  if (!claims) return json({ error: 'unauthorized' }, 401);
  return json({ id: claims.sub, name: claims.name, picture: claims.picture });
}
