import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  GitBranch,
  Orbit,
  SearchCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { ConfidenceLevel, RetrievalDiagnostics, RetrievalStageTrace } from '../lib/ragTypes';

interface RetrievalTracePanelProps {
  confidence?: ConfidenceLevel;
  retrieval: RetrievalDiagnostics;
}

function getConfidenceLabel(confidence?: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return '신뢰도 높음';
    case 'medium':
      return '신뢰도 보통';
    case 'low':
      return '신뢰도 낮음';
    default:
      return '신뢰도 미표기';
  }
}

function getConfidenceTone(confidence?: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'low':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}

function getReadinessLabel(readiness: RetrievalDiagnostics['retrievalReadiness']): string {
  switch (readiness) {
    case 'hybrid_ready':
      return '하이브리드 준비 완료';
    case 'hybrid_partial':
      return '하이브리드 준비 중';
    case 'lexical_only':
      return '어휘 검색 우선';
  }
}

function getReadinessTone(readiness: RetrievalDiagnostics['retrievalReadiness']): string {
  switch (readiness) {
    case 'hybrid_ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'hybrid_partial':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'lexical_only':
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getRetrievalModeLabel(mode: RetrievalDiagnostics['selectedRetrievalMode']): string {
  switch (mode) {
    case 'local':
      return '로컬 검색';
    case 'workflow-global':
      return '워크플로 확장 검색';
    case 'drift-refine':
      return '질의 보정 검색';
  }
}

function getStageLabel(stage: RetrievalStageTrace['stage']): string {
  switch (stage) {
    case 'query_normalization':
      return '질의 정규화';
    case 'lexical_candidates':
      return '어휘 후보 수집';
    case 'vector_candidates':
      return '벡터 후보 수집';
    case 'fusion':
      return '후보 융합';
    case 'document_diversification':
      return '문서 다양화';
    case 'answer_evidence_gate':
      return '답변 근거 게이트';
  }
}

function TraceBadge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${tone}`}>{children}</span>;
}

function SectionShell({
  icon: Icon,
  title,
  children,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      </div>
      {children}
    </section>
  );
}

export default function RetrievalTracePanel({ confidence, retrieval }: RetrievalTracePanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const basisCoverage = useMemo(
    () => [
      { label: '법적 근거', value: retrieval.basisCoverage.legal },
      { label: '평가 근거', value: retrieval.basisCoverage.evaluation },
      { label: '실무 근거', value: retrieval.basisCoverage.practical },
    ],
    [retrieval.basisCoverage.evaluation, retrieval.basisCoverage.legal, retrieval.basisCoverage.practical],
  );

  return (
    <section className="mt-3 w-full overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fafc] shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-white/70 sm:px-5"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">분석 경과</p>
              <p className="mt-1 text-xs text-slate-500">
                검색 단계 {retrieval.stageTrace.length}개 · 계획 단계 {retrieval.plannerTrace.length}개 · 근거 문서{' '}
                {retrieval.finalEvidenceDocuments.length}개
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {confidence && <TraceBadge tone={getConfidenceTone(confidence)}>{getConfidenceLabel(confidence)}</TraceBadge>}
            <TraceBadge tone="border-slate-200 bg-white text-slate-700">
              {getRetrievalModeLabel(retrieval.selectedRetrievalMode)}
            </TraceBadge>
            <TraceBadge tone={getReadinessTone(retrieval.retrievalReadiness)}>
              {getReadinessLabel(retrieval.retrievalReadiness)}
            </TraceBadge>
            <TraceBadge
              tone={
                retrieval.fallbackTriggered
                  ? 'border-violet-200 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-slate-100 text-slate-600'
              }
            >
              {retrieval.fallbackTriggered ? '법령 fallback 사용' : '로컬 근거 우선'}
            </TraceBadge>
          </div>
        </div>

        <span className="mt-1 rounded-full border border-slate-200 bg-white p-2 text-slate-500">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="space-y-4 border-t border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionShell icon={SearchCheck} title="검색 흐름">
              <div className="space-y-3">
                {retrieval.stageTrace.map((stage) => (
                  <div key={`${stage.stage}-${stage.inputCount}-${stage.outputCount}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{getStageLabel(stage.stage)}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                        {stage.inputCount} → {stage.outputCount}
                      </span>
                    </div>
                    {stage.notes && stage.notes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {stage.notes.map((note) => (
                          <span key={`${stage.stage}-${note}`} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">
                            {note}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionShell>

            <SectionShell icon={GitBranch} title="응답 계획">
              <div className="space-y-3">
                {retrieval.plannerTrace.length > 0 ? (
                  retrieval.plannerTrace.map((entry) => (
                    <div key={`${entry.step}-${entry.detail}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">{entry.step}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{entry.detail}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-500">응답 계획 상세 로그가 없습니다.</p>
                )}
              </div>
            </SectionShell>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionShell icon={Orbit} title="질의 해석">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">정규화 단계</p>
                  <div className="mt-2 space-y-2">
                    {retrieval.normalizationTrace.length > 0 ? (
                      retrieval.normalizationTrace.map((entry) => (
                        <div key={`${entry.step}-${entry.detail}`} className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="text-sm font-semibold text-slate-900">{entry.step}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{entry.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">질의 정규화 로그가 없습니다.</p>
                    )}
                  </div>
                </div>

                {retrieval.aliasResolutions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">별칭 해석</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {retrieval.aliasResolutions.map((entry) => (
                        <span
                          key={`${entry.alias}-${entry.canonical}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
                        >
                          {entry.alias} → {entry.canonical}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {retrieval.parsedLawRefs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">법령 참조</p>
                    <div className="mt-2 space-y-2">
                      {retrieval.parsedLawRefs.map((lawRef) => (
                        <div key={`${lawRef.raw}-${lawRef.canonicalLawName}`} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900">{lawRef.canonicalLawName}</p>
                          <p className="mt-1">
                            원문: {lawRef.raw}
                            {lawRef.article ? ` · ${lawRef.article}` : ''}
                            {lawRef.clause ? ` · ${lawRef.clause}` : ''}
                            {lawRef.item ? ` · ${lawRef.item}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionShell>

            <SectionShell icon={CircleDot} title="근거 범위">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {basisCoverage.map((bucket) => (
                    <span key={bucket.label} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                      {bucket.label} {bucket.value}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">최종 근거 문서</p>
                  {retrieval.finalEvidenceDocuments.length > 0 ? (
                    retrieval.finalEvidenceDocuments.map((documentPath) => (
                      <p key={documentPath} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {documentPath}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">최종 근거 문서가 표시되지 않았습니다.</p>
                  )}
                </div>
              </div>
            </SectionShell>
          </div>

          {retrieval.fallbackTriggered && retrieval.fallbackSources.length > 0 && (
            <SectionShell icon={ShieldAlert} title="Fallback 참조">
              <div className="space-y-3">
                {retrieval.fallbackSources.map((source) => (
                  <div key={`${source.source}-${source.query}`} className="rounded-2xl border border-violet-100 bg-violet-50/70 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{source.title}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700">
                        {source.cached ? 'cache' : source.source}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{source.query}</p>
                  </div>
                ))}
              </div>
            </SectionShell>
          )}
        </div>
      )}
    </section>
  );
}
