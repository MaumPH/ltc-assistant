import fs from 'fs';
import path from 'path';
import { inferBasisBucketFromChunk } from './brain';
import { isRecipientOnboardingWorkflowQuery } from './ragNaturalQuery';
import type {
  BasisBucketKey,
  ClaimCoverage,
  ClaimCoverageDetail,
  ClaimPlan,
  ClaimPlanItem,
  ExpertAnswerBlockItem,
  ExpertAnswerEnvelope,
  OntologyRelationType,
  SemanticFrame,
  SemanticPrimaryIntent,
  SemanticSlotKey,
  StructuredChunk,
  ValidationIssue,
} from './ragTypes';

interface RuleManifest {
  schema_version?: number;
  rules?: ValidationRule[];
}

export interface ValidationRule {
  id: string;
  description: string;
  primary_intents: SemanticPrimaryIntent[];
  required_slots?: SemanticSlotKey[];
  required_relations?: OntologyRelationType[];
  required_evidence?: Partial<Record<BasisBucketKey, number>>;
}

export interface RetrievalValidationSummary {
  claimPlan: ClaimPlan;
  claimCoverage: ClaimCoverage;
  validationIssues: ValidationIssue[];
}

const DEFAULT_RULES: ValidationRule[] = [
  {
    id: 'eligibility-core-evidence',
    description: 'Eligibility questions need legal and practical support.',
    primary_intents: ['eligibility'],
    required_slots: ['service_scope', 'institution_type', 'recipient_grade'],
    required_evidence: {
      legal: 1,
      practical: 1,
    },
  },
  {
    id: 'compliance-core-evidence',
    description: 'Compliance questions need legal support and a grounded operational basis.',
    primary_intents: ['compliance'],
    required_slots: ['service_scope', 'institution_type'],
    required_evidence: {
      legal: 1,
      practical: 1,
    },
  },
  {
    id: 'cost-core-evidence',
    description: 'Cost questions need legal support, and numeric answers need directly grounded rate evidence.',
    primary_intents: ['cost'],
    required_slots: ['service_scope', 'recipient_grade'],
    required_evidence: {
      legal: 1,
    },
  },
  {
    id: 'exception-needs-qualifier',
    description: 'Exception questions need exception and limiter relations.',
    primary_intents: ['exception'],
    required_slots: ['exception_context'],
    required_relations: ['exception-of', 'limited-by'],
  },
];

const SLOT_LABELS: Partial<Record<SemanticSlotKey, string>> = {
  service_scope: '급여유형',
  institution_type: '기관/시설 유형',
  benefit_type: '급여 항목',
  recipient_grade: '수급자 등급',
  actor_role: '대상 직종/역할',
  document_type: '문서 유형',
  cost_topic: '비용 항목',
  time_scope: '기준 시점',
  legal_action: '행정/법적 조치',
  exception_context: '예외 조건',
};

const BASIS_BUCKET_LABELS: Record<BasisBucketKey, string> = {
  legal: '법적 근거',
  evaluation: '평가 근거',
  practical: '실무 근거',
};

let cachedRulesProjectRoot = '';
let cachedRules: ValidationRule[] | null = null;

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean)));
}

function resolveProjectRoot(projectRoot?: string): string {
  if (projectRoot?.trim()) return projectRoot;
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
    return process.cwd();
  }
  return '.';
}

export function loadOntologyValidationRules(projectRoot?: string): ValidationRule[] {
  const resolvedProjectRoot = resolveProjectRoot(projectRoot);
  if (cachedRules && cachedRulesProjectRoot === resolvedProjectRoot) {
    return cachedRules;
  }

  const manifestPath = path.join(resolvedProjectRoot, 'knowledge', 'ontology', 'rules.json');
  try {
    if (fs.existsSync(manifestPath)) {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RuleManifest;
      const rules = Array.isArray(parsed.rules) ? parsed.rules : [];
      cachedRulesProjectRoot = resolvedProjectRoot;
      cachedRules = rules.filter((rule) => typeof rule.id === 'string' && Array.isArray(rule.primary_intents));
      return cachedRules;
    }
  } catch (error) {
    console.warn('[ragSemanticValidation] failed to load validation rules; using embedded defaults:', error);
  }

  cachedRulesProjectRoot = resolvedProjectRoot;
  cachedRules = DEFAULT_RULES;
  return cachedRules;
}

function summarizeSlotValue(frame: SemanticFrame, slot: SemanticSlotKey): string | undefined {
  return frame.slots[slot]?.map((value) => value.canonical).join(', ') || undefined;
}

function collectSlotValues(frame: SemanticFrame, slot: SemanticSlotKey): string[] {
  return uniqueStrings((frame.slots[slot] ?? []).map((value) => value.canonical));
}

