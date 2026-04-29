export type QualifierCategory = 'temporal' | 'population' | 'exception' | 'numeric';

type QualifierPatternMap = Record<QualifierCategory, RegExp[]>;

export const QUALIFIER_PATTERNS: QualifierPatternMap = {
  temporal: [
    /\d+\s*(?:일|주|개월|년)\s*이내/u,
    /급여제공\s*시작일/u,
    /토요일|공휴일/u,
    /매(?:일|주|월|분기|년)/u,
    /연\s*\d+\s*회/u,
    /(?:월|주|분기)\s*\d+\s*회\s*이상/u,
  ],
  population: [
    /신규\s*수급자/u,
    /모든\s*수급자/u,
    /전체\s*수급자/u,
    /보호자\s*포함/u,
    /수급자\s*\(보호자\)/u,
    /야간\s*근무/u,
    /전\s*직원/u,
    /퇴소|입소/u,
  ],
  exception: [/^다만/u, /단,/u, /예외/u, /단서/u, /제외/u],
  numeric: [/\d+\s*(?:가지|회|명|일|주|개월)/u],
};

const QUALIFIER_CATEGORIES: QualifierCategory[] = ['temporal', 'population', 'exception', 'numeric'];

export function getQualifierCategories(text: string): QualifierCategory[] {
  return QUALIFIER_CATEGORIES.filter((category) => QUALIFIER_PATTERNS[category].some((pattern) => pattern.test(text)));
}

export function hasQualifierSignal(text: string): boolean {
  return getQualifierCategories(text).length > 0;
}

export function collectQualifierLines(lines: string[]): Record<QualifierCategory, string[]> {
  const buckets: Record<QualifierCategory, string[]> = {
    temporal: [],
    population: [],
    exception: [],
    numeric: [],
  };

  for (const line of lines) {
    for (const category of getQualifierCategories(line)) {
      buckets[category].push(line);
    }
  }

  return buckets;
}
