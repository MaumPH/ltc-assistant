import fs from 'fs';
import path from 'path';
import type {
  LawAliasResolution,
  NaturalLanguageQueryProfile,
  NaturalLanguageQueryType,
  OntologyConceptStatus,
  OntologyRelationType,
  ParsedLawReference,
  QueryNormalizationTraceEntry,
  SemanticEntityRef,
  SemanticFrame,
  SemanticPrimaryIntent,
  SemanticRelationRequest,
  SemanticSlotKey,
  SemanticSlotValue,
} from './ragTypes';
import { tokenize } from './ragMetadata';

interface LawAliasEntry {
  canonical: string;
  aliases: string[];
  alternatives?: string[];
}

interface LexiconEntry {
  expression: string;
  canonical: string;
  entity_type: string;
  slot_hint?: SemanticSlotKey;
  mode_scope?: string[];
  confidence?: number;
  status?: OntologyConceptStatus;
}

interface LexiconManifest {
  schema_version?: number;
  entries?: LexiconEntry[];
}

interface ParsedSearchQuery {
  lawName: string;
  article?: string;
  jo?: string;
  clause?: string;
  item?: string;
  subItem?: string;
  matchedAlias?: string;
}

const FALLBACK_LEXICON_ENTRIES: LexiconEntry[] = [
  { expression: '요양원', canonical: '노인요양시설', entity_type: 'institution', slot_hint: 'institution_type', confidence: 0.98, status: 'promoted' },
  { expression: '시설급여', canonical: '시설급여', entity_type: 'benefit', slot_hint: 'benefit_type', confidence: 0.96, status: 'promoted' },
  { expression: '주야간보호', canonical: '주야간보호', entity_type: 'service', slot_hint: 'service_scope', confidence: 0.98, status: 'promoted' },
  { expression: '데이케어', canonical: '주야간보호', entity_type: 'service', slot_hint: 'service_scope', confidence: 0.92, status: 'promoted' },
  { expression: '방문요양', canonical: '방문요양', entity_type: 'service', slot_hint: 'service_scope', confidence: 0.98, status: 'promoted' },
  { expression: '방문목욕', canonical: '방문목욕', entity_type: 'service', slot_hint: 'service_scope', confidence: 0.96, status: 'promoted' },
  { expression: '방문간호', canonical: '방문간호', entity_type: 'service', slot_hint: 'service_scope', confidence: 0.96, status: 'promoted' },
  { expression: '복지용구', canonical: '복지용구', entity_type: 'service', slot_hint: 'service_scope', confidence: 0.95, status: 'promoted' },
  { expression: '1등급', canonical: '장기요양 1등급', entity_type: 'grade', slot_hint: 'recipient_grade', confidence: 0.99, status: 'promoted' },
  { expression: '2등급', canonical: '장기요양 2등급', entity_type: 'grade', slot_hint: 'recipient_grade', confidence: 0.99, status: 'promoted' },
  { expression: '3등급', canonical: '장기요양 3등급', entity_type: 'grade', slot_hint: 'recipient_grade', confidence: 0.99, status: 'promoted' },
  { expression: '4등급', canonical: '장기요양 4등급', entity_type: 'grade', slot_hint: 'recipient_grade', confidence: 0.99, status: 'promoted' },
  { expression: '5등급', canonical: '장기요양 5등급', entity_type: 'grade', slot_hint: 'recipient_grade', confidence: 0.99, status: 'promoted' },
  { expression: '인지지원등급', canonical: '인지지원등급', entity_type: 'grade', slot_hint: 'recipient_grade', confidence: 0.99, status: 'promoted' },
  { expression: '본인부담금', canonical: '본인부담금', entity_type: 'cost_item', slot_hint: 'cost_topic', confidence: 0.97, status: 'promoted' },
  { expression: '감경', canonical: '본인부담금 감경', entity_type: 'exception', slot_hint: 'exception_context', confidence: 0.94, status: 'promoted' },
  { expression: '가산', canonical: '가산', entity_type: 'cost_item', slot_hint: 'cost_topic', confidence: 0.9, status: 'validated' },
  { expression: '의사소견서', canonical: '의사소견서', entity_type: 'form', slot_hint: 'document_type', confidence: 0.98, status: 'promoted' },
  { expression: '급여제공계획서', canonical: '급여제공계획서', entity_type: 'document', slot_hint: 'document_type', confidence: 0.97, status: 'promoted' },
  { expression: '케어플랜', canonical: '급여제공계획서', entity_type: 'document', slot_hint: 'document_type', confidence: 0.9, status: 'validated' },
  { expression: '요양보호사', canonical: '요양보호사', entity_type: 'actor', slot_hint: 'actor_role', confidence: 0.99, status: 'promoted' },
  { expression: '사회복지사', canonical: '사회복지사', entity_type: 'actor', slot_hint: 'actor_role', confidence: 0.99, status: 'promoted' },
  { expression: '시설장', canonical: '시설장', entity_type: 'actor', slot_hint: 'actor_role', confidence: 0.98, status: 'promoted' },
  { expression: '평가', canonical: '평가', entity_type: 'quality_indicator', slot_hint: 'time_scope', confidence: 0.86, status: 'validated' },
  { expression: '입소 초기', canonical: '입소 초기', entity_type: 'workflow', slot_hint: 'time_scope', confidence: 0.88, status: 'validated' },
];

