import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Loader2, ShieldAlert, Scale, Info, Database, Key, Eye, EyeOff, X, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

// ✅ 빌드 시점에 knowledge 폴더의 모든 .md 파일을 번들에 포함 (서버 불필요)
const knowledgeModules = import.meta.glob('/knowledge/*.md', { query: '?raw', import: 'default', eager: true });

const knowledgeFileList = Object.entries(knowledgeModules).map(([filePath, content]) => ({
  name: filePath.split('/').pop() || filePath,
  size: (content as string).length,
}));

const knowledgeContext = (() => {
  // 분당 입력 토큰 한도(무료 25만 토큰 ≈ 약 18만 글자)를 고려해 최대 크기 제한
  const MAX_CHARS = 160_000;
  let context = '';
  for (const [filePath, content] of Object.entries(knowledgeModules)) {
    const fileName = filePath.split('/').pop() || filePath;
    const chunk = `\n\n--- Document: ${fileName} ---\n${content as string}\n`;
    if (context.length + chunk.length > MAX_CHARS) break;
    context += chunk;
  }
  return context;
})();

const SYSTEM_INSTRUCTION = `당신은 장기요양기관 실무자를 위한 '소스 기반 실무 보조 어시스턴트'입니다.
반드시 다음 규칙을 엄격하게 준수하여 답변하십시오.

1. 핵심 원칙: 제공된 문서의 내용에만 근거하여 답변합니다. 외부 지식이나 사전 학습된 정보는 철저히 배제하십시오.
2. 보수적 답변: 제공된 문서에서 근거를 찾을 수 없는 질문에는 반드시 "확인 불가"라고 답변하십시오. 추측하거나 지어내지 마십시오.
3. 우선순위 규칙: 문서 내 충돌이 있을 경우 다음 우선순위에 따라 정보를 처리하십시오: 법률 > 시행령 > 시행규칙 > 고시 > 매뉴얼.
4. 특이사항:
   - 날짜(시행일, 적용일 등)에 민감하게 반응하여 정확한 기준 시점을 파악하십시오.
   - 소스 문서에 명시되지 않은 서식, 양식, 문안은 절대 창작하지 마십시오.
5. 답변 구조: 반드시 다음 구조를 사용하여 답변하십시오.
   [기준 시점] (관련 규정의 시행일 또는 기준 날짜)
   [결론] (질문에 대한 명확하고 간결한 답변)
   [확정 근거] (결론을 도출한 문서 내 정확한 문구와 조항)
   [실무 해석] (해당 규정을 실무에 어떻게 적용해야 하는지 보수적으로 해석)
   [출처] (문서명, 페이지 번호, 조항 등 구체적인 출처)`;

const API_KEY_STORAGE = 'ltc_gemini_api_key';
const MODEL_STORAGE = 'ltc_gemini_model';

const MODELS = [
  { id: 'gemini-3-flash-preview',      label: 'Gemini 3 Flash Preview',      desc: '빠름 · 기본 추천' },
  { id: 'gemini-3.1-pro-preview',      label: 'Gemini 3.1 Pro Preview',      desc: '가장 정확 · 할당량 소모 많음' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite Preview', desc: '가볍고 빠름 · 간단한 질문용' },
] as const;

type ModelId = typeof MODELS[number]['id'];

// ─────────────────────────────────────────────
// API 키 입력 폼 (초기 설정 & 변경 모달 공용)
// ─────────────────────────────────────────────
function ApiKeyForm({ onSave, onCancel }: { onSave: (key: string) => void; onCancel?: () => void }) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('API 키를 입력해 주세요.');
      return;
    }
    if (!key.trim().startsWith('AIza')) {
      setError('올바른 Gemini API 키 형식이 아닙니다. (AIza...로 시작)');
      return;
    }
    localStorage.setItem(API_KEY_STORAGE, key.trim());
    onSave(key.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Gemini API 키</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(''); }}
            placeholder="AIza..."
            className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700 block mb-1">API 키 발급 방법</strong>
        1.{' '}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Google AI Studio
        </a>{' '}
        접속<br />
        2. "Create API key" 클릭 후 복사<br />
        3. 위 입력창에 붙여넣기
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          저장하기
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center">
        API 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────
