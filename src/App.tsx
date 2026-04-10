import React, { useState } from 'react';
import TopNav, { MODELS, type TabId, type ModelId, MODEL_STORAGE } from './components/TopNav';
import { ApiKeySetupScreen, ApiKeyModal, API_KEY_STORAGE } from './components/ApiKeySetup';
import ChatView from './components/ChatView';
import EvaluationWiki from './components/EvaluationWiki';
import Dashboard from './components/Dashboard';
import KnowledgeBaseView from './components/KnowledgeBaseView';

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(API_KEY_STORAGE));
  const [activeTab, setActiveTab] = useState<TabId>('integrated');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    const saved = localStorage.getItem(MODEL_STORAGE);
    const valid = MODELS.find(m => m.id === saved);
    if (!valid) localStorage.removeItem(MODEL_STORAGE);
    return (valid?.id ?? MODELS[0].id) as ModelId;
  });

  // API 키 없으면 초기 설정 화면
  if (!apiKey) {
    return <ApiKeySetupScreen onSave={setApiKey} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* 상단 네비게이션 */}
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onApiKeyClick={() => setShowKeyModal(true)}
      />

      {/* 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'integrated' && (
          <ChatView mode="integrated" apiKey={apiKey} selectedModel={selectedModel} />
        )}
        {activeTab === 'evaluation' && (
          <ChatView mode="evaluation" apiKey={apiKey} selectedModel={selectedModel} />
        )}
        {activeTab === 'wiki' && <EvaluationWiki />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'knowledge' && <KnowledgeBaseView />}
      </div>

      {/* API 키 변경 모달 */}
      {showKeyModal && (
        <ApiKeyModal
          onSave={(newKey) => { setApiKey(newKey); setShowKeyModal(false); }}
          onClose={() => setShowKeyModal(false)}
        />
      )}
    </div>
  );
}
