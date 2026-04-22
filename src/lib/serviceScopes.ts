import type { ServiceScopeId, StructuredChunk } from './ragTypes';

export interface ServiceScopeOption {
  id: ServiceScopeId;
  label: string;
  aliases: string[];
  boostTerms: string[];
}

export const ALL_SERVICE_SCOPE_ID: ServiceScopeId = 'all';

export const SERVICE_SCOPE_OPTIONS: ServiceScopeOption[] = [
  {
    id: 'all',
    label: '전체/공통',
    aliases: [],
    boostTerms: [],
  },
  {
    id: 'facility-care',
    label: '요양원/공동생활가정',
    aliases: ['요양원', '노인요양시설', '노인요양공동생활가정', '공동생활가정', '시설급여', '입소시설'],
    boostTerms: ['노인의료복지시설', '시설기준', '직원배치기준', '입소자'],
  },
  {
    id: 'day-night-care',
    label: '주야간보호',
    aliases: ['주야간보호', '주·야간보호', '주ㆍ야간보호', '주간보호', '데이케어', '주야간보호센터'],
    boostTerms: ['주야간보호기관', '주간보호센터', '장기요양기관 재가급여 평가매뉴얼', '주야간보호 평가매뉴얼'],
  },
  {
    id: 'short-term-care',
    label: '단기보호',
    aliases: ['단기보호', '단기보호기관', '단기보호 급여', '단기보호서비스'],
    boostTerms: ['단기보호 평가', '단기보호시설', '월 한도액 단기보호'],
  },
  {
    id: 'home-visit-care',
    label: '방문요양',
    aliases: ['방문요양', '방문요양기관', '방문요양 급여', '인지활동형 방문요양'],
    boostTerms: ['재가요양보호사', '요양보호사 방문', '방문요양 평가', '방문요양 서비스'],
  },
  {
    id: 'home-visit-bath',
    label: '방문목욕',
    aliases: ['방문목욕', '방문목욕기관', '방문목욕 급여', '목욕차량'],
    boostTerms: ['이동목욕차량', '방문목욕 평가', '방문목욕 서비스'],
  },
  {
    id: 'home-visit-nursing',
    label: '방문간호',
    aliases: ['방문간호', '방문간호기관', '방문간호 급여', '간호지시서'],
    boostTerms: ['방문간호지시서', '방문간호 평가', '간호사 방문'],
  },
  {
    id: 'integrated-home-care',
    label: '통합재가',
    aliases: ['통합재가', '통합재가기관', '통합재가서비스', '통합재가서비스 제공기관'],
    boostTerms: ['통합재가 평가', '통합재가 급여', '복합 재가급여'],
  },
  {
    id: 'welfare-equipment',
    label: '복지용구',
    aliases: ['복지용구', '복지용구사업소', '복지용구 급여', '복지용구사업자'],
    boostTerms: ['복지용구 급여범위', '복지용구 급여기준', '복지용구 평가', '복지용구 제품'],
  },
];

const SERVICE_SCOPE_BY_ID = new Map<ServiceScopeId, ServiceScopeOption>(
  SERVICE_SCOPE_OPTIONS.map((option) => [option.id, option]),
);

type SpecificServiceScopeId = Exclude<ServiceScopeId, 'all'>;

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function buildScopeTerms(option: ServiceScopeOption): string[] {
  return unique([option.label, ...option.aliases, ...option.boostTerms]).map(compact).filter(Boolean);
}

function buildScopeIdentityTerms(option: ServiceScopeOption): string[] {
  return unique([option.label, ...option.aliases]).map(compact).filter(Boolean);
}

function buildChunkScopeMetadataText(chunk: StructuredChunk): string {
  return compact(
    [
      chunk.docTitle,
      chunk.fileName,
      chunk.title,
      chunk.parentSectionTitle,
      chunk.documentGroup,
      ...chunk.sectionPath,
      ...chunk.matchedLabels,
      ...chunk.linkedDocumentTitles,
    ].join(' '),
  );
}

function buildChunkScopeText(chunk: StructuredChunk): string {
  return compact(
    [
      buildChunkScopeMetadataText(chunk),
      chunk.searchText,
      chunk.text,
    ].join(' '),
  );
}

