import type {
  NaturalLanguageQueryProfile,
  PromptMode,
  RetrievalPriorityClass,
  SearchCandidate,
  SourceType,
} from './ragTypes';
import { isRecipientOnboardingWorkflowQuery } from './ragNaturalQuery';

export interface RetrievalPriorityPolicy {
  priorityClass: RetrievalPriorityClass;
  name: string;
  legalWeight: number;
  evaluationPrimaryWeight: number;
  evaluationSupportWeight: number;
  manualWeight: number;
  qaWeight: number;
  guideWeight: number;
  mismatchPenalty: number;
  scopeBoost: number;
  comparisonWeight: number;
  documentLookupWeight: number;
}

export const RETRIEVAL_PRIORITY_POLICY_NAME = 'dynamic-intent-scope-v1';

export const INTENT_PRIORITY_MATRIX: Record<RetrievalPriorityClass, RetrievalPriorityPolicy> = {
  legal_judgment: {
    priorityClass: 'legal_judgment',
    name: RETRIEVAL_PRIORITY_POLICY_NAME,
    legalWeight: 24,
    evaluationPrimaryWeight: 8,
    evaluationSupportWeight: 3,
    manualWeight: 4,
    qaWeight: 7,
    guideWeight: 6,
    mismatchPenalty: 12,
    scopeBoost: 16,
    comparisonWeight: 4,
    documentLookupWeight: 8,
  },
  evaluation_readiness: {
    priorityClass: 'evaluation_readiness',
    name: RETRIEVAL_PRIORITY_POLICY_NAME,
    legalWeight: 6,
    evaluationPrimaryWeight: 22,
    evaluationSupportWeight: 14,
    manualWeight: 10,
    qaWeight: 5,
    guideWeight: 4,
    mismatchPenalty: 10,
    scopeBoost: 18,
    comparisonWeight: 6,
    documentLookupWeight: 8,
  },
  operational_workflow: {
    priorityClass: 'operational_workflow',
    name: RETRIEVAL_PRIORITY_POLICY_NAME,
    legalWeight: 5,
    evaluationPrimaryWeight: 10,
    evaluationSupportWeight: 8,
    manualWeight: 16,
    qaWeight: 8,
    guideWeight: 10,
    mismatchPenalty: 10,
    scopeBoost: 18,
    comparisonWeight: 5,
    documentLookupWeight: 8,
  },
  document_lookup: {
    priorityClass: 'document_lookup',
    name: RETRIEVAL_PRIORITY_POLICY_NAME,
    legalWeight: 8,
    evaluationPrimaryWeight: 8,
    evaluationSupportWeight: 5,
    manualWeight: 8,
    qaWeight: 6,
    guideWeight: 6,
    mismatchPenalty: 8,
    scopeBoost: 14,
    comparisonWeight: 6,
    documentLookupWeight: 18,
  },
  comparison_definition: {
    priorityClass: 'comparison_definition',
    name: RETRIEVAL_PRIORITY_POLICY_NAME,
    legalWeight: 7,
    evaluationPrimaryWeight: 8,
    evaluationSupportWeight: 6,
    manualWeight: 12,
    qaWeight: 6,
    guideWeight: 6,
    mismatchPenalty: 8,
    scopeBoost: 14,
    comparisonWeight: 16,
    documentLookupWeight: 8,
  },
};

const EVALUATION_READINESS_RE =
  /평가|인정|불인정|평가대응|평가예정통보|지표|현장|언제까지\s*기록|무엇을\s*확인|확인사항|증빙/u;
const FOOD_PREFERENCE_EVALUATION_RE =
  /기피\s*식품|기피식품|식품\s*선호|식품선호|선호도\s*조사|식사\s*만족|식사만족|희망\s*식사|희망식사|대체\s*식품|대체식품|대체\s*식단|대체식단|욕구\s*사정|욕구사정|식사\s*\(?간식\)?|식사간식|급식|식단표|영양사/u;
const DOCUMENT_LOOKUP_RE =
  /문서|자료|매뉴얼|Q&A|고시|법|시행규칙|시행령|별표|조항|서식|어디\s*보면|찾아/u;
const LEGAL_REFERENCE_RE = /법|시행규칙|시행령|고시|조|항|호|별표/u;

function looksLikeDocumentLookup(query: string): boolean {
  return DOCUMENT_LOOKUP_RE.test(query) && /어디|어느|찾아|보여|문서|자료/u.test(query);
}

function hasEvaluationReadinessCue(query: string): boolean {
  return EVALUATION_READINESS_RE.test(query) || FOOD_PREFERENCE_EVALUATION_RE.test(query);
}

function looksLikeLegalJudgment(query: string, profile: NaturalLanguageQueryProfile): boolean {
  if (profile.parsedLawRefs.length > 0) return true;
  if (!LEGAL_REFERENCE_RE.test(query)) return false;
  return ['eligibility', 'compliance', 'cost', 'exception', 'sanction'].includes(profile.semanticFrame.primaryIntent);
}

