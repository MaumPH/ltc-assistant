import type { StructuredChunk, ValidationIssue } from './ragTypes';

export interface EvaluationRequirementCompletenessRule {
  id: string;
  sourceDocumentId?: string;
  sourceDocumentTitle?: string;
  indicatorTitle?: string;
  requirementTitle: string;
  aliases?: string[];
  requiredItems: EvaluationRequirementItem[];
  conditionalItems?: EvaluationRequirementConditionalItem[];
  evidenceSelectors: EvaluationEvidenceSelector[];
}

export interface EvaluationRequirementItem {
  id: string;
  label: string;
  kind:
    | 'checklist_item'
    | 'target'
    | 'actor'
    | 'frequency'
    | 'deadline'
    | 'evidence'
    | 'verification_method'
    | 'noncompliance_condition'
    | 'exception_condition';
  aliases?: string[];
  requiredForAnswer?: boolean;
}

export interface EvaluationRequirementConditionalItem {
  whenQueryMatches: string[];
  requiredItemIds: string[];
}

export interface EvaluationEvidenceSelector {
  documentTitleIncludes?: string[];
  sectionTitleIncludes?: string[];
  textIncludesAny?: string[];
  textIncludesAll?: string[];
}

export interface EvaluationRequirementMatch {
  rule: EvaluationRequirementCompletenessRule;
  score: number;
  matchedTerms: string[];
}

export interface EvaluationRequirementBoosts {
  documentBoosts: Map<string, number>;
  chunkBoosts: Map<string, number>;
}

export interface EvaluationRequirementCompletenessInstructionParams {
  question: string;
  matchedRequirements: EvaluationRequirementMatch[];
  evidence: StructuredChunk[];
}

export interface EvaluationRequirementCompletenessValidationParams {
  question: string;
  answerText: string;
  matchedRequirements: EvaluationRequirementMatch[];
  evidence: StructuredChunk[];
}

const recipientRightsGuidelineItems: EvaluationRequirementItem[] = [
  { id: 'pressure-ulcer-prevention', label: '욕창예방', kind: 'checklist_item' },
  { id: 'fall-prevention', label: '낙상예방', kind: 'checklist_item' },
  { id: 'dehydration-prevention', label: '탈수예방', kind: 'checklist_item' },
  { id: 'bowel-assistance', label: '배변도움', kind: 'checklist_item' },
  { id: 'contracture-prevention', label: '관절구축예방', kind: 'checklist_item', aliases: ['관절 구축 예방'] },
  { id: 'dementia-prevention', label: '치매예방', kind: 'checklist_item' },
  { id: 'infection-prevention', label: '감염예방', kind: 'checklist_item' },
  { id: 'older-adult-human-rights', label: '노인인권보호', kind: 'checklist_item', aliases: ['인권보호'] },
];

export const recipientRightsGuidelineFixture: EvaluationRequirementCompletenessRule = {
  id: 'evaluation-completeness-recipient-rights-checklist',
  sourceDocumentTitle: '02-05-노인인권보호',
  indicatorTitle: '노인인권보호',
  requirementTitle: '수급자 8가지 지침 설명',
  aliases: [
    '8대 지침',
    '8가지 지침',
    '수급자 지침',
    '보호자 지침',
    '노인인권보호 지침',
    '신규수급자 지침',
    '신규 입소자 지침',
  ],
  requiredItems: [
    ...recipientRightsGuidelineItems,
    {
      id: 'target-all-recipients',
      label: '모든 수급자(보호자)',
      kind: 'target',
      aliases: ['모든 수급자', '보호자'],
    },
    {
      id: 'annual-frequency',
      label: '연 1회 이상',
      kind: 'frequency',
      aliases: ['매년 1회 이상', '1년에 1회 이상'],
    },
    {
      id: 'new-recipient-deadline',
      label: '급여제공 시작일부터 토요일·공휴일 포함 14일 이내',
      kind: 'deadline',
      aliases: ['급여제공 시작일', '14일 이내', '토요일', '공휴일 포함'],
      requiredForAnswer: false,
    },
    {
      id: 'evaluation-day-record-verification',
      label: '평가 당일 기록 확인',
      kind: 'verification_method',
      aliases: ['평가 당일', '기록 확인'],
    },
    {
      id: 'missing-record-noncompliance',
      label: '평가 당일 기록 미확인 시 불인정(N)',
      kind: 'noncompliance_condition',
      aliases: ['불인정', '불인정(N)', '기록이 없으면 불인정'],
      requiredForAnswer: false,
    },
  ],
  conditionalItems: [
    {
      whenQueryMatches: ['신규', '신규수급자', '신규 수급자', '신규 입소자', '입소자', '급여제공 시작', '14일'],
      requiredItemIds: ['new-recipient-deadline'],
    },
    {
      whenQueryMatches: ['기록', '평가 당일', '인정', '불인정', 'N'],
      requiredItemIds: ['missing-record-noncompliance'],
    },
  ],
  evidenceSelectors: [
    {
      documentTitleIncludes: ['02-05-노인인권보호'],
      sectionTitleIncludes: ['평가기준', '확인방법'],
      textIncludesAny: ['8가지 지침', '욕창예방', '낙상예방', '14일'],
    },
  ],
};

