import type { GoogleGenAI } from '@google/genai';
import { describeError } from './embeddingService';
import { collectQualifierLines, getQualifierCategories, hasQualifierSignal, type QualifierCategory } from './qualifierPatterns';
import { buildPreciseCitationLabel, compareIsoDateDesc, formatEvidenceStateLabel } from './ragMetadata';
import type { ChatMessage, ConfidenceLevel, GroundedAnswer, SearchRun, StructuredChunk } from './ragTypes';
import { safeTrim, toSafeString } from './textGuards';

function chunkToCitationLine(chunk: StructuredChunk): string {
  return buildPreciseCitationLabel(chunk);
}

function dedupeCitations(chunks: StructuredChunk[]): StructuredChunk[] {
  const seen = new Set<string>();
  const result: StructuredChunk[] = [];
  for (const chunk of chunks) {
    const key = chunk.citationGroupId;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(chunk);
  }
  return result.sort((left, right) => compareIsoDateDesc(left.effectiveDate, right.effectiveDate));
}

function deriveKeyIssueDate(answer: GroundedAnswer, citations: StructuredChunk[]): string {
  const provided = sanitizeGroundedText(answer.keyIssueDate);
  if (provided && /20\d{2}(?:[-./]\d{1,2}|년\s*\d{1,2}\s*월?)/u.test(provided) && !/^확인 필요/u.test(provided)) {
    return provided;
  }

  const collectCitationDateLabels = (items: StructuredChunk[]): string[] =>
    Array.from(
      new Set(
        items
          .flatMap((citation) => {
            const compactDate = citation.fileName.match(/\((20\d{2})(\d{2})(\d{2})\)/);
            if (compactDate) {
              return [`${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`];
            }

            const yearMonthDate = citation.fileName.match(/\((20\d{2})\.(\d{1,2})\.?\)/);
            if (yearMonthDate) {
              return [`${yearMonthDate[1]}년 ${Number(yearMonthDate[2])}월`];
            }

            return [citation.effectiveDate, citation.publishedDate].filter(
              (value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)),
            );
          })
          .filter(Boolean),
      ),
    ).sort(compareIsoDateDesc);

  const primaryCitationDates = collectCitationDateLabels(citations.filter((citation) => citation.sourceRole === 'primary_evaluation'));
  if (primaryCitationDates.length === 1) return primaryCitationDates[0];
  if (primaryCitationDates.length > 1) return `확인 필요 (${primaryCitationDates.join(', ')})`;

  const citationDates = collectCitationDateLabels(citations);
  if (citationDates.length === 1) return citationDates[0];
  if (citationDates.length > 1) return `확인 필요 (${citationDates.join(', ')})`;

  return provided && !/^확인 필요/u.test(provided) ? provided : '확인 필요';
}

function sanitizeGroundedText(value: unknown): string {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).replace(/\s+/g, ' ').trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGroundedText(item)).filter(Boolean).join(', ');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['value', 'date', 'text', 'label', 'summary', 'conclusion', 'answer']) {
      const normalized = sanitizeGroundedText(record[key]);
      if (normalized) return normalized;
    }
  }

  return '';
}

function stripInternalCitationArtifacts(text: unknown): string {
  if (typeof text !== 'string') return '';
  if (!text) return '';

  return text
    .replace(/\((?:\s*(?:Evidence|evidence)\s*[\d,\s]+)\)/g, '')
    .replace(/\b(?:Evidence|evidence)\s*[\d,\s]+\b/g, '')
    .replace(/\bwindow\s+\d+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .trim();
}

function sanitizeAnswerList(values: unknown[] | undefined): string[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((item) => stripInternalCitationArtifacts(toSafeString(item)))
    .filter(Boolean);
}

function deriveCoverageIndicators(answer: GroundedAnswer, citations: StructuredChunk[]): string[] {
  const explicit = Array.isArray(answer.coverageIndicators) ? answer.coverageIndicators : [];
  const fromCitations = dedupeCitations(citations).map((chunk) => safeTrim(chunk.parentSectionTitle || chunk.articleNo || chunk.title || chunk.docTitle));
  return Array.from(new Set([...explicit, ...fromCitations].filter(Boolean)));
}

function deriveApplicabilityConditions(answer: GroundedAnswer, citations: StructuredChunk[]): string[] {
  const candidateLines = [
    ...(Array.isArray(answer.applicabilityConditions) ? answer.applicabilityConditions : []),
    ...dedupeCitations(citations).flatMap((chunk) =>
      chunk.text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => safeTrim(toSafeString(line).replace(/\|/g, ' ').replace(/\s+/g, ' ')))
        .filter((line) => line.length >= 4 && hasQualifierSignal(line)),
    ),
  ];

  const merged: string[] = [];
  const seen = new Set<string>();
  for (const line of candidateLines) {
    const normalized = stripInternalCitationArtifacts(line);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
  }
  return merged;
}

