export const STRUCTURED_ANSWER_SECTION_KEYS = [
  '답변 가능 상태',
  '기준 시점',
  '결론',
  '확정 근거',
  '실무 해석/운영 참고',
  '예외·주의 및 추가 확인사항',
  '출처',
] as const;

export type StructuredAnswerSectionKey = (typeof STRUCTURED_ANSWER_SECTION_KEYS)[number];

export interface ParsedStructuredAnswer {
  sections: Record<StructuredAnswerSectionKey, string>;
}

const HEADER_RE = /^\[(.+?)\]\s*$/gm;

export function parseStructuredAnswer(text: string): ParsedStructuredAnswer | null {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return null;

  const matches = Array.from(normalized.matchAll(HEADER_RE));
  if (matches.length !== STRUCTURED_ANSWER_SECTION_KEYS.length) {
    return null;
  }

  const sections = {} as Record<StructuredAnswerSectionKey, string>;

  for (let index = 0; index < STRUCTURED_ANSWER_SECTION_KEYS.length; index += 1) {
    const expectedKey = STRUCTURED_ANSWER_SECTION_KEYS[index];
    const match = matches[index];
    const header = match[1]?.trim();

    if (header !== expectedKey || match.index === undefined) {
      return null;
    }

    const contentStart = match.index + match[0].length;
    const contentEnd = index + 1 < matches.length && matches[index + 1].index !== undefined
      ? matches[index + 1].index
      : normalized.length;

    sections[expectedKey] = normalized.slice(contentStart, contentEnd).trim();
  }

  return { sections };
}
