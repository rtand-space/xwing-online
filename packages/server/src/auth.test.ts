import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from './auth';

describe('session JWT', () => {
  it('round-trips a signed token', async () => {
    const t = await signJwt({ sub: 'google:42', name: 'Wedge' }, 'secret', 60);
    const claims = await verifyJwt(t, 'secret');
    expect(claims?.sub).toBe('google:42');
    expect(claims?.name).toBe('Wedge');
  });

  it('rejects a wrong secret and a tampered token', async () => {
    const t = await signJwt({ sub: 'x' }, 'secret', 60);
    expect(await verifyJwt(t, 'other')).toBeNull();
    expect(await verifyJwt(t.slice(0, -2) + 'aa', 'secret')).toBeNull();
  });

  it('rejects an expired token', async () => {
    const t = await signJwt({ sub: 'x' }, 'secret', -1);
    expect(await verifyJwt(t, 'secret')).toBeNull();
  });
});