function buildEvidenceSnippet(chunk: StructuredChunk): string {
  const cleanedLines = chunk.text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => safeTrim(toSafeString(line).replace(/\|/g, ' ').replace(/\s+/g, ' ')))
    .filter((line) => line.length >= 8);

  const uniqueLines = Array.from(new Set(cleanedLines));
  const qualifierLines = collectQualifierLines(uniqueLines);
  const selected: string[] = [];
  const seen = new Set<string>();

  const pushLine = (line: string | undefined) => {
    if (!line || seen.has(line)) return;
    seen.add(line);
    selected.push(line);
  };

  for (const category of ['temporal', 'population', 'exception', 'numeric'] as QualifierCategory[]) {
    pushLine(qualifierLines[category][0]);
  }

  for (const line of uniqueLines) {
    if (hasQualifierSignal(line)) pushLine(line);
  }

  if (selected.length === 0) {
    pushLine(uniqueLines[0] ?? '');
  }

  return selected
    .map((line) => {
      if (line.length <= 320) return line;
      const head = line.slice(0, 237).trim();
      const tail = line.slice(-80).trim();
      return `${head} ... ${tail}`;
    })
    .join(' / ');
}

function needsEvidenceFallback(values: string[]): boolean {
  if (values.length < 2) return true;
  return values.every((value) => value.length < 90 && !hasQualifierSignal(value));
}

function mergeEvidenceLines(answerLines: unknown[], citations: StructuredChunk[]): string[] {
  const diverseChunks = (() => {
    const selected: StructuredChunk[] = [];
    const deferred: StructuredChunk[] = [];
    const seenIndicators = new Set<string>();

    for (const chunk of dedupeCitations(citations)) {
      const key = `${chunk.docTitle}::${chunk.articleNo ?? chunk.parentSectionTitle}`;
      if (seenIndicators.has(key)) {
        deferred.push(chunk);
        continue;
      }
      seenIndicators.add(key);
      selected.push(chunk);
    }

    return [...selected, ...deferred].slice(0, 6);
  })();
  const fallbackLines = diverseChunks.map((chunk) => `${buildPreciseCitationLabel(chunk)}: ${buildEvidenceSnippet(chunk)}`).filter((line) => !line.endsWith(':'));
  const normalizedAnswerLines = answerLines.map((line) => safeTrim(toSafeString(line).replace(/\s+/g, ' '))).filter(Boolean);

  const preferred = needsEvidenceFallback(normalizedAnswerLines)
    ? [...fallbackLines, ...normalizedAnswerLines]
    : [...normalizedAnswerLines, ...fallbackLines];
  const merged: string[] = [];
  const seen = new Set<string>();
  const coveredCategories = new Set<QualifierCategory>();

  for (const line of preferred) {
    const normalized = safeTrim(toSafeString(line).replace(/\s+/g, ' '));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
    for (const category of getQualifierCategories(normalized)) {
      coveredCategories.add(category);
    }
    if (coveredCategories.size === 4 || merged.length >= 6) break;
  }

  return merged.length > 0 ? merged : ['직접 근거를 확인할 수 없어 결론을 제한했습니다.'];
}

