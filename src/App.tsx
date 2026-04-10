import React, { Suspense, lazy, startTransition, useEffect, useState } from 'react';
import TopNav, {
  MODELS,
  MODEL_STORAGE,
  MobileSettingsSheet,
  type ModelId,
  type TabId,
} from './components/TopNav';
import { ApiKeyModal, API_KEY_STORAGE, ApiKeySetupScreen } from './components/ApiKeySetup';

const ChatView = lazy(() => import('./components/ChatView'));
const EvaluationWiki = lazy(() => import('./components/EvaluationWiki'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const KnowledgeBaseView = lazy(() => import('./components/KnowledgeBaseView'));

function readStoredApiKey() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(API_KEY_STORAGE);
}

function readStoredModel(): ModelId {
  if (typeof window === 'undefined') return MODELS[0].id as ModelId;

  const saved = localStorage.getItem(MODEL_STORAGE);
  const valid = MODELS.find((model) => model.id === saved);

  if (!valid && saved) {
    localStorage.removeItem(MODEL_STORAGE);
  }

  return (valid?.id ?? MODELS[0].id) as ModelId;
}

function ScreenLoader() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
        화면을 불러오는 중입니다.
      </div>
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(readStoredApiKey);
  const [activeTab, setActiveTab] = useState<TabId>('integrated');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(readStoredModel);

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE, selectedModel);
  }, [selectedModel]);

  if (!apiKey) {
    return <ApiKeySetupScreen onSave={setApiKey} />;
  }

  const handleTabChange = (tab: TabId) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  const handleApiKeySave = (newKey: string) => {
    setApiKey(newKey);
    setShowKeyModal(false);
    setShowMobileSettings(false);
  };

  return (
    <div className="app-shell flex flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
      <TopNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onApiKeyClick={() => setShowKeyModal(true)}
        onMobileSettingsClick={() => setShowMobileSettings(true)}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<ScreenLoader />}>
          {activeTab === 'integrated' && (
            <ChatView mode="integrated" apiKey={apiKey} selectedModel={selectedModel} />
          )}
          {activeTab === 'evaluation' && (
            <ChatView mode="evaluation" apiKey={apiKey} selectedModel={selectedModel} />
          )}
          {activeTab === 'wiki' && <EvaluationWiki />}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'knowledge' && <KnowledgeBaseView />}
        </Suspense>
      </div>

      {showMobileSettings && (
        <MobileSettingsSheet
          isOpen={showMobileSettings}
          hasApiKey={Boolean(apiKey)}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onApiKeySave={handleApiKeySave}
          onClose={() => setShowMobileSettings(false)}
        />
      )}

      {showKeyModal && (
        <ApiKeyModal
          onSave={handleApiKeySave}
          onClose={() => setShowKeyModal(false)}
        />
      )}
    </div>
  );
}
