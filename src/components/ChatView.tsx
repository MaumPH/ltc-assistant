import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Scale, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MODELS, type ModelId } from './TopNav';
import ExpertAnswerCard from './ExpertAnswerCard';
import RetrievalTracePanel from './RetrievalTracePanel';
import { getApiUrl } from '../lib/apiUrl';
import type { ChatCapabilities, ExpertAnswerEnvelope, RetrievalDiagnostics } from '../lib/ragTypes';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
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
  details?: string;
  model?: string;
}

const MAX_RATE_LIMIT_RETRIES = 2;
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

export default function ChatView({ mode, apiKey, capabilities, selectedModel }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(() => [createMessage('model', INITIAL_MESSAGES[mode])]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const requiresUserKey = capabilities?.requiresUserGenerationKey ?? true;
  const canSubmit = !isLoading && Boolean(input.trim()) && (!requiresUserKey || Boolean(apiKey));

  useEffect(() => {
    setMessages([createMessage('model', INITIAL_MESSAGES[mode])]);
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
        createMessage('model', '개인 Gemini API 키가 있어야 답변 생성을 시작할 수 있습니다.\n\n상단의 `개인 키` 버튼에서 답변용 키를 등록해 주세요.'),
      ]);
      return;
    }

    const requestModel = selectedModel;
    const requestModelLabel = getModelLabel(requestModel);
    const requestTimeoutMs = getRequestTimeoutMs(requestModel);
    const userMessage = createMessage('user', trimmed);
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
            ? ((await response.json().catch(() => ({}))) as ChatApiErrorResponse)
            : {};
          const errorText = parsed.error ?? buildServerErrorMessage(response.status, response.statusText);
          const detailText = parsed.details?.trim();
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
                  error instanceof Error ? error.message : '알 수 없는 오류',
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
          <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-slate-800 shadow-sm sm:px-5 sm:py-4">
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 pb-6 pt-4 sm:p-4 md:px-8 md:pb-8 md:pt-6">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 md:space-y-8">
          {requiresUserKey && !apiKey && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              개인 Gemini API 키를 등록하면 이 채팅창에서 바로 답변 생성을 시작할 수 있습니다.
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'model' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm">
                  <Scale className="h-4 w-4 text-white" />
                </div>
              )}

              <div
                className={`flex flex-col ${
                  message.role === 'user'
                    ? 'max-w-[92%] items-end sm:max-w-[85%] md:max-w-[75%]'
                    : 'max-w-[96%] items-start sm:max-w-[92%] md:max-w-[88%] lg:max-w-[84%]'
                }`}
              >
                {message.role === 'user' ? (
                  <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-white shadow-sm sm:px-5 sm:py-4">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed sm:text-base">{message.text}</p>
                  </div>
                ) : (
                  renderModelMessage(message)
                )}
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
                aria-label="질문 입력"
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

        </div>
      </div>
    </div>
  );
}
