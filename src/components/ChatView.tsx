import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Scale, Send, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MODELS, type ModelId } from './TopNav';
import ExpertAnswerCard from './ExpertAnswerCard';
import RetrievalTracePanel from './RetrievalTracePanel';
import { formatApiConnectionError, getApiUrl } from '../lib/apiUrl';
import {
  ALL_SERVICE_SCOPE_ID,
  SERVICE_SCOPE_OPTIONS,
  coerceServiceScopes,
  getServiceScopeLabels,
} from '../lib/serviceScopes';
import type { ChatCapabilities, ExpertAnswerEnvelope, RetrievalDiagnostics, ServiceScopeId } from '../lib/ragTypes';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  serviceScopes?: ServiceScopeId[];
  answer?: ExpertAnswerEnvelope;
  citations?: Array<{
    evidenceId: string;
    label?: string;
    docTitle: string;
    articleNo?: string;
    sectionPath: string[];
    effectiveDate?: string;
  }>;
  retrieval?: RetrievalDiagnostics;
}

interface ChatViewProps {
  mode: 'integrated' | 'evaluation';
  apiKey: string | null;
  capabilities: ChatCapabilities | null;
  selectedModel: ModelId;
}

interface ChatApiResponse {
  model?: string;
  answer?: ExpertAnswerEnvelope;
  text?: string;
  citations?: Message['citations'];
  retrieval?: RetrievalDiagnostics;
}

interface ChatApiErrorResponse {
  error?: string;
  details?: unknown;
  model?: string;
}

const MAX_RATE_LIMIT_RETRIES = 2;
const SERVICE_SCOPE_STORAGE_PREFIX = 'ltc.chat.serviceScopes';
const REQUEST_TIMEOUT_MS_BY_MODEL: Record<ModelId, number> = {
  'gemini-3-flash-preview': 120_000,
  'gemini-3.1-pro-preview': 240_000,
  'gemini-3.1-flash-lite-preview': 150_000,
};

const INITIAL_MESSAGES: Record<ChatViewProps['mode'], string> = {
  integrated: '장기요양 통합채팅입니다.',
  evaluation: '평가채팅입니다.',
};
let messageSequence = 0;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

function createMessage(role: Message['role'], text: string, extras?: Partial<Message>): Message {
  messageSequence += 1;
  return {
    id: `message-${Date.now()}-${messageSequence}`,
    role,
    text,
    ...extras,
  };
}

function formatErrorDetails(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.debug('[ChatView] failed to stringify error details:', error);
    return undefined;
  }
}

function getServiceScopeStorageKey(mode: ChatViewProps['mode']): string {
  return `${SERVICE_SCOPE_STORAGE_PREFIX}.${mode}`;
}

function readStoredServiceScopes(mode: ChatViewProps['mode']): ServiceScopeId[] {
  if (typeof window === 'undefined') return [ALL_SERVICE_SCOPE_ID];
  const raw = window.localStorage.getItem(getServiceScopeStorageKey(mode));
  if (!raw) return [ALL_SERVICE_SCOPE_ID];
  try {
    return coerceServiceScopes(JSON.parse(raw));
  } catch (error) {
    console.debug('[ChatView] failed to read stored service scopes:', error);
    return [ALL_SERVICE_SCOPE_ID];
  }
}

function getServiceScopeLabelText(scopes: ServiceScopeId[] | undefined): string {
  return getServiceScopeLabels(scopes?.length ? scopes : [ALL_SERVICE_SCOPE_ID]).join(', ');
}

