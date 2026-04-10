import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Scale, Info, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
import { searchKnowledge, allKnowledgeFiles, evalKnowledgeFiles } from '../lib/knowledge';
import type { ModelId } from './TopNav';

import systemPromptRaw from '/system_prompt.md?raw';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ChatViewProps {
  mode: 'integrated' | 'evaluation';
  apiKey: string;
  selectedModel: ModelId;
}

export default function ChatView({ mode, apiKey, selectedModel }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: mode === 'integrated'
        ? '안녕하세요. 장기요양기관 실무 보조 어시스턴트입니다.\n\n시스템에 등록된 **전체 법령·고시·평가기준 문서**에만 근거하여 엄격하고 보수적으로 답변해 드립니다.\n\n질문하실 내용을 입력해 주세요.'
        : '안녕하세요. **평가 전용** 어시스턴트입니다.\n\n2026년 주야간보호 평가매뉴얼 및 평가 후기 자료에만 근거하여 답변해 드립니다.\n\n평가 관련 질문을 입력해 주세요.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 탭 전환 시 대화 초기화
  useEffect(() => {
    setMessages([{
      role: 'model',
      text: mode === 'integrated'
        ? '안녕하세요. 장기요양기관 실무 보조 어시스턴트입니다.\n\n시스템에 등록된 **전체 법령·고시·평가기준 문서**에만 근거하여 엄격하고 보수적으로 답변해 드립니다.\n\n질문하실 내용을 입력해 주세요.'
        : '안녕하세요. **평가 전용** 어시스턴트입니다.\n\n2026년 주야간보호 평가매뉴얼 및 평가 후기 자료에만 근거하여 답변해 드립니다.\n\n평가 관련 질문을 입력해 주세요.',
    }]);
    setInput('');
  }, [mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const callApi = async (retryCount = 0): Promise<void> => {
      const files = mode === 'evaluation' ? evalKnowledgeFiles : allKnowledgeFiles;
      // RAG: 질문과 관련된 청크만 검색 (원본 server.ts 방식)
      const knowledgeContext = searchKnowledge(files, input);
      const ai = new GoogleGenAI({ apiKey });

      const fullSystemInstruction = `${systemPromptRaw}\n\n---\n# 관련 지식베이스 문서 (아래 문서에만 근거하여 답변할 것)\n${knowledgeContext}`;

      const contents = newMessages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      }));

      try {
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config: { systemInstruction: fullSystemInstruction, temperature: 0.1 },
        });
        setMessages([...newMessages, { role: 'model', text: response.text || '' }]);
      } catch (error: any) {
        const is429 = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota');
        const isKeyError = error.message?.includes('API_KEY') || error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('invalid');

        // 429 오류: 재시도 대기 시간 파싱 후 자동 재시도 (최대 2회)
        if (is429 && retryCount < 2) {
          const delayMatch = error.message?.match(/retry.*?(\d+)s/i) || error.message?.match(/"retryDelay":"(\d+)s"/);
          const delaySec = delayMatch ? parseInt(delayMatch[1]) + 2 : 15;

          // 카운트다운 메시지 표시
          for (let i = delaySec; i > 0; i--) {
            setMessages([...newMessages, {
              role: 'model',
              text: `분당 토큰 한도 초과. **${i}초 후 자동 재시도**합니다... (${retryCount + 1}/2회)`,
            }]);
            await new Promise(r => setTimeout(r, 1000));
          }
          return callApi(retryCount + 1);
        }

        setMessages([...newMessages, {
          role: 'model',
          text: isKeyError
            ? 'API 키가 유효하지 않습니다. 우측 상단의 **API 키** 버튼을 눌러 다시 입력해 주세요.'
            : is429
              ? '분당 토큰 한도를 초과했습니다. 잠시 후 다시 질문해 주세요.\n\n> 해결 방법: [Google AI Studio](https://aistudio.google.com)에서 결제 수단을 등록하면 한도가 크게 늘어납니다.'
              : `오류가 발생했습니다. 다시 시도해 주세요.\n\n> ${error.message}`,
        }]);
      }
    };

    try {
      await callApi();
    } finally {
      setIsLoading(false);
    }
  };

  const sourceLabel = mode === 'evaluation' ? '평가매뉴얼 및 평가 후기 자료' : '전체 지식베이스 문서';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                  <Scale className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`px-5 py-4 rounded-2xl shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.text}</p>
                  ) : (
                    <div className="prose prose-sm md:prose-base prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-semibold prose-a:text-blue-600">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm text-slate-500 font-medium">지식베이스를 검색하고 규정을 검토 중입니다...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력창 */}
      <div className="p-4 md:p-6 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] shrink-0">
        <div className="max-w-4xl mx-auto">
          {mode === 'evaluation' && (
            <div className="mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              평가 전용 모드 — 평가매뉴얼 및 평가 후기 자료만 참조합니다.
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            <div className="relative flex-1 bg-slate-50 border border-slate-300 rounded-2xl shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <textarea
                value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); e.currentTarget.style.height = 'auto'; } }}
                placeholder="질문을 입력하세요... (Shift+Enter: 줄바꿈)"
                className="w-full max-h-48 min-h-[56px] py-4 px-4 bg-transparent border-none resize-none focus:ring-0 text-[15px] text-slate-800 placeholder:text-slate-400"
                rows={1}
                style={{ height: 'auto' }}
              />
            </div>
            <button type="submit" disabled={isLoading || !input.trim()}
              className="h-14 w-14 flex items-center justify-center bg-blue-600 text-white rounded-2xl shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0">
              <Send className="w-5 h-5 ml-1" />
            </button>
          </form>
          <p className="mt-3 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <Info className="w-3 h-3" />
            답변은 {sourceLabel}에 기반하여 생성됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
