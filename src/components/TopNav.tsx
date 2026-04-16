import React, { useEffect, useState } from 'react';
import { Bot, ChevronDown, Key, Scale, Settings2, X } from 'lucide-react';
import { ApiKeyForm } from './ApiKeySetup';
import { CHAT_MODELS, MODEL_STORAGE, type ChatModelId } from '../lib/chatModels';

export type TabId = 'home' | 'integrated' | 'evaluation' | 'wiki' | 'dashboard' | 'knowledge';

export const TABS: { id: TabId; label: string; shortLabel: string }[] = [
  { id: 'home', label: '메인페이지', shortLabel: '홈' },
  { id: 'integrated', label: '통합채팅', shortLabel: '통합' },
  { id: 'evaluation', label: '평가채팅', shortLabel: '평가' },
  { id: 'wiki', label: '평가 지침 정리', shortLabel: '지침' },
  { id: 'dashboard', label: '대시보드', shortLabel: '대시' },
  { id: 'knowledge', label: '지식기반', shortLabel: '문서' },
];

export const MODELS = CHAT_MODELS.map((model) => ({
  id: model.id,
  label: model.label,
  desc: model.description,
}));

export type ModelId = ChatModelId;
export { MODEL_STORAGE };

const CHAT_TABS: TabId[] = ['integrated', 'evaluation'];

interface TopNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
  onApiKeyClick: () => void;
  onMobileSettingsClick: () => void;
}

interface MobileSettingsSheetProps {
  isOpen: boolean;
  hasApiKey: boolean;
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
  onApiKeyClear: () => void;
  onApiKeySave: (key: string) => void;
  onClose: () => void;
}

function ModelOption({
  description,
  isSelected,
  label,
  onClick,
}: {
  description: string;
  isSelected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <p className={`mt-1 text-xs ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>{description}</p>
        </div>
        <span
          className={`h-4 w-4 rounded-full border ${
            isSelected ? 'border-blue-500 bg-blue-500 shadow-[inset_0_0_0_3px_white]' : 'border-slate-300 bg-white'
          }`}
        />
      </div>
    </button>
  );
}

export function MobileSettingsSheet({
  hasApiKey,
  isOpen,
  onApiKeyClear,
  onApiKeySave,
  onClose,
  onModelChange,
  selectedModel,
}: MobileSettingsSheetProps) {
  const [showApiEditor, setShowApiEditor] = useState(!hasApiKey);

  useEffect(() => {
    if (isOpen) {
      setShowApiEditor(!hasApiKey);
    }
  }, [hasApiKey, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="모바일 설정">
      <button type="button" aria-label="설정 닫기" className="absolute inset-0 bg-slate-950/50" onClick={onClose} />

      <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[28px] bg-white shadow-2xl">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">모바일 설정</h2>
            <p className="mt-1 text-xs text-slate-500">모델 선택과 개인 답변 키 관리를 한 번에 할 수 있습니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="설정 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="max-h-[82dvh] overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="space-y-6">
            <section className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Bot className="h-4 w-4 text-blue-600" />
                채팅 모델
              </div>
              <p className="text-xs leading-5 text-slate-500">대화 생성에 사용할 모델을 선택하세요.</p>

              <div className="space-y-2">
                {MODELS.map((model) => (
                  <ModelOption
                    key={model.id}
                    description={model.desc}
                    isSelected={selectedModel === model.id}
                    label={model.label}
                    onClick={() => onModelChange(model.id)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Key className="h-4 w-4 text-blue-600" />
                    개인 답변 키
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    검색용 서버 임베딩 키와 별개로, 최종 답변 생성에만 사용됩니다.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    hasApiKey ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {hasApiKey ? '등록됨' : '미등록'}
                </span>
              </div>

              {hasApiKey && !showApiEditor && (
                <button
                  type="button"
                  onClick={() => setShowApiEditor(true)}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
                >
                  개인 키 변경
                </button>
              )}

              {showApiEditor && (
                <ApiKeyForm
                  autoFocus={!hasApiKey}
                  hasStoredKey={hasApiKey}
                  onCancel={hasApiKey ? () => setShowApiEditor(false) : undefined}
                  onClear={
                    hasApiKey
                      ? () => {
                          onApiKeyClear();
                          setShowApiEditor(false);
                        }
                      : undefined
                  }
                  onSave={(key) => {
                    onApiKeySave(key);
                  }}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TopNav({
  activeTab,
  onApiKeyClick,
  onMobileSettingsClick,
  onModelChange,
  onTabChange,
  selectedModel,
}: TopNavProps) {
  const isChat = CHAT_TABS.includes(activeTab);

  return (
    <header className="z-20 shrink-0 bg-slate-900 text-white shadow-lg">
      <div className="flex h-14 items-center gap-3 px-3 sm:gap-4 sm:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <Scale className="h-5 w-5 text-blue-400" />
          <span className="hidden whitespace-nowrap text-sm font-semibold sm:block font-brand">장기요양 물어보세요</span>
        </div>

        <div className="hidden h-6 w-px shrink-0 bg-slate-700 sm:block" />

        <nav className="scrollbar-hide flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {isChat && (
            <div className="relative hidden sm:block">
              <select
                value={selectedModel}
                onChange={(event) => onModelChange(event.target.value as ModelId)}
                className="cursor-pointer appearance-none rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-3 pr-7 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
            </div>
          )}

          <button
            type="button"
            onClick={onApiKeyClick}
            className="hidden items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white sm:flex"
          >
            <Key className="h-3.5 w-3.5" />
            <span>개인 키</span>
          </button>

          <button
            type="button"
            onClick={onMobileSettingsClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 sm:hidden"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>설정</span>
          </button>
        </div>
      </div>
    </header>
  );
}
