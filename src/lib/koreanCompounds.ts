import { safeTrim } from './textGuards';

export const COMPOUND_SPLITS: Record<string, string[]> = {
  신규수급자: ['신규수급자', '신규 수급자', '신규', '수급자', '신규대상자', '신규 대상자', '입소자', '신규입소자'],
  신규입소자: ['신규입소자', '신규 입소자', '신규', '입소자', '수급자', '신규수급자'],
  급여제공계획: ['급여제공계획', '급여 제공 계획', '급여계획', '서비스계획', '제공계획', '계획수립'],
  급여제공계획서: ['급여제공계획서', '급여제공계획', '급여 제공 계획서', '제공계획서', '계획서'],
  욕구사정: ['욕구사정', '욕구 사정', '사정', '초기사정', '초기 사정', '평가'],
  초기상담: ['초기상담', '초기 상담', '상담', '입소상담', '보호자상담'],
  장기요양계약: ['장기요양계약', '장기요양 계약', '계약', '계약체결', '이용계약'],
  비상연락망: ['비상연락망', '비상 연락망', '연락망', '보호자 연락처', '응급연락처'],
};

export const PROCEDURE_QUERY_TERMS = [
  '업무',
  '절차',
  '단계',
  '순서',
  '방법',
  '체크리스트',
  '해야',
  '해야할',
  '해야하는',
  '할일',
  '할 일',
  '준비',
  '진행',
  '작성',
  '수립',
  '체결',
  '안내',
];

export const PROCEDURE_EVIDENCE_TERMS = [
  '초기',
  '상담',
  '욕구',
  '사정',
  '급여제공계획',
  '급여 제공 계획',
  '계획',
  '계약',
  '동의',
  '기록',
  '안내',
  '점검',
  '평가',
  '보호자',
  '비상연락망',
  '교육',
  '제공',
  '작성',
  '수립',
  '체결',
];

function includesCompact(haystack: string, needle: string): boolean {
  const compactHaystack = haystack.replace(/\s+/g, '').toLowerCase();
  const compactNeedle = needle.replace(/\s+/g, '').toLowerCase();
  return compactNeedle.length > 0 && compactHaystack.includes(compactNeedle);
}

export function expandCompoundTerms(text: string): string[] {
  const normalized = safeTrim(text);
  if (!normalized) return [];

  const expanded = new Set<string>();
  for (const [compound, variants] of Object.entries(COMPOUND_SPLITS)) {
    if (!includesCompact(normalized, compound) && !variants.some((variant) => includesCompact(normalized, variant))) {
      continue;
    }
    for (const variant of variants) {
      const cleaned = safeTrim(variant);
      if (cleaned) expanded.add(cleaned);
    }
  }

  return Array.from(expanded);
}

export function isProcedureLikeQuery(text: string): boolean {
  const normalized = safeTrim(text);
  if (!normalized) return false;
  return PROCEDURE_QUERY_TERMS.some((term) => includesCompact(normalized, term));
}

export function getProcedureEvidenceMatches(text: string): string[] {
  const normalized = safeTrim(text);
  if (!normalized) return [];
  return PROCEDURE_EVIDENCE_TERMS.filter((term) => includesCompact(normalized, term));
}

export function countProcedureEvidenceTerms(text: string): number {
  return getProcedureEvidenceMatches(text).length;
}