const LAW_ALIAS_ENTRIES: LawAliasEntry[] = [
  {
    canonical: '노인장기요양보험법',
    aliases: ['장기요양보험법', '장기요양법', '노인장기요양법'],
    alternatives: ['노인장기요양보험법 시행령', '노인장기요양보험법 시행규칙'],
  },
  {
    canonical: '노인장기요양보험법 시행령',
    aliases: ['장기요양보험법 시행령', '장기요양법 시행령'],
  },
  {
    canonical: '노인장기요양보험법 시행규칙',
    aliases: ['장기요양보험법 시행규칙', '장기요양법 시행규칙'],
  },
  {
    canonical: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시',
    aliases: ['장기요양급여 고시', '급여비용 고시', '급여제공기준 고시'],
  },
  {
    canonical: '노인복지법',
    aliases: ['노복법'],
  },
  {
    canonical: '의료급여법',
    aliases: ['의료급여'],
  },
];

const FOOD_PREFERENCE_EVALUATION_RE =
  /기피\s*식품|기피식품|식품\s*선호|식품선호|선호도\s*조사|식사\s*만족|식사만족|희망\s*식사|희망식사|대체\s*식품|대체식품|대체\s*식단|대체식단|욕구\s*사정|욕구사정|식사\s*\(?간식\)?|식사간식|급식|식단표|영양사/u;

function isFoodPreferenceEvaluationQuery(query: string): boolean {
  return FOOD_PREFERENCE_EVALUATION_RE.test(query);
}

function hasDefinitionExplanationSignal(query: string): boolean {
  return /설명|이란\s*(뭐|무엇|어떤)|뭔가요|의미가|뜻이/u.test(query);
}

const QUERY_TYPE_PATTERNS: Array<{ type: NaturalLanguageQueryType; patterns: RegExp[] }> = [
  { type: 'comparison', patterns: [/차이/u, /비교/u, /구분/u, /\bvs\b/i] },
  { type: 'checklist', patterns: [/체크리스트/u, /뭐\s*준비/u, /무엇\s*준비/u, /확인사항/u, /챙겨/u] },
  { type: 'procedure', patterns: [/어떻게/u, /절차/u, /방법/u, /순서/u, /진행/u, /신청/u, /제출/u] },
  { type: 'requirement', patterns: [/가능/u, /될까/u, /되나/u, /돼/u, /수\s*있/u, /해도/u, /필수/u, /해야/u, /의무/u, /대상/u, /조건/u] },
  { type: 'scope', patterns: [/얼마/u, /금액/u, /범위/u, /기간/u, /언제까지/u] },
  { type: 'consequence', patterns: [/위반/u, /제재/u, /처분/u, /벌점/u] },
  { type: 'exemption', patterns: [/예외/u, /감경/u, /면제/u, /제외/u] },
  { type: 'definition', patterns: [/뭐야/u, /무엇/u, /정의/u, /개념/u, /뜻/u, /설명/u, /이란/u] },
];

const QUERY_TERM_EXPANSIONS: Array<{ triggers: string[]; expansions: string[] }> = [
  {
    triggers: ['기피식품', '식품선호', '식품선호도', '선호도 조사', '식사만족도', '식사 만족도'],
    expansions: ['기피식품', '식사만족도', '식사 만족도', '희망 식사', '대체식품', '대체 식품', '욕구사정', '식사간식'],
  },
  { triggers: ['뭐야', '무엇', '정의', '개념', '뜻'], expansions: ['정의', '개념', '무엇인가'] },
  { triggers: ['뭐 준비', '무엇 준비', '챙겨'], expansions: ['체크리스트', '확인사항', '준비서류'] },
  { triggers: ['어떻게', '방법', '절차'], expansions: ['절차', '방법', '순서'] },
  { triggers: ['가능', '될까', '되나', '돼', '수 있어', '해도', '대상'], expansions: ['가능 여부', '해도 되는지', '적용 조건'] },
  { triggers: ['본인부담', '비용', '금액'], expansions: ['본인부담금', '급여비용', '산정기준'] },
  { triggers: ['예외', '감경', '면제'], expansions: ['예외', '단서', '제외 기준'] },
  { triggers: ['인력현황', '직원현황', '인력배치'], expansions: ['인력기준', '인력배치기준', '직원배치기준', '인력신고 현황'] },
];

const RELATION_TO_QUERY_TERMS: Record<OntologyRelationType, string[]> = {
  'alias-of': ['동의어', '같은 용어'],
  requires: ['필요 서류', '요건', '필수'],
  'eligible-for': ['대상', '가능 여부', '적용 조건'],
  'not-eligible-for': ['제외', '불가', '제한'],
  'applies-to': ['적용 대상', '해당 기준'],
  'not-applies-to': ['비적용', '예외 적용 제외'],
  'belongs-to': ['분류', '소속'],
  'uses-document': ['서류', '문서', '작성'],
  'has-cost': ['본인부담금', '비용', '산정'],
  'limited-by': ['제한', '조건', '상한'],
  'exception-of': ['예외', '단서', '감경'],
  'conflicts-with': ['충돌', '주의', '제재'],
  'evidenced-by': ['근거', '증빙'],
  'follows-step': ['절차', '순서', '진행'],
  'same-as': ['동일', '같은 개념'],
};

