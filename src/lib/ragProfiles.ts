import type { RetrievalFeatureFlags, RetrievalProfile } from './ragTypes';

export const DEFAULT_RETRIEVAL_PROFILES: RetrievalProfile[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: '기본 운영 프로필. 품질과 응답 안정성을 균형 있게 유지합니다.',
    queryProcessing: {
      rewrite: true,
      clarify: true,
      hyde: true,
      decompose: true,
    },
    retrieval: {
      sectionRouting: true,
      reranker: true,
      externalElasticsearch: true,
      scopeBoosts: true,
    },
    guardrails: {
      piiMasking: true,
      promptInjection: true,
      citationWarning: true,
      hallucinationSignal: true,
      abstainOnLowConfidence: true,
    },
    cache: {
      normalization: true,
      hyde: true,
      retrieval: true,
      answer: true,
      fallback: true,
    },
    weights: {
      lexical: 1,
      vector: 1,
      rerank: 1,
      section: 0.7,
    },
  },
  {
    id: 'precision',
    label: 'Precision',
    description: '평가/법령형 질의에서 근거 정확도와 인용 우선순위를 더 강하게 반영합니다.',
    queryProcessing: {
      rewrite: true,
      clarify: true,
      hyde: false,
      decompose: false,
    },
    retrieval: {
      sectionRouting: true,
      reranker: true,
      externalElasticsearch: true,
      scopeBoosts: true,
    },
    guardrails: {
      piiMasking: true,
      promptInjection: true,
      citationWarning: true,
      hallucinationSignal: true,
      abstainOnLowConfidence: true,
    },
    cache: {
      normalization: true,
      hyde: false,
      retrieval: true,
      answer: true,
      fallback: true,
    },
    weights: {
      lexical: 1.15,
      vector: 0.85,
      rerank: 1.2,
      section: 1,
    },
  },
  {
    id: 'recall',
    label: 'Recall',
    description: '질문 변형과 탐색 범위를 넓혀 실무형/구어체 질의 recall을 우선합니다.',
    queryProcessing: {
      rewrite: true,
      clarify: false,
      hyde: true,
      decompose: true,
    },
    retrieval: {
      sectionRouting: true,
      reranker: true,
      externalElasticsearch: true,
      scopeBoosts: true,
    },
    guardrails: {
      piiMasking: true,
      promptInjection: true,
      citationWarning: true,
      hallucinationSignal: true,
      abstainOnLowConfidence: true,
    },
    cache: {
      normalization: true,
      hyde: true,
      retrieval: true,
      answer: false,
      fallback: true,
    },
    weights: {
      lexical: 0.95,
      vector: 1.15,
      rerank: 0.95,
      section: 0.75,
    },
  },
];

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function listRetrievalProfiles(): RetrievalProfile[] {
  return DEFAULT_RETRIEVAL_PROFILES.map((profile) => structuredClone(profile));
}

export function getRetrievalProfile(profileId: string | undefined): RetrievalProfile {
  return (
    DEFAULT_RETRIEVAL_PROFILES.find((profile) => profile.id === profileId) ??
    DEFAULT_RETRIEVAL_PROFILES[0]
  );
}

export function getRetrievalFeatureFlags(profile: RetrievalProfile): RetrievalFeatureFlags {
  return {
    queryRewrite: profile.queryProcessing.rewrite,
    queryClarification: profile.queryProcessing.clarify,
    hyde: profile.queryProcessing.hyde,
    decompose: profile.queryProcessing.decompose,
    sectionRouting: profile.retrieval.sectionRouting,
    reranker: profile.retrieval.reranker,
    cache: Object.values(profile.cache).some(Boolean),
    guardrails: Object.values(profile.guardrails).some(Boolean),
    externalElasticsearch: profile.retrieval.externalElasticsearch,
  };
}

export function applyRetrievalFeatureOverrides(
  profile: RetrievalProfile,
  overrides: Partial<RetrievalFeatureFlags> | undefined,
): RetrievalProfile {
  if (!overrides || Object.keys(overrides).length === 0) {
    return structuredClone(profile);
  }

  const next = structuredClone(profile);

  next.queryProcessing.rewrite = coerceBoolean(overrides.queryRewrite, next.queryProcessing.rewrite);
  next.queryProcessing.clarify = coerceBoolean(overrides.queryClarification, next.queryProcessing.clarify);
  next.queryProcessing.hyde = coerceBoolean(overrides.hyde, next.queryProcessing.hyde);
  next.queryProcessing.decompose = coerceBoolean(overrides.decompose, next.queryProcessing.decompose);

  next.retrieval.sectionRouting = coerceBoolean(overrides.sectionRouting, next.retrieval.sectionRouting);
  next.retrieval.reranker = coerceBoolean(overrides.reranker, next.retrieval.reranker);
  next.retrieval.externalElasticsearch = coerceBoolean(
    overrides.externalElasticsearch,
    next.retrieval.externalElasticsearch,
  );

  const cacheEnabled = coerceBoolean(overrides.cache, Object.values(next.cache).some(Boolean));
  next.cache = {
    normalization: cacheEnabled && next.cache.normalization,
    hyde: cacheEnabled && next.cache.hyde,
    retrieval: cacheEnabled && next.cache.retrieval,
    answer: cacheEnabled && next.cache.answer,
    fallback: cacheEnabled && next.cache.fallback,
  };

  const guardrailEnabled = coerceBoolean(overrides.guardrails, Object.values(next.guardrails).some(Boolean));
  next.guardrails = {
    piiMasking: guardrailEnabled && next.guardrails.piiMasking,
    promptInjection: guardrailEnabled && next.guardrails.promptInjection,
    citationWarning: guardrailEnabled && next.guardrails.citationWarning,
    hallucinationSignal: guardrailEnabled && next.guardrails.hallucinationSignal,
    abstainOnLowConfidence: guardrailEnabled && next.guardrails.abstainOnLowConfidence,
  };

  return next;
}

export function resolveInitialRetrievalProfileId(): string {
  const requested = process.env.RAG_ACTIVE_PROFILE?.trim();
  return getRetrievalProfile(requested).id;
}
