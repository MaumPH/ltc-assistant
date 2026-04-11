import React, { useState } from 'react';
import { Eye, EyeOff, Key, Scale } from 'lucide-react';

export const API_KEY_STORAGE = 'ltc_gemini_api_key';

interface ApiKeyFormProps {
  autoFocus?: boolean;
  onCancel?: () => void;
  onSave: (key: string) => void;
}

export function ApiKeyForm({ autoFocus = true, onCancel, onSave }: ApiKeyFormProps) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

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
        <label className="mb-2 block text-sm font-medium text-slate-700">Gemini API 키</label>

        <div className="relative">
          <input
            autoFocus={autoFocus}
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setError('');
            }}
            placeholder="AIza..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey((previous) => !previous)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
            aria-label={showKey ? 'API 키 숨기기' : 'API 키 보기'}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
        <strong className="mb-1 block text-slate-700">API 키 발급 방법</strong>
        1.{' '}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Google AI Studio
        </a>{' '}
        접속
        <br />
        2. &quot;Create API key&quot; 클릭 후 복사
        <br />
        3. 위 입력창에 붙여넣기
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          저장하기
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">
        API 키는 이 브라우저에 저장되며, 질문 처리 시 설정된 RAG 백엔드로만 전송됩니다.
      </p>
    </form>
  );
}

export function ApiKeySetupScreen({ onSave }: { onSave: (key: string) => void }) {
  return (
    <div className="app-viewport overflow-y-auto bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">장기요양 실무 보조</h1>
              <p className="text-xs text-slate-500">소스 기반 AI 어시스턴트</p>
            </div>
          </div>

          <p className="mb-6 mt-4 text-sm leading-6 text-slate-500">
            시작하려면 본인의 Google Gemini API 키를 입력해 주세요.
            <br />
            키는 이 기기에 저장되며, 검색과 답변 조립을 수행하는 RAG 백엔드로만 전달됩니다.
          </p>

          <ApiKeyForm onSave={onSave} />
        </div>
      </div>
    </div>
  );
}

export function ApiKeyModal({ onClose, onSave }: { onClose: () => void; onSave: (key: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        className="w-full rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">API 키 변경</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-slate-400 transition-colors hover:text-slate-600"
            aria-label="닫기"
          >
            &times;
          </button>
        </div>

        <ApiKeyForm onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}