function normalizeSupportText(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[()[\]{}"'`.,:;!?/\\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAnchorConceptKey(value: string): string {
  return normalizeSupportText(value).replace(
    /(에서|으로|로|을|를|은|는|이|가|와|과|도|만|할|하기|하다|인가요|있나요|할수있나요|할수)$/u,
    '',
  );
}

function compactSupportText(value: string): string {
  return normalizeSupportText(value).replace(/\s+/g, '');
}

function isLegalSourceType(sourceType: StructuredChunk['sourceType']): boolean {
  return sourceType === 'law' || sourceType === 'ordinance' || sourceType === 'rule' || sourceType === 'notice';
}

function isGenericSupportAnchor(value: string): boolean {
  const normalized = toAnchorConceptKey(value);
  return (
    normalized.length < 2 ||
    new Set([
      '\uc5b4\ub5a4',
      '\ubb34\uc5c7',
      '\ubb38\uc11c',
      '\uc790\ub8cc',
      '\ubc29\ubc95',
      '\uc808\ucc28',
      '\uc21c\uc11c',
      '\ud558\ub098\uc694',
      '\ubd10\uc57c',
      '\ud655\uc778',
      '\uc9c8\ubb38',
    ]).has(normalized)
  );
}

function isDomainGenericAnchor(value: string): boolean {
  return new Set([
    '장기요양',
    '장기요양기관',
    '급여',
    '급여비용',
    '비용',
    '청구',
    '고시',
    '기준',
    '산정기준',
    '본인부담금',
    '적용',
    '의무',
    '배치',
    '절차',
    '파악',
    '기록',
    '제공',
    '확인',
  ]).has(toAnchorConceptKey(value));
}

function describeIntentPredicate(intent: SemanticPrimaryIntent, relation: OntologyRelationType | undefined): string {
  if (relation) return relation;
  switch (intent) {
    case 'eligibility':
      return 'eligible-for';
    case 'compliance':
      return 'applies-to';
    case 'cost':
      return 'has-cost';
    case 'document':
      return 'uses-document';
    case 'workflow':
      return 'follows-step';
    case 'comparison':
      return 'same-as';
    case 'definition':
      return 'same-as';
    case 'exception':
      return 'exception-of';
    case 'sanction':
      return 'conflicts-with';
  }
}

function buildIntentCueAnchors(intent: SemanticPrimaryIntent): string[] {
  switch (intent) {
    case 'cost':
      return ['\uace0\uc2dc', '\uc0b0\uc815\uae30\uc900', '\uae09\uc5ec\ube44\uc6a9', '\uae30\uc900'];
    case 'workflow':
      return ['\uc808\ucc28', '\ud30c\uc545', '\uae30\ub85d', '\uc81c\uacf5', '\ud655\uc778'];
    case 'compliance':
      return ['\uae30\uc900', '\ubc30\uce58', '\uc758\ubb34', '\uc801\uc6a9'];
    case 'exception':
      return ['\uc608\uc678', '\ub2e8\uc11c', '\uc81c\ud55c', '\uba74\uc81c'];
    case 'document':
      return ['\ubb38\uc11c', '\uc11c\uc2dd', '\uc870\ud56d'];
    default:
      return [];
  }
}

function buildClaimSupportBucketHints(intent: SemanticPrimaryIntent): BasisBucketKey[] {
  switch (intent) {
    case 'eligibility':
    case 'compliance':
      return ['legal', 'practical'];
    case 'cost':
    case 'exception':
      return ['legal'];
    case 'workflow':
      return ['evaluation', 'practical'];
    default:
      return ['legal', 'evaluation', 'practical'];
  }
}

function buildClaimSupportAnchors(params: {
  semanticFrame: SemanticFrame;
  canonicalSubject: string;
  object?: string;
}): string[] {
  const slotAnchors = [
    ...collectSlotValues(params.semanticFrame, 'service_scope'),
    ...collectSlotValues(params.semanticFrame, 'institution_type'),
    ...collectSlotValues(params.semanticFrame, 'recipient_grade'),
    ...collectSlotValues(params.semanticFrame, 'document_type'),
    ...collectSlotValues(params.semanticFrame, 'cost_topic'),
    ...collectSlotValues(params.semanticFrame, 'exception_context'),
  ];

  return uniqueStrings([
    params.canonicalSubject,
    params.object ?? '',
    ...slotAnchors,
    ...params.semanticFrame.canonicalTerms,
    ...buildIntentCueAnchors(params.semanticFrame.primaryIntent),
  ]).filter((anchor) => !isGenericSupportAnchor(anchor));
}

interface WorkflowFacetDefinition {
  id: string;
  subject: string;
  object: string;
  anchors: string[];
  buckets: BasisBucketKey[];
}

const RECIPIENT_ONBOARDING_WORKFLOW_FACETS: WorkflowFacetDefinition[] = [
  {
    id: 'contract',
    subject: '수급자 정보 확인 및 장기요양급여 제공계약',
    object: '급여 개시 전 계약과 본인 여부, 등급, 인정 유효기간, 개인별장기요양이용계획서 확인',
    anchors: [
      '장기요양급여 제공계약',
      '계약서',
      '장기요양급여 개시 전',
      '본인 여부',
      '장기요양등급',
      '장기요양인정 유효기간',
      '개인별장기요양이용계획서',
      '시행규칙 제16조',
      '제16조',
    ],
    buckets: ['legal'],
  },
  {
    id: 'care-plan',
    subject: '장기요양급여 제공 계획서 작성 및 통보',
    object: '급여 제공 시작 전 계획서 작성, 설명, 확인서명, 공단 통보',
    anchors: [
      '장기요양급여 제공 계획서',
      '급여제공계획',
      '급여제공계획서',
      '제공을 시작하기 전에',
      '수급자 또는 보호자에게 설명',
      '확인 서명',
      '공단에 통보',
      '시행령 제13조',
      '제13조',
      '시행규칙 제21조의2',
    ],
    buckets: ['legal', 'evaluation'],
  },
  {
    id: 'initial-assessment',
    subject: '초기 욕구사정 및 위험도 평가',
    object: '급여제공 시작일까지 욕구사정, 낙상평가, 욕창평가, 인지기능 평가 실시',
    anchors: [
      '욕구사정',
      '낙상평가',
      '낙상 위험도',
      '욕창평가',
      '욕창 위험도',
      '인지기능 평가',
      '위험도평가',
      '급여제공 시작일까지',
      '신규수급자는',
      '해당급여 직원이 대면',
    ],
    buckets: ['evaluation'],
  },
  {
    id: 'food-preference',
    subject: '기피식품 파악',
    object: '급여제공 시작일까지 종교, 건강, 비선호 등으로 섭취하기 어려운 식재료 파악',
    anchors: [
      '기피식품',
      '기피식품 파악',
      '영양상태',
      '식사제공 유의사항',
      '섭취하기 어려운 식재료',
      '급여제공 시작일까지',
    ],
    buckets: ['evaluation'],
  },
];

function buildRecipientOnboardingWorkflowClaims(params: {
  question: string;
  semanticFrame: SemanticFrame;
  subject: string;
}): ClaimPlanItem[] {
  if (params.semanticFrame.primaryIntent !== 'workflow' || !isRecipientOnboardingWorkflowQuery(params.question)) {
    return [];
  }

  const serviceScopeAnchors = collectSlotValues(params.semanticFrame, 'service_scope');
  return RECIPIENT_ONBOARDING_WORKFLOW_FACETS.map((facet) => ({
    id: `claim-workflow-${facet.id}`,
    claimType: 'workflow_step',
    canonicalSubject: facet.subject,
    predicate: 'follows-step',
    object: facet.object,
    requiredEvidenceTypes: facet.buckets,
    supportAnchors: uniqueStrings([
      facet.subject,
      facet.object,
      ...facet.anchors,
      ...serviceScopeAnchors,
    ]).filter((anchor) => !isGenericSupportAnchor(anchor)),
    supportBucketHints: facet.buckets,
    supportingEvidenceIds: [],
    assumptions: [],
  }));
}

function buildChunkSupportFields(chunk: StructuredChunk): Array<{ weight: number; value: string }> {
  return [
    { weight: 3.2, value: chunk.docTitle },
    { weight: 2.6, value: chunk.parentSectionTitle },
    { weight: 2.4, value: chunk.matchedLabels.join(' ') },
    { weight: 2.1, value: chunk.searchText },
    { weight: 1.7, value: chunk.textPreview },
    { weight: 1.4, value: chunk.text },
  ];
}

function scoreAnchorAgainstChunk(anchor: string, chunk: StructuredChunk): number {
  const normalizedAnchor = normalizeSupportText(anchor);
  const compactAnchor = compactSupportText(anchor);
  if (!normalizedAnchor) return 0;

  let bestScore = 0;
  for (const field of buildChunkSupportFields(chunk)) {
    const normalizedField = normalizeSupportText(field.value);
    if (!normalizedField) continue;
    if (normalizedField.includes(normalizedAnchor)) {
      bestScore = Math.max(bestScore, field.weight);
      continue;
    }

    const compactField = compactSupportText(field.value);
    if (compactAnchor.length >= 2 && compactField.includes(compactAnchor)) {
      bestScore = Math.max(bestScore, Math.max(1, field.weight - 0.4));
    }
  }

  return bestScore;
}

function buildRequestedServiceScopeKeys(frame: SemanticFrame): Set<string> {
  return buildComparableServiceScopeSet((frame.slots.service_scope ?? []).map((value) => value.canonical));
}

function analyzeClaimEvidenceSupport(
  claim: ClaimPlanItem,
  semanticFrame: SemanticFrame,
  evidence: StructuredChunk[],
): {
  supportedEvidenceIds: string[];
  partialEvidenceIds: string[];
} {
  const requestedScopeKeys = buildRequestedServiceScopeKeys(semanticFrame);
  const ranked = evidence
    .map((chunk) => {
      const matchedAnchors = claim.supportAnchors
        .map((anchor) => ({ anchor, score: scoreAnchorAgainstChunk(anchor, chunk) }))
        .filter((entry) => entry.score > 0);
      const matchedAnchorCount = matchedAnchors.length;
      const specificAnchorCount = matchedAnchors.filter((entry) => !isDomainGenericAnchor(entry.anchor)).length;
      let score = matchedAnchors.reduce((sum, entry) => sum + entry.score, 0);

      const bucket = inferBasisBucketFromChunk(chunk);
      if (claim.supportBucketHints.includes(bucket)) score += 1.2;
      if (isLegalSourceType(chunk.sourceType) && claim.claimType === 'cost') score += 1.8;
      if ((claim.claimType === 'workflow' || claim.claimType === 'workflow_step') && chunk.sourceRole === 'primary_evaluation') score += 2.2;
      if ((claim.claimType === 'workflow' || claim.claimType === 'workflow_step') && bucket === 'evaluation') score += 1.4;
      if (claim.claimType === 'compliance' && isLegalSourceType(chunk.sourceType)) score += 1.4;
      if (claim.claimType === 'document' && chunk.articleNo) score += 0.8;

      const chunkScopes = classifyEvidenceServiceScopes(chunk);
      let scopeMatched = false;
      if (requestedScopeKeys.size > 0 && chunkScopes.length > 0) {
        if (hasComparableScopeMatch(chunkScopes, requestedScopeKeys)) {
          scopeMatched = true;
          score += 1.4;
        } else if (!isLegalSourceType(chunk.sourceType)) {
          score -= 1.2;
        }
      }

      return {
        id: chunk.id,
        score,
        matchedAnchorCount,
        specificAnchorCount,
        scopeMatched,
      };
    })
    .sort((left, right) => right.score - left.score);

  const supportedEvidenceIds = ranked
    .filter(
      (entry) =>
        entry.score >= 5.2 &&
        entry.matchedAnchorCount >= 2 &&
        (entry.specificAnchorCount >= 1 || entry.scopeMatched),
    )
    .slice(0, 4)
    .map((entry) => entry.id);
  const partialEvidenceIds =
    supportedEvidenceIds.length > 0
      ? []
      : ranked
          .filter(
            (entry) =>
              entry.score >= 3.2 &&
              entry.matchedAnchorCount >= 1 &&
              (entry.specificAnchorCount >= 1 || entry.scopeMatched),
          )
          .slice(0, 3)
          .map((entry) => entry.id);

  return {
    supportedEvidenceIds,
    partialEvidenceIds,
  };
}

function buildClaimCoverageDetails(
  claimPlan: ClaimPlan,
  semanticFrame: SemanticFrame,
  evidence: StructuredChunk[],
): ClaimCoverageDetail[] {
  return claimPlan.claims.map((claim) => {
    if (claim.claimType === 'assumption') {
      return {
        claimId: claim.id,
        status: 'partial',
        evidenceIds: [],
      };
    }

    const analysis = analyzeClaimEvidenceSupport(claim, semanticFrame, evidence);
    if (analysis.supportedEvidenceIds.length > 0) {
      return {
        claimId: claim.id,
        status: 'supported',
        evidenceIds: analysis.supportedEvidenceIds,
      };
    }

    if (analysis.partialEvidenceIds.length > 0) {
      return {
        claimId: claim.id,
        status: 'partial',
        evidenceIds: analysis.partialEvidenceIds,
      };
    }

    return {
      claimId: claim.id,
      status: 'unsupported',
      evidenceIds: [],
    };
  });
}

export function buildClaimPlan(params: {
  question: string;
  semanticFrame: SemanticFrame;
  evidence: StructuredChunk[];
}): ClaimPlan {
  const subject =
    params.semanticFrame.canonicalTerms[0] ??
    summarizeSlotValue(params.semanticFrame, 'service_scope') ??
    summarizeSlotValue(params.semanticFrame, 'institution_type') ??
    params.question;
  const primaryRelation = params.semanticFrame.relationRequests[0]?.relation;
  const object =
    summarizeSlotValue(params.semanticFrame, 'recipient_grade') ??
    summarizeSlotValue(params.semanticFrame, 'document_type') ??
    summarizeSlotValue(params.semanticFrame, 'cost_topic') ??
    summarizeSlotValue(params.semanticFrame, 'exception_context');

  const mainClaim: ClaimPlanItem = {
    id: 'claim-main',
    claimType: params.semanticFrame.primaryIntent,
    canonicalSubject: subject,
    predicate: describeIntentPredicate(params.semanticFrame.primaryIntent, primaryRelation),
    object,
    requiredEvidenceTypes: uniqueStrings(
      params.semanticFrame.primaryIntent === 'eligibility' || params.semanticFrame.primaryIntent === 'compliance'
        ? ['legal', 'practical']
        : params.semanticFrame.primaryIntent === 'cost'
          ? ['legal']
          : params.semanticFrame.primaryIntent === 'workflow'
            ? ['evaluation', 'practical']
            : ['legal', 'evaluation', 'practical'],
    ),
    supportAnchors: buildClaimSupportAnchors({
      semanticFrame: params.semanticFrame,
      canonicalSubject: subject,
      object,
    }),
    supportBucketHints: buildClaimSupportBucketHints(params.semanticFrame.primaryIntent),
    supportingEvidenceIds: [],
    assumptions: params.semanticFrame.assumptions,
  };
  mainClaim.supportingEvidenceIds = analyzeClaimEvidenceSupport(mainClaim, params.semanticFrame, params.evidence).supportedEvidenceIds;
  const workflowStepClaims = buildRecipientOnboardingWorkflowClaims({
    question: params.question,
    semanticFrame: params.semanticFrame,
    subject,
  });
  for (const claim of workflowStepClaims) {
    claim.supportingEvidenceIds = analyzeClaimEvidenceSupport(claim, params.semanticFrame, params.evidence).supportedEvidenceIds;
  }

  const assumptionClaims: ClaimPlanItem[] = params.semanticFrame.assumptions.map((assumption, index) => ({
    id: `claim-assumption-${index + 1}`,
    claimType: 'assumption',
    canonicalSubject: subject,
    predicate: 'assumption',
    object: assumption,
    requiredEvidenceTypes: [],
    supportAnchors: [],
    supportBucketHints: [],
    supportingEvidenceIds: [],
    assumptions: [assumption],
  }));

  return {
    claims: [mainClaim, ...workflowStepClaims, ...assumptionClaims],
  };
}

function buildEvidenceCounts(evidence: StructuredChunk[]): Record<BasisBucketKey, number> {
  return evidence.reduce<Record<BasisBucketKey, number>>(
    (counts, chunk) => {
      counts[inferBasisBucketFromChunk(chunk)] += 1;
      return counts;
    },
    { legal: 0, evaluation: 0, practical: 0 },
  );
}

function classifyEvidenceServiceScopes(chunk: StructuredChunk): string[] {
  const haystack = `${chunk.docTitle} ${chunk.parentSectionTitle} ${chunk.searchText}`;
  const scopes: string[] = [];
  if (/주\s*[·ㆍ\/-]?\s*야간보호|주야간보호|데이케어|주간보호/u.test(haystack)) scopes.push('주야간보호');
  if (/방문요양/u.test(haystack)) scopes.push('방문요양');
  if (/방문목욕/u.test(haystack)) scopes.push('방문목욕');
  if (/방문간호/u.test(haystack)) scopes.push('방문간호');
  if (/요양원|노인요양시설|노인의료복지시설|공동생활가정|시설급여|입소시설/u.test(haystack)) scopes.push('시설급여');
  return scopes;
}

function isStaffingFrame(frame: SemanticFrame): boolean {
  const haystack = [
    ...frame.canonicalTerms,
    ...frame.entityRefs.flatMap((entity) => [entity.label, entity.canonical]),
  ].join(' ');
  return /인력\s*(배치|기준|현황|신고)?|직원\s*(배치|기준)|요양보호사/u.test(haystack);
}

function isCostReferenceLookupFrame(frame: SemanticFrame): boolean {
  if (frame.primaryIntent !== 'cost') return false;
  const haystack = normalizeSupportText(
    [
      ...frame.canonicalTerms,
      ...frame.entityRefs.flatMap((entity) => [entity.label, entity.canonical]),
      ...collectSlotValues(frame, 'document_type'),
      ...collectSlotValues(frame, 'cost_topic'),
    ].join(' '),
  );
  const hasReferenceCue = /(?:고시|기준|문서|조항|어떤)/u.test(haystack);
  const hasNumericCue = /(?:얼마|몇|%|비율|금액|수가)/u.test(haystack);
  return hasReferenceCue && !hasNumericCue;
}

function getRequiredSlotsForRule(rule: ValidationRule, frame: SemanticFrame): SemanticSlotKey[] {
  const requiredSlots = rule.required_slots ?? [];
  if (
    frame.primaryIntent === 'compliance' &&
    isStaffingFrame(frame) &&
    requiredSlots.includes('service_scope')
  ) {
    return requiredSlots.filter((slot) => slot === 'service_scope');
  }
  if (rule.id === 'cost-core-evidence' && isCostReferenceLookupFrame(frame)) {
    return requiredSlots.filter((slot) => slot !== 'recipient_grade');
  }
  return requiredSlots;
}

function toComparableServiceScopeKeys(scope: string): string[] {
  const normalized = scope.replace(/\s+/g, '');
  if (/요양원|노인요양시설|노인의료복지시설|공동생활가정|시설급여|입소시설/u.test(normalized)) {
    return ['facility-care'];
  }
  if (/주[·ㆍ\/-]?야간보호|주야간보호|데이케어|주간보호/u.test(normalized)) {
    return ['day-night-care'];
  }
  if (/방문요양/u.test(normalized)) {
    return ['home-visit-care'];
  }
  if (/방문목욕/u.test(normalized)) {
    return ['home-visit-bath'];
  }
  if (/방문간호/u.test(normalized)) {
    return ['home-visit-nursing'];
  }
  if (/복지용구/u.test(normalized)) {
    return ['welfare-equipment'];
  }
  return [normalized];
}

function buildComparableServiceScopeSet(scopes: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const scope of scopes) {
    for (const key of toComparableServiceScopeKeys(scope)) {
      keys.add(key);
    }
  }
  return keys;
}

