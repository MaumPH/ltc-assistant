import crypto from 'node:crypto';

export const ADMIN_DASHBOARD_PASSWORD_ENV = 'ADMIN_DASHBOARD_PASSWORD';
const DEFAULT_TOKEN_BYTES = 32;

type AdminAuthEnv = Record<string, string | undefined>;

interface AdminSessionStoreOptions {
  ttlMs: number;
  now?: () => number;
  createToken?: () => string;
}

export interface AdminSession {
  token: string;
  expiresAt: number;
}

export function readAdminPassword(env: AdminAuthEnv = process.env): string | null {
  const password = env[ADMIN_DASHBOARD_PASSWORD_ENV]?.trim();
  return password ? password : null;
}

export function isAdminPasswordConfigured(env: AdminAuthEnv = process.env): boolean {
  return readAdminPassword(env) !== null;
}

function hashSecret(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest();
}

export function verifyAdminPassword(input: string, env: AdminAuthEnv = process.env): boolean {
  const configuredPassword = readAdminPassword(env);
  if (!configuredPassword || !input) return false;

  return crypto.timingSafeEqual(hashSecret(input), hashSecret(configuredPassword));
}

export function extractBearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

export class AdminSessionStore {
  private readonly sessions = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly createTokenValue: () => string;

  constructor({ ttlMs, now = () => Date.now(), createToken }: AdminSessionStoreOptions) {
    this.ttlMs = Math.max(1, ttlMs);
    this.now = now;
    this.createTokenValue = createToken ?? (() => crypto.randomBytes(DEFAULT_TOKEN_BYTES).toString('base64url'));
  }

  createSession(): AdminSession {
    this.pruneExpired();

    const token = this.createTokenValue();
    const expiresAt = this.now() + this.ttlMs;
    this.sessions.set(token, expiresAt);

    return { token, expiresAt };
  }

  isValid(token: string | null | undefined): boolean {
    if (!token) return false;

    const expiresAt = this.sessions.get(token);
    if (!expiresAt) return false;

    if (expiresAt <= this.now()) {
      this.sessions.delete(token);
      return false;
    }

    return true;
  }

  revoke(token: string | null | undefined): void {
    if (token) {
      this.sessions.delete(token);
    }
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [token, expiresAt] of this.sessions.entries()) {
      if (expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }
}