function mapConfidence(value: string | undefined): ConfidenceLevel {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function mapEvidenceState(value: string | undefined): GroundedAnswer['evidenceState'] {
  return value === 'confirmed' || value === 'partial' || value === 'conflict' || value === 'not_enough'
    ? value
    : 'not_enough';
}

export function normalizeAnswerShape(candidate: Partial<GroundedAnswer>): GroundedAnswer {
  return {
    evidenceState: mapEvidenceState(candidate.evidenceState),
    confidence: mapConfidence(candidate.confidence),
    keyIssueDate: sanitizeGroundedText(candidate.keyIssueDate) || undefined,
    conclusion: stripInternalCitationArtifacts(candidate.conclusion) || '검색된 근거만으로 결론을 확정하기 어렵습니다.',
    applicabilityConditions: sanitizeAnswerList(candidate.applicabilityConditions),
    coverageIndicators: sanitizeAnswerList(candidate.coverageIndicators),
    directEvidence: sanitizeAnswerList(candidate.directEvidence),
    practicalGuidance: sanitizeAnswerList(candidate.practicalGuidance),
    caveats: sanitizeAnswerList(candidate.caveats),
    citationEvidenceIds: Array.isArray(candidate.citationEvidenceIds)
      ? candidate.citationEvidenceIds.map((item) => sanitizeGroundedText(item)).filter(Boolean)
      : [],
    followUpQuestion: stripInternalCitationArtifacts(candidate.followUpQuestion) || undefined,
  };
}

export function createAbstainAnswer(search: SearchRun): GroundedAnswer {
  const leading = search.evidence.slice(0, 2);
  return {
    evidenceState: search.confidence === 'low' ? 'not_enough' : 'partial',
    confidence: 'low',
    keyIssueDate: leading.find((item) => item.effectiveDate)?.effectiveDate,
    conclusion: '검색된 근거만으로 질문에 직접 대응하는 조문이나 문답을 확정할 수 없습니다.',
    applicabilityConditions: [],
    coverageIndicators: [],
    directEvidence: leading.length > 0 ? leading.map((item) => `${item.docTitle}${item.articleNo ? ` ${item.articleNo}` : ''}에서 관련 단서를 확인했습니다.`) : [],
    practicalGuidance: ['질문의 기관 유형, 급여 유형, 적용 시점을 더 구체화한 뒤 다시 확인하는 편이 안전합니다.'],
    caveats: ['현재 근거만으로는 단정 답변을 제공하지 않습니다.'],
    citationEvidenceIds: leading.map((item) => item.id),
    followUpQuestion: '적용 기관 유형이나 확인하려는 기준 시점을 알려주시면 근거를 다시 좁혀보겠습니다.',
  };
}

function formatSection(title: string, body: string | string[]): string {
  const content = Array.isArray(body) ? body.filter(Boolean).map((line) => `- ${line}`).join('\n') : body;
  return `[${title}]\n${content || '- 없음'}`;
}

export function formatMarkdownAnswer(answer: GroundedAnswer, citations: StructuredChunk[]): string {
  const keyIssueDate = deriveKeyIssueDate(answer, citations);
  const evidenceState = formatEvidenceStateLabel(answer.evidenceState);
  const applicabilityConditions = deriveApplicabilityConditions(answer, citations);
  const coverageIndicators = deriveCoverageIndicators(answer, citations);
  const directEvidence = mergeEvidenceLines(answer.directEvidence, citations);
  const sourceLines = dedupeCitations(citations).map(chunkToCitationLine);

  return [
    formatSection('답변 가능 상태', evidenceState),
    formatSection('기준 시점', keyIssueDate),
    formatSection('결론', answer.conclusion),
    ...(applicabilityConditions.length > 0 ? [formatSection('적용 조건/한정자', applicabilityConditions)] : []),
    formatSection('확정 근거', directEvidence),
    formatSection('실무 해석/운영 참고', answer.practicalGuidance.length > 0 ? answer.practicalGuidance : ['실무 참고 사항이 없으면 출처 확인을 우선합니다.']),
    formatSection(
      '예외·주의 및 추가 확인사항',
      [
        ...(answer.caveats.length > 0 ? answer.caveats : ['적용 기관 유형, 시점, 문서 버전에 따라 판단이 달라질 수 있습니다.']),
        ...(answer.followUpQuestion ? [answer.followUpQuestion] : []),
      ],
    ),
    ...(coverageIndicators.length > 0 ? [formatSection('지표 커버리지', coverageIndicators)] : []),
    formatSection('출처', sourceLines.length > 0 ? sourceLines : ['근거 청크를 특정하지 못했습니다.']),
  ].join('\n\n');
}

function buildGroundedAnswerSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['evidenceState', 'confidence', 'conclusion', 'directEvidence', 'practicalGuidance', 'caveats', 'citationEvidenceIds'],
    properties: {
      evidenceState: {
        type: 'string',
        enum: ['confirmed', 'partial', 'conflict', 'not_enough'],
        description: '검색 근거 기준 최종 상태. confirmed=확정, partial=부분확정, conflict=충돌, not_enough=확인 불가.',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: '근거 밀도에 대한 내부 자신감.',
      },
      keyIssueDate: {
        type: 'string',
        description: '확인 가능한 기준 시점. 예: 2026년 1월, 2026-01-20 시행. 정말 불가할 때만 확인 필요.',
      },
      conclusion: {
        type: 'string',
        description: '2~4문장 요약. 질문이 의무/존재 여부를 묻는 경우 첫 문장에서 있다, 없다, 없지만 별도로 필요하다를 분명히 쓴다.',
      },
      applicabilityConditions: {
        type: 'array',
        items: { type: 'string' },
        description: '근거 원문에 등장한 시간·대상·예외 한정자를 원문 표현 그대로 누락 없이 나열한다.',
      },
      coverageIndicators: {
        type: 'array',
        items: { type: 'string' },
        description:
          '답변이 실제로 반영한 지표 또는 조문 식별자. 열거형 질의에서는 제공된 evidence에 등장한 서로 다른 지표를 가능한 한 누락 없이 나열한다.',
      },
      directEvidence: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '각 항목은 문서명/항목 + 핵심 문구 + 그 문구가 결론에 주는 의미를 한 문장으로 설명한다. 문서명만 나열하지 않는다. 수치·기한·대상 한정자는 원문 그대로 인용한다.',
      },
      practicalGuidance: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '평가 대응이나 운영 참고만 적고, 법적 결론과 섞지 않는다.',
      },
      caveats: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '예외, 적용 조건, 추가 확인 필요사항만 적는다.',
      },
      citationEvidenceIds: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: '반드시 제공된 evidence id만 넣는다.',
      },
      followUpQuestion: {
        type: 'string',
        description: '근거가 부족할 때만 짧고 구체적으로 쓴다.',
      },
    },
  };
}