function hasComparableScopeMatch(scopes: readonly string[], requestedScopeKeys: Set<string>): boolean {
  return scopes.some((scope) => toComparableServiceScopeKeys(scope).some((key) => requestedScopeKeys.has(key)));
}

function evaluateRuleViolations(
  frame: SemanticFrame,
  evidence: StructuredChunk[],
  rules: ValidationRule[],
): ValidationIssue[] {
  const evidenceCounts = buildEvidenceCounts(evidence);
  const issues: ValidationIssue[] = [];

  for (const rule of rules) {
    if (!rule.primary_intents.includes(frame.primaryIntent)) continue;

    const missingSlots = getRequiredSlotsForRule(rule, frame).filter((slot) => (frame.slots[slot]?.length ?? 0) === 0);
    if (missingSlots.length > 0) {
      issues.push({
        code: 'insufficient-evidence-composition',
        severity: missingSlots.length >= 2 ? 'warning' : 'info',
        message: `${rule.description} Missing slots: ${missingSlots.join(', ')}`,
      });
    }

    for (const [bucket, requiredCount] of Object.entries(rule.required_evidence ?? {}) as Array<[BasisBucketKey, number]>) {
      if ((evidenceCounts[bucket] ?? 0) >= requiredCount) continue;
      issues.push({
        code: 'insufficient-evidence-composition',
        severity: bucket === 'legal' ? 'block' : 'warning',
        message: `${rule.description} ${bucket} evidence is thinner than required.`,
        evidenceIds: evidence.slice(0, 4).map((chunk) => chunk.id),
      });
    }

    const relationSet = new Set(frame.relationRequests.map((request) => request.relation));
    const missingRelations = (rule.required_relations ?? []).filter((relation) => !relationSet.has(relation));
    if (missingRelations.length > 0) {
      issues.push({
        code: 'unsupported-claim',
        severity: 'warning',
        message: `${rule.description} Missing relation cues: ${missingRelations.join(', ')}`,
      });
    }
  }

  return issues;
}

