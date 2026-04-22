import fs from 'fs';
import path from 'path';
import { inferBasisBucketFromChunk } from './brain';
import type {
  BasisBucketKey,
  ClaimCoverage,
  ClaimPlan,
  ClaimPlanItem,
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
  if (/요양원|노인요양시설|시설급여/u.test(haystack)) scopes.push('시설급여');
  return scopes;
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

    const missingSlots = (rule.required_slots ?? []).filter((slot) => (frame.slots[slot]?.length ?? 0) === 0);
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

  const requestedServiceScopes = new Set(
    (params.semanticFrame.slots.service_scope ?? []).map((value) => value.canonical),
  );
  if (requestedServiceScopes.size > 0) {
    const conflictingScopes = new Set<string>();
    const conflictingEvidenceIds: string[] = [];
    for (const chunk of params.evidence) {
      const chunkScopes = classifyEvidenceServiceScopes(chunk);
      if (chunkScopes.some((scope) => requestedServiceScopes.has(scope))) continue;

      const chunkConflicts = chunkScopes.filter((scope) => !requestedServiceScopes.has(scope));
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

function appendValidationWarnings(answer: ExpertAnswerEnvelope, issues: ValidationIssue[]): ExpertAnswerEnvelope {
  const warningIssues = issues.filter((issue) => issue.severity === 'warning');
  if (warningIssues.length === 0) return answer;

  const warningBlock = {
    type: 'warning' as const,
    title: '추가 확인이 필요한 부분',
    items: warningIssues.slice(0, 4).map((issue) => ({
      label: issue.code,
      detail: issue.message,
      citationIds: issue.evidenceIds,
    })),
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