function ServiceScopeSelector({
  selectedScopes,
  onToggle,
}: {
  selectedScopes: ServiceScopeId[];
  onToggle: (scope: ServiceScopeId) => void;
}) {
  const selected = new Set(selectedScopes);

  return (
    <div>
      <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">적용 급여유형</div>
      <div className="flex flex-wrap gap-1.5">
        {SERVICE_SCOPE_OPTIONS.map((option) => {
          const checked = selected.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={checked}
              onClick={() => onToggle(option.id)}
              className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
                checked
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <span
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                  checked ? 'border-white bg-white text-blue-600' : 'border-slate-400 bg-white'
                }`}
                aria-hidden="true"
              >
                {checked && <Check className="h-3 w-3" />}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getModelLabel(modelId: string): string {
  return MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}

function getRequestTimeoutMs(modelId: ModelId): number {
  return REQUEST_TIMEOUT_MS_BY_MODEL[modelId] ?? 120_000;
}

function buildServerErrorMessage(status: number, fallback = '서버 오류'): string {
  if (status === 404) {
    return '채팅 백엔드 주소를 찾지 못했습니다. 별도 RAG 서버 주소를 확인해 주세요.';
  }
  if (status === 401 || status === 403) {
    return '개인 API 키가 유효하지 않거나 권한이 없습니다.';
  }
  if (status === 429) {
    return '요청 속도 또는 모델 쿼터를 초과했습니다.';
  }
  if (status === 503) {
    return '선택한 모델 서비스가 일시적으로 과부하 상태입니다.';
  }
  if (status === 504) {
    return '모델 응답이 제한 시간 안에 끝나지 않았습니다.';
  }
  return fallback;
}

function buildErrorMessage(title: string, detail?: string): string {
  return detail ? `${title}\n\n> ${detail}` : title;
}

function getRetrievalText(retrieval: RetrievalDiagnostics | undefined, key: keyof RetrievalDiagnostics): string | undefined {
  const value = retrieval?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getAgentDecisionLabel(value: string | undefined): string {
  switch (value) {
    case 'answer':
      return '답변';
    case 'abstain':
      return '보류';
    case 'clarify':
      return '확인 요청';
    default:
      return value ?? '판단 전';
  }
}

function getEvidenceBalanceLabel(retrieval: RetrievalDiagnostics | undefined): string | undefined {
  const balance = retrieval?.evidenceBalance;
  if (!balance || typeof balance !== 'object') return undefined;
  const entries = balance as { legal?: unknown; evaluation?: unknown; practical?: unknown; missingBuckets?: unknown };
  const missingBuckets = Array.isArray(entries.missingBuckets)
    ? entries.missingBuckets.map((item) => String(item)).filter(Boolean)
    : [];
  const counts = [
    `법 ${Number(entries.legal ?? 0)}`,
    `평가 ${Number(entries.evaluation ?? 0)}`,
    `실무 ${Number(entries.practical ?? 0)}`,
  ].join(' / ');
  return missingBuckets.length > 0 ? `${counts} · 부족: ${missingBuckets.join(', ')}` : counts;
}

function RetrievalStatus({ retrieval }: { retrieval?: RetrievalDiagnostics }) {
  const readiness = getRetrievalText(retrieval, 'retrievalReadiness');
  const hybridReason = getRetrievalText(retrieval, 'hybridReadinessReason');
  const agentDecision = getRetrievalText(retrieval, 'agentDecision');
  const evidenceBalance = getEvidenceBalanceLabel(retrieval);
  const shouldShow =
    Boolean(hybridReason) &&
    (readiness !== 'hybrid_ready' || agentDecision === 'abstain' || agentDecision === 'clarify');

  if (!shouldShow) return null;

  return (
    <div className="mt-2 max-w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 shadow-sm">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <span>검색: {readiness ?? 'unknown'}</span>
        <span>판단: {getAgentDecisionLabel(agentDecision)}</span>
        {evidenceBalance && <span>근거: {evidenceBalance}</span>}
      </div>
      {hybridReason && <p className="mt-1 text-slate-500">{hybridReason}</p>}
    </div>
  );
}

export default function ChatView({ mode, apiKey, capabilities, selectedModel }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(() => [createMessage('model', INITIAL_MESSAGES[mode])]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServiceScopes, setSelectedServiceScopes] = useState<ServiceScopeId[]>(() => readStoredServiceScopes(mode));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const requiresUserKey = capabilities?.requiresUserGenerationKey ?? true;
  const canSubmit = !isLoading && Boolean(input.trim()) && (!requiresUserKey || Boolean(apiKey));

  useEffect(() => {
    setMessages([createMessage('model', INITIAL_MESSAGES[mode])]);
    setInput('');
    setSelectedServiceScopes(readStoredServiceScopes(mode));
  }, [mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto' });
  }, [isLoading, messages]);

  useEffect(() => {
    window.localStorage.setItem(getServiceScopeStorageKey(mode), JSON.stringify(selectedServiceScopes));
  }, [mode, selectedServiceScopes]);

  const handleServiceScopeToggle = (scope: ServiceScopeId) => {
    setSelectedServiceScopes((current) => {
      if (scope === ALL_SERVICE_SCOPE_ID) return [ALL_SERVICE_SCOPE_ID];

      const specifics = current.filter((item) => item !== ALL_SERVICE_SCOPE_ID);
      const next = specifics.includes(scope)
        ? specifics.filter((item) => item !== scope)
        : [...specifics, scope];

      return next.length > 0 ? next : [ALL_SERVICE_SCOPE_ID];
    });
  };

  const submitCurrentMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (requiresUserKey && !apiKey) {
      setMessages((current) => [
        ...current,
        createMessage('model', '개인 Gemini API 키가 있어야 답변 생성을 시작할 수 있습니다.\n\n상단의 `개인 키` 버튼에서 답변용 키를 등록해 주세요.'),
      ]);
      return;
    }

    const requestModel = selectedModel;
    const requestModelLabel = getModelLabel(requestModel);
    const requestTimeoutMs = getRequestTimeoutMs(requestModel);
    const requestServiceScopes = selectedServiceScopes;
    const userMessage = createMessage('user', trimmed, { serviceScopes: requestServiceScopes });
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const callApi = async (retryCount = 0): Promise<void> => {
      try {
        const response = await fetch(getApiUrl('/api/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.slice(-4),
            mode,
            model: requestModel,
            promptVariant: 'v2',
            apiKey: apiKey ?? undefined,
            serviceScopes: requestServiceScopes,
          }),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });

        if (response.status === 429) {
          const delay = Number.parseInt(response.headers.get('Retry-After') ?? '15', 10) + 2;
          if (retryCount < MAX_RATE_LIMIT_RETRIES) {
            for (let seconds = delay; seconds > 0; seconds -= 1) {
              setMessages([
                ...newMessages,
                createMessage('model', `요청이 너무 많습니다. **${seconds}초 후 자동 재시도합니다.** (${retryCount + 1}/${MAX_RATE_LIMIT_RETRIES})`),
              ]);
              await wait(1000);
            }
            return callApi(retryCount + 1);
          }
        }

        if (!response.ok) {
          const contentType = response.headers.get('content-type') ?? '';
          const parsed = contentType.includes('application/json')
            ? ((await response.json().catch((error) => {
                console.warn('[ChatView] failed to parse chat error response:', error);
                return {};
              })) as ChatApiErrorResponse)
            : {};
          const errorText = parsed.error ?? buildServerErrorMessage(response.status, response.statusText);
          const detailText = formatErrorDetails(parsed.details);
          const responseModelLabel = parsed.model ? getModelLabel(parsed.model) : requestModelLabel;

          setMessages([
            ...newMessages,
            createMessage(
              'model',
              buildErrorMessage(
                `모델 요청 중 오류가 발생했습니다. (${responseModelLabel})`,
                `${errorText}${detailText ? `\n${detailText}` : ''}`,
              ),
            ),
          ]);
          return;
        }

        const data = (await response.json()) as ChatApiResponse;
        const responseText = data.text?.trim() || '응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
        setMessages([
          ...newMessages,
          createMessage('model', responseText, {
            answer: data.answer,
            citations: data.citations,
            retrieval: data.retrieval,
          }),
        ]);
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        const timeoutSeconds = Math.round(requestTimeoutMs / 1000);
        setMessages([
          ...newMessages,
          createMessage(
            'model',
            isTimeout
              ? buildErrorMessage(
                  `모델 응답 시간이 초과되었습니다. (${requestModelLabel})`,
                  `${timeoutSeconds}초 안에 응답을 받지 못했습니다. 복합 검색과 근거 검증이 함께 돌아갈 때 특히 오래 걸릴 수 있습니다.`,
                )
              : buildErrorMessage(
                  `오류가 발생했습니다. (${requestModelLabel})`,
                  error instanceof Error && error.message === 'Failed to fetch'
                    ? formatApiConnectionError('/api/chat', error)
                    : error instanceof Error
                      ? error.message
                      : '알 수 없는 오류',
                ),
          ),
        ]);
      }
    };

    try {
      await callApi();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitCurrentMessage();
  };

  const renderModelMessage = (message: Message) => {
    return (
      <div className="w-full">
        {message.answer ? (
          <ExpertAnswerCard answer={message.answer} />
        ) : (
          <div className="rounded-[20px] rounded-tl px-4 py-3 text-slate-800 shadow-[0_2px_12px_rgba(15,23,42,0.08),0_0_0_1px_#f1f5f9] sm:px-5 sm:py-4">
            <div className="prose prose-sm max-w-none break-words prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-blue-600 md:prose-base">
              <ReactMarkdown>{message.text}</ReactMarkdown>
            </div>
          </div>
        )}

        {message.retrieval && (
          <RetrievalTracePanel confidence={message.answer?.confidence} retrieval={message.retrieval} />
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col px-3 sm:px-5 lg:px-8 2xl:max-w-[1600px]">
      <div className="shrink-0 pb-1 pt-3">
        <ServiceScopeSelector selectedScopes={selectedServiceScopes} onToggle={handleServiceScopeToggle} />
      </div>

      {requiresUserKey && !apiKey && (
        <div className="mb-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          개인 Gemini API 키를 등록하면 이 채팅창에서 바로 답변 생성을 시작할 수 있습니다.
          <span className="mt-1 block text-xs text-blue-700">등록한 API 키는 이 브라우저의 localStorage에만 저장됩니다.</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'model' && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-700 shadow-[0_4px_12px_rgba(29,78,216,0.3)]">
                  <Scale className="h-4 w-4 text-white" />
                </div>
              )}

              <div
                className={`flex flex-col ${
                  message.role === 'user'
                    ? 'max-w-[82%] items-end sm:max-w-[74%] lg:max-w-[70%]'
                    : 'min-w-0 flex-1 items-start'
                }`}
              >
                {message.role === 'user' ? (
                  <>
                    <div className="rounded-[20px] rounded-br bg-blue-600 px-4 py-3 text-white shadow-sm">
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.text}</p>
                    </div>
                    {message.serviceScopes && (
                      <span className="mt-1 max-w-full truncate px-1 text-[11px] font-medium text-slate-500">
                        적용 급여유형: {getServiceScopeLabelText(message.serviceScopes)}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {renderModelMessage(message)}
                    <RetrievalStatus retrieval={message.retrieval} />
                  </>
                )}
              </div>

              {message.role === 'user' && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-end justify-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-700 shadow-[0_4px_12px_rgba(29,78,216,0.3)]">
                <Scale className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-[20px] rounded-tl bg-white px-4 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.08),0_0_0_1px_#f1f5f9]">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-slate-500">
                    구조화된 근거를 검색하고 답변을 검증하는 중입니다...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        <form
          onSubmit={handleSubmit}
          className="flex items-end rounded-2xl border border-slate-200 bg-white shadow-[0_-2px_8px_rgba(15,23,42,0.03),0_4px_16px_rgba(15,23,42,0.06)] transition focus-within:border-blue-600"
        >
          <textarea
            value={input}
            rows={1}
            style={{ height: 'auto' }}
            placeholder="질문을 입력해 주세요. (Shift+Enter: 줄바꿈)"
            aria-label="질문 입력"
            className="max-h-48 min-h-[56px] flex-1 resize-none bg-transparent px-4 py-3.5 text-[15px] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
            onChange={(event) => {
              setInput(event.target.value);
              resizeTextarea(event.target);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitCurrentMessage();
                resizeTextarea(event.currentTarget);
              }
            }}
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)] transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            aria-label="메시지 보내기"
          >
            <Send className="ml-0.5 h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
