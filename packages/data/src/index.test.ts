import { describe, expect, it } from 'vitest';
import { DATA_VERSION } from './index';

describe('@xwing/data', () => {
  it('exposes the pinned points version', () => {
    expect(DATA_VERSION).toMatch(/^XWA /);
  });
});