function buildMixedServiceScopeIssues(frame: SemanticFrame, evidence: StructuredChunk[]): ValidationIssue[] {
  const requestedServiceScopes = buildRequestedServiceScopeKeys(frame);
  if (requestedServiceScopes.size === 0) return [];

  const matchingEvidenceIds: string[] = [];
  const conflictingScopes = new Set<string>();
  const conflictingEvidenceIds: string[] = [];

  for (const chunk of evidence) {
    const chunkScopes = classifyEvidenceServiceScopes(chunk);
    if (chunkScopes.length === 0) continue;
    if (hasComparableScopeMatch(chunkScopes, requestedServiceScopes)) {
      matchingEvidenceIds.push(chunk.id);
      continue;
    }
    if (isLegalSourceType(chunk.sourceType)) {
      continue;
    }

    const chunkConflicts = chunkScopes.filter((scope) => !hasComparableScopeMatch([scope], requestedServiceScopes));
    if (chunkConflicts.length === 0) continue;
    chunkConflicts.forEach((scope) => conflictingScopes.add(scope));
    conflictingEvidenceIds.push(chunk.id);
  }

  if (conflictingEvidenceIds.length === 0) return [];

  const shouldWarn =
    matchingEvidenceIds.length === 0 || conflictingEvidenceIds.length > Math.max(1, matchingEvidenceIds.length);
  if (!shouldWarn) return [];

  return [
    {
      code: 'mixed-service-scope',
      severity: 'warning',
      message: `Evidence contains mixed service scopes: ${Array.from(conflictingScopes).join(', ')}`,
      evidenceIds: conflictingEvidenceIds.slice(0, 6),
    },
  ];
}

