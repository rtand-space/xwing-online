import { describe, expect, it } from 'vitest';
import { CLIENT_VERSION } from './index';

describe('@xwing/client', () => {
  it('exposes a version', () => {
    expect(CLIENT_VERSION).toBe('0.0.0');
  });
});