const INTENT_RELATIONS: Record<SemanticPrimaryIntent, OntologyRelationType[]> = {
  eligibility: ['eligible-for', 'not-eligible-for', 'requires', 'limited-by'],
  compliance: ['applies-to', 'requires', 'limited-by', 'conflicts-with'],
  cost: ['has-cost', 'limited-by', 'exception-of'],
  document: ['uses-document', 'requires'],
  workflow: ['follows-step', 'uses-document', 'requires'],
  comparison: ['same-as', 'conflicts-with', 'belongs-to'],
  definition: ['same-as', 'belongs-to'],
  exception: ['exception-of', 'limited-by', 'not-applies-to'],
  sanction: ['conflicts-with', 'applies-to', 'limited-by'],
};

const GENERIC_STOP_TOKENS = new Set([
  '알려줘',
  '알려주세요',
  '설명',
  '설명해줘',
  '설명해주세요',
  '질문',
  '문의',
  '뭐야',
  '뭔가요',
  '무엇',
  '이게',
  '이건',
  '그게',
  '그건',
  '어떻게',
  '해도',
  '될까',
  '가능',
  '준비',
  '확인',
  '해주세요',
]);

let cachedLexiconProjectRoot = '';
let cachedLexiconEntries: LexiconEntry[] | null = null;

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean)));
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeAliasKey(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[()[\]{}'"`’‘“”.,/\\\-_:;!?]/gu, ' ')
    .replace(/\s+/gu, '')
    .trim();
}

export function compactQueryText(value: string): string {
  return normalizeAliasKey(value);
}

export function normalizeLawSearchText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[\u00a0\u2002\u2003\u2009]/gu, ' ')
    .replace(/[‐‑‒–—―]/gu, '-')
    .replace(/\s*-\s*/gu, '-')
    .replace(/\s+/gu, ' ')
    .replace(/제\s+(\d+)\s+조/gu, '제$1조')
    .replace(/제\s+(\d+)\s+항/gu, '제$1항')
    .replace(/제\s+(\d+)\s+호/gu, '제$1호')
    .replace(/제\s+(\d+)\s+목/gu, '제$1목')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .trim();
}

function resolveProjectRoot(projectRoot?: string): string {
  if (projectRoot?.trim()) return projectRoot;
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
    return process.cwd();
  }
  return '.';
}

export function loadOntologyLexiconEntries(projectRoot?: string): LexiconEntry[] {
  const resolvedProjectRoot = resolveProjectRoot(projectRoot);
  if (cachedLexiconEntries && cachedLexiconProjectRoot === resolvedProjectRoot) {
    return cachedLexiconEntries;
  }

  const manifestPath = path.join(resolvedProjectRoot, 'knowledge', 'ontology', 'lexicon.json');
  try {
    if (fs.existsSync(manifestPath)) {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as LexiconManifest;
      const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      cachedLexiconEntries = entries
        .filter((entry) => typeof entry.expression === 'string' && typeof entry.canonical === 'string')
        .map((entry) => ({
          expression: entry.expression,
          canonical: entry.canonical,
          entity_type: entry.entity_type,
          slot_hint: entry.slot_hint,
          mode_scope: entry.mode_scope,
          confidence: safeNumber(entry.confidence, 0.75),
          status: entry.status ?? 'validated',
        }));
      cachedLexiconProjectRoot = resolvedProjectRoot;
      return cachedLexiconEntries;
    }
  } catch {
    // Fall through to the embedded defaults.
  }

  cachedLexiconProjectRoot = resolvedProjectRoot;
  cachedLexiconEntries = FALLBACK_LEXICON_ENTRIES;
  return cachedLexiconEntries;
}

function resolveAliasEntry(lawName: string): LawAliasResolution {
  const normalizedKey = normalizeAliasKey(lawName);
  const entry = LAW_ALIAS_ENTRIES.find((item) =>
    [item.canonical, ...item.aliases].some((candidate) => normalizeAliasKey(candidate) === normalizedKey),
  );
  if (!entry) {
    return {
      canonical: lawName.trim(),
      alias: lawName,
      alternatives: [],
    };
  }

  const matchedAlias = entry.aliases.find((alias) => normalizeAliasKey(alias) === normalizedKey);
  return {
    canonical: entry.canonical,
    alias: lawName,
    matchedAlias,
    alternatives: entry.alternatives ?? [],
  };
}

export function detectAliasesInQuery(query: string): LawAliasResolution[] {
  const normalizedQuery = normalizeAliasKey(query);
  if (!normalizedQuery) return [];

  const hits: LawAliasResolution[] = [];
  const seen = new Set<string>();
  for (const entry of LAW_ALIAS_ENTRIES) {
    for (const candidate of [entry.canonical, ...entry.aliases]) {
      const normalized = normalizeAliasKey(candidate);
      if (normalized.length < 2 || !normalizedQuery.includes(normalized) || seen.has(entry.canonical)) continue;
      seen.add(entry.canonical);
      hits.push({
        canonical: entry.canonical,
        alias: candidate,
        matchedAlias: entry.aliases.find((alias) => normalizeAliasKey(alias) === normalized),
        alternatives: entry.alternatives ?? [],
      });
      break;
    }
  }
  return hits;
}