export function evaluateRetrievalValidation(params: {
  semanticFrame: SemanticFrame;
  evidence: StructuredChunk[];
  projectRoot?: string;
  claimPlan?: ClaimPlan;
}): RetrievalValidationSummary {
  const claimPlan = params.claimPlan ?? buildClaimPlan({
    question: params.semanticFrame.canonicalTerms[0] ?? '질문',
    semanticFrame: params.semanticFrame,
    evidence: params.evidence,
  });
  const rules = loadOntologyValidationRules(params.projectRoot);
  const issues: ValidationIssue[] = [];
  const claimCoverageDetails = buildClaimCoverageDetails(claimPlan, params.semanticFrame, params.evidence);
  const supportedClaims = claimCoverageDetails.filter((detail) => detail.status === 'supported').length;
  const partiallySupportedClaims = claimCoverageDetails.filter((detail) => detail.status === 'partial').length;
  const unsupportedClaims = claimCoverageDetails.filter((detail) => detail.status === 'unsupported').length;
  const claimDetailById = new Map(claimCoverageDetails.map((detail) => [detail.claimId, detail] as const));

  for (const claim of claimPlan.claims) {
    if (claim.claimType === 'assumption') continue;
    const detail = claimDetailById.get(claim.id);
    if (!detail || detail.status !== 'unsupported') continue;
    issues.push({
      code: 'unsupported-claim',
      severity: claim.claimType === 'workflow' || claim.claimType === 'workflow_step' ? 'info' : 'warning',
      message: `No direct supporting evidence was found for ${claim.canonicalSubject} -> ${claim.predicate}.`,
      claimId: claim.id,
    });
  }

  issues.push(...evaluateRuleViolations(params.semanticFrame, params.evidence, rules));
  issues.push(...buildMixedServiceScopeIssues(params.semanticFrame, params.evidence));

  const basisCounts = buildEvidenceCounts(params.evidence);
  const mainClaimDetail =
    claimCoverageDetails.find((detail) => detail.claimId === 'claim-main') ??
    claimCoverageDetails.find((detail) => detail.status !== 'partial');
  const mainClaimEvidenceIds = new Set(mainClaimDetail?.evidenceIds ?? []);
  const hasDirectLegalSupport = params.evidence.some(
    (chunk) => mainClaimEvidenceIds.has(chunk.id) && isLegalSourceType(chunk.sourceType),
  );
  if (
    (params.semanticFrame.primaryIntent === 'eligibility' ||
      params.semanticFrame.primaryIntent === 'compliance' ||
      params.semanticFrame.primaryIntent === 'cost') &&
    (basisCounts.legal <= 0 || !hasDirectLegalSupport)
  ) {
    issues.push({
      code: 'basis-confusion',
      severity: 'block',
      message:
        basisCounts.legal <= 0
          ? 'High-risk question is missing direct legal basis in the selected evidence.'
          : 'Selected legal evidence does not directly support the primary high-risk claim.',
      evidenceIds:
        mainClaimDetail?.evidenceIds && mainClaimDetail.evidenceIds.length > 0
          ? mainClaimDetail.evidenceIds
          : params.evidence.slice(0, 4).map((chunk) => chunk.id),
    });
  }

  return {
    claimPlan,
    claimCoverage: {
      totalClaims: claimPlan.claims.length,
      supportedClaims,
      partiallySupportedClaims,
      unsupportedClaims,
      details: claimCoverageDetails,
    },
    validationIssues: issues,
  };
}