export const employeeEducationFixture: EvaluationRequirementCompletenessRule = {
  id: 'evaluation-completeness-staff-education-record-fields',
  sourceDocumentTitle: '01-06-직원교육',
  indicatorTitle: '직원교육',
  requirementTitle: '직원 운영규정 및 급여제공지침 교육',
  aliases: [
    '직원교육',
    '운영규정 교육',
    '급여제공지침 교육',
    '급여 제공 지침 교육',
    '신규직원 교육',
    '직원 교육 기록',
  ],
  requiredItems: [
    {
      id: 'staff-education-target-all-employees',
      label: '모든 직원',
      kind: 'target',
      aliases: ['직원 전체', '전 직원'],
    },
    {
      id: 'staff-education-annual-frequency',
      label: '연 1회 이상',
      kind: 'frequency',
      aliases: ['매년 1회 이상', '1년에 1회 이상'],
    },
    {
      id: 'staff-education-operating-regulation',
      label: '운영규정 교육',
      kind: 'checklist_item',
      aliases: ['운영규정교육'],
    },
    {
      id: 'staff-education-care-guideline',
      label: '급여제공지침 교육',
      kind: 'checklist_item',
      aliases: ['급여 제공 지침 교육', '급여제공지침'],
    },
    {
      id: 'staff-education-date',
      label: '교육일자',
      kind: 'evidence',
      aliases: ['교육일시', '교육 날짜'],
    },
    {
      id: 'staff-education-method',
      label: '교육방법',
      kind: 'evidence',
      aliases: ['교육 방식'],
    },
    {
      id: 'staff-education-instructor',
      label: '강사명',
      kind: 'evidence',
      aliases: ['강사 이름'],
    },
    {
      id: 'staff-education-attendee-signature',
      label: '참석자명(서명)',
      kind: 'evidence',
      aliases: ['참석자명', '서명'],
    },
    {
      id: 'new-staff-education-deadline',
      label: '신규직원은 급여제공 시작일로부터 7일 이내',
      kind: 'deadline',
      aliases: ['신규직원', '급여제공 시작일', '7일 이내'],
      requiredForAnswer: false,
    },
    {
      id: 'departed-staff-verification-exception',
      label: '평가 당일 퇴사일이 확인되는 직원은 교육실시 여부를 확인하지 않음',
      kind: 'exception_condition',
      aliases: ['퇴사일이 확인되는 직원', '교육실시 여부는 확인하지 않는다'],
      requiredForAnswer: false,
    },
    {
      id: 'unreported-departure-noncompliance',
      label: '지자체에 퇴직신고 되지 않은 경우 불인정(N)',
      kind: 'noncompliance_condition',
      aliases: ['퇴직신고 되지 않은 경우', '불인정(N)', '불인정'],
      requiredForAnswer: false,
    },
    {
      id: 'linked-standard-noncompliance',
      label: '기준①번이 불인정(N)되는 경우 기준③번도 연동하여 불인정(N)',
      kind: 'noncompliance_condition',
      aliases: ['기준①번', '기준③번', '연동하여 불인정'],
      requiredForAnswer: false,
    },
  ],
  conditionalItems: [
    {
      whenQueryMatches: ['신규', '신규직원', '급여제공 시작', '7일'],
      requiredItemIds: ['new-staff-education-deadline'],
    },
    {
      whenQueryMatches: ['퇴사', '퇴직', '퇴사일', '퇴직신고'],
      requiredItemIds: ['departed-staff-verification-exception', 'unreported-departure-noncompliance'],
    },
    {
      whenQueryMatches: ['기준①', '기준1', '기준③', '기준3', '연동', '불인정'],
      requiredItemIds: ['linked-standard-noncompliance'],
    },
  ],
  evidenceSelectors: [
    {
      documentTitleIncludes: ['01-06-직원교육'],
      sectionTitleIncludes: ['평가기준', '확인방법'],
      textIncludesAny: ['교육일자', '교육방법', '강사명', '참석자명', '신규직원', '7일 이내'],
    },
    {
      documentTitleIncludes: ['2026년 주야간보호 평가매뉴얼'],
      sectionTitleIncludes: ['직원교육'],
      textIncludesAny: ['교육일자', '교육방법', '강사명', '참석자명', '신규직원', '7일 이내'],
    },
  ],
};

