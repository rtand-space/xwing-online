import { describe, expect, it } from 'vitest';
import { SERVER_VERSION } from './index';

describe('@xwing/server', () => {
  it('exposes a version', () => {
    expect(SERVER_VERSION).toBe('0.0.0');
  });
});