function looksLikeLawName(value: string): boolean {
  return /(법|시행령|시행규칙|고시|규정|지침)$/u.test(value) || LAW_ALIAS_ENTRIES.some((entry) =>
    [entry.canonical, ...entry.aliases].some((candidate) => normalizeAliasKey(candidate) === normalizeAliasKey(value)),
  );
}

function parseSearchQuery(query: string): ParsedSearchQuery | null {
  const normalizedQuery = normalizeLawSearchText(query);
  const articlePattern =
    /^(.*?)(제\s*\d+\s*조(?:의\s*\d+)?)(?:\s*(제\s*\d+\s*항))?(?:\s*(제\s*\d+\s*호))?(?:\s*(제\s*\d+\s*목))?$/u;
  const match = normalizedQuery.match(articlePattern);
  if (!match) return null;

  const rawLawName = normalizeLawSearchText(match[1] ?? '').trim();
  if (!looksLikeLawName(rawLawName)) return null;

  const lawResolution = resolveAliasEntry(rawLawName);
  const article = normalizeLawSearchText(match[2] ?? '').replace(/\s+/gu, '');
  const articleJoMatch = article.match(/제(\d+)조(?:의(\d+))?/u);
  const clause = (match[3] ?? '').match(/제(\d+)항/u)?.[1];
  const item = (match[4] ?? '').match(/제(\d+)호/u)?.[1];
  const subItem = (match[5] ?? '').match(/제(\d+)목/u)?.[1];
  const jo = articleJoMatch
    ? `${articleJoMatch[1].padStart(4, '0')}${(articleJoMatch[2] ?? '0').padStart(2, '0')}`
    : undefined;

  return {
    lawName: lawResolution.canonical,
    article,
    jo,
    clause,
    item,
    subItem,
    matchedAlias: lawResolution.matchedAlias,
  };
}

function buildQueryTypeExpansions(query: string): string[] {
  const normalized = normalizeLawSearchText(query);
  const lower = normalized.toLowerCase();
  const expansions: string[] = [];

  for (const group of QUERY_TERM_EXPANSIONS) {
    if (!group.triggers.some((trigger) => lower.includes(trigger.toLowerCase()))) continue;
    expansions.push(...group.expansions);
  }

  return uniqueStrings(expansions);
}

function extractLexiconHits(query: string, lexiconEntries: LexiconEntry[]): LexiconEntry[] {
  const compactQuery = compactQueryText(query);
  return lexiconEntries
    .filter((entry) => compactQuery.includes(compactQueryText(entry.expression)))
    .sort((left, right) => safeNumber(right.confidence, 0.75) - safeNumber(left.confidence, 0.75));
}

function looksLikeExplicitDocumentLookup(query: string): boolean {
  return (
    /((어느|어떤|해당|관련)\s*(문서|서류|자료|양식|서식))/u.test(query) ||
    /((문서|서류|자료|양식|서식).*(찾|보여|알려|확인|다운로드|첨부))/u.test(query) ||
    /((찾|보여|알려|확인).*(문서|서류|자료|양식|서식))/u.test(query)
  );
}

function hasEligibilityCue(query: string): boolean {
  return /누가|대상자?|자격|해당자|신청\s*자격|이용\s*대상|수급자|가능한\s*사람/u.test(query);
}

function hasComplianceCue(query: string): boolean {
  return (
    /기준|별표|인력기준|시설기준|배치기준|운영기준|필수|의무|언제까지|기한|통보|평가예정통보|안내해야/u.test(query) ||
    /어느\s*별표/u.test(query)
  );
}

function hasWorkflowCue(query: string): boolean {
  return /작성|수립|절차|순서|진행|신고/u.test(query);
}

function inferNaturalLanguagePrimaryIntent(query: string, queryType: NaturalLanguageQueryType): SemanticPrimaryIntent {
  const explicitDocumentLookup = looksLikeExplicitDocumentLookup(query);
  const eligibilityCue = hasEligibilityCue(query);
  const complianceCue = hasComplianceCue(query);

  if (isFoodPreferenceEvaluationQuery(query)) {
    if (hasDefinitionExplanationSignal(query)) return 'definition';
    return 'workflow';
  }
  if (/예외|감경|면제|제외|단서/u.test(query)) return 'exception';
  if (/본인부담|비용|금액|수가|본인부담금/u.test(query)) return 'cost';
  if (/제재|처분|위반|벌점/u.test(query)) return 'sanction';
  if (eligibilityCue) return 'eligibility';
  if (complianceCue) return 'compliance';
  if (explicitDocumentLookup) return 'document';
  if (hasWorkflowCue(query)) return 'workflow';
  if (queryType === 'comparison') return 'comparison';
  if (queryType === 'definition') return 'definition';
  if (queryType === 'procedure' || queryType === 'checklist') return 'workflow';
  if (queryType === 'exemption') return 'exception';
  if (queryType === 'consequence') return 'sanction';
  if (queryType === 'scope') return 'cost';
  if (queryType === 'requirement') return eligibilityCue ? 'eligibility' : 'compliance';
  return 'compliance';
}

