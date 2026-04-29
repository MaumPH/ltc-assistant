import { extractMatchedEntityAnchors, type EntityAnchorMatch } from './entityAnchors';

export interface QueryExpansionProfile {
  checklistExpansion: boolean;
  enumeration: boolean;
  entityAnchors: EntityAnchorMatch[];
  fusedTopK: number;
  evidenceTopK: number;
  maxVisibleCandidatesPerDocument: number;
  maxEvidenceClustersPerDocument: number;
  maxForcedInjections: number;
}

const CHECKLIST_CUE_TERMS = ['해야할', '해야하는', '해야되는', '할일', '체크리스트', '무엇', '뭐', '안내', '설명', '교육', '업무', '절차'];
const OPERATIONAL_CUE_TERMS = ['입소', '신규', '초기', '준비', '수급자', '보호자', '직원', '평가', '오면', '왔을때', '처음'];
const ENUMERATION_EVENT_TERMS = ['오면', '올때', '왔을때', '받으면', '시작', '입소', '퇴소', '발생', '발견', '등록'];
const ENUMERATION_TASK_TERMS = ['업무', '절차', '순서', '할일', '해야할', '해야하는', '해야되는'];

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export function detectEnumerationIntent(query: string): boolean {
  const compactQuery = compact(query);
  const hasEntityAnchor = extractMatchedEntityAnchors(query).length > 0;
  const hasEventCue = ENUMERATION_EVENT_TERMS.some((term) => compactQuery.includes(term));
  const hasTaskCue = ENUMERATION_TASK_TERMS.some((term) => compactQuery.includes(term));

  return hasEntityAnchor && hasEventCue && hasTaskCue;
}

export function buildQueryExpansionProfile(query: string): QueryExpansionProfile {
  const compactQuery = compact(query);
  const entityAnchors = extractMatchedEntityAnchors(query);
  const checklistExpansion =
    CHECKLIST_CUE_TERMS.some((term) => compactQuery.includes(term)) &&
    OPERATIONAL_CUE_TERMS.some((term) => compactQuery.includes(term));
  const enumeration = detectEnumerationIntent(query);

  return {
    checklistExpansion,
    enumeration,
    entityAnchors,
    fusedTopK: enumeration ? 48 : 32,
    evidenceTopK: enumeration ? 28 : checklistExpansion ? 22 : 18,
    maxVisibleCandidatesPerDocument: enumeration ? 5 : checklistExpansion ? 4 : 3,
    maxEvidenceClustersPerDocument: enumeration ? 5 : checklistExpansion ? 3 : 2,
    maxForcedInjections: enumeration && entityAnchors.length > 0 ? 4 : 0,
  };
}

export { extractMatchedEntityAnchors as extractMatchedEntityAnchors };
