import type {
  LawAliasResolution,
  NaturalLanguageQueryProfile,
  NaturalLanguageQueryType,
  ParsedLawReference,
  QueryNormalizationTraceEntry,
} from './ragTypes';

interface LawAliasEntry {
  canonical: string;
  aliases: string[];
  alternatives?: string[];
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

const BASIC_CHAR_MAP = new Map<string, string>([
  ['벚', '법'],
  ['벆', '법'],
  ['벋', '법'],
  ['뻡', '법'],
  ['볍', '법'],
  ['뱝', '법'],
  ['셰', '세'],
  ['쉐', '세'],
  ['괸', '관'],
  ['곽', '관'],
  ['엄', '업'],
  ['얼', '업'],
]);

const LAW_ALIAS_ENTRIES: LawAliasEntry[] = [
  {
    canonical: '대한민국헌법',
    aliases: ['헌법', '헌 법'],
  },
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
    aliases: ['장기요양급여 고시', '급여비용 고시', '급여제공기준', '급여비용 산정방법 고시'],
  },
  {
    canonical: '노인복지법',
    aliases: ['노복법', '노인복지 법'],
  },
  {
    canonical: '의료법',
    aliases: ['의료 법'],
  },
  {
    canonical: '근로기준법',
    aliases: ['근기법', '근로법'],
  },
  {
    canonical: '산업안전보건법',
    aliases: ['산안법'],
    alternatives: ['산업안전보건법 시행령', '산업안전보건법 시행규칙', '산업안전보건기준에 관한 규칙'],
  },
  {
    canonical: '산업안전보건기준에 관한 규칙',
    aliases: ['산안기준규칙', '산안규칙', '안전보건규칙', '안전보건기준규칙'],
    alternatives: ['산업안전보건법', '산업안전보건법 시행령'],
  },
  {
    canonical: '중대재해 처벌 등에 관한 법률',
    aliases: ['중대재해처벌법', '중처법', '중대재해법'],
    alternatives: ['산업안전보건법'],
  },
  {
    canonical: '개인정보 보호법',
    aliases: ['개보법', '개인정보법', '개인정보보호법'],
  },
  {
    canonical: '국민건강보험법',
    aliases: ['건보법', '국건법'],
  },
  {
    canonical: '관세법',
    aliases: ['관세벚', '관세요', '관세 볍', '관세 볍률'],
    alternatives: ['관세법 시행령', '관세법 시행규칙'],
  },
];

const QUERY_TERM_EXPANSIONS: Array<{ triggers: string[]; expansions: string[] }> = [
  {
    triggers: ['뭐 봐야', '뭘 봐야', '뭐를 봐야', '무엇을 봐야'],
    expansions: ['준비', '체크리스트', '확인사항'],
  },
  {
    triggers: ['뭐 해야', '뭘 해야', '무엇을 해야'],
    expansions: ['업무', '체크리스트', '준비'],
  },
  {
    triggers: ['어떻게', '어떡해'],
    expansions: ['절차', '방법', '순서'],
  },
  {
    triggers: ['필수냐', '필수인가', '의무냐', '의무인가'],
    expansions: ['필수', '의무', '법정'],
  },
  {
    triggers: ['언제까지'],
    expansions: ['기한', '시점'],
  },
  {
    triggers: ['준비할 것', '준비물'],
    expansions: ['준비', '체크리스트', '증빙'],
  },
  {
    triggers: ['새 수급자', '수급자 받으면', '처음 오는 수급자', '뭐부터 해야 해'],
    expansions: ['신규 수급자', '입소 초기', '초기 업무', '급여제공계획', '상담'],
  },
];

const QUERY_TYPE_PATTERNS: Array<{ type: NaturalLanguageQueryType; patterns: RegExp[] }> = [
  { type: 'exemption', patterns: [/면제/u, /감면/u, /비과세/u] },
  { type: 'consequence', patterns: [/벌칙/u, /위반/u, /과태료/u, /처벌/u] },
  { type: 'procedure', patterns: [/절차/u, /방법/u, /어떻게/u, /신청/u, /준비/u, /체크리스트/u] },
  { type: 'comparison', patterns: [/차이/u, /비교/u, /구분/u, /vs/i] },
  { type: 'requirement', patterns: [/요건/u, /자격/u, /가능/u, /필수/u, /의무/u] },
  { type: 'scope', patterns: [/세율/u, /얼마/u, /범위/u, /금액/u, /기간/u, /언제까지/u] },
  { type: 'definition', patterns: [/이란/u, /뜻/u, /정의/u, /무엇/u, /뭐야/u] },
  { type: 'application', patterns: [/적용/u, /해당/u, /가능한가/u, /되는가/u] },
];

