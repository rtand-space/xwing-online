import { describe, expect, it } from 'vitest';
import { DATA_VERSION } from './index';

describe('@xwing/data', () => {
  it('exposes a version', () => {
    expect(DATA_VERSION).toBe('0.0.0');
  });
});
