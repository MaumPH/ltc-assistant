import type {
  AgentDecision,
  BasisBucketKey,
  ConfidenceLevel,
  EvidenceBalance,
  IndexStatus,
} from './ragTypes';

const BASIS_BUCKETS: BasisBucketKey[] = ['legal', 'evaluation', 'practical'];

export function describeHybridReadiness(status: IndexStatus): string {
  const { embeddedChunks, totalChunks, ratio } = status.embeddingCoverage;
  const storageDetail =
    status.storageMode === 'postgres'
      ? 'Postgres/pgvector 저장소가 연결되어 있습니다.'
      : `현재 저장소는 ${status.storageMode}이며 pgvector 검색은 사용하지 않습니다.`;

  if (totalChunks <= 0) {
    return `검색 가능한 청크가 없어 하이브리드 검색을 준비할 수 없습니다. ${storageDetail}`;
  }

  if (embeddedChunks <= 0) {
    return `임베딩된 청크가 없습니다. 현재는 exact/lexical 검색만 사용합니다. ${storageDetail}`;
  }

  const percent = `${Math.round(ratio * 1000) / 10}%`;
  if (status.retrievalReadiness === 'hybrid_partial') {
    return `일부 청크만 임베딩되었습니다(${embeddedChunks}/${totalChunks}, ${percent}). 하이브리드 검색은 부분적으로만 사용됩니다. ${storageDetail}`;
  }

  return `하이브리드 검색 준비 완료(${embeddedChunks}/${totalChunks}, ${percent}). exact/lexical/vector 후보를 함께 사용합니다. ${storageDetail}`;
}

export function buildEvidenceBalance(counts: Record<BasisBucketKey, number>): EvidenceBalance {
  const missingBuckets = BASIS_BUCKETS.filter((bucket) => counts[bucket] <= 0);
  return {
    legal: counts.legal,
    evaluation: counts.evaluation,
    practical: counts.practical,
    missingBuckets,
    balanced: missingBuckets.length === 0,
  };
}

export function inferAgentDecision(params: {
  confidence: ConfidenceLevel;
  evidenceCount: number;
  needsClarification?: boolean;
}): AgentDecision {
  if (params.needsClarification) return 'clarify';
  if (params.evidenceCount <= 0 || params.confidence === 'low') return 'abstain';
  return 'answer';
}
