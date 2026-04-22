import fs from 'fs';
import path from 'path';
import { inferBasisBucketFromChunk } from './brain';
import type {
  BasisBucketKey,
  ClaimCoverage,
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
    description: 'Eligibility and compliance questions need legal and practical support.',
    primary_intents: ['eligibility', 'compliance'],
    required_slots: ['service_scope', 'institution_type', 'recipient_grade'],
    required_evidence: {
      legal: 1,
      practical: 1,
    },
  },
  {
    id: 'cost-core-evidence',
    description: 'Cost questions need legal support and grounded numeric evidence.',
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
  } catch {
    // Fall through to embedded defaults.
  }

  cachedRulesProjectRoot = resolvedProjectRoot;
  cachedRules = DEFAULT_RULES;
  return cachedRules;
}

function summarizeSlotValue(frame: SemanticFrame, slot: SemanticSlotKey): string | undefined {
  return frame.slots[slot]?.map((value) => value.canonical).join(', ') || undefined;
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

function buildSupportingEvidenceIds(
  canonicalSubject: string,
  object: string | undefined,
  evidence: StructuredChunk[],
): string[] {
  const queryTerms = uniqueStrings([canonicalSubject, object ?? '']).filter(Boolean);
  return evidence
    .filter((chunk) =>
      queryTerms.some((term) => {
        const normalizedTerm = term.toLowerCase();
        return (
          chunk.docTitle.toLowerCase().includes(normalizedTerm) ||
          chunk.parentSectionTitle.toLowerCase().includes(normalizedTerm) ||
          chunk.searchText.toLowerCase().includes(normalizedTerm)
        );
      }),
    )
    .slice(0, 4)
    .map((chunk) => chunk.id);
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
          : ['legal', 'evaluation', 'practical'],
    ),
    supportingEvidenceIds: buildSupportingEvidenceIds(subject, object, params.evidence),
    assumptions: params.semanticFrame.assumptions,
  };

  const assumptionClaims: ClaimPlanItem[] = params.semanticFrame.assumptions.map((assumption, index) => ({
    id: `claim-assumption-${index + 1}`,
    claimType: 'assumption',
    canonicalSubject: subject,
    predicate: 'assumption',
    object: assumption,
    requiredEvidenceTypes: [],
    supportingEvidenceIds: [],
    assumptions: [assumption],
  }));

  return {
    claims: [mainClaim, ...assumptionClaims],
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
  if (/주야간보호|데이케어|주간보호/u.test(haystack)) scopes.push('주야간보호');
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

function getRequiredSlotsForRule(rule: ValidationRule, frame: SemanticFrame): SemanticSlotKey[] {
  const requiredSlots = rule.required_slots ?? [];
  if (
    frame.primaryIntent === 'compliance' &&
    isStaffingFrame(frame) &&
    requiredSlots.includes('service_scope')
  ) {
    return requiredSlots.filter((slot) => slot === 'service_scope');
  }
  return requiredSlots;
}

function toComparableServiceScopeKeys(scope: string): string[] {
  const normalized = scope.replace(/\s+/g, '');
  if (/요양원|노인요양시설|노인의료복지시설|공동생활가정|시설급여|입소시설/u.test(normalized)) {
    return ['facility-care'];
  }
  if (/주야간보호|데이케어|주간보호/u.test(normalized)) {
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
  const supportedClaims = claimPlan.claims.filter((claim) => claim.supportingEvidenceIds.length > 0).length;
  const assumptionClaims = claimPlan.claims.filter((claim) => claim.claimType === 'assumption').length;
  const partiallySupportedClaims = Math.min(assumptionClaims, claimPlan.claims.length - supportedClaims);
  const unsupportedClaims = Math.max(0, claimPlan.claims.length - supportedClaims - partiallySupportedClaims);

  for (const claim of claimPlan.claims) {
    if (claim.claimType === 'assumption') continue;
    if (claim.supportingEvidenceIds.length > 0) continue;
    issues.push({
      code: 'unsupported-claim',
      severity: 'warning',
      message: `No direct supporting evidence was found for ${claim.canonicalSubject} -> ${claim.predicate}.`,
      claimId: claim.id,
    });
  }

  issues.push(...evaluateRuleViolations(params.semanticFrame, params.evidence, rules));

  const requestedServiceScopes = buildComparableServiceScopeSet(
    (params.semanticFrame.slots.service_scope ?? []).map((value) => value.canonical),
  );
  if (requestedServiceScopes.size > 0) {
    const conflictingScopes = new Set<string>();
    const conflictingEvidenceIds: string[] = [];
    for (const chunk of params.evidence) {
      const chunkScopes = classifyEvidenceServiceScopes(chunk);
      if (hasComparableScopeMatch(chunkScopes, requestedServiceScopes)) continue;

      const chunkConflicts = chunkScopes.filter(
        (scope) => !hasComparableScopeMatch([scope], requestedServiceScopes),
      );
      if (chunkConflicts.length === 0) continue;
      chunkConflicts.forEach((scope) => conflictingScopes.add(scope));
      conflictingEvidenceIds.push(chunk.id);
    }
    if (conflictingScopes.size > 0) {
      issues.push({
        code: 'mixed-service-scope',
        severity: 'warning',
        message: `Evidence contains mixed service scopes: ${Array.from(conflictingScopes).join(', ')}`,
        evidenceIds: conflictingEvidenceIds.slice(0, 6),
      });
    }
  }

  const basisCounts = buildEvidenceCounts(params.evidence);
  if (
    (params.semanticFrame.primaryIntent === 'eligibility' ||
      params.semanticFrame.primaryIntent === 'compliance' ||
      params.semanticFrame.primaryIntent === 'cost') &&
    basisCounts.legal <= 0
  ) {
    issues.push({
      code: 'basis-confusion',
      severity: 'block',
      message: 'High-risk question is missing direct legal basis in the selected evidence.',
      evidenceIds: params.evidence.slice(0, 4).map((chunk) => chunk.id),
    });
  }

  return {
    claimPlan,
    claimCoverage: {
      totalClaims: claimPlan.claims.length,
      supportedClaims,
      partiallySupportedClaims,
      unsupportedClaims,
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

function collectAnswerText(answer: ExpertAnswerEnvelope): string {
  return [
    answer.headline,
    answer.summary,
    answer.scope,
    ...answer.blocks.flatMap((block) => [block.title, block.intro ?? '', ...block.items.flatMap((item) => [item.label, item.detail])]),
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

  const warningBlock = {
    type: 'warning' as const,
    title: '추가 확인이 필요한 부분',
    items: warningIssues.slice(0, 4).map(formatValidationIssueForAnswer),
  };

  return {
    ...answer,
    blocks: [warningBlock, ...answer.blocks],
  };
}

function injectAssumptions(answer: ExpertAnswerEnvelope, semanticFrame: SemanticFrame): ExpertAnswerEnvelope {
  if (semanticFrame.assumptions.length === 0) return answer;
  const assumptionText = `해석 가정: ${semanticFrame.assumptions.join(' / ')}`;
  const scope = answer.scope ? `${assumptionText} ${answer.scope}` : assumptionText;
  return {
    ...answer,
    scope,
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
