import React from 'react';
import { Scale, ChevronDown } from 'lucide-react';

export type TabId = 'integrated' | 'evaluation' | 'wiki' | 'dashboard' | 'knowledge';

export const TABS: { id: TabId; label: string; shortLabel: string }[] = [
  { id: 'integrated',  label: '통합용',       shortLabel: '통합' },
  { id: 'evaluation',  label: '평가용',       shortLabel: '평가' },
  { id: 'wiki',        label: '평가지표 정리', shortLabel: '지표' },
  { id: 'dashboard',   label: '대시보드',     shortLabel: '대시' },
  { id: 'knowledge',   label: '지식베이스',   shortLabel: '문서' },
];

export const MODELS = [
  { id: 'gemini-3-flash-preview',        label: 'Gemini 3 Flash',      desc: '빠름 · 기본 추천' },
  { id: 'gemini-3.1-pro-preview',        label: 'Gemini 3.1 Pro',      desc: '정확 · 할당량 소모 많음' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', desc: '가볍고 빠름' },
] as const;

export type ModelId = typeof MODELS[number]['id'];
export const MODEL_STORAGE = 'ltc_gemini_model';

const CHAT_TABS: TabId[] = ['integrated', 'evaluation'];

interface TopNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
}

export default function TopNav({ activeTab, onTabChange, selectedModel, onModelChange }: TopNavProps) {
  const isChat = CHAT_TABS.includes(activeTab);

  return (
    <header className="bg-slate-900 text-white shadow-lg z-20 shrink-0">
      <div className="flex items-center h-14 px-4 gap-4">

        {/* 로고 */}
        <div className="flex items-center gap-2 shrink-0">
          <Scale className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-semibold hidden sm:block whitespace-nowrap">장기요양 실무 보조</span>
        </div>

        {/* 구분선 */}
        <div className="w-px h-6 bg-slate-700 shrink-0" />

        {/* 탭 */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>

        {/* 우측 컨트롤 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 모델 선택 (채팅 탭에서만) */}
          {isChat && (
            <div className="relative hidden sm:block">
              <select
                value={selectedModel}
                onChange={(e) => {
                  const val = e.target.value as ModelId;
                  onModelChange(val);
                  localStorage.setItem(MODEL_STORAGE, val);
                }}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-3 pr-7 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          )}

        </div>
      </div>
    </header>
  );
}
