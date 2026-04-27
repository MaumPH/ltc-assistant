interface ApiUrlEnv {
  VITE_RAG_API_BASE_URL?: string;
}

function getConfiguredApiBaseUrl(): string {
  const viteEnv = (import.meta as ImportMeta & { env?: ApiUrlEnv }).env;
  const processEnv =
    typeof process === 'undefined' ? undefined : (process.env as Record<string, string | undefined>);

  return (viteEnv?.VITE_RAG_API_BASE_URL ?? processEnv?.VITE_RAG_API_BASE_URL ?? '').replace(/\/$/, '');
}

export function getApiUrl(route: string): string {
  const apiBaseUrl = getConfiguredApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}${route.startsWith('/') ? route : `/${route}`}` : route;
}

export function formatApiConnectionError(route: string, error: unknown): string {
  const url = getApiUrl(route);
  const message = error instanceof Error ? error.message : String(error);
  return [
    `API 서버에 연결하지 못했습니다: ${url}`,
    `브라우저 오류: ${message || 'Failed to fetch'}`,
    'GitHub Pages에서는 백엔드가 실행되지 않으므로 API 서버 주소, CORS 허용 Origin, 서버 환경변수를 확인해 주세요.',
  ].join('\n');
}