export function inferNaturalLanguageQueryType(query: string): NaturalLanguageQueryType {
  if (isFoodPreferenceEvaluationQuery(query)) {
    if (hasDefinitionExplanationSignal(query)) return 'definition';
    return 'checklist';
  }

  for (const entry of QUERY_TYPE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(query))) {
      return entry.type;
    }
  }
  return 'application';
}

function createSlotValue(entry: LexiconEntry, source: SemanticSlotValue['source']): SemanticSlotValue {
  return {
    value: entry.expression,
    canonical: entry.canonical,
    confidence: safeNumber(entry.confidence, 0.75),
    source,
    entityType: entry.entity_type,
    status: entry.status && entry.status !== 'rejected' ? entry.status : undefined,
  };
}

function pushSlotValue(
  slots: SemanticFrame['slots'],
  slotKey: SemanticSlotKey,
  value: SemanticSlotValue,
): void {
  const existing = slots[slotKey] ?? [];
  if (existing.some((entry) => entry.canonical === value.canonical)) {
    return;
  }
  slots[slotKey] = [...existing, value];
}

function deriveHeuristicSlots(query: string, slots: SemanticFrame['slots']): void {
  const normalized = normalizeLawSearchText(query);

  const gradeMatches = normalized.match(/[1-5]등급|인지지원등급/gu) ?? [];
  for (const grade of gradeMatches) {
    pushSlotValue(slots, 'recipient_grade', {
      value: grade,
      canonical: grade === '인지지원등급' ? grade : `장기요양 ${grade}`,
      confidence: 0.92,
      source: 'heuristic',
      entityType: 'grade',
      status: 'validated',
    });
  }

  if (/입소|요양원/u.test(normalized)) {
    pushSlotValue(slots, 'institution_type', {
      value: '요양원',
      canonical: '노인요양시설',
      confidence: 0.88,
      source: 'heuristic',
      entityType: 'institution',
      status: 'promoted',
    });
    pushSlotValue(slots, 'benefit_type', {
      value: '입소',
      canonical: '시설급여',
      confidence: 0.78,
      source: 'heuristic',
      entityType: 'benefit',
      status: 'validated',
    });
  }

  if (/주야간|데이케어|주간보호/u.test(normalized)) {
    pushSlotValue(slots, 'service_scope', {
      value: '주야간보호',
      canonical: '주야간보호',
      confidence: 0.9,
      source: 'heuristic',
      entityType: 'service',
      status: 'promoted',
    });
  }

  if (/방문요양/u.test(normalized)) {
    pushSlotValue(slots, 'service_scope', {
      value: '방문요양',
      canonical: '방문요양',
      confidence: 0.9,
      source: 'heuristic',
      entityType: 'service',
      status: 'promoted',
    });
  }

  if (/본인부담|비용|금액/u.test(normalized)) {
    pushSlotValue(slots, 'cost_topic', {
      value: '비용',
      canonical: '본인부담금',
      confidence: 0.82,
      source: 'heuristic',
      entityType: 'cost_item',
      status: 'validated',
    });
  }

  if (/감경|예외|면제|제외/u.test(normalized)) {
    pushSlotValue(slots, 'exception_context', {
      value: '예외',
      canonical: '예외',
      confidence: 0.84,
      source: 'heuristic',
      entityType: 'exception',
      status: 'validated',
    });
  }

  if (/의사소견서|급여제공계획서|케어플랜|서식|서류/u.test(normalized)) {
    pushSlotValue(slots, 'document_type', {
      value: '서류',
      canonical: '서류',
      confidence: 0.7,
      source: 'heuristic',
      entityType: 'document',
      status: 'validated',
    });
  }
}

function buildEntityRefs(
  lexiconHits: LexiconEntry[],
  slots: SemanticFrame['slots'],
  aliasResolutions: LawAliasResolution[],
  parsedLawRefs: ParsedLawReference[],
): SemanticEntityRef[] {
  const refs: SemanticEntityRef[] = lexiconHits.map((entry) => ({
    label: entry.expression,
    canonical: entry.canonical,
    entityType: entry.entity_type,
    confidence: safeNumber(entry.confidence, 0.75),
    source: 'lexicon',
    status: entry.status && entry.status !== 'rejected' ? entry.status : undefined,
  }));

  for (const values of Object.values(slots)) {
    for (const value of values ?? []) {
      refs.push({
        label: value.value,
        canonical: value.canonical,
        entityType: value.entityType ?? 'concept',
        confidence: value.confidence,
        source: value.source === 'lexicon' ? 'lexicon' : 'heuristic',
        status: value.status,
      });
    }
  }

  for (const alias of aliasResolutions) {
    refs.push({
      label: alias.alias,
      canonical: alias.canonical,
      entityType: 'law',
      confidence: 0.95,
      source: 'query',
      status: 'promoted',
    });
  }

  for (const lawRef of parsedLawRefs) {
    refs.push({
      label: lawRef.raw,
      canonical: lawRef.article ? `${lawRef.canonicalLawName} ${lawRef.article}` : lawRef.canonicalLawName,
      entityType: 'law',
      confidence: 0.98,
      source: 'query',
      status: 'promoted',
    });
  }

  const deduped = new Map<string, SemanticEntityRef>();
  for (const ref of refs) {
    const key = `${ref.entityType}:${compactQueryText(ref.canonical)}`;
    const current = deduped.get(key);
    if (!current || current.confidence < ref.confidence) {
      deduped.set(key, ref);
    }
  }
  return Array.from(deduped.values()).sort((left, right) => right.confidence - left.confidence);
}

