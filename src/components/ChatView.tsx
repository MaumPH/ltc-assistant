import React, { useEffect, useRef, useState } from 'react';
import { Info, Loader2, Scale, Send, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { buildVariantSystemInstruction, type PromptSourceSet } from '../lib/promptAssembly';
import { MODELS, type ModelId } from './TopNav';

import systemPromptRaw from '/system_prompt.md?raw';
import v2BasePromptRaw from '/prompts/v2/base.md?raw';
import integratedOverlayRaw from '/prompts/v2/integrated.overlay.md?raw';
import evaluationOverlayRaw from '/prompts/v2/evaluation.overlay.md?raw';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ChatViewProps {
  mode: 'integrated' | 'evaluation';
  apiKey: string;
  selectedModel: ModelId;
}

type KnowledgeModule = typeof import('../lib/knowledge');
type GenAiModule = typeof import('@google/genai');

type FailureKind = 'timeout' | 'connection' | 'model' | 'rate_limit' | 'auth' | 'quota' | 'unknown';

interface ModelFailure {
  model: ModelId;
  kind: FailureKind;
  message: string;
  status?: number;
}

interface GenerationResult {
  text: string;
  usedModel: ModelId;
  fallbackUsed: boolean;
  failureKind?: FailureKind;
}

interface ModelRequestSuccess {
  ok: true;
  text: string;
}

interface ModelRequestFailure {
  ok: false;
  failure: ModelFailure;
}

type ModelRequestResult = ModelRequestSuccess | ModelRequestFailure;

function isModelRequestFailure(result: ModelRequestResult): result is ModelRequestFailure {
  return result.ok === false;
}

class GenerationFlowError extends Error {
  primaryFailure: ModelFailure;
  fallbackFailure?: ModelFailure;

  constructor(primaryFailure: ModelFailure, fallbackFailure?: ModelFailure) {
    super(fallbackFailure ? '기본 모델과 대체 모델 모두 실패했습니다.' : primaryFailure.message);
    this.name = 'GenerationFlowError';
    this.primaryFailure = primaryFailure;
    this.fallbackFailure = fallbackFailure;
  }
}

class ServerRouteUnavailableError extends Error {
  constructor(message = 'Chat server route is unavailable.') {
    super(message);
    this.name = 'ServerRouteUnavailableError';
  }
}

const promptSources: PromptSourceSet = {
  baseline: systemPromptRaw,
  base: v2BasePromptRaw,
  overlays: {
    integrated: integratedOverlayRaw,
    evaluation: evaluationOverlayRaw,
  },
};

const INITIAL_MESSAGES: Record<ChatViewProps['mode'], string> = {
  integrated:
    '안녕하세요. 장기요양기관 업무 보조 어시스턴트입니다.\n\n시스템에 등록된 **전체 법령·고시·평가 기준 문서**만을 근거로 엄격하고 보수적으로 답변드립니다.\n\n질문하실 내용을 입력해 주세요.',
  evaluation:
    '안녕하세요. **평가 전용** 어시스턴트입니다.\n\n2026년 주야간보호 평가매뉴얼과 평가 관련 자료만을 근거로 답변드립니다.\n\n평가 관련 질문을 입력해 주세요.',
};

const FALLBACK_MODEL: ModelId = 'gemini-3.1-flash-lite-preview';
const BASE_MODEL_REQUEST_TIMEOUT_MS = 45_000;
const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_CONTEXT_CHARS = 20_000;
const CLIENT_RETRIEVAL_CANDIDATE_K = 30;
const CLIENT_CONTEXT_TOP_K = 8;

let knowledgeModulePromise: Promise<KnowledgeModule> | null = null;
let genAiModulePromise: Promise<GenAiModule> | null = null;
let serverRouteUnavailable = false;

function loadKnowledgeModule() {
  if (!knowledgeModulePromise) {
    knowledgeModulePromise = import('../lib/knowledge');
  }

  return knowledgeModulePromise;
}

function loadGenAiModule() {
  if (!genAiModulePromise) {
    genAiModulePromise = import('@google/genai');
  }

  return genAiModulePromise;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

function shouldUseClientSideChat() {
  if (serverRouteUnavailable) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
}

function getModelRequestTimeoutMs(model: ModelId): number {
  if (model === 'gemini-3.1-pro-preview') {
    return 75_000;
  }

  if (model === 'gemini-3-flash-preview') {
    return 60_000;
  }

  return BASE_MODEL_REQUEST_TIMEOUT_MS;
}

function getModelLabel(model: ModelId): string {
  return MODELS.find((item) => item.id === model)?.label ?? model;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return '알 수 없는 오류';
}

function getErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  if (typeof error === 'object' && error && 'name' in error && typeof error.name === 'string') {
    return error.name;
  }

  return 'Error';
}

function getErrorStatus(error: unknown): number | undefined {
  const candidates: unknown[] = [];

  if (typeof error === 'object' && error) {
    const record = error as Record<string, unknown>;
    candidates.push(record.status, record.statusCode, record.code);

    const sdkHttpResponse = record.sdkHttpResponse as Record<string, unknown> | undefined;
    const cause = record.cause as Record<string, unknown> | undefined;
    const nestedError = record.error as Record<string, unknown> | undefined;

    candidates.push(
      sdkHttpResponse?.status,
      sdkHttpResponse?.statusCode,
      cause?.status,
      cause?.statusCode,
      nestedError?.status,
      nestedError?.statusCode,
    );
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }

    if (typeof candidate === 'string') {
      const parsed = Number.parseInt(candidate, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function classifyFailure(error: unknown, timedOut = false): FailureKind {
  const status = getErrorStatus(error);
  const name = getErrorName(error).toLowerCase();
  const message = getErrorMessage(error).toLowerCase();

  if (
    timedOut ||
    name === 'aborterror' ||
    name === 'apiconnectiontimeouterror' ||
    message.includes('timed out') ||
    message.includes('timeout')
  ) {
    return 'timeout';
  }

  if (status === 429 || message.includes('429') || message.includes('resource_exhausted')) {
    return 'rate_limit';
  }

  if (
    status === 401 ||
    status === 403 ||
    message.includes('api key') ||
    message.includes('api_key') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('permission denied')
  ) {
    return 'auth';
  }

  if (
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current quota')
  ) {
    return 'quota';
  }

  if (
    name.includes('connection') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('socket hang up')
  ) {
    return 'connection';
  }

  if (
    status === 404 ||
    message.includes('publisher model') ||
    message.includes('model') && message.includes('not found') ||
    message.includes('model') && message.includes('unsupported') ||
    message.includes('model') && message.includes('unavailable') ||
    message.includes('not available') && message.includes('model')
  ) {
    return 'model';
  }

  return 'unknown';
}

function toModelFailure(model: ModelId, error: unknown, timedOut = false): ModelFailure {
  return {
    model,
    kind: classifyFailure(error, timedOut),
    message: getErrorMessage(error),
    status: getErrorStatus(error),
  };
}

function shouldFallback(failure: ModelFailure): boolean {
  if (failure.model === FALLBACK_MODEL) {
    return false;
  }

  return failure.kind === 'timeout' || failure.kind === 'connection' || failure.kind === 'model';
}

function formatFallbackNotice(model: ModelId, failureKind?: FailureKind): string {
  if (failureKind === 'model') {
    return `> 선택한 모델을 현재 경로에서 사용할 수 없어 ${getModelLabel(model)}로 자동 재시도했습니다.`;
  }

  if (failureKind === 'connection') {
    return `> 선택한 모델 호출 중 연결 문제가 있어 ${getModelLabel(model)}로 자동 재시도했습니다.`;
  }

  return `> 선택한 모델 응답이 지연되어 ${getModelLabel(model)}로 자동 재시도했습니다.`;
}

function formatFailureMessage(error: GenerationFlowError): string {
  const { primaryFailure, fallbackFailure } = error;

  if (fallbackFailure) {
    return [
      '기본 모델과 대체 모델 모두 실패했습니다. 잠시 후 다시 시도해 주세요.',
      `> 기본 모델(${getModelLabel(primaryFailure.model)}): ${primaryFailure.message}`,
      `> 대체 모델(${getModelLabel(fallbackFailure.model)}): ${fallbackFailure.message}`,
    ].join('\n\n');
  }

  if (primaryFailure.kind === 'auth') {
    return 'API 키가 유효하지 않습니다. 상단 설정에서 API 키를 다시 입력해 주세요.';
  }

  if (primaryFailure.kind === 'quota' || primaryFailure.kind === 'rate_limit') {
    return '요청 한도를 초과했거나 결제 설정이 필요합니다. 잠시 후 다시 질문해 주세요.\n\n> 해결 방법: [Google AI Studio](https://aistudio.google.com)에서 결제 수단과 사용량 한도를 확인해 주세요.';
  }

  if (primaryFailure.kind === 'timeout') {
    return `선택한 모델 응답이 너무 오래 걸려 요청을 종료했습니다. 잠시 후 다시 시도해 주세요.\n\n> ${primaryFailure.message}`;
  }

  return `오류가 발생했습니다. 다시 시도해 주세요.\n\n> ${primaryFailure.message}`;
}

async function requestClientSideResponse({
  apiKey,
  messages,
  mode,
  selectedModel,
}: {
  apiKey: string;
  messages: Message[];
  mode: ChatViewProps['mode'];
  selectedModel: ModelId;
}): Promise<string> {
  const [{ GoogleGenAI }, knowledge] = await Promise.all([loadGenAiModule(), loadKnowledgeModule()]);
  const knowledgeFiles = mode === 'evaluation' ? knowledge.evalKnowledgeFiles : knowledge.allKnowledgeFiles;
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.text ?? '';
  const candidates = latestUserMessage
    ? knowledge.searchKnowledge(knowledgeFiles, latestUserMessage, CLIENT_RETRIEVAL_CANDIDATE_K)
    : [];
  const topChunks = candidates.slice(0, CLIENT_CONTEXT_TOP_K);

  let contextChars = 0;
  const knowledgeContext = knowledge.chunksToContext(
    topChunks.filter((chunk) => {
      if (contextChars + chunk.text.length > MAX_CONTEXT_CHARS) {
        return false;
      }

      contextChars += chunk.text.length;
      return true;
    }),
  );

  const ai = new GoogleGenAI({ apiKey });
  const contents = messages.slice(-4).map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));
  const systemInstruction = buildVariantSystemInstruction({
    mode,
    variant: 'v2',
    knowledgeContext,
    sources: promptSources,
  });

  try {
    const result = await generateWithFallback({
      ai,
      contents,
      selectedModel,
      systemInstruction,
    });

    return result.fallbackUsed
      ? `${formatFallbackNotice(result.usedModel, result.failureKind)}\n\n${result.text}`
      : result.text;
  } catch (error) {
    if (error instanceof GenerationFlowError) {
      return formatFailureMessage(error);
    }

    throw error;
  }
}

async function requestModel({
  ai,
  contents,
  model,
  systemInstruction,
}: {
  ai: InstanceType<GenAiModule['GoogleGenAI']>;
  contents: { role: Message['role']; parts: { text: string }[] }[];
  model: ModelId;
  systemInstruction: string;
}): Promise<ModelRequestResult> {
  const controller = new AbortController();
  let timedOut = false;
  const startedAt = performance.now();
  const timeoutMs = getModelRequestTimeoutMs(model);
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  console.info('[ChatView] Gemini request started', {
    requestedModel: model,
    timeoutMs,
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        abortSignal: controller.signal,
        systemInstruction,
        temperature: 0.1,
      },
    });

    const elapsedMs = Math.round(performance.now() - startedAt);
    const text = response.text?.trim() || '응답 본문을 받지 못했습니다. 잠시 후 다시 시도해 주세요.';

    console.info('[ChatView] Gemini request finished', {
      requestedModel: model,
      elapsedMs,
      textLength: text.length,
    });

    return { ok: true, text };
  } catch (error) {
    const failure = toModelFailure(model, error, timedOut);
    const elapsedMs = Math.round(performance.now() - startedAt);

    console.warn('[ChatView] Gemini request failed', {
      requestedModel: model,
      elapsedMs,
      failureKind: failure.kind,
      status: failure.status,
      errorName: getErrorName(error),
      errorMessage: failure.message,
    });

    return { ok: false, failure };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function generateWithFallback({
  ai,
  contents,
  selectedModel,
  systemInstruction,
}: {
  ai: InstanceType<GenAiModule['GoogleGenAI']>;
  contents: { role: Message['role']; parts: { text: string }[] }[];
  selectedModel: ModelId;
  systemInstruction: string;
}): Promise<GenerationResult> {
  const primaryResult = await requestModel({
    ai,
    contents,
    model: selectedModel,
    systemInstruction,
  });

  if (!isModelRequestFailure(primaryResult)) {
    return {
      text: primaryResult.text,
      usedModel: selectedModel,
      fallbackUsed: false,
    };
  }

  const primaryFailure = primaryResult.failure;

  if (!shouldFallback(primaryFailure)) {
    throw new GenerationFlowError(primaryFailure);
  }

  console.warn('[ChatView] Falling back to alternate Gemini model', {
    requestedModel: selectedModel,
    fallbackModel: FALLBACK_MODEL,
    failureKind: primaryFailure.kind,
  });

  const fallbackResult = await requestModel({
    ai,
    contents,
    model: FALLBACK_MODEL,
    systemInstruction,
  });

  if (!isModelRequestFailure(fallbackResult)) {
    console.info('[ChatView] Gemini fallback succeeded', {
      requestedModel: selectedModel,
      usedModel: FALLBACK_MODEL,
    });

    return {
      text: fallbackResult.text,
      usedModel: FALLBACK_MODEL,
      fallbackUsed: true,
      failureKind: primaryFailure.kind,
    };
  }

  throw new GenerationFlowError(primaryFailure, fallbackResult.failure);
}

export default function ChatView({ mode, apiKey, selectedModel }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: INITIAL_MESSAGES[mode],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const userMessage: Message = { role: 'user', text: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const callApi = async (retryCount = 0): Promise<void> => {
      try {
        if (shouldUseClientSideChat()) {
          const text = await requestClientSideResponse({
            apiKey,
            messages: newMessages,
            mode,
            selectedModel,
          });
          setMessages([...newMessages, { role: 'model', text }]);
          return;
        }

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.slice(-4),
            mode,
            model: selectedModel,
            promptVariant: 'v2',
            apiKey,
          }),
          signal: AbortSignal.timeout(55_000),
        });

        if (response.status === 429) {
          const delay = Number.parseInt(response.headers.get('Retry-After') ?? '15', 10) + 2;
          if (retryCount < MAX_RATE_LIMIT_RETRIES) {
            for (let s = delay; s > 0; s -= 1) {
              setMessages([
                ...newMessages,
                {
                  role: 'model',
                  text: `분당 요청 한도를 초과했습니다. **${s}초 후 자동 재시도합니다.** (${retryCount + 1}/${MAX_RATE_LIMIT_RETRIES})`,
                },
              ]);
              await wait(1000);
            }
            return callApi(retryCount + 1);
          }
          setMessages([
            ...newMessages,
            { role: 'model', text: '요청 한도를 초과했거나 결제 설정이 필요합니다. 잠시 후 다시 질문해 주세요.\n\n> 해결 방법: [Google AI Studio](https://aistudio.google.com)에서 결제 수단과 사용량 한도를 확인해 주세요.' },
          ]);
          return;
        }

        if (!response.ok) {
          const contentType = response.headers.get('content-type') ?? '';
          if (!contentType.includes('application/json') || response.status === 404) {
            throw new ServerRouteUnavailableError(`Unexpected server response (${response.status}).`);
          }

          const data = await response.json().catch(() => ({ error: '서버 오류' }));
          setMessages([
            ...newMessages,
            { role: 'model', text: `오류가 발생했습니다. 다시 시도해 주세요.\n\n> ${(data as { error?: string }).error ?? response.statusText}` },
          ]);
          return;
        }

        const data = await response.json() as { text?: string };
        setMessages([...newMessages, { role: 'model', text: data.text?.trim() || '응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.' }]);
      } catch (error) {
        if (
          error instanceof ServerRouteUnavailableError ||
          (error instanceof Error && error.name === 'TypeError')
        ) {
          serverRouteUnavailable = true;
          const text = await requestClientSideResponse({
            apiKey,
            messages: newMessages,
            mode,
            selectedModel,
          });
          setMessages([...newMessages, { role: 'model', text }]);
          return;
        }

        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        setMessages([
          ...newMessages,
          {
            role: 'model',
            text: isTimeout
              ? '선택한 모델 응답이 너무 오래 걸려 요청을 종료했습니다. 잠시 후 다시 시도해 주세요.'
              : `오류가 발생했습니다. 다시 시도해 주세요.\n\n> ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
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

  const sourceLabel = mode === 'evaluation' ? '평가 매뉴얼 및 평가 근거 자료' : '전체 지식베이스 문서';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 pb-6 pt-4 sm:p-4 md:px-8 md:pb-8 md:pt-6">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 md:space-y-8">
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
                  지식베이스를 검색하고 답변을 준비하고 있습니다...
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
          {mode === 'evaluation' && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              평가 전용 모드에서는 평가 매뉴얼과 평가 관련 자료만 참고합니다.
            </div>
          )}

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
                onFocus={() => {
                  void loadGenAiModule();
                  void loadKnowledgeModule();
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
              disabled={isLoading || !input.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-14"
              aria-label="메시지 보내기"
            >
              <Send className="ml-0.5 h-5 w-5" />
            </button>
          </form>

          <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
            <Info className="h-3 w-3" />
            답변은 {sourceLabel}를 기반으로 생성됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
