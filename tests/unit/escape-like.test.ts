import { describe, it, expect } from 'vitest';
import { escapeLike } from '../../src/lib/escape-like.js';

describe('escapeLike Lib', () => {
  it('escapes percentage sign (%)', () => {
    expect(escapeLike('100% discount')).toBe('100\\% discount');
  });

  it('escapes underscore (_)', () => {
    expect(escapeLike('user_name')).toBe('user\\_name');
  });

  it('escapes backslash (\\)', () => {
    expect(escapeLike('C:\\path')).toBe('C:\\\\path');
  });

  it('leaves standard alphanumeric and punctuation untouched', () => {
    expect(escapeLike('normal query 123 !@#')).toBe('normal query 123 !@#');
  });
});
