import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock3,
  GitBranch,
  Layers3,
  Orbit,
  SearchCheck,
  ShieldAlert,
  SlidersHorizontal,
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
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence';
    default:
      return 'Unrated confidence';
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
      return 'Hybrid ready';
    case 'hybrid_partial':
      return 'Hybrid partial';
    case 'lexical_only':
      return 'Lexical only';
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
      return 'Local';
    case 'workflow-global':
      return 'Workflow global';
    case 'drift-refine':
      return 'Drift refine';
  }
}

function getStageLabel(stage: RetrievalStageTrace['stage']): string {
  switch (stage) {
    case 'query_normalization':
      return 'Query normalization';
    case 'lexical_candidates':
      return 'Lexical candidates';
    case 'vector_candidates':
      return 'Vector candidates';
    case 'fusion':
      return 'Fusion';
    case 'document_diversification':
      return 'Document diversification';
    case 'answer_evidence_gate':
      return 'Answer evidence gate';
    case 'hyde_context':
      return 'HyDE context';
    case 'section_routing':
      return 'Section routing';
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
      { label: 'Legal', value: retrieval.basisCoverage.legal },
      { label: 'Evaluation', value: retrieval.basisCoverage.evaluation },
      { label: 'Practical', value: retrieval.basisCoverage.practical },
    ],
    [retrieval.basisCoverage.evaluation, retrieval.basisCoverage.legal, retrieval.basisCoverage.practical],
  );

  const profileFlags = useMemo(
    () => [
      { label: 'rewrite', enabled: retrieval.profile.queryProcessing.rewrite },
      { label: 'clarify', enabled: retrieval.profile.queryProcessing.clarify },
      { label: 'hyde', enabled: retrieval.profile.queryProcessing.hyde },
      { label: 'decompose', enabled: retrieval.profile.queryProcessing.decompose },
      { label: 'tree-routing', enabled: retrieval.profile.retrieval.sectionRouting },
      { label: 'reranker', enabled: retrieval.profile.retrieval.reranker },
      { label: 'elastic', enabled: retrieval.profile.retrieval.externalElasticsearch },
      { label: 'cache', enabled: Object.values(retrieval.profile.cache).some(Boolean) },
      { label: 'guardrails', enabled: Object.values(retrieval.profile.guardrails).some(Boolean) },
    ],
    [retrieval.profile],
  );

  const latencyEntries = useMemo(
    () => [
      ['normalize', retrieval.latency.queryNormalizationMs],
      ['cache', retrieval.latency.cacheLookupMs],
      ['hyde', retrieval.latency.hydeMs],
      ['retrieve', retrieval.latency.retrievalMs],
      ['fallback', retrieval.latency.fallbackMs],
      ['plan', retrieval.latency.planningMs],
      ['answer', retrieval.latency.answerMs],
      ['total', retrieval.latency.totalMs],
    ],
    [retrieval.latency],
  );

  const cacheEntries = useMemo(
    () => Object.entries(retrieval.cacheHits) as Array<[keyof typeof retrieval.cacheHits, boolean]>,
    [retrieval.cacheHits],
  );

  const activeGuardrails = useMemo(
    () => retrieval.guardrails.filter((item) => item.triggered),
    [retrieval.guardrails],
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
              <p className="text-sm font-semibold text-slate-900">Retrieval analysis</p>
              <p className="mt-1 text-xs text-slate-500">
                {retrieval.stageTrace.length} stages, {retrieval.plannerTrace.length} planner steps,{' '}
                {retrieval.finalEvidenceDocuments.length} evidence documents
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
              {retrieval.fallbackTriggered ? 'Law fallback used' : 'Primary evidence flow'}
            </TraceBadge>
            <TraceBadge tone="border-slate-200 bg-white text-slate-700">{retrieval.profile.id}</TraceBadge>
          </div>
        </div>

        <span className="mt-1 rounded-full border border-slate-200 bg-white p-2 text-slate-500">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="space-y-4 border-t border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionShell icon={SearchCheck} title="Search Flow">
              <div className="space-y-3">
                {retrieval.stageTrace.map((stage) => (
                  <div
                    key={`${stage.stage}-${stage.inputCount}-${stage.outputCount}`}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{getStageLabel(stage.stage)}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                        {stage.inputCount} to {stage.outputCount}
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

            <SectionShell icon={GitBranch} title="Planner Trace">
              <div className="space-y-3">
                {retrieval.plannerTrace.length > 0 ? (
                  retrieval.plannerTrace.map((entry) => (
                    <div key={`${entry.step}-${entry.detail}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">{entry.step}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{entry.detail}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-500">No planner trace was recorded.</p>
                )}
              </div>
            </SectionShell>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionShell icon={Orbit} title="Query Analysis">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Normalization</p>
                  <div className="mt-2 space-y-2">
                    {retrieval.normalizationTrace.length > 0 ? (
                      retrieval.normalizationTrace.map((entry) => (
                        <div key={`${entry.step}-${entry.detail}`} className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="text-sm font-semibold text-slate-900">{entry.step}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{entry.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No normalization trace.</p>
                    )}
                  </div>
                </div>

                {retrieval.aliasResolutions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Alias Resolutions</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {retrieval.aliasResolutions.map((entry) => (
                        <span
                          key={`${entry.alias}-${entry.canonical}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
                        >
                          {entry.alias} to {entry.canonical}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {retrieval.parsedLawRefs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Law References</p>
                    <div className="mt-2 space-y-2">
                      {retrieval.parsedLawRefs.map((lawRef) => (
                        <div key={`${lawRef.raw}-${lawRef.canonicalLawName}`} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900">{lawRef.canonicalLawName}</p>
                          <p className="mt-1">{lawRef.raw}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionShell>

            <SectionShell icon={CircleDot} title="Evidence Coverage">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {basisCoverage.map((bucket) => (
                    <span key={bucket.label} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                      {bucket.label} {bucket.value}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Final Evidence Documents</p>
                  {retrieval.finalEvidenceDocuments.length > 0 ? (
                    retrieval.finalEvidenceDocuments.map((documentPath) => (
                      <p key={documentPath} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {documentPath}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No final evidence documents were selected.</p>
                  )}
                </div>
              </div>
            </SectionShell>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionShell icon={SlidersHorizontal} title="Retrieval Profile">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {retrieval.profile.label} <span className="text-slate-400">({retrieval.profile.id})</span>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{retrieval.profile.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {profileFlags.map((flag) => (
                    <span
                      key={flag.label}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        flag.enabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {flag.label}
                    </span>
                  ))}
                </div>

                <div className="grid gap-2 text-sm text-slate-600">
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    lexical {retrieval.profile.weights.lexical.toFixed(2)} / vector {retrieval.profile.weights.vector.toFixed(2)}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    rerank {retrieval.profile.weights.rerank.toFixed(2)} / section {retrieval.profile.weights.section.toFixed(2)}
                  </div>
                </div>
              </div>
            </SectionShell>

            <SectionShell icon={Clock3} title="Latency And Cache">
              <div className="space-y-3">
                <div className="grid gap-2">
                  {latencyEntries.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-700">{label}</span>
                      <span className="text-slate-500">{value} ms</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {cacheEntries.map(([label, hit]) => (
                    <span
                      key={label}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        hit ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {label} {hit ? 'hit' : 'miss'}
                    </span>
                  ))}
                </div>
              </div>
            </SectionShell>

            <SectionShell icon={Layers3} title="Routing And Guardrails">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {retrieval.sectionRouting.enabled ? retrieval.sectionRouting.strategy : 'chunk_only'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{retrieval.sectionRouting.detail}</p>
                </div>

                {retrieval.sectionRouting.selectedSectionTitles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {retrieval.sectionRouting.selectedSectionTitles.map((title) => (
                      <span key={title} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {title}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {activeGuardrails.length > 0 ? (
                    activeGuardrails.map((guardrail) => (
                      <div key={`${guardrail.type}-${guardrail.detail}`} className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{guardrail.type}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700">
                            {guardrail.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{guardrail.detail}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">No guardrail warnings for this response.</p>
                  )}
                </div>
              </div>
            </SectionShell>
          </div>

          {retrieval.fallbackTriggered && retrieval.fallbackSources.length > 0 && (
            <SectionShell icon={ShieldAlert} title="Fallback Sources">
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