function buildRelationRequests(
  primaryIntent: SemanticPrimaryIntent,
  secondaryIntents: SemanticPrimaryIntent[],
  slots: SemanticFrame['slots'],
): SemanticRelationRequest[] {
  const intents = [primaryIntent, ...secondaryIntents];
  const requests: SemanticRelationRequest[] = [];
  const seen = new Set<OntologyRelationType>();

  const addRequest = (relation: OntologyRelationType, weight: number, reason: string, source: SemanticRelationRequest['source']) => {
    if (seen.has(relation)) return;
    seen.add(relation);
    requests.push({ relation, weight, reason, source });
  };

  for (const intent of intents) {
    for (const relation of INTENT_RELATIONS[intent] ?? []) {
      addRequest(relation, intent === primaryIntent ? 1.2 : 0.9, `${intent} intent`, 'intent');
    }
  }

  if ((slots.cost_topic?.length ?? 0) > 0) {
    addRequest('has-cost', 1.15, 'cost slot detected', 'slot');
  }
  if ((slots.document_type?.length ?? 0) > 0) {
    addRequest('uses-document', 1.05, 'document slot detected', 'slot');
  }
  if ((slots.exception_context?.length ?? 0) > 0) {
    addRequest('exception-of', 1.15, 'exception slot detected', 'slot');
  }
  if ((slots.service_scope?.length ?? 0) > 0 || (slots.institution_type?.length ?? 0) > 0) {
    addRequest('applies-to', 1.05, 'service or institution slot detected', 'slot');
  }
  if ((slots.recipient_grade?.length ?? 0) > 0) {
    addRequest('eligible-for', 1.08, 'grade slot detected', 'slot');
  }

  return requests;
}

function buildCriticalSlotList(primaryIntent: SemanticPrimaryIntent): SemanticSlotKey[] {
  if (primaryIntent === 'eligibility') {
    return ['service_scope', 'institution_type', 'recipient_grade'];
  }
  if (primaryIntent === 'compliance') {
    return ['service_scope', 'institution_type'];
  }
  if (primaryIntent === 'cost') {
    return ['service_scope', 'recipient_grade'];
  }
  if (primaryIntent === 'document' || primaryIntent === 'workflow') {
    return ['service_scope', 'document_type'];
  }
  if (primaryIntent === 'exception') {
    return ['exception_context', 'service_scope'];
  }
  return [];
}

function buildAssumptions(
  normalizedQuery: string,
  primaryIntent: SemanticPrimaryIntent,
  slots: SemanticFrame['slots'],
): { assumptions: string[]; missingCriticalSlots: SemanticSlotKey[]; riskLevel: SemanticFrame['riskLevel'] } {
  const assumptions: string[] = [];
  const criticalSlots = buildCriticalSlotList(primaryIntent);
  const missingCriticalSlots = criticalSlots.filter((slot) => (slots[slot]?.length ?? 0) === 0);

  if ((slots.institution_type?.length ?? 0) > 0 && (slots.service_scope?.length ?? 0) === 0) {
    const topInstitution = slots.institution_type?.[0];
    if (topInstitution?.canonical === '노인요양시설') {
      assumptions.push('질문의 적용 범위를 노인요양시설/시설급여 맥락으로 우선 해석했습니다.');
    }
  }

  if ((slots.document_type?.length ?? 0) > 0 && /서류|양식|문서/u.test(normalizedQuery)) {
    assumptions.push('문서 질문은 공식 서식 또는 운영상 필수 문서 기준으로 우선 해석했습니다.');
  }

  if ((slots.recipient_grade?.length ?? 0) === 0 && /(수급자|어르신|보호자|입소)/u.test(normalizedQuery) && primaryIntent === 'eligibility') {
    assumptions.push('등급 정보가 없어서 일반적인 장기요양 수급자 기준으로 조건을 안내해야 할 수 있습니다.');
  }

  let riskLevel: SemanticFrame['riskLevel'] = 'low';
  if (missingCriticalSlots.length >= 2) {
    riskLevel = 'high';
  } else if (missingCriticalSlots.length === 1 || assumptions.length > 0) {
    riskLevel = 'medium';
  }

  return {
    assumptions,
    missingCriticalSlots,
    riskLevel,
  };
}

