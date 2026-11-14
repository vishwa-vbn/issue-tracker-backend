import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../../src/lib/password.js';

describe('Password Lib', () => {
  it('hashes and successfully verifies a password', async () => {
    const raw = 'Passw0rdOK!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2')).toBe(true);

    const isValid = await verifyPassword(raw, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword123', hash);
    expect(isInvalid).toBe(false);
  });

  it('verifies against DUMMY_HASH returning false', async () => {
    const result = await verifyPassword('random_attempt', DUMMY_HASH);
    expect(result).toBe(false);
  });
});