export const employeeRightsProtectionFixture: EvaluationRequirementCompletenessRule = {
  id: 'evaluation-completeness-staff-rights-protection-guidance',
  sourceDocumentTitle: '01-07-직원인권보호',
  indicatorTitle: '직원인권보호',
  requirementTitle: '직원 인권침해 예방 및 상호존중 안내',
  aliases: [
    '직원인권보호',
    '직원 인권보호',
    '직원인권침해교육',
    '직원 인권침해 교육',
    '직원 인권침해 예방',
    '인권침해 대응조치',
    '폭언 폭행 성희롱 예방',
    '상호존중 안내',
  ],
  requiredItems: [
    {
      id: 'staff-rights-institution-effort',
      label: '직원의 인권보호를 위한 기관의 노력',
      kind: 'checklist_item',
      aliases: ['직원 인권보호를 위한 기관 노력', '포스터', '프로그램 운영', '기관 자체 교육'],
    },
    {
      id: 'staff-rights-target-all-recipients-guardians',
      label: '모든 수급자(보호자)',
      kind: 'target',
      aliases: ['모든 수급자', '보호자'],
    },
    {
      id: 'staff-rights-annual-frequency',
      label: '연 1회 이상',
      kind: 'frequency',
      aliases: ['매년 1회 이상', '1년에 1회 이상'],
    },
    {
      id: 'staff-rights-violence-harassment-prevention',
      label: '폭언·폭행·성희롱 예방',
      kind: 'checklist_item',
      aliases: ['폭언 예방', '폭행 예방', '성희롱 예방', '폭언·폭행·성희롱 발생 예방 수칙'],
    },
    {
      id: 'staff-rights-mutual-respect',
      label: '직원과 수급자의 상호존중',
      kind: 'checklist_item',
      aliases: ['상호존중', '상호 존중 수칙', '존칭사용'],
    },
    {
      id: 'staff-rights-guidance-date',
      label: '안내일자',
      kind: 'evidence',
      aliases: ['안내 일자'],
    },
    {
      id: 'staff-rights-guidance-method',
      label: '안내방법',
      kind: 'evidence',
      aliases: ['안내 방법', '우편', 'SMS', '문자', '이메일', '대면'],
    },
    {
      id: 'staff-rights-guidance-content',
      label: '안내내용',
      kind: 'evidence',
      aliases: ['안내 내용'],
    },
    {
      id: 'staff-rights-recipient-name',
      label: '수급자명',
      kind: 'evidence',
      aliases: ['수급자 이름'],
    },
    {
      id: 'staff-rights-guardian-name-relation',
      label: '보호자명(관계)',
      kind: 'evidence',
      aliases: ['보호자명', '보호자 관계'],
    },
    {
      id: 'staff-rights-evaluation-day-record',
      label: '평가 당일 기록 확인',
      kind: 'verification_method',
      aliases: ['평가 당일', '기록으로 확인'],
    },
    {
      id: 'staff-rights-new-recipient-start-deadline',
      label: '신규수급자는 급여제공 시작일까지 안내',
      kind: 'deadline',
      aliases: ['신규수급자', '급여제공 시작일', '급여개시일', '시작일까지 안내'],
      requiredForAnswer: false,
    },
    {
      id: 'staff-rights-missing-record-noncompliance',
      label: '평가 당일 기록 미확인 시 불인정(N)',
      kind: 'noncompliance_condition',
      aliases: ['불인정', '불인정(N)', '기록이 확인되지 않는 경우'],
      requiredForAnswer: false,
    },
  ],
  conditionalItems: [
    {
      whenQueryMatches: ['신규', '신규수급자', '급여제공 시작', '급여개시일'],
      requiredItemIds: ['staff-rights-new-recipient-start-deadline'],
    },
    {
      whenQueryMatches: ['기록', '평가 당일', '인정', '불인정', 'N'],
      requiredItemIds: ['staff-rights-missing-record-noncompliance'],
    },
  ],
  evidenceSelectors: [
    {
      documentTitleIncludes: ['01-07-직원인권보호'],
      sectionTitleIncludes: ['평가기준', '확인방법'],
      textIncludesAny: ['폭언', '폭행', '성희롱', '상호존중', '안내일자', '안내방법'],
    },
    {
      documentTitleIncludes: ['2026년 주야간보호 평가매뉴얼'],
      sectionTitleIncludes: ['직원인권보호'],
      textIncludesAny: ['폭언', '폭행', '성희롱', '상호존중', '안내일자', '안내방법'],
    },
  ],
};

