import { describe, it, expect, beforeEach } from 'vitest';

// Ensure env parsing succeeds for tests without needing a real .env
beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_123456';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_123456';
  process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';
});

it('signFileToken rejects invalid fileObjectId', async () => {
  const { signFileToken } = await import('./tokens.js');
  expect(() => signFileToken({ userId: 1, fileObjectId: 0 })).toThrow('Invalid fileObjectId');
  expect(() => signFileToken({ userId: 1, fileObjectId: -1 })).toThrow('Invalid fileObjectId');
  expect(() => signFileToken({ userId: 1, fileObjectId: 'x' })).toThrow('Invalid fileObjectId');
});

it('signAccessToken creates verifiable token with expected audience', async () => {
  const { signAccessToken, verifyAccessToken, ACCESS_TOKEN_AUDIENCE } = await import('./tokens.js');

  const token = signAccessToken({ userId: 123, role: 'ADMIN' });
  const payload = verifyAccessToken(token);

  expect(payload).toMatchObject({
    role: 'ADMIN',
    aud: ACCESS_TOKEN_AUDIENCE,
    iss: 'genbi-backend',
    sub: '123',
  });
});
