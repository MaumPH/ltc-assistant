import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_DASHBOARD_PASSWORD_ENV,
  AdminSessionStore,
  extractBearerToken,
  isAdminPasswordConfigured,
  verifyAdminPassword,
} from '../src/lib/adminAuth';

test('admin password is configured only when the env value is non-empty', () => {
  assert.equal(isAdminPasswordConfigured({}), false);
  assert.equal(isAdminPasswordConfigured({ [ADMIN_DASHBOARD_PASSWORD_ENV]: '   ' }), false);
  assert.equal(isAdminPasswordConfigured({ [ADMIN_DASHBOARD_PASSWORD_ENV]: 'secret' }), true);
});

test('admin password verification accepts only the configured password', () => {
  const env = { [ADMIN_DASHBOARD_PASSWORD_ENV]: 'correct-password' };

  assert.equal(verifyAdminPassword('correct-password', env), true);
  assert.equal(verifyAdminPassword('wrong-password', env), false);
  assert.equal(verifyAdminPassword('', env), false);
  assert.equal(verifyAdminPassword('correct-password', {}), false);
});

test('admin session store creates, validates, expires, and revokes tokens', () => {
  let now = 1_000;
  const store = new AdminSessionStore({
    ttlMs: 2_000,
    now: () => now,
    jwtSecret: 'test-secret',
  });

  const session = store.createSession();

  assert.match(session.token, /^[^.]+\.[^.]+\.[^.]+$/);
  assert.equal(session.expiresAt, 3_000);
  assert.equal(store.isValid(session.token), true);

  now = 3_001;
  assert.equal(store.isValid(session.token), false);

  const nextSession = store.createSession();
  assert.equal(store.isValid(nextSession.token), true);
  store.revoke(nextSession.token);
  assert.equal(store.isValid(nextSession.token), false);
});

test('bearer token extraction accepts only Authorization bearer values', () => {
  assert.equal(extractBearerToken('Bearer abc123'), 'abc123');
  assert.equal(extractBearerToken('bearer abc123'), 'abc123');
  assert.equal(extractBearerToken('Basic abc123'), null);
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken(['Bearer abc123']), null);
});
