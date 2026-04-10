import React, { useState } from 'react';
import { Eye, EyeOff, Scale, Key } from 'lucide-react';

export const API_KEY_STORAGE = 'ltc_gemini_api_key';

// ─────────────────────────────────────────────
// API 키 입력 폼 (초기 설정 & 변경 모달 공용)
// ─────────────────────────────────────────────
export function ApiKeyForm({ onSave, onCancel }: { onSave: (key: string) => void; onCancel?: () => void }) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) { setError('API 키를 입력해 주세요.'); return; }
    if (!key.trim().startsWith('AIza')) { setError('올바른 Gemini API 키 형식이 아닙니다. (AIza...로 시작)'); return; }
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
          <button type="button" onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700 block mb-1">API 키 발급 방법</strong>
        1.{' '}<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>{' '}접속<br />
        2. "Create API key" 클릭 후 복사<br />
        3. 위 입력창에 붙여넣기
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            취소
          </button>
        )}
        <button type="submit"
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          저장하기
        </button>
      </div>
      <p className="text-xs text-slate-400 text-center">API 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.</p>
    </form>
  );
}

// ─────────────────────────────────────────────
// 초기 설정 전체화면
// ─────────────────────────────────────────────
export function ApiKeySetupScreen({ onSave }: { onSave: (key: string) => void }) {
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
          시작하려면 본인의 Google Gemini API 키를 입력해 주세요.<br />
          키는 이 기기의 브라우저에만 저장되며 서버로 전송되지 않습니다.
        </p>
        <ApiKeyForm onSave={onSave} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// API 키 변경 모달
// ─────────────────────────────────────────────
export function ApiKeyModal({ onSave, onClose }: { onSave: (key: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">API 키 변경</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <ApiKeyForm onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}