export function inferRetrievalPriorityClass(params: {
  mode: PromptMode;
  query: string;
  queryProfile: NaturalLanguageQueryProfile;
}): RetrievalPriorityClass {
  const normalizedQuery = params.queryProfile.normalizedQuery || params.query;
  const { queryType, semanticFrame } = params.queryProfile;

  if (looksLikeDocumentLookup(normalizedQuery) || semanticFrame.primaryIntent === 'document') {
    return 'document_lookup';
  }

  if (
    queryType === 'comparison' ||
    queryType === 'definition' ||
    semanticFrame.primaryIntent === 'comparison' ||
    semanticFrame.primaryIntent === 'definition'
  ) {
    return 'comparison_definition';
  }

  if (params.mode === 'evaluation') {
    if (isRecipientOnboardingWorkflowQuery(normalizedQuery)) return 'evaluation_readiness';
    return looksLikeLegalJudgment(normalizedQuery, params.queryProfile) ? 'legal_judgment' : 'evaluation_readiness';
  }

  if (hasEvaluationReadinessCue(normalizedQuery)) {
    return 'evaluation_readiness';
  }

  if (['workflow', 'document'].includes(semanticFrame.primaryIntent)) {
    return 'operational_workflow';
  }

  if (['eligibility', 'compliance', 'cost', 'exception', 'sanction'].includes(semanticFrame.primaryIntent)) {
    return 'legal_judgment';
  }

  return 'operational_workflow';
}

function isLegalSource(sourceType: SourceType): boolean {
  return sourceType === 'law' || sourceType === 'ordinance' || sourceType === 'rule' || sourceType === 'notice';
}

export function isEvaluationLinkedWorkflowQuery(query: string): boolean {
  return hasEvaluationReadinessCue(query) || isRecipientOnboardingWorkflowQuery(query);
}

export function scoreCandidateByPriority(params: {
  candidate: SearchCandidate;
  priorityClass: RetrievalPriorityClass;
  policy: RetrievalPriorityPolicy;
  evaluationLinked: boolean;
}): number {
  const { candidate, priorityClass, policy, evaluationLinked } = params;
  let score = 0;

  switch (priorityClass) {
    case 'legal_judgment':
      if (isLegalSource(candidate.sourceType)) score += policy.legalWeight;
      if (!isLegalSource(candidate.sourceType) && candidate.sourceRole === 'primary_evaluation') {
        score -= policy.evaluationPrimaryWeight * 0.75;
      }
      if (!isLegalSource(candidate.sourceType) && candidate.sourceType === 'manual') {
        score -= policy.manualWeight * 0.5;
      }
      if (candidate.mode === 'evaluation' && candidate.sourceRole === 'support_reference') {
        score -= policy.evaluationSupportWeight * 0.5;
      }
      if (candidate.sourceType === 'qa') score -= policy.qaWeight;
      if (candidate.sourceType === 'guide' || candidate.sourceType === 'wiki') score -= policy.guideWeight;
      break;
    case 'evaluation_readiness':
      if (candidate.sourceRole === 'primary_evaluation') score += policy.evaluationPrimaryWeight;
      if (candidate.mode === 'evaluation' && candidate.sourceRole === 'support_reference') {
        score += policy.evaluationSupportWeight;
      }
      if (candidate.sourceType === 'manual') score += policy.manualWeight * 0.45;
      if (isLegalSource(candidate.sourceType)) score += policy.legalWeight * 0.35;
      break;
    case 'operational_workflow':
      if (candidate.sourceType === 'manual') score += policy.manualWeight;
      if (candidate.sourceType === 'guide' || candidate.sourceType === 'wiki') score += policy.guideWeight;
      if (candidate.sourceType === 'qa') score += policy.qaWeight * 0.8;
      if (candidate.sourceRole === 'primary_evaluation') {
        score += evaluationLinked ? policy.evaluationPrimaryWeight * 0.65 : policy.manualWeight * 0.5;
      } else if (candidate.mode === 'evaluation' && candidate.sourceRole === 'support_reference' && evaluationLinked) {
        score += policy.evaluationSupportWeight * 0.75;
      }
      break;
    case 'document_lookup':
      if (candidate.exactScore >= 18) score += policy.documentLookupWeight;
      if (candidate.articleNo) score += policy.documentLookupWeight * 0.35;
      if (candidate.sourceRole === 'primary_evaluation') score += policy.evaluationPrimaryWeight * 0.35;
      if (candidate.sourceType === 'manual') score += policy.manualWeight * 0.4;
      if (isLegalSource(candidate.sourceType)) score += policy.legalWeight * 0.4;
      break;
    case 'comparison_definition':
      if (candidate.sourceType === 'comparison') score += policy.comparisonWeight;
      if (candidate.sourceType === 'manual') score += policy.manualWeight * 0.85;
      if (candidate.sourceType === 'qa') score += policy.qaWeight * 0.55;
      if (isLegalSource(candidate.sourceType)) score += policy.legalWeight * 0.45;
      break;
  }

  return score;
}

export function classifyPriorityBucket(candidate: SearchCandidate): string {
  if (isLegalSource(candidate.sourceType)) return 'legal';
  if (candidate.sourceRole === 'primary_evaluation') return 'evaluation_primary';
  if (candidate.mode === 'evaluation' || candidate.sourceRole === 'support_reference') return 'evaluation_support';
  if (candidate.sourceType === 'comparison') return 'comparison';
  if (candidate.sourceType === 'manual') return 'manual';
  if (candidate.sourceType === 'qa') return 'qa';
  if (candidate.sourceType === 'guide' || candidate.sourceType === 'wiki') return 'guide';
  return 'other';
}