function buildCanonicalTerms(
  normalizedQuery: string,
  entityRefs: SemanticEntityRef[],
  slots: SemanticFrame['slots'],
  queryTypeExpansions: string[],
): string[] {
  const terms = new Set<string>();
  for (const ref of entityRefs) {
    terms.add(ref.canonical);
  }

  for (const values of Object.values(slots)) {
    for (const value of values ?? []) {
      terms.add(value.canonical);
    }
  }

  for (const token of tokenize(normalizedQuery)) {
    if (token.length < 2 || GENERIC_STOP_TOKENS.has(token)) continue;
    terms.add(token);
  }

  for (const expansion of queryTypeExpansions) {
    terms.add(expansion);
  }

  return uniqueStrings(Array.from(terms)).slice(0, 24);
}

function buildRelationDrivenVariants(relationRequests: SemanticRelationRequest[]): string[] {
  return uniqueStrings(
    relationRequests.flatMap((request) => RELATION_TO_QUERY_TERMS[request.relation as OntologyRelationType] ?? []),
  );
}

function buildSemanticFrame(params: {
  normalizedQuery: string;
  queryType: NaturalLanguageQueryType;
  aliasResolutions: LawAliasResolution[];
  parsedLawRefs: ParsedLawReference[];
  lexiconHits: LexiconEntry[];
  queryTypeExpansions: string[];
}): SemanticFrame {
  const primaryIntent = inferNaturalLanguagePrimaryIntent(params.normalizedQuery, params.queryType);
  const secondaryIntents = uniqueStrings([
    params.queryType === 'checklist' || params.queryType === 'procedure' ? 'workflow' : '',
    (params.lexiconHits.some((entry) => entry.slot_hint === 'cost_topic') ? 'cost' : '') as SemanticPrimaryIntent | '',
    (params.lexiconHits.some((entry) => entry.slot_hint === 'document_type') ? 'document' : '') as SemanticPrimaryIntent | '',
    (params.queryType === 'comparison' ? 'comparison' : '') as SemanticPrimaryIntent | '',
  ]).filter((value): value is SemanticPrimaryIntent => value !== primaryIntent) as SemanticPrimaryIntent[];

  const slots: SemanticFrame['slots'] = {};
  for (const entry of params.lexiconHits) {
    if (!entry.slot_hint) continue;
    pushSlotValue(slots, entry.slot_hint, createSlotValue(entry, 'lexicon'));
  }
  deriveHeuristicSlots(params.normalizedQuery, slots);

  const entityRefs = buildEntityRefs(params.lexiconHits, slots, params.aliasResolutions, params.parsedLawRefs);
  const relationRequests = buildRelationRequests(primaryIntent, secondaryIntents, slots);
  const canonicalTerms = buildCanonicalTerms(params.normalizedQuery, entityRefs, slots, params.queryTypeExpansions);
  const { assumptions, missingCriticalSlots, riskLevel } = buildAssumptions(
    params.normalizedQuery,
    primaryIntent,
    slots,
  );

  return {
    primaryIntent,
    secondaryIntents,
    canonicalTerms,
    entityRefs,
    relationRequests,
    slots,
    assumptions,
    missingCriticalSlots,
    riskLevel,
  };
}

function buildSemanticVariants(semanticFrame: SemanticFrame): string[] {
  const variants = [
    ...semanticFrame.canonicalTerms,
    ...buildRelationDrivenVariants(semanticFrame.relationRequests),
    ...Object.values(semanticFrame.slots).flatMap((values) => (values ?? []).map((value) => value.canonical)),
  ];
  return uniqueStrings(variants);
}

function recomputeSemanticRiskLevel(
  missingCriticalSlots: SemanticSlotKey[],
  assumptions: string[],
): SemanticFrame['riskLevel'] {
  if (missingCriticalSlots.length >= 2) return 'high';
  if (missingCriticalSlots.length === 1 || assumptions.length > 0) return 'medium';
  return 'low';
}

