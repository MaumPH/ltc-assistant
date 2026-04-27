import type { ParsedLawReference } from './ragTypes';

export interface LawMcpFallbackResult {
  cacheKey: string;
  title: string;
  query: string;
  text: string;
  source: string;
  cached: boolean;
  url?: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildMcpUrl(baseUrl: string): string {
  const normalized = trimTrailingSlash(baseUrl);
  return /\/mcp$/i.test(normalized) ? normalized : `${normalized}/mcp`;
}

function buildHealthUrl(baseUrl: string): string {
  const normalized = trimTrailingSlash(baseUrl);
  return /\/mcp$/i.test(normalized) ? normalized.replace(/\/mcp$/i, '/health') : `${normalized}/health`;
}

function extractTextContent(payload: unknown): string {
  const result = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>).result : null;
  const content = result && typeof result === 'object' ? (result as Record<string, unknown>).content : null;
  if (!Array.isArray(content)) return '';

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const text = (item as Record<string, unknown>).text;
      return typeof text === 'string' ? text.trim() : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

async function callMcpTool(baseUrl: string, name: string, args: Record<string, unknown>): Promise<string> {
  const response = await fetch(buildMcpUrl(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${Date.now()}`,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Law MCP request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const error = payload.error;
  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    const rawMessage = errorRecord.message;
    const message = typeof rawMessage === 'string'
      ? rawMessage
      : (() => {
          try {
            return JSON.stringify(error) ?? 'Unknown Law MCP error';
          } catch (error) {
            console.debug('[lawMcpClient] failed to stringify MCP error payload:', error);
            return 'Unknown Law MCP error';
          }
        })();
    throw new Error(message);
  }

  const text = extractTextContent(payload);
  if (!text) {
    throw new Error(`Law MCP tool "${name}" returned no text content.`);
  }

  return text;
}

export class LawMcpClient {
  private readonly enabled: boolean;
  private readonly baseUrl: string;

  constructor(baseUrl: string | undefined, enabled = true) {
    this.enabled = enabled && Boolean(baseUrl);
    this.baseUrl = baseUrl ? trimTrailingSlash(baseUrl) : '';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await fetch(buildHealthUrl(this.baseUrl));
      return response.ok;
    } catch (error) {
      console.debug('[lawMcpClient] health check failed:', error);
      return false;
    }
  }

  async fetchFallback(query: string, parsedLawRefs: ParsedLawReference[]): Promise<LawMcpFallbackResult | null> {
    if (!this.enabled || !query.trim()) return null;

    const preferredTitle = parsedLawRefs[0]
      ? `${parsedLawRefs[0].canonicalLawName}${parsedLawRefs[0].article ? ` ${parsedLawRefs[0].article}` : ''}`
      : 'Korean Law MCP fallback';
    const cacheKey = parsedLawRefs[0]
      ? `${parsedLawRefs[0].canonicalLawName}:${parsedLawRefs[0].jo ?? parsedLawRefs[0].article ?? query}`
      : query;

    const attempts: Array<{ tool: string; args: Record<string, unknown> }> = [];
    const primaryLawRef = parsedLawRefs[0];

    if (primaryLawRef) {
      attempts.push({
        tool: 'get_law_text',
        args: {
          lawId: primaryLawRef.canonicalLawName,
          ...(primaryLawRef.article ? { jo: primaryLawRef.article } : {}),
        },
      });
      attempts.push({
        tool: 'search_law',
        args: {
          query: primaryLawRef.canonicalLawName,
        },
      });
    }

    attempts.push({ tool: 'chain_full_research', args: { query } });
    attempts.push({ tool: 'search_law', args: { query } });

    for (const attempt of attempts) {
      try {
        const text = await callMcpTool(this.baseUrl, attempt.tool, attempt.args);
        return {
          cacheKey,
          title: preferredTitle,
          query,
          text,
          source: `korean-law-mcp:${attempt.tool}`,
          cached: false,
          url: buildMcpUrl(this.baseUrl),
        };
      } catch (error) {
        console.warn(`[lawMcpClient] fallback tool ${attempt.tool} failed:`, error);
        continue;
      }
    }

    return null;
  }
}
