import React, { useState } from 'react';
import TopNav, { MODELS, type TabId, type ModelId, MODEL_STORAGE } from './components/TopNav';
import ChatView from './components/ChatView';
import EvaluationWiki from './components/EvaluationWiki';
import Dashboard from './components/Dashboard';
import KnowledgeBaseView from './components/KnowledgeBaseView';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('integrated');
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    const saved = localStorage.getItem(MODEL_STORAGE);
    const valid = MODELS.find(m => m.id === saved);
    if (!valid) localStorage.removeItem(MODEL_STORAGE);
    return (valid?.id ?? MODELS[0].id) as ModelId;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* 상단 네비게이션 */}
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />

      {/* 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'integrated' && (
          <ChatView mode="integrated" selectedModel={selectedModel} />
        )}
        {activeTab === 'evaluation' && (
          <ChatView mode="evaluation" selectedModel={selectedModel} />
        )}
        {activeTab === 'wiki' && <EvaluationWiki />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'knowledge' && <KnowledgeBaseView />}
      </div>
    </div>
  );
}