export function buildNaturalLanguageQueryProfile(
  query: string,
  options?: { projectRoot?: string },
): NaturalLanguageQueryProfile {
  const normalizationTrace: QueryNormalizationTraceEntry[] = [];
  const originalQuery = query.trim();
  const normalizedQuery = normalizeLawSearchText(originalQuery);
  normalizationTrace.push({ step: 'normalize-query', detail: normalizedQuery || '(empty)' });

  const lexiconEntries = loadOntologyLexiconEntries(options?.projectRoot);
  const lexiconHits = extractLexiconHits(normalizedQuery, lexiconEntries);
  if (lexiconHits.length > 0) {
    normalizationTrace.push({
      step: 'normalize-terms',
      detail: lexiconHits
        .slice(0, 6)
        .map((entry) => `${entry.expression}->${entry.canonical}`)
        .join(', '),
    });
  }

  const aliasResolutions = detectAliasesInQuery(normalizedQuery);
  if (aliasResolutions.length > 0) {
    normalizationTrace.push({
      step: 'resolve-aliases',
      detail: aliasResolutions.map((item) => `${item.alias}->${item.canonical}`).join(', '),
    });
  }

  const parsedLawRefs: ParsedLawReference[] = [];
  const parsed = parseSearchQuery(normalizedQuery);
  if (parsed) {
    parsedLawRefs.push({
      raw: normalizedQuery,
      canonicalLawName: parsed.lawName,
      article: parsed.article,
      jo: parsed.jo,
      clause: parsed.clause,
      item: parsed.item,
      subItem: parsed.subItem,
      matchedAlias: parsed.matchedAlias,
    });
    normalizationTrace.push({
      step: 'parse-law-refs',
      detail: `${parsed.lawName}${parsed.article ? ` ${parsed.article}` : ''}`,
    });
  }

  const queryType = inferNaturalLanguageQueryType(normalizedQuery);
  normalizationTrace.push({ step: 'classify-query', detail: queryType });

  const queryTypeExpansions = buildQueryTypeExpansions(normalizedQuery);
  if (queryTypeExpansions.length > 0) {
    normalizationTrace.push({
      step: 'expand-synonyms',
      detail: queryTypeExpansions.slice(0, 6).join(' | '),
    });
  }

  const semanticFrame = buildSemanticFrame({
    normalizedQuery,
    queryType,
    aliasResolutions,
    parsedLawRefs,
    lexiconHits,
    queryTypeExpansions,
  });
  normalizationTrace.push({
    step: 'semantic-frame',
    detail: `${semanticFrame.primaryIntent} / risk=${semanticFrame.riskLevel}`,
  });

  const aliasVariants = aliasResolutions.flatMap((item) => [item.canonical, ...item.alternatives]);
  const lawVariants = parsedLawRefs.flatMap((item) =>
    uniqueStrings([
      item.canonicalLawName,
      item.article ? `${item.canonicalLawName} ${item.article}` : '',
      item.clause && item.article ? `${item.canonicalLawName} ${item.article} 제${item.clause}항` : '',
      item.item && item.article ? `${item.canonicalLawName} ${item.article} 제${item.item}호` : '',
    ]),
  );
  const semanticVariants = buildSemanticVariants(semanticFrame);

  const searchVariants = uniqueStrings([
    normalizedQuery,
    ...aliasVariants,
    ...lawVariants,
    ...queryTypeExpansions,
    ...semanticVariants,
  ]);
  normalizationTrace.push({
    step: 'search-variants',
    detail: `${searchVariants.length} variants`,
  });

  return {
    originalQuery,
    normalizedQuery,
    queryType,
    aliasResolutions,
    parsedLawRefs,
    synonymExpansions: queryTypeExpansions,
    searchVariants,
    normalizationTrace,
    semanticFrame,
  };
}

export function enrichQueryProfileWithServiceScopeLabels(
  profile: NaturalLanguageQueryProfile,
  serviceScopeLabels: readonly string[],
): NaturalLanguageQueryProfile {
  const labels = uniqueStrings(serviceScopeLabels).filter(
    (label) => label && !/^\s*전체\s*\/\s*공통\s*$/u.test(label),
  );
  if (labels.length === 0) {
    return profile;
  }

  const serviceScopeKeys = new Set(
    (profile.semanticFrame.slots.service_scope ?? []).map((value) => compactQueryText(value.canonical)),
  );
  const nextServiceScopeValues = [
    ...(profile.semanticFrame.slots.service_scope ?? []),
    ...labels
      .filter((label) => !serviceScopeKeys.has(compactQueryText(label)))
      .map((label) => ({
        value: label,
        canonical: label,
        confidence: 0.99,
        source: 'query' as const,
        entityType: 'service',
        status: 'promoted' as const,
      })),
  ];

  const entityRefs = new Map(
    profile.semanticFrame.entityRefs.map((entity) => [`${entity.entityType}:${compactQueryText(entity.canonical)}`, entity]),
  );
  for (const label of labels) {
    const key = `service:${compactQueryText(label)}`;
    if (!entityRefs.has(key)) {
      entityRefs.set(key, {
        label,
        canonical: label,
        entityType: 'service',
        confidence: 0.99,
        source: 'query',
        status: 'promoted',
      });
    }
  }

  const relationRequests = [...profile.semanticFrame.relationRequests];
  if (!relationRequests.some((request) => request.relation === 'applies-to')) {
    relationRequests.push({
      relation: 'applies-to',
      weight: 1.05,
      reason: 'selected service scope',
      source: 'slot',
    });
  }

  const missingCriticalSlots = profile.semanticFrame.missingCriticalSlots.filter((slot) => slot !== 'service_scope');
  const semanticFrame: SemanticFrame = {
    ...profile.semanticFrame,
    canonicalTerms: uniqueStrings([...profile.semanticFrame.canonicalTerms, ...labels]),
    entityRefs: Array.from(entityRefs.values()).sort((left, right) => right.confidence - left.confidence),
    relationRequests,
    slots: {
      ...profile.semanticFrame.slots,
      service_scope: nextServiceScopeValues,
    },
    missingCriticalSlots,
    riskLevel: recomputeSemanticRiskLevel(missingCriticalSlots, profile.semanticFrame.assumptions),
  };

  return {
    ...profile,
    searchVariants: uniqueStrings([...profile.searchVariants, ...labels]),
    normalizationTrace: [
      ...profile.normalizationTrace,
      { step: 'selected-service-scope', detail: labels.join(', ') },
    ],
    semanticFrame,
  };
}