function hasAnyLegalEvidence(citations: StructuredChunk[]): boolean {
  return citations.some((chunk) => ['law', 'ordinance', 'rule', 'notice'].includes(chunk.sourceType));
}

function collectCitationDates(citations: StructuredChunk[]): string[] {
  return uniqueStrings(citations.flatMap((citation) => [citation.effectiveDate ?? '', citation.publishedDate ?? ''])).filter(
    (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  );
}

function safeArray<T>(value: readonly T[] | undefined): T[] {
  return Array.isArray(value) ? [...value] : [];
}

function collectAnswerText(answer: ExpertAnswerEnvelope): string {
  const groundedBasis = answer.groundedBasis as ExpertAnswerEnvelope['groundedBasis'] | undefined;
  const blocks = safeArray(answer.blocks);

  return [
    answer.headline,
    answer.summary,
    answer.referenceDate,
    answer.conclusion,
    answer.appliedScope,
    answer.scope,
    ...(['legal', 'evaluation', 'practical'] as const).flatMap((bucket) =>
      safeArray(groundedBasis?.[bucket]).flatMap((entry) => [entry.label, entry.quote, entry.explanation]),
    ),
    ...safeArray(answer.practicalInterpretation).flatMap((item) => [item.label, item.detail]),
    ...safeArray(answer.additionalChecks).flatMap((item) => [item.label, item.detail]),
    ...blocks.flatMap((block) => [
      block.title,
      block.intro ?? '',
      ...safeArray(block.items).flatMap((item) => [item.label, item.detail]),
    ]),
    ...safeArray(answer.followUps),
  ]
    .filter(Boolean)
    .join(' ');
}

function hasUngroundedCostNumber(answerText: string, citations: StructuredChunk[]): boolean {
  const numbers = answerText.match(/\d+(?:[.,]\d+)?%?/g) ?? [];
  if (numbers.length === 0) return false;
  return !citations.some((citation) => numbers.some((numberText) => citation.text.includes(numberText)));
}

function toSlotLabel(slot: string): string {
  return SLOT_LABELS[slot as SemanticSlotKey] ?? slot.replace(/_/g, ' ');
}

function extractMissingSlotLabels(message: string): string[] {
  const match = message.match(/Missing slots:\s*([A-Za-z_,\s-]+)/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((slot) => slot.trim())
    .filter(Boolean)
    .map(toSlotLabel);
}

function extractThinBasisLabel(message: string): string | null {
  const match = message.match(/\b(legal|evaluation|practical)\s+evidence is thinner/i);
  if (!match) return null;
  return BASIS_BUCKET_LABELS[match[1] as BasisBucketKey] ?? null;
}

function extractMixedScopes(message: string): string[] {
  const match = message.match(/mixed service scopes:\s*(.+)$/i);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function extractNewestDate(message: string): string | null {
  return message.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function formatValidationIssueForAnswer(issue: ValidationIssue): ExpertAnswerBlockItem {
  switch (issue.code) {
    case 'insufficient-evidence-composition': {
      const missingSlots = extractMissingSlotLabels(issue.message);
      if (missingSlots.length > 0) {
        return {
          label: '질문 조건 확인 필요',
          detail: `정확한 판단을 위해 ${missingSlots.join(', ')} 정보가 더 필요합니다. 현재 답변은 확인된 근거 범위 안에서만 참고하세요.`,
          citationIds: issue.evidenceIds,
        };
      }

      const basisLabel = extractThinBasisLabel(issue.message);
      return {
        label: basisLabel ? `${basisLabel} 보강 필요` : '근거 구성 보강 필요',
        detail: basisLabel
          ? `${basisLabel}가 충분히 확보되지 않았습니다. 해당 항목은 원문 근거를 추가 확인한 뒤 적용하세요.`
          : '질문을 확정하려면 법적 근거, 평가 근거, 실무 근거의 조합을 더 확인해야 합니다.',
        citationIds: issue.evidenceIds,
      };
    }
    case 'mixed-service-scope': {
      const scopes = extractMixedScopes(issue.message);
      return {
        label: '급여유형 범위 확인 필요',
        detail:
          scopes.length > 0
            ? `선택한 급여유형과 다른 범위의 근거가 함께 검색되었습니다: ${scopes.join(', ')}. 답변을 적용할 때는 선택한 급여유형과 직접 맞는 근거를 우선 확인하세요.`
            : '선택한 급여유형과 다른 범위의 근거가 함께 검색되었습니다. 적용 전 급여유형이 맞는지 다시 확인하세요.',
        citationIds: issue.evidenceIds,
      };
    }
    case 'unsupported-claim':
      return {
        label: '직접 근거 확인 필요',
        detail: '답변 일부와 직접 연결되는 근거가 충분하지 않습니다. 해당 항목은 원문 문서에서 추가 근거를 확인한 뒤 적용하세요.',
        citationIds: issue.evidenceIds,
      };
    case 'stale-priority': {
      const newestDate = extractNewestDate(issue.message);
      return {
        label: '최신 기준일 확인 필요',
        detail: newestDate
          ? `검색된 근거 중 최신 기준일(${newestDate})이 답변에 충분히 드러나지 않았습니다. 최신 개정 기준을 먼저 확인하세요.`
          : '검색된 근거 중 최신 기준일이 답변에 충분히 드러나지 않았습니다. 최신 개정 기준을 먼저 확인하세요.',
        citationIds: issue.evidenceIds,
      };
    }
    case 'ungrounded-cost-number':
      return {
        label: '금액·비율 근거 확인 필요',
        detail: '답변의 금액 또는 비율 수치가 인용 근거와 직접 연결되지 않았습니다. 산식과 기준 금액을 원문에서 다시 확인하세요.',
        citationIds: issue.evidenceIds,
      };
    case 'missing-exception':
      return {
        label: '예외·단서 조건 확인 필요',
        detail: '사용자가 요청한 예외나 단서 조건이 답변에 충분히 드러나지 않았습니다. 적용 제외, 다만 조항, 제한 조건을 추가 확인하세요.',
        citationIds: issue.evidenceIds,
      };
    case 'grade-benefit-mismatch':
      return {
        label: '등급과 급여 적용 범위 확인 필요',
        detail: '수급자 등급과 급여 적용 범위가 서로 맞는지 추가 확인이 필요합니다.',
        citationIds: issue.evidenceIds,
      };
    case 'institution-scope-mismatch':
      return {
        label: '기관 유형과 급여유형 확인 필요',
        detail: '기관 유형과 선택한 급여유형의 적용 범위가 서로 맞는지 추가 확인이 필요합니다.',
        citationIds: issue.evidenceIds,
      };
    case 'basis-confusion':
      return {
        label: '법적 근거 확인 필요',
        detail: '고위험 판단에 필요한 직접 법적 근거가 부족합니다. 답변을 확정하기 전에 관련 조문을 먼저 확인하세요.',
        citationIds: issue.evidenceIds,
      };
  }
}

function appendValidationWarnings(answer: ExpertAnswerEnvelope, issues: ValidationIssue[]): ExpertAnswerEnvelope {
  const warningIssues = issues.filter((issue) => issue.severity === 'warning');
  if (warningIssues.length === 0) return answer;

  const warningItems = warningIssues.slice(0, 4).map(formatValidationIssueForAnswer);
  const additionalChecks = safeArray(answer.additionalChecks);
  const existing = new Set(additionalChecks.map((item) => `${item.label}::${item.detail}`));
  const mergedAdditionalChecks = [
    ...additionalChecks,
    ...warningItems.filter((item) => !existing.has(`${item.label}::${item.detail}`)),
  ].slice(0, 8);

  return {
    ...answer,
    additionalChecks: mergedAdditionalChecks,
  };
}

function injectAssumptions(answer: ExpertAnswerEnvelope, semanticFrame: SemanticFrame): ExpertAnswerEnvelope {
  if (semanticFrame.assumptions.length === 0) return answer;
  const assumptionText = `해석 가정: ${semanticFrame.assumptions.join(' / ')}`;
  const scope = answer.scope ? `${assumptionText} ${answer.scope}` : assumptionText;
  const additionalChecks = safeArray(answer.additionalChecks);
  const assumptionItem: ExpertAnswerBlockItem = {
    label: '해석 가정',
    detail: semanticFrame.assumptions.join(' / '),
  };
  const hasAssumptionItem = additionalChecks.some(
    (item) => item.label === assumptionItem.label && item.detail === assumptionItem.detail,
  );
  return {
    ...answer,
    scope,
    additionalChecks: hasAssumptionItem
      ? additionalChecks
      : [...additionalChecks, assumptionItem].slice(0, 8),
  };
}

export function validateAnswerEnvelope(params: {
  answer: ExpertAnswerEnvelope;
  semanticFrame: SemanticFrame;
  citations: StructuredChunk[];
  evidence: StructuredChunk[];
  projectRoot?: string;
  claimPlan?: ClaimPlan;
}): {
  answer: ExpertAnswerEnvelope;
  claimCoverage: ClaimCoverage;
  validationIssues: ValidationIssue[];
  shouldAbstain: boolean;
} {
  const retrievalSummary = evaluateRetrievalValidation({
    semanticFrame: params.semanticFrame,
    evidence: params.evidence,
    projectRoot: params.projectRoot,
    claimPlan: params.claimPlan,
  });
  const issues = [...retrievalSummary.validationIssues];
  const answerText = collectAnswerText(params.answer);

  const citationDates = collectCitationDates(params.citations);
  if (citationDates.length > 1) {
    const sorted = citationDates.slice().sort().reverse();
    if (!answerText.includes(sorted[0])) {
      issues.push({
        code: 'stale-priority',
        severity: 'warning',
        message: `Newest citation date ${sorted[0]} is not surfaced in the answer.`,
      });
    }
  }

  if (params.semanticFrame.primaryIntent === 'cost' && hasUngroundedCostNumber(answerText, params.citations)) {
    issues.push({
      code: 'ungrounded-cost-number',
      severity: hasAnyLegalEvidence(params.citations) ? 'warning' : 'block',
      message: 'The answer includes cost-like numbers that were not directly grounded in the cited evidence.',
      evidenceIds: params.citations.map((chunk) => chunk.id),
    });
  }

  if (params.semanticFrame.primaryIntent === 'exception' && !/(예외|단서|다만|면제|제외)/u.test(answerText)) {
    issues.push({
      code: 'missing-exception',
      severity: 'warning',
      message: 'The answer does not clearly surface the exception or qualifier requested by the user.',
      evidenceIds: params.citations.map((chunk) => chunk.id),
    });
  }

  const shouldAbstain = issues.some((issue) => issue.severity === 'block');
  const answerWithAssumptions = injectAssumptions(params.answer, params.semanticFrame);
  const answerWithWarnings = appendValidationWarnings(answerWithAssumptions, issues);

  return {
    answer: answerWithWarnings,
    claimCoverage: retrievalSummary.claimCoverage,
    validationIssues: issues,
    shouldAbstain,
  };
}