const aliasLookup = new Map<string, LawAliasEntry>();

for (const entry of LAW_ALIAS_ENTRIES) {
  aliasLookup.set(normalizeAliasKey(entry.canonical), entry);
  for (const alias of entry.aliases) {
    aliasLookup.set(normalizeAliasKey(alias), entry);
  }
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean)));
}

function normalizeBasicTypos(value: string): string {
  return value.replace(/[벚벆벋뻡볍뱝셰쉐괸곽엄얼]/gu, (char) => BASIC_CHAR_MAP.get(char) ?? char);
}

function normalizeAliasKey(value: string): string {
  return normalizeBasicTypos(value)
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/gu, '')
    .replace(/[·•]/gu, '');
}

export function compactQueryText(value: string): string {
  return normalizeAliasKey(value);
}

export function normalizeLawSearchText(input: string): string {
  let value = input.normalize('NFC');

  value = value
    .replace(/[\u00a0\u2002\u2003\u2009]/gu, ' ')
    .replace(/[‐‑‒–—―﹘﹣－]/gu, '-')
    .replace(/[﹦=]/gu, ' ')
    .replace(/§/gu, ' 제')
    .replace(/\s*[-]\s*/gu, '-')
    .replace(/\s*\.\s*/gu, ' ');

  value = normalizeBasicTypos(value);
  value = value.replace(/([a-zA-Z])([가-힣])/gu, '$1 $2');

  return value
    .replace(/\s+/gu, ' ')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .trim();
}

function resolveAliasEntry(lawName: string): LawAliasResolution {
  const normalizedKey = normalizeAliasKey(lawName);
  const entry = aliasLookup.get(normalizedKey);

  if (entry) {
    const matchedAlias = entry.aliases.find((alias) => normalizeAliasKey(alias) === normalizedKey);
    return {
      canonical: entry.canonical,
      alias: lawName,
      matchedAlias: matchedAlias ?? undefined,
      alternatives: entry.alternatives ?? [],
    };
  }

  const cleaned = normalizeBasicTypos(lawName).trim();
  return {
    canonical: cleaned,
    alias: lawName,
    alternatives: [],
  };
}

export function detectAliasesInQuery(query: string): LawAliasResolution[] {
  if (!query.trim()) return [];
  const normalized = normalizeAliasKey(query);
  const seen = new Set<string>();
  const hits: LawAliasResolution[] = [];

  for (const entry of LAW_ALIAS_ENTRIES) {
    const candidates = [entry.canonical, ...entry.aliases];
    for (const candidate of candidates) {
      const key = normalizeAliasKey(candidate);
      if (key.length < 2 || !normalized.includes(key) || seen.has(entry.canonical)) continue;
      seen.add(entry.canonical);
      hits.push({
        canonical: entry.canonical,
        alias: candidate,
        matchedAlias: entry.aliases.find((alias) => normalizeAliasKey(alias) === key) ?? undefined,
        alternatives: entry.alternatives ?? [],
      });
      break;
    }
  }

  return hits;
}

function stripClauseAndItem(raw: string): string {
  return raw
    .replace(/제?\d+항.*$/u, '')
    .replace(/제?\d+호.*$/u, '')
    .replace(/제?\d+목.*$/u, '');
}

function normalizeSeparators(raw: string): string {
  return raw
    .replace(/[‐‑‒–—―﹘﹣－]/gu, '-')
    .replace(/[·•]/gu, ' ');
}

function parseArticleComponents(input: string): { articleNumber: number; branchNumber: number } {
  const sanitized = stripClauseAndItem(
    normalizeSeparators(input)
      .replace(/제|第/gu, '')
      .replace(/조문|條/gu, '조')
      .replace(/之/gu, '의')
      .replace(/[()]/gu, '')
      .replace(/\s+/gu, '')
      .trim(),
  );

  const match = sanitized.match(/(\d+)(?:조)?(?:(?:의|-)\s*(\d+))?/u);
  if (!match) {
    throw new Error(`Cannot parse article reference: ${input}`);
  }

  const articleNumber = Number.parseInt(match[1], 10);
  const branchNumber = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (Number.isNaN(articleNumber) || Number.isNaN(branchNumber)) {
    throw new Error(`Cannot parse article number: ${input}`);
  }

  return { articleNumber, branchNumber };
}

function formatArticleLabel(input: { articleNumber: number; branchNumber: number }): string {
  const base = `제${input.articleNumber}조`;
  return input.branchNumber > 0 ? `${base}의${input.branchNumber}` : base;
}