function matchesScopeOption(haystack: string, option: ServiceScopeOption): boolean {
  return buildScopeTerms(option).some((term) => haystack.includes(term));
}

function matchesScopeIdentityOption(haystack: string, option: ServiceScopeOption): boolean {
  return buildScopeIdentityTerms(option).some((term) => haystack.includes(term));
}

function asServiceScopeId(value: unknown): ServiceScopeId {
  if (typeof value !== 'string' || !SERVICE_SCOPE_BY_ID.has(value as ServiceScopeId)) {
    throw new Error(`Invalid serviceScopes value: ${String(value)}`);
  }
  return value as ServiceScopeId;
}

export function parseServiceScopes(input: unknown): ServiceScopeId[] {
  if (input === undefined || input === null) return [ALL_SERVICE_SCOPE_ID];
  if (!Array.isArray(input)) {
    throw new Error('Invalid serviceScopes: expected an array.');
  }

  const selectedSpecifics: ServiceScopeId[] = [];
  for (const value of input) {
    const id = asServiceScopeId(value);
    if (id === ALL_SERVICE_SCOPE_ID) continue;
    if (!selectedSpecifics.includes(id)) {
      selectedSpecifics.push(id);
    }
  }

  return selectedSpecifics.length > 0 ? selectedSpecifics : [ALL_SERVICE_SCOPE_ID];
}

export function coerceServiceScopes(input: unknown): ServiceScopeId[] {
  try {
    return parseServiceScopes(input);
  } catch {
    return [ALL_SERVICE_SCOPE_ID];
  }
}

export function getEffectiveServiceScopes(scopes: readonly ServiceScopeId[] | undefined): SpecificServiceScopeId[] {
  const parsed = coerceServiceScopes(scopes);
  return parsed.filter((scope): scope is SpecificServiceScopeId => scope !== ALL_SERVICE_SCOPE_ID);
}

export function getServiceScopeLabels(scopes: readonly ServiceScopeId[] | undefined): string[] {
  const parsed = coerceServiceScopes(scopes);
  return parsed.map((scope) => SERVICE_SCOPE_BY_ID.get(scope)?.label ?? scope);
}

export function getServiceScopeOptions(scopes: readonly ServiceScopeId[] | undefined): ServiceScopeOption[] {
  return getEffectiveServiceScopes(scopes)
    .map((scope) => SERVICE_SCOPE_BY_ID.get(scope))
    .filter((option): option is ServiceScopeOption => Boolean(option));
}

export function getServiceScopeSearchAliases(scopes: readonly ServiceScopeId[] | undefined): string[] {
  return unique(
    getServiceScopeOptions(scopes).flatMap((option) => [
      option.label,
      ...option.aliases,
    ]),
  );
}

export function buildServiceScopePromptContext(scopes: readonly ServiceScopeId[] | undefined): string {
  const labels = getServiceScopeLabels(scopes);
  const effectiveScopes = getEffectiveServiceScopes(scopes);
  if (effectiveScopes.length === 0) {
    return '선택 적용 범위: 전체/공통 (급여유형 범위 제한 없음)';
  }

  const multiScopeNote =
    effectiveScopes.length > 1 ? '여러 급여유형이 함께 선택되어 공통점과 차이점이 있을 수 있음.' : '';
  return ['선택 적용 범위:', labels.join(', '), multiScopeNote].filter(Boolean).join(' ');
}

export function isChunkCompatibleWithServiceScopes(
  chunk: StructuredChunk,
  scopes: readonly ServiceScopeId[] | undefined,
): boolean {
  const selectedOptions = getServiceScopeOptions(scopes);
  if (selectedOptions.length === 0) return true;

  const selectedScopeIds = new Set(selectedOptions.map((option) => option.id));
  const otherOptions = SERVICE_SCOPE_OPTIONS.filter(
    (option) => option.id !== ALL_SERVICE_SCOPE_ID && !selectedScopeIds.has(option.id),
  );
  const metadataHaystack = buildChunkScopeMetadataText(chunk);
  const selectedMetadataMatch = selectedOptions.some((option) => matchesScopeIdentityOption(metadataHaystack, option));
  const otherMetadataMatch = otherOptions.some((option) => matchesScopeIdentityOption(metadataHaystack, option));
  if (otherMetadataMatch && !selectedMetadataMatch) {
    return false;
  }

  const haystack = buildChunkScopeText(chunk);
  if (selectedOptions.some((option) => matchesScopeIdentityOption(haystack, option))) {
    return true;
  }

  return !otherOptions.some((option) => matchesScopeIdentityOption(haystack, option));
}

