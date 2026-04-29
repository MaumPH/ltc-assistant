export interface EntityAnchor {
  id: string;
  synonyms: string[];
}

export interface EntityAnchorMatch {
  id: string;
  matchedTerms: string[];
}

export const ENTITY_ANCHORS: EntityAnchor[] = [
  { id: '신규수급자', synonyms: ['신규수급자', '신규 수급자', '신규로 등록', '처음 온 수급자', '신규 등록'] },
  { id: '퇴소', synonyms: ['퇴소', '종결', '서비스 종료', '퇴원', '종료 시'] },
  { id: '입소', synonyms: ['입소', '입실', '처음 입소', '입소 시'] },
  { id: '민원', synonyms: ['민원', '불만', '고충', '이의제기', '항의'] },
  { id: '사고발생', synonyms: ['사고 발생', '사고발생', '응급상황', '사건 발생', '사고 시'] },
  { id: '12월신규', synonyms: ['12월 신규', '12월에 신규', '12월 신규 수급자', '12월 등록'] },
];

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export function extractMatchedEntityAnchors(query: string): EntityAnchorMatch[] {
  const compactQuery = compact(query);

  return ENTITY_ANCHORS.map((anchor) => {
    const matchedTerms = anchor.synonyms.filter((term) => compactQuery.includes(compact(term)));
    return matchedTerms.length > 0 ? { id: anchor.id, matchedTerms } : null;
  }).filter((item): item is EntityAnchorMatch => Boolean(item));
}

export function scoreEntityAnchorText(text: string, anchorId: string): number {
  const anchor = ENTITY_ANCHORS.find((item) => item.id === anchorId);
  if (!anchor) return 0;

  const haystack = compact(text);
  let score = 0;
  for (const synonym of anchor.synonyms) {
    const needle = compact(synonym);
    if (needle && haystack.includes(needle)) {
      score += Math.max(1, needle.length);
    }
  }

  return score;
}
