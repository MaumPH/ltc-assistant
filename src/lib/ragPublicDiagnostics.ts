import type { CandidateDiagnostic, RetrievalStageTrace } from './ragTypes';

const INTERNAL_AUTHORITY_DRIFT_MARKER = 'evaluation-authority-drift-guard';

function isPublicDiagnosticText(value: string): boolean {
  return !value.toLowerCase().includes(INTERNAL_AUTHORITY_DRIFT_MARKER);
}

export function sanitizeUserFacingStageTrace<T extends RetrievalStageTrace>(stageTrace: T[]): T[] {
  return stageTrace.map((stage) => {
    if (!stage.notes) return stage;
    const notes = stage.notes.filter(isPublicDiagnosticText);
    if (notes.length === stage.notes.length) return stage;
    const sanitized = { ...stage, notes };
    if (sanitized.notes.length === 0) {
      delete sanitized.notes;
    }
    return sanitized;
  });
}

export function sanitizeUserFacingCandidateDiagnostics<T extends Pick<CandidateDiagnostic, 'matchedTerms'>>(items: T[]): T[] {
  return items.map((item) => {
    const matchedTerms = item.matchedTerms.filter(isPublicDiagnosticText);
    if (matchedTerms.length === item.matchedTerms.length) return item;
    return {
      ...item,
      matchedTerms,
    };
  });
}
