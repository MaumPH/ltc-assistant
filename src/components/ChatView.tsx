import React, { useEffect, useRef, useState } from 'react';
import { Info, Loader2, Scale, Send, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MODELS, type ModelId } from './TopNav';
import type { ChatCapabilities } from '../lib/ragTypes';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ChatViewProps {
  mode: 'integrated' | 'evaluation';
  apiKey: string | null;
  capabilities: ChatCapabilities | null;
  selectedModel: ModelId;
}

interface ChatApiResponse {
  model?: string;
  text?: string;
}

interface ChatApiErrorResponse {
  error?: string;
  details?: string;
  model?: string;
}

const API_BASE_URL = (import.meta.env.VITE_RAG_API_BASE_URL || '').replace(/\/$/, '');
const MAX_RATE_LIMIT_RETRIES = 2;
const REQUEST_TIMEOUT_MS_BY_MODEL: Record<ModelId, number> = {
  'gemini-3-flash-preview': 120_000,
  'gemini-3.1-pro-preview': 240_000,
  'gemini-3.1-flash-lite-preview': 150_000,
};

const INITIAL_MESSAGES: Record<ChatViewProps['mode'], string> = {
  integrated:
    '안녕하세요. 장기요양 통합 상담 모드입니다.\n\n문서 검색과 임베딩은 서버 지식기반을 사용하고, 답변은 근거가 충분할 때만 확정적으로 안내합니다.',
  evaluation:
    '안녕하세요. 평가 상담 모드입니다.\n\n평가 관련 문서를 우선 검색하고, 근거가 부족하면 보수적으로 `확인 불가`로 답합니다.',
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

function getApiUrl(route: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${route}` : route;
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

function getReadinessLabel(capabilities: ChatCapabilities | null): string {
  switch (capabilities?.retrievalReadiness) {
    case 'hybrid_ready':
      return '하이브리드 검색 준비 완료';
    case 'hybrid_partial':
      return '하이브리드 검색 부분 준비';
    case 'lexical_only':
      return '현재는 lexical 위주 검색';
    default:
      return '검색 상태 확인 중';
  }
}

export default function ChatView({ mode, apiKey, capabilities, selectedModel }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: INITIAL_MESSAGES[mode],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const requiresUserKey = capabilities?.requiresUserGenerationKey ?? true;
  const canSubmit = !isLoading && Boolean(input.trim()) && (!requiresUserKey || Boolean(apiKey));

  useEffect(() => {
    setMessages([
      {
        role: 'model',
        text: INITIAL_MESSAGES[mode],
      },
    ]);
    setInput('');
  }, [mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto' });
  }, [isLoading, messages]);

  const submitCurrentMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (requiresUserKey && !apiKey) {
      setMessages((current) => [
        ...current,
        {
          role: 'model',
          text: '개인 Gemini API 키가 있어야 답변 생성을 시작할 수 있습니다.\n\n상단의 `개인 키` 버튼에서 답변용 키를 등록해 주세요.',
        },
      ]);
      return;
    }

    const requestModel = selectedModel;
    const requestModelLabel = getModelLabel(requestModel);
    const requestTimeoutMs = getRequestTimeoutMs(requestModel);
    const userMessage: Message = { role: 'user', text: trimmed };
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
          }),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });

        if (response.status === 429) {
          const delay = Number.parseInt(response.headers.get('Retry-After') ?? '15', 10) + 2;
          if (retryCount < MAX_RATE_LIMIT_RETRIES) {
            for (let seconds = delay; seconds > 0; seconds -= 1) {
              setMessages([
                ...newMessages,
                {
                  role: 'model',
                  text: `요청이 너무 많습니다. **${seconds}초 후 자동 재시도합니다.** (${retryCount + 1}/${MAX_RATE_LIMIT_RETRIES})`,
                },
              ]);
              await wait(1000);
            }
            return callApi(retryCount + 1);
          }
        }

        if (!response.ok) {
          const contentType = response.headers.get('content-type') ?? '';
          const parsed = contentType.includes('application/json')
            ? ((await response.json().catch(() => ({}))) as ChatApiErrorResponse)
            : {};
          const errorText = parsed.error ?? buildServerErrorMessage(response.status, response.statusText);
          const detailText = parsed.details?.trim();
          const responseModelLabel = parsed.model ? getModelLabel(parsed.model) : requestModelLabel;

          setMessages([
            ...newMessages,
            {
              role: 'model',
              text: buildErrorMessage(
                `모델 요청 중 오류가 발생했습니다. (${responseModelLabel})`,
                `${errorText}${detailText ? `\n${detailText}` : ''}`,
              ),
            },
          ]);
          return;
        }

        const data = (await response.json()) as ChatApiResponse;
        const responseText = data.text?.trim() || '응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
        setMessages([...newMessages, { role: 'model', text: responseText }]);
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        const timeoutSeconds = Math.round(requestTimeoutMs / 1000);
        setMessages([
          ...newMessages,
          {
            role: 'model',
            text: isTimeout
              ? buildErrorMessage(
                  `모델 응답 시간이 초과되었습니다. (${requestModelLabel})`,
                  `${timeoutSeconds}초 안에 응답을 받지 못했습니다. 복합 검색과 근거 검증이 함께 돌아갈 때 특히 오래 걸릴 수 있습니다.`,
                )
              : buildErrorMessage(
                  `오류가 발생했습니다. (${requestModelLabel})`,
                  error instanceof Error ? error.message : '알 수 없는 오류',
                ),
          },
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

  const sourceLabel =
    mode === 'evaluation' ? '평가 문서와 평가 근거 자료' : '법령, 고시, 운영 문서, 평가 문서 evidence';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 pb-6 pt-4 sm:p-4 md:px-8 md:pb-8 md:pt-6">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 md:space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <div className="font-medium text-slate-900">검색 상태: {getReadinessLabel(capabilities)}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {capabilities
                ? capabilities.generationMode === 'user'
                  ? '문서 검색은 서버 임베딩 키로 수행되고, 최종 답변 생성은 개인 키가 필요합니다.'
                  : '문서 검색과 답변 생성이 모두 서버 설정 기준으로 동작합니다.'
                : '서버의 검색 준비 상태를 확인하는 중입니다.'}
            </div>
          </div>

          {mode === 'evaluation' && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              평가 모드에서는 평가 문서군과 평가 관련 자료를 우선 검색합니다.
            </div>
          )}

          {requiresUserKey && !apiKey && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              개인 Gemini API 키를 등록하면 이 채팅창에서 바로 답변 생성을 시작할 수 있습니다.
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'model' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm">
                  <Scale className="h-4 w-4 text-white" />
                </div>
              )}

              <div
                className={`flex max-w-[92%] flex-col sm:max-w-[85%] md:max-w-[75%] ${
                  message.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 shadow-sm sm:px-5 sm:py-4 ${
                    message.role === 'user'
                      ? 'rounded-tr-sm bg-blue-600 text-white'
                      : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed sm:text-base">{message.text}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none break-words prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-blue-600 md:prose-base">
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start gap-3 sm:gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm">
                <Scale className="h-4 w-4 text-white" />
              </div>
              <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-slate-500">
                  구조화된 근거를 검색하고 답변을 검증하는 중입니다...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div
        className="shrink-0 border-t border-slate-200 bg-white/95 px-3 pt-3 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] backdrop-blur sm:px-4 md:px-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="mx-auto max-w-4xl">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 sm:gap-3">
            <div className="relative flex-1 rounded-2xl border border-slate-300 bg-slate-50 shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              <textarea
                value={input}
                rows={1}
                style={{ height: 'auto' }}
                placeholder="질문을 입력해 주세요. (Shift+Enter: 줄바꿈)"
                className="max-h-48 min-h-[52px] w-full resize-none bg-transparent px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:ring-0 sm:min-h-[56px] sm:text-[15px]"
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
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-14"
              aria-label="메시지 보내기"
            >
              <Send className="ml-0.5 h-5 w-5" />
            </button>
          </form>

          <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
            <Info className="h-3 w-3" />
            답변은 {sourceLabel}를 기준으로 생성됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
