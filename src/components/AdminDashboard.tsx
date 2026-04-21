import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { getApiUrl } from '../lib/apiUrl';
import RagAdminPanel from './RagAdminPanel';

const ADMIN_SESSION_STORAGE_KEY = 'ltc_admin_session';
const ADMIN_PASSWORD_ENV_NAME = 'ADMIN_DASHBOARD_PASSWORD';

interface AdminSessionResponse {
  authenticated: boolean;
  token: string;
  expiresAt: string;
}

interface StoredAdminSession {
  token: string;
  expiresAt: string;
}

function readStoredAdminSession(): StoredAdminSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredAdminSession>;
    if (!parsed.token || !parsed.expiresAt) return null;

    const expiresAt = new Date(parsed.expiresAt).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      return null;
    }

    return {
      token: parsed.token,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return null;
  }
}

function storeAdminSession(session: AdminSessionResponse): StoredAdminSession {
  const stored = {
    token: session.token,
    expiresAt: session.expiresAt,
  };
  window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

function clearAdminSession() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  }
}

export default function AdminDashboard() {
  const [session, setSession] = useState<StoredAdminSession | null>(readStoredAdminSession);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    const verifySession = async () => {
      try {
        const response = await fetch(getApiUrl('/api/admin/session'), {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });
        if (!response.ok && !cancelled) {
          clearAdminSession();
          setSession(null);
        }
      } catch {
        if (!cancelled) {
          clearAdminSession();
          setSession(null);
        }
      }
    };

    void verifySession();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password.trim()) {
      setError('관리자 비밀번호를 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl('/api/admin/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<AdminSessionResponse> & {
        error?: string;
        details?: string;
      };

      if (!response.ok || !payload.token || !payload.expiresAt) {
        throw new Error(payload.details || payload.error || '관리자 로그인에 실패했습니다.');
      }

      setSession(storeAdminSession(payload as AdminSessionResponse));
      setPassword('');
      setShowPassword(false);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '관리자 로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    const token = session?.token;
    clearAdminSession();
    setSession(null);
    setPassword('');
    setError(null);

    if (!token) return;
    await fetch(getApiUrl('/api/admin/session'), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => undefined);
  };

  if (session) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">관리자 대시보드</h1>
                <p className="mt-1 text-sm text-slate-500">
                  비밀번호 인증이 완료된 세션에서만 RAG 운영 도구를 사용할 수 있습니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          </div>

          <RagAdminPanel authToken={session.token} onAuthExpired={() => void handleLogout()} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-8 sm:px-6 md:px-8">
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center">
        <section className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">관리자 로그인</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                서버 환경변수 <code>{ADMIN_PASSWORD_ENV_NAME}</code>에 설정한 비밀번호를 입력하세요.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">관리자 비밀번호</label>
              <div className="relative">
                <input
                  autoFocus
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 pr-12 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  placeholder="비밀번호 입력"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? '확인 중...' : '관리자 대시보드 접속'}
            </button>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
              비밀번호는 브라우저에 저장하지 않습니다. 인증 토큰은 현재 탭의 세션 저장소에만 보관됩니다.
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