export function chunkMatchesSelectedServiceScopes(
  chunk: StructuredChunk,
  scopes: readonly ServiceScopeId[] | undefined,
): boolean {
  const selectedOptions = getServiceScopeOptions(scopes);
  if (selectedOptions.length === 0) return false;

  const haystack = buildChunkScopeText(chunk);
  return selectedOptions.some((option) => matchesScopeIdentityOption(haystack, option));
}

export function buildServiceScopeDocumentBoosts(
  chunks: readonly StructuredChunk[],
  scopes: readonly ServiceScopeId[] | undefined,
): Map<string, number> {
  const scopeOptions = getServiceScopeOptions(scopes);
  const boosts = new Map<string, number>();
  if (scopeOptions.length === 0) return boosts;

  for (const chunk of chunks) {
    const metadataText = compact(
      [
        chunk.docTitle,
        chunk.fileName,
        chunk.title,
        chunk.parentSectionTitle,
        chunk.documentGroup,
        ...chunk.sectionPath,
        ...chunk.matchedLabels,
        ...chunk.linkedDocumentTitles,
      ].join(' '),
    );
    const bodyText = compact([chunk.searchText, chunk.text].join(' '));
    let chunkScore = 0;

    for (const option of scopeOptions) {
      const terms = buildScopeTerms(option);
      let optionScore = 0;
      for (const term of terms) {
        if (metadataText.includes(term)) optionScore += 12;
        if (bodyText.includes(term)) optionScore += 3;
      }
      chunkScore += Math.min(optionScore, 36);
    }

    if (chunkScore <= 0) continue;
    const current = boosts.get(chunk.documentId) ?? 0;
    boosts.set(chunk.documentId, Math.min(96, current + chunkScore));
  }

  return boosts;
}

export function buildServiceScopeChunkBoosts(
  chunks: readonly StructuredChunk[],
  scopes: readonly ServiceScopeId[] | undefined,
  queryTerms: readonly string[],
): Map<string, number> {
  const scopeOptions = getServiceScopeOptions(scopes);
  const focusTerms = unique(queryTerms.map(compact).filter((term) => term.length >= 2));
  const boosts = new Map<string, number>();
  if (scopeOptions.length === 0 || focusTerms.length === 0) return boosts;

  for (const chunk of chunks) {
    const metadataText = compact(
      [
        chunk.docTitle,
        chunk.fileName,
        chunk.title,
        chunk.parentSectionTitle,
        chunk.documentGroup,
        ...chunk.sectionPath,
        ...chunk.matchedLabels,
        ...chunk.linkedDocumentTitles,
      ].join(' '),
    );
    const bodyText = compact([chunk.searchText, chunk.text].join(' '));
    const focusHits = focusTerms.filter((term) => metadataText.includes(term) || bodyText.includes(term));
    if (focusHits.length === 0) continue;

    let chunkScore = 0;
    for (const option of scopeOptions) {
      const scopeTerms = unique([option.label, ...option.aliases]).map(compact).filter(Boolean);
      const boostTerms = unique(option.boostTerms).map(compact).filter(Boolean);
      const scopeMatch = scopeTerms.some((term) => metadataText.includes(term) || bodyText.includes(term));
      const boostTermMatch = boostTerms.some((term) => metadataText.includes(term) || bodyText.includes(term));
      if (!scopeMatch && !boostTermMatch) continue;

      chunkScore += Math.min(96, focusHits.length * 22 + (scopeMatch ? 24 : 0) + (boostTermMatch ? 18 : 0));
    }

    if (chunk.sourceRole === 'routing_summary' && chunkScore > 0) {
      chunkScore += 28;
    }

    if (chunkScore > 0) {
      boosts.set(chunk.id, Math.min(140, chunkScore));
    }
  }

  return boosts;
}
