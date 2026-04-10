import React, { useEffect, useRef, useState } from 'react';
import { Info, Loader2, Scale, Send, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { buildVariantSystemInstruction, type PromptSourceSet } from '../lib/promptAssembly';
import type { ModelId } from './TopNav';

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
    '안녕하세요. 장기요양기관 실무 보조 어시스턴트입니다.\n\n시스템에 등록된 **전체 법령·고시·평가 기준 문서**만을 근거로 엄격하고 보수적으로 답변드립니다.\n\n질문하실 내용을 입력해 주세요.',
  evaluation:
    '안녕하세요. **평가 전용** 어시스턴트입니다.\n\n2026년 주야간보호 평가매뉴얼과 평가 관련 자료만을 근거로 답변드립니다.\n\n평가 관련 질문을 입력해 주세요.',
};

let knowledgeModulePromise: Promise<KnowledgeModule> | null = null;
let genAiModulePromise: Promise<GenAiModule> | null = null;

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
      const [{ GoogleGenAI }, knowledgeModule] = await Promise.all([
        loadGenAiModule(),
        loadKnowledgeModule(),
      ]);

      const files = mode === 'evaluation' ? knowledgeModule.evalKnowledgeFiles : knowledgeModule.allKnowledgeFiles;
      const knowledgeContext = knowledgeModule.searchKnowledge(files, trimmed);
      const ai = new GoogleGenAI({ apiKey });

      const fullSystemInstruction = buildVariantSystemInstruction({
        mode,
        variant: 'v2',
        knowledgeContext,
        sources: promptSources,
      });

      const contents = newMessages.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      }));

      try {
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config: { systemInstruction: fullSystemInstruction, temperature: 0.1 },
        });

        setMessages([...newMessages, { role: 'model', text: response.text || '' }]);
      } catch (error: any) {
        const errorMessage = error?.message ?? '알 수 없는 오류';
        const is429 =
          errorMessage.includes('429') ||
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('quota');
        const isKeyError =
          errorMessage.includes('API_KEY') ||
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('invalid');

        if (is429 && retryCount < 2) {
          const delayMatch = errorMessage.match(/retry.*?(\d+)s/i) || errorMessage.match(/"retryDelay":"(\d+)s"/);
          const delaySeconds = delayMatch ? Number.parseInt(delayMatch[1], 10) + 2 : 15;

          for (let seconds = delaySeconds; seconds > 0; seconds -= 1) {
            setMessages([
              ...newMessages,
              {
                role: 'model',
                text: `분당 요청 한도를 초과했습니다. **${seconds}초 후 자동 재시도**합니다. (${retryCount + 1}/2회)`,
              },
            ]);
            await wait(1000);
          }

          return callApi(retryCount + 1);
        }

        setMessages([
          ...newMessages,
          {
            role: 'model',
            text: isKeyError
              ? 'API 키가 유효하지 않습니다. 상단 설정에서 API 키를 다시 입력해 주세요.'
              : is429
                ? '분당 요청 한도를 초과했습니다. 잠시 후 다시 질문해 주세요.\n\n> 해결 방법: [Google AI Studio](https://aistudio.google.com)에서 결제 수단을 등록하면 한도가 더 넓어질 수 있습니다.'
                : `오류가 발생했습니다. 다시 시도해 주세요.\n\n> ${errorMessage}`,
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
                <span className="text-sm font-medium text-slate-500">지식베이스를 검토하고 답변을 준비하는 중입니다...</span>
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