export const EVALUATION_REQUIREMENT_FIXTURES: EvaluationRequirementCompletenessRule[] = [
  recipientRightsGuidelineFixture,
  employeeEducationFixture,
  employeeRightsProtectionFixture,
];

export function buildEvaluationRequirementFixtures(): EvaluationRequirementCompletenessRule[] {
  return EVALUATION_REQUIREMENT_FIXTURES.map((rule) => structuredClone(rule));
}

function compactText(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

function includesTerm(text: string, term: string): boolean {
  const normalizedTerm = compactText(term);
  return normalizedTerm.length > 0 && compactText(text).includes(normalizedTerm);
}

function matchesAnyTerm(text: string, terms: string[] | undefined): boolean {
  return !terms || terms.length === 0 || terms.some((term) => includesTerm(text, term));
}

function matchesAllTerms(text: string, terms: string[] | undefined): boolean {
  return !terms || terms.length === 0 || terms.every((term) => includesTerm(text, term));
}

function itemTerms(item: EvaluationRequirementItem): string[] {
  return [item.label, ...(item.aliases ?? [])];
}

function ruleTerms(rule: EvaluationRequirementCompletenessRule): string[] {
  return [
    rule.requirementTitle,
    rule.sourceDocumentTitle ?? '',
    rule.indicatorTitle ?? '',
    ...(rule.aliases ?? []),
    ...rule.requiredItems.flatMap(itemTerms),
  ].filter(Boolean);
}

function ruleCoreTerms(rule: EvaluationRequirementCompletenessRule): string[] {
  return [
    rule.requirementTitle,
    rule.sourceDocumentTitle ?? '',
    rule.indicatorTitle ?? '',
    ...(rule.aliases ?? []),
  ].filter(Boolean);
}

export function evidenceMatchesEvaluationRequirement(
  chunk: StructuredChunk,
  rule: EvaluationRequirementCompletenessRule,
): boolean {
  return rule.evidenceSelectors.some((selector) => {
    const sectionText = [chunk.parentSectionTitle, chunk.title, ...chunk.sectionPath].join(' ');
    const bodyText = [chunk.text, chunk.textPreview, chunk.searchText].join(' ');
    return (
      matchesAllTerms(chunk.docTitle, selector.documentTitleIncludes) &&
      matchesAnyTerm(sectionText, selector.sectionTitleIncludes) &&
      matchesAnyTerm(bodyText, selector.textIncludesAny) &&
      matchesAllTerms(bodyText, selector.textIncludesAll)
    );
  });
}

function questionHasEvaluationRequirementIntent(query: string): boolean {
  return /평가|평가기준|확인방법|확인|필수|항목|체크|지침|교육|기한|주기|빈도|대상|증빙|기록|불인정|감점|예외|언제|얼마나|며칠/u.test(query);
}

export function findMatchingEvaluationRequirements(
  query: string,
  ontologyOrFixtures: EvaluationRequirementCompletenessRule[] = buildEvaluationRequirementFixtures(),
): EvaluationRequirementMatch[] {
  if (!questionHasEvaluationRequirementIntent(query)) return [];

  return ontologyOrFixtures
    .map((rule) => {
      const coreHits = ruleCoreTerms(rule).filter((term) => includesTerm(query, term));
      const itemHits = rule.requiredItems.filter((item) => itemTerms(item).some((term) => includesTerm(query, term)));
      const matchedTerms = [...coreHits, ...itemHits.flatMap(itemTerms)];
      const itemScore = itemHits.reduce((sum, item) => sum + (item.requiredForAnswer === false ? 0.35 : 1), 0);
      const score = coreHits.length * 3 + itemScore;
      return { rule, score, matchedTerms };
    })
    .filter((match) => match.score >= 1)
    .sort((left, right) => right.score - left.score);
}

export function buildEvaluationRequirementDocumentBoosts(
  matches: EvaluationRequirementMatch[],
  chunks: StructuredChunk[],
): Map<string, number> {
  return buildEvaluationRequirementBoosts(matches, chunks).documentBoosts;
}

export function buildEvaluationRequirementChunkBoosts(
  matches: EvaluationRequirementMatch[],
  chunks: StructuredChunk[],
): Map<string, number> {
  return buildEvaluationRequirementBoosts(matches, chunks).chunkBoosts;
}

export function buildEvaluationRequirementBoosts(
  matches: EvaluationRequirementMatch[],
  chunks: StructuredChunk[],
): EvaluationRequirementBoosts {
  const documentBoosts = new Map<string, number>();
  const chunkBoosts = new Map<string, number>();
  if (matches.length === 0) return { documentBoosts, chunkBoosts };

  for (const chunk of chunks) {
    for (const match of matches) {
      if (!evidenceMatchesEvaluationRequirement(chunk, match.rule)) continue;
      const score = 2400 + Math.min(400, match.score * 80);
      const currentDocumentScore = documentBoosts.get(chunk.documentId) ?? 0;
      documentBoosts.set(chunk.documentId, Math.max(currentDocumentScore, score));
      const currentChunkScore = chunkBoosts.get(chunk.id) ?? 0;
      chunkBoosts.set(chunk.id, Math.max(currentChunkScore, score));
    }
  }

  return { documentBoosts, chunkBoosts };
}

function conditionMatches(question: string, condition: EvaluationRequirementConditionalItem): boolean {
  return condition.whenQueryMatches.some((term) => includesTerm(question, term));
}

export function getRequiredEvaluationRequirementItems(
  question: string,
  rule: EvaluationRequirementCompletenessRule,
): EvaluationRequirementItem[] {
  const requiredIds = new Set(
    rule.requiredItems.filter((item) => item.requiredForAnswer !== false).map((item) => item.id),
  );

  for (const condition of rule.conditionalItems ?? []) {
    if (!conditionMatches(question, condition)) continue;
    for (const itemId of condition.requiredItemIds) {
      requiredIds.add(itemId);
    }
  }

  return rule.requiredItems.filter((item) => requiredIds.has(item.id));
}

export function buildEvaluationRequirementCompletenessInstructions(
  params: EvaluationRequirementCompletenessInstructionParams,
): string[] {
  return params.matchedRequirements
    .filter((match) => params.evidence.some((chunk) => evidenceMatchesEvaluationRequirement(chunk, match.rule)))
    .map((match) => {
      const requiredItems = getRequiredEvaluationRequirementItems(params.question, match.rule);
      const grouped = requiredItems.map((item) => `${item.kind}: ${item.label}`).join('; ');
      return [
        `Evaluation requirement completeness [${match.rule.id}]`,
        `Requirement: ${match.rule.requirementTitle}`,
        `Answer must include every applicable structured item from the matched requirement: ${grouped || 'none'}.`,
        'Do not collapse checklist items into a vague summary when the evidence defines explicit items.',
      ].join('\n');
    });
}

function itemIsPresent(answerText: string, item: EvaluationRequirementItem): boolean {
  return itemTerms(item).some((term) => includesTerm(answerText, term));
}

function issueCodeForMissingItem(item: EvaluationRequirementItem): ValidationIssue['code'] {
  if (item.kind === 'deadline') return 'missing-evaluation-deadline';
  if (item.kind === 'verification_method') return 'missing-evaluation-verification-method';
  if (item.kind === 'noncompliance_condition') return 'missing-evaluation-noncompliance-condition';
  return 'missing-evaluation-required-item';
}

export function validateEvaluationRequirementCompleteness(
  params: EvaluationRequirementCompletenessValidationParams,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const match of params.matchedRequirements) {
    const hasEvidence = params.evidence.some((chunk) => evidenceMatchesEvaluationRequirement(chunk, match.rule));
    if (!hasEvidence) continue;

    const applicableItems = getRequiredEvaluationRequirementItems(params.question, match.rule);
    const missingItems = applicableItems.filter((item) => !itemIsPresent(params.answerText, item));
    for (const item of missingItems) {
      issues.push({
        code: issueCodeForMissingItem(item),
        severity: 'block',
        message: `Evaluation requirement item missing from answer: ${match.rule.requirementTitle} / ${item.label}`,
      });
    }

    for (const condition of match.rule.conditionalItems ?? []) {
      if (!conditionMatches(params.question, condition)) continue;
      const missingConditionalItems = match.rule.requiredItems.filter(
        (item) => condition.requiredItemIds.includes(item.id) && !itemIsPresent(params.answerText, item),
      );
      for (const item of missingConditionalItems) {
        if (issues.some((issue) => issue.message.includes(` / ${item.label}`))) continue;
        issues.push({
          code: 'missing-evaluation-conditional-item',
          severity: 'block',
          message: `Conditional evaluation requirement item missing from answer: ${match.rule.requirementTitle} / ${item.label}`,
        });
      }
    }
  }

  return issues;
}