// 초기 설정 전체화면
// ─────────────────────────────────────────────
function ApiKeySetupScreen({ onSave }: { onSave: (key: string) => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">장기요양 실무 보조</h1>
            <p className="text-xs text-slate-500">소스 기반 AI 어시스턴트</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-4 mb-6">
          시작하려면 본인의 Google Gemini API 키를 입력해 주세요.
          키는 이 기기의 브라우저에만 저장되며 서버로 전송되지 않습니다.
        </p>
        <ApiKeyForm onSave={onSave} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 앱
// ─────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(API_KEY_STORAGE));
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    const saved = localStorage.getItem(MODEL_STORAGE);
    // localStorage에 저장된 값이 현재 목록에 없으면 기본값으로 초기화
    const valid = MODELS.find(m => m.id === saved);
    if (!valid) localStorage.removeItem(MODEL_STORAGE);
    return (valid?.id ?? MODELS[0].id) as ModelId;
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: '안녕하세요. 장기요양기관 실무 보조 어시스턴트입니다.\n\n시스템에 등록된 법령, 고시, 평가기준 문서에만 근거하여 엄격하고 보수적으로 답변해 드립니다.\n\n질문하실 내용을 입력해 주세요.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // API 키 없으면 설정 화면 표시
  if (!apiKey) {
    return <ApiKeySetupScreen onSave={setApiKey} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });

      const contents = newMessages.map((msg, idx) => {
        const isLastUser = msg.role === 'user' && idx === newMessages.length - 1;
        return {
          role: msg.role,
          parts: [{
            text: isLastUser
              ? `[System: The following are the knowledge base documents you must strictly base your answer on.]\n${knowledgeContext}\n\n[User Question]\n${msg.text}`
              : msg.text,
          }],
        };
      });

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
        },
      });

      setMessages([...newMessages, { role: 'model', text: response.text || '' }]);
    } catch (error: any) {
      const isKeyError =
        error.message?.includes('API_KEY') ||
        error.message?.includes('401') ||
        error.message?.includes('403') ||
        error.message?.includes('invalid');
      setMessages([...newMessages, {
        role: 'model',
        text: isKeyError
          ? 'API 키가 유효하지 않습니다. 우측 상단의 **API 키 변경** 버튼을 눌러 올바른 키를 다시 입력해 주세요.'
          : `오류가 발생했습니다. 다시 시도해 주세요.\n\n> ${error.message}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">

      {/* ── 사이드바 ── */}
      <div className="w-80 bg-slate-900 text-slate-50 flex flex-col shadow-xl z-10 hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <Scale className="w-6 h-6 text-blue-400" />
            <h1 className="text-lg font-semibold tracking-tight">장기요양 실무 보조</h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            등록된 지식베이스 문서에만 근거하여 엄격하게 답변하는 소스 기반 AI 어시스턴트입니다.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              지식베이스 문서 ({knowledgeFileList.length})
            </h2>
          </div>
          <ul className="space-y-3">
            {knowledgeFileList.map((file, idx) => (
              <li key={idx} className="flex flex-col gap-1 bg-slate-800/50 p-3 rounded-md border border-slate-700/50">
                <div className="flex items-start gap-3 text-sm">
                  <FileText className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <span className="truncate text-slate-300" title={file.name}>{file.name}</span>
                </div>
                <div className="pl-7 text-[10px] text-slate-500">{formatBytes(file.size)}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* 모델 선택 */}
        <div className="px-6 pb-4 border-t border-slate-800 pt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">AI 모델</p>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => {
                const val = e.target.value as ModelId;
                setSelectedModel(val);
                localStorage.setItem(MODEL_STORAGE, val);
              }}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {MODELS.find(m => m.id === selectedModel)?.desc}
          </p>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-start gap-3 text-xs text-slate-400 bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              본 AI는 외부 지식을 배제하고 오직 지식베이스 문서만 참조합니다.
              법적 효력을 갖는 최종 판단은 반드시 원본 문서를 직접 확인하시기 바랍니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── 메인 채팅 영역 ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* 헤더 */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3 md:hidden">
            <Scale className="w-5 h-5 text-blue-600" />
            <h1 className="text-base font-semibold">장기요양 실무 보조</h1>
          </div>
          <div className="hidden md:block" />
          <button
            onClick={() => setShowKeyModal(true)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
            API 키 변경
          </button>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-8">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Scale className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
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
        <div className="p-4 md:p-6 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)]">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
              <div className="relative flex-1 bg-slate-50 border border-slate-300 rounded-2xl shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                      e.currentTarget.style.height = 'auto';
                    }
                  }}
                  placeholder="질문을 입력하세요... (Shift+Enter: 줄바꿈)"
                  className="w-full max-h-48 min-h-[56px] py-4 px-4 bg-transparent border-none resize-none focus:ring-0 text-[15px] text-slate-800 placeholder:text-slate-400"
                  rows={1}
                  style={{ height: 'auto' }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="h-14 w-14 flex items-center justify-center bg-blue-600 text-white rounded-2xl shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </form>
            <div className="mt-3 text-center">
              <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <Info className="w-3 h-3" />
                답변은 좌측에 등록된 지식베이스 문서에 기반하여 생성됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── API 키 변경 모달 ── */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">API 키 변경</h2>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ApiKeyForm
              onSave={(newKey) => {
                setApiKey(newKey);
                setShowKeyModal(false);
              }}
              onCancel={() => setShowKeyModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