function resolveGenerationTemperature(model: string): number {
  void model;
  return 0.1;
}

export async function generateGroundedAnswer(params: {
  ai: GoogleGenAI;
  model: string;
  contents: Array<{ role: ChatMessage['role']; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  evidence: StructuredChunk[];
}): Promise<GroundedAnswer> {
  const evidenceIds = new Set(params.evidence.map((item) => item.id));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const extraReminder =
      attempt === 0
        ? ''
        : '\n\n재시도 규칙: citationEvidenceIds에는 제공된 evidence id만 사용하세요. 근거 chunk가 0개일 때만 not_enough로 답하고, 근거가 일부라도 있으면 partial로 답하되 caveats에 부족한 근거를 구체적으로 적으세요.';

    const response = await params.ai.models.generateContent({
      model: params.model,
      contents: params.contents,
      config: {
        systemInstruction: `${params.systemInstruction}${extraReminder}`,
        temperature: resolveGenerationTemperature(params.model),
        responseMimeType: 'application/json',
        responseJsonSchema: buildGroundedAnswerSchema(),
      },
    });

    let parsed: GroundedAnswer;
    try {
      parsed = normalizeAnswerShape(JSON.parse(response.text || '{}') as Partial<GroundedAnswer>);
    } catch (error) {
      console.warn(`[answer] failed to parse grounded answer attempt ${attempt + 1}: ${describeError(error)}`);
      continue;
    }

    const validCitationIds = parsed.citationEvidenceIds.filter((item) => evidenceIds.has(item));
    if (validCitationIds.length > 0 || parsed.evidenceState === 'not_enough') {
      return {
        ...parsed,
        citationEvidenceIds: validCitationIds.length > 0 ? validCitationIds : params.evidence.slice(0, 2).map((item) => item.id),
      };
    }
  }

  return createAbstainAnswer({
    query: '',
    mode: 'integrated',
    intent: 'integrated',
    confidence: 'low',
    exactCandidates: [],
    lexicalCandidates: [],
    vectorCandidates: [],
    fusedCandidates: [],
    evidence: params.evidence.map((item) => ({
      ...item,
      exactScore: 0,
      lexicalScore: 0,
      vectorScore: 0,
      fusedScore: 0,
      rerankScore: 0,
      ontologyScore: 0,
      matchedTerms: [],
    })),
  });
}