function buildJO(input: string): string {
  const components = parseArticleComponents(input);
  return `${components.articleNumber.toString().padStart(4, '0')}${components.branchNumber.toString().padStart(2, '0')}`;
}

function normalizeArticle(article: string): string {
  return formatArticleLabel(parseArticleComponents(article));
}

function looksLikeLawName(value: string): boolean {
  return /(법|령|규칙|고시|조례|규정|헌법|보험)/u.test(value) || aliasLookup.has(normalizeAliasKey(value));
}

function parseSearchQuery(query: string): ParsedSearchQuery | null {
  const normalizedQuery = normalizeLawSearchText(query);
  const articlePattern =
    /\s*(제?\d+(?:조)?(?:[-의]\d+)?)(?:\s*제?\d+항)?(?:\s*제?\d+호)?(?:\s*제?\d+목)?$/u;
  const match = articlePattern.exec(normalizedQuery);

  if (match && match.index !== undefined) {
    const rawLawName = normalizedQuery.slice(0, match.index).trim();
    if (!looksLikeLawName(rawLawName)) {
      return null;
    }

    const lawNameResolution = resolveAliasEntry(rawLawName || normalizedQuery.trim());
    const fullArticleSegment = normalizedQuery.slice(match.index).trim();
    const articleLabel = normalizeArticle(match[1].trim());
    const jo = buildJO(articleLabel);
    const clauseMatch = fullArticleSegment.match(/제?\s*(\d+)\s*항/u);
    const itemMatch = fullArticleSegment.match(/제?\s*(\d+)\s*호/u);
    const subItemMatch = fullArticleSegment.match(/제?\s*(\d+)\s*목/u);

    return {
      lawName: lawNameResolution.canonical,
      article: articleLabel,
      jo,
      clause: clauseMatch?.[1],
      item: itemMatch?.[1],
      subItem: subItemMatch?.[1],
      matchedAlias: lawNameResolution.matchedAlias,
    };
  }

  return null;
}

function buildSynonymExpansions(query: string): string[] {
  const normalized = normalizeLawSearchText(query).toLowerCase();
  const expansions: string[] = [];

  for (const group of QUERY_TERM_EXPANSIONS) {
    if (!group.triggers.some((trigger) => normalized.includes(trigger.toLowerCase()))) continue;
    expansions.push(...group.expansions.map((expansion) => `${normalizeLawSearchText(query)} ${expansion}`));
  }

  return uniqueStrings(expansions).filter((variant) => variant !== normalizeLawSearchText(query));
}

export function inferNaturalLanguageQueryType(query: string): NaturalLanguageQueryType {
  for (const entry of QUERY_TYPE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(query))) {
      return entry.type;
    }
  }

  return 'application';
}

export function buildNaturalLanguageQueryProfile(query: string): NaturalLanguageQueryProfile {
  const normalizationTrace: QueryNormalizationTraceEntry[] = [];
  const originalQuery = query.trim();
  const normalizedQuery = normalizeLawSearchText(originalQuery);
  normalizationTrace.push({ step: 'normalize-query', detail: normalizedQuery || '(empty)' });

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

  const synonymExpansions = buildSynonymExpansions(normalizedQuery);
  if (synonymExpansions.length > 0) {
    normalizationTrace.push({
      step: 'expand-synonyms',
      detail: synonymExpansions.slice(0, 4).join(' | '),
    });
  }

  const aliasVariants = aliasResolutions.flatMap((item) => [
    item.canonical,
    ...item.alternatives,
  ]);
  const lawVariants = parsedLawRefs.flatMap((item) =>
    uniqueStrings([
      item.canonicalLawName,
      item.article ? `${item.canonicalLawName} ${item.article}` : '',
      item.clause && item.article ? `${item.canonicalLawName} ${item.article} 제${item.clause}항` : '',
      item.item && item.article ? `${item.canonicalLawName} ${item.article} 제${item.item}호` : '',
    ]),
  );

  const searchVariants = uniqueStrings([
    normalizedQuery,
    ...aliasVariants,
    ...lawVariants,
    ...synonymExpansions,
  ]);
  normalizationTrace.push({
    step: 'search-variants',
    detail: `${searchVariants.length} variants`,
  });

  const queryType = inferNaturalLanguageQueryType(normalizedQuery);
  normalizationTrace.push({ step: 'classify-query', detail: queryType });

  return {
    originalQuery,
    normalizedQuery,
    queryType,
    aliasResolutions,
    parsedLawRefs,
    synonymExpansions,
    searchVariants,
    normalizationTrace,
  };
}
