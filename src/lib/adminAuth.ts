import crypto from 'node:crypto';

export const ADMIN_DASHBOARD_PASSWORD_ENV = 'ADMIN_DASHBOARD_PASSWORD';
export const ADMIN_JWT_SECRET_ENV = 'ADMIN_JWT_SECRET';
const JWT_ALGORITHM = 'HS256';
const GENERATED_ADMIN_JWT_SECRET = crypto.randomBytes(32).toString('base64url');

type AdminAuthEnv = Record<string, string | undefined>;

interface AdminSessionStoreOptions {
  ttlMs: number;
  now?: () => number;
  jwtSecret?: string;
  warnOnMissingSecret?: boolean;
}

export interface AdminSession {
  token: string;
  expiresAt: number;
}

export function readAdminPassword(env: AdminAuthEnv = process.env): string | null {
  const rawPassword = env[ADMIN_DASHBOARD_PASSWORD_ENV];
  if (rawPassword !== undefined && rawPassword.trim() === '') {
    console.warn(`[adminAuth] ${ADMIN_DASHBOARD_PASSWORD_ENV} is blank and will be treated as unset.`);
    return null;
  }

  const password = rawPassword?.trim();
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

function resolveAdminJwtSecret(env: AdminAuthEnv = process.env, warnOnMissingSecret = true): string {
  const configuredSecret = env[ADMIN_JWT_SECRET_ENV]?.trim();
  if (configuredSecret) return configuredSecret;

  if (warnOnMissingSecret) {
    console.warn(
      `[adminAuth] ${ADMIN_JWT_SECRET_ENV} is not set. Using a random in-memory fallback; admin sessions will be invalid after server restart.`,
    );
  }

  return GENERATED_ADMIN_JWT_SECRET;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeBase64UrlJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch (error) {
    console.debug('[adminAuth] failed to decode JWT JSON payload:', error);
    return null;
  }
}

function signJwtPart(header: string, payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export class AdminSessionStore {
  private readonly revokedTokens = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly jwtSecret: string;

  constructor({ ttlMs, now = () => Date.now(), jwtSecret, warnOnMissingSecret = true }: AdminSessionStoreOptions) {
    this.ttlMs = Math.max(1, ttlMs);
    this.now = now;
    this.jwtSecret = jwtSecret?.trim() || resolveAdminJwtSecret(process.env, warnOnMissingSecret);
  }

  createSession(): AdminSession {
    this.pruneExpired();

    const expiresAt = this.now() + this.ttlMs;
    const header = base64UrlJson({ alg: JWT_ALGORITHM, typ: 'JWT' });
    const payload = base64UrlJson({
      iat: Math.floor(this.now() / 1000),
      exp: Math.floor(expiresAt / 1000),
    });
    const signature = signJwtPart(header, payload, this.jwtSecret);
    const token = `${header}.${payload}.${signature}`;

    return { token, expiresAt };
  }

  isValid(token: string | null | undefined): boolean {
    this.pruneExpired();
    if (!token) return false;
    if (this.revokedTokens.has(token)) return false;

    const decoded = this.verifyToken(token);
    if (!decoded) return false;

    return decoded.expiresAt > this.now();
  }

  revoke(token: string | null | undefined): void {
    if (!token) return;

    const decoded = this.verifyToken(token);
    if (decoded && decoded.expiresAt > this.now()) {
      this.revokedTokens.set(token, decoded.expiresAt);
    }
  }

  pruneExpired(): void {
    const now = this.now();
    for (const [token, expiresAt] of this.revokedTokens.entries()) {
      if (expiresAt <= now) {
        this.revokedTokens.delete(token);
      }
    }
  }

  private verifyToken(token: string): { expiresAt: number } | null {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature || token.split('.').length !== 3) return null;

    const decodedHeader = decodeBase64UrlJson(header);
    if (decodedHeader?.alg !== JWT_ALGORITHM || decodedHeader.typ !== 'JWT') return null;

    const expectedSignature = signJwtPart(header, payload, this.jwtSecret);
    if (!safeEqual(signature, expectedSignature)) return null;

    const decodedPayload = decodeBase64UrlJson(payload);
    const exp = decodedPayload?.exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;

    return { expiresAt: exp * 1000 };
  }
}
