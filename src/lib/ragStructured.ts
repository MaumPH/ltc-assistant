import { buildCitationLabel, buildPreciseCitationLabel, extractArticleNo, normalizeWhitespace, sha1, toDocumentMetadata } from './ragMetadata';
import { hasQualifierSignal } from './qualifierPatterns';
import type { CompiledPage, KnowledgeFile, StructuredChunk, StructuredSection } from './ragTypes';

const MAX_CHUNK_CHARS = 1200;
const MAX_PROTECTED_CHUNK_CHARS = 2400;
const CHUNK_OVERLAP_CHARS = 120;

type SectionBoundary = {
  title: string;
  depth: number;
  articleNo?: string;
  isMarkdownHeading: boolean;
};

type SpanBlock = {
  text: string;
  spanStart: number;
  spanEnd: number;
  listGroupId?: string;
  containsCheckList?: boolean;
  protectedGroup?: boolean;
};

type ChunkWindow = {
  text: string;
  spanStart: number;
  spanEnd: number;
  listGroupId?: string;
  containsCheckList: boolean;
};

const LAW_HEADING_RE = /^\s*제\s*\d+\s*조(?:의\s*\d+)?(?:\s*\([^)]*\))?/;
const LAW_APPENDIX_RE = /^\s*\[?\s*(별표|별지)\s*\d+/;
const LAW_ATTACHMENT_RE = /^\s*\(?붙임\)?/;
const QA_BOUNDARY_RE = /^(q\s*&\s*a|q&a|질문\(q\)|답변\(a\)|질문\s*\d+|답변\s*\d+|사례\s*\d+|문\s*\d+[.)]?)/i;
const EVALUATION_SUBHEADING_RE =
  /^(평가기준|확인방법|관련근거|평가방법|평가자료|확인사항|준비서류|급여제공기록|작성방법|유의사항|점검사항)\s*[:：]?\s*$/;
const NUMBERED_SUBHEADING_RE = /^\s*(?:\d{1,2}|[가-하])[\.)]\s+\S.{0,80}$/u;
const PARAGRAPH_RE = /[\s\S]+?(?=(?:\n\s*\n)|$)/g;
const LIST_ITEM_RE = /^\s*(?:[-*•‣▪▫]|\d{1,2}[.)]|[①-⑳]|[가-힣][.)])\s+/u;
const TABLE_ROW_RE = /^\s*\|.+\|\s*$/u;
const CHECKLIST_CUE_RE = /(체크리스트|지침|확인|예방|교육|안내|필수|점검|서류|기록|업무|절차|방법|기한|이내|수급자|보호자)/u;

function detectBoundary(line: string): SectionBoundary | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const markdownHeading = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (markdownHeading) {
    return {
      title: markdownHeading[2].trim(),
      depth: markdownHeading[1].length,
      articleNo: extractArticleNo(markdownHeading[2]),
      isMarkdownHeading: true,
    };
  }

  if (LAW_HEADING_RE.test(trimmed)) {
    return {
      title: trimmed,
      depth: 3,
      articleNo: extractArticleNo(trimmed),
      isMarkdownHeading: false,
    };
  }

  if (LAW_APPENDIX_RE.test(trimmed) || LAW_ATTACHMENT_RE.test(trimmed)) {
    return {
      title: trimmed,
      depth: 2,
      articleNo: extractArticleNo(trimmed),
      isMarkdownHeading: false,
    };
  }

  if (QA_BOUNDARY_RE.test(trimmed)) {
    return {
      title: trimmed,
      depth: 4,
      articleNo: extractArticleNo(trimmed),
      isMarkdownHeading: false,
    };
  }

  if (EVALUATION_SUBHEADING_RE.test(trimmed) || NUMBERED_SUBHEADING_RE.test(trimmed)) {
    return {
      title: trimmed,
      depth: 4,
      articleNo: extractArticleNo(trimmed),
      isMarkdownHeading: false,
    };
  }

  return null;
}

function pushSection(
  sections: StructuredSection[],
  documentId: string,
  activeTitle: string,
  activePath: string[],
  activeArticleNo: string | undefined,
  lines: string[],
  startLine: number,
  endLine: number,
) {
  const content = normalizeWhitespace(lines.join('\n'));
  if (!content) return;

  sections.push({
    id: sha1(`${documentId}:${activePath.join('>')}:${startLine}:${endLine}`),
    documentId,
    title: activeTitle,
    depth: activePath.length,
    path: activePath,
    articleNo: activeArticleNo,
    content,
    lineStart: startLine,
    lineEnd: endLine,
  });
}

export function buildStructuredSections(file: KnowledgeFile): StructuredSection[] {
  const metadata = toDocumentMetadata(file);
  const lines = file.content.replace(/\r\n/g, '\n').split('\n');
  const sections: StructuredSection[] = [];
  const markdownTrail: Array<{ depth: number; title: string }> = [];

  let activeTitle = metadata.title;
  let activePath = [metadata.title];
  let activeArticleNo = metadata.articleHint;
  let activeStartLine = 1;
  let buffer: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const detectedBoundary = detectBoundary(line);
    const trimmed = line.trim();
    const previousTrimmed = (lines[index - 1] ?? '').trim();
    const nextTrimmed = (lines[index + 1] ?? '').trim();
    const isConsecutiveListItem =
      LIST_ITEM_RE.test(trimmed) && (LIST_ITEM_RE.test(previousTrimmed) || LIST_ITEM_RE.test(nextTrimmed));
    const boundary = isConsecutiveListItem ? null : detectedBoundary;

    if (!boundary) {
      buffer.push(line);
      continue;
    }

    if (buffer.length > 0) {
      pushSection(
        sections,
        metadata.documentId,
        activeTitle,
        activePath,
        activeArticleNo,
        buffer,
        activeStartLine,
        index,
      );
    }

    if (boundary.isMarkdownHeading) {
      while (markdownTrail.length > 0 && markdownTrail[markdownTrail.length - 1].depth >= boundary.depth) {
        markdownTrail.pop();
      }
      markdownTrail.push({ depth: boundary.depth, title: boundary.title });
      activePath = [metadata.title, ...markdownTrail.map((item) => item.title)];
    } else {
      activePath = [metadata.title, ...markdownTrail.map((item) => item.title), boundary.title];
    }

    activeTitle = boundary.title;
    activeArticleNo = boundary.articleNo ?? extractArticleNo(boundary.title) ?? metadata.articleHint;
    activeStartLine = index + 1;
    buffer = [line];
  }

  if (buffer.length > 0) {
    pushSection(
      sections,
      metadata.documentId,
      activeTitle,
      activePath,
      activeArticleNo,
      buffer,
      activeStartLine,
      lines.length,
    );
  }

  if (sections.length === 0) {
    pushSection(
      sections,
      metadata.documentId,
      metadata.title,
      [metadata.title],
      metadata.articleHint,
      lines,
      1,
      lines.length,
    );
  }

  return sections;
}

function normalizeSpan(raw: string, absoluteStart: number): SpanBlock | null {
  const leading = raw.search(/\S/);
  if (leading < 0) return null;
  const trailingMatch = raw.match(/\s*$/);
  const trailingLength = trailingMatch?.[0]?.length ?? 0;
  const trimmed = raw.slice(leading, raw.length - trailingLength);
  const normalized = normalizeWhitespace(trimmed);
  if (!normalized) return null;

  return {
    text: normalized,
    spanStart: absoluteStart + leading,
    spanEnd: absoluteStart + raw.length - trailingLength,
  };
}

function buildParagraphBlocks(content: string): SpanBlock[] {
  return Array.from(content.matchAll(PARAGRAPH_RE))
    .map((match) => {
      const raw = match[0];
      const normalized = normalizeSpan(raw, match.index ?? 0);
      if (!normalized) return null;
      const lines = raw.split('\n');
      const listLineCount = lines.filter((line) => LIST_ITEM_RE.test(line.trim())).length;
      const tableLineCount = lines.filter((line) => TABLE_ROW_RE.test(line.trim())).length;
      const protectedGroup = listLineCount >= 2 || tableLineCount >= 2;
      const containsCheckList = protectedGroup || CHECKLIST_CUE_RE.test(normalized.text) || hasQualifierSignal(normalized.text);
      const block: SpanBlock = {
        ...normalized,
        listGroupId: protectedGroup ? sha1(`${normalized.spanStart}:${normalized.text}`) : undefined,
        containsCheckList,
        protectedGroup,
      };
      return block;
    })
    .filter((value): value is SpanBlock => value !== null);
}

function isLawChunkBoundary(line: string): boolean {
  return LAW_HEADING_RE.test(line) || LAW_APPENDIX_RE.test(line) || LAW_ATTACHMENT_RE.test(line);
}

function buildLawBlocks(content: string): SpanBlock[] {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks: SpanBlock[] = [];

  let buffer: string[] = [];
  let blockStart = 0;
  let cursor = 0;

  const flush = (nextCursor: number) => {
    const raw = buffer.join('\n');
    const normalizedBlock = normalizeSpan(raw, blockStart);
    if (normalizedBlock) {
      blocks.push({
        ...normalizedBlock,
        spanEnd: Math.max(normalizedBlock.spanEnd, nextCursor),
      });
    }
    buffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineStart = cursor;
    const nextCursor = cursor + line.length + 1;
    const trimmed = line.trim();
    const shouldStartNew = trimmed && isLawChunkBoundary(trimmed) && buffer.length > 0;

    if (shouldStartNew) {
      flush(lineStart);
      blockStart = lineStart;
    }

    if (buffer.length === 0) {
      blockStart = lineStart;
    }
    buffer.push(line);
    cursor = nextCursor;
  }

  if (buffer.length > 0) {
    flush(normalized.length);
  }

  return blocks;
}

function splitOversizedBlock(block: SpanBlock): SpanBlock[] {
  const pieces: SpanBlock[] = [];
  const limit = block.protectedGroup ? MAX_PROTECTED_CHUNK_CHARS : MAX_CHUNK_CHARS;
  let start = 0;

  while (start < block.text.length) {
    const baseEnd = Math.min(start + limit, block.text.length);
    let end = baseEnd;
    const tailProbe = block.text.slice(Math.max(start, baseEnd - 160), baseEnd);
    if ((block.protectedGroup || block.containsCheckList) && hasQualifierSignal(tailProbe) && baseEnd < block.text.length) {
      const extension = block.text.slice(baseEnd, Math.min(block.text.length, baseEnd + 600));
      const paragraphBoundary = extension.match(/\n\s*\n/u);
      end = paragraphBoundary ? baseEnd + (paragraphBoundary.index ?? 0) + paragraphBoundary[0].length : Math.min(block.text.length, baseEnd + 600);
    }
    const segment = block.text.slice(start, end).trim();
    if (segment) {
      const leading = block.text.slice(start, end).search(/\S/);
      const safeLeading = leading < 0 ? 0 : leading;
      pieces.push({
        text: segment,
        spanStart: block.spanStart + start + safeLeading,
        spanEnd: block.spanStart + end,
        listGroupId: block.listGroupId,
        containsCheckList: block.containsCheckList,
        protectedGroup: block.protectedGroup,
      });
    }
    if (end >= block.text.length) break;
    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }

  return pieces;
}

function buildWindowsFromBlocks(blocks: SpanBlock[]): ChunkWindow[] {
  const expandedBlocks = blocks.flatMap((block) =>
    block.text.length > (block.protectedGroup ? MAX_PROTECTED_CHUNK_CHARS : MAX_CHUNK_CHARS)
      ? splitOversizedBlock(block)
      : [block],
  );

  if (expandedBlocks.length === 0) return [];

  const windows: ChunkWindow[] = [];
  let buffer: SpanBlock[] = [];

  const pushWindow = (windowBlocks: SpanBlock[]) => {
    if (windowBlocks.length === 0) return;
    const text = normalizeWhitespace(windowBlocks.map((item) => item.text).join('\n\n'));
    if (!text) return;
    const listGroupIds = Array.from(new Set(windowBlocks.map((item) => item.listGroupId).filter(Boolean)));
    windows.push({
      text,
      spanStart: windowBlocks[0].spanStart,
      spanEnd: windowBlocks[windowBlocks.length - 1].spanEnd,
      listGroupId:
        listGroupIds.length === 0
          ? undefined
          : listGroupIds.length === 1
            ? listGroupIds[0]
            : sha1(listGroupIds.join(':')),
      containsCheckList: windowBlocks.some((item) => Boolean(item.containsCheckList)),
    });
  };

  const getOverlapTail = (windowBlocks: SpanBlock[]): SpanBlock[] => {
    const overlap: SpanBlock[] = [];
    let charCount = 0;
    for (let index = windowBlocks.length - 1; index >= 0; index -= 1) {
      overlap.unshift(windowBlocks[index]);
      charCount += windowBlocks[index].text.length;
      if (charCount >= CHUNK_OVERLAP_CHARS) break;
    }
    return overlap;
  };

  for (const block of expandedBlocks) {
    const candidateBlocks = [...buffer, block];
    const candidateLength = candidateBlocks.reduce((sum, item) => sum + item.text.length, 0) + (candidateBlocks.length - 1) * 2;
    const candidateLimit = candidateBlocks.some((item) => item.protectedGroup || item.containsCheckList)
      ? MAX_PROTECTED_CHUNK_CHARS
      : MAX_CHUNK_CHARS;

    if (buffer.length > 0 && candidateLength > candidateLimit) {
      pushWindow(buffer);
      buffer = [...getOverlapTail(buffer), block];
      continue;
    }

    buffer = candidateBlocks;
  }

  pushWindow(buffer);
  return windows;
}

function looksLikeLawStructuredSection(section: StructuredSection): boolean {
  return (
    Boolean(section.articleNo) ||
    LAW_HEADING_RE.test(section.title) ||
    LAW_APPENDIX_RE.test(section.title) ||
    LAW_ATTACHMENT_RE.test(section.title)
  );
}

function splitSectionText(section: StructuredSection): ChunkWindow[] {
  const blocks = looksLikeLawStructuredSection(section) ? buildLawBlocks(section.content) : buildParagraphBlocks(section.content);
  const effectiveBlocks =
    blocks.length > 0
      ? blocks
      : [
          {
            text: normalizeWhitespace(section.content),
            spanStart: 0,
            spanEnd: section.content.length,
          },
        ];

  return buildWindowsFromBlocks(effectiveBlocks).map((window) => {
    if (!window.text || window.text.startsWith(section.title)) {
      return window;
    }

    return {
      ...window,
      text: normalizeWhitespace(`${section.title}\n${window.text}`),
    };
  });
}

function buildEmbeddingInput(params: { docTitle: string; section: StructuredSection; text: string }): string {
  return normalizeWhitespace(
    [
      `[문서: ${params.docTitle}]`,
      `[섹션: ${params.section.title}]`,
      params.section.path.length > 0 ? `[경로: ${params.section.path.join(' > ')}]` : '',
      params.section.articleNo ? `[조문: ${params.section.articleNo}]` : '',
      '',
      params.text,
    ].join('\n'),
  );
}

export function buildStructuredChunks(files: KnowledgeFile[]): StructuredChunk[] {
  const chunks: StructuredChunk[] = [];

  for (const file of files) {
    const metadata = toDocumentMetadata(file);
    const sections = buildStructuredSections(file);
    let chunkIndex = 0;

    for (const section of sections) {
      const windows = splitSectionText(section);
      for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
        const window = windows[windowIndex];
        if (!window.text) continue;
        const embeddingInput = buildEmbeddingInput({
          docTitle: metadata.title,
          section,
          text: window.text,
        });

        const chunkHash = sha1(`${metadata.documentId}:${section.id}:${windowIndex}:${embeddingInput}`);
        const matchedLabels = [metadata.title, metadata.sourceType, metadata.documentGroup, ...section.path]
          .filter(Boolean)
          .map((value) => String(value));

        chunks.push({
          id: sha1(`${metadata.documentId}:${chunkHash}`),
          documentId: metadata.documentId,
          chunkIndex,
          title: section.title,
          text: window.text,
          textPreview: window.text.slice(0, 220),
          searchText: normalizeWhitespace(
            [
              metadata.title,
              metadata.fileName,
              metadata.sourceType,
              metadata.documentGroup,
              section.path.join(' '),
              section.articleNo ?? '',
              section.title,
              window.text,
            ].join('\n'),
          ),
          mode: metadata.mode,
          sourceType: metadata.sourceType,
          sourceRole: metadata.sourceRole,
          documentGroup: metadata.documentGroup,
          docTitle: metadata.title,
          fileName: metadata.fileName,
          path: metadata.path,
          effectiveDate: metadata.effectiveDate,
          publishedDate: metadata.publishedDate,
          sectionPath: section.path,
          headingPath: section.path,
          articleNo: section.articleNo,
          matchedLabels,
          chunkHash,
          parentSectionId: section.id,
          parentSectionTitle: section.title,
          listGroupId: window.listGroupId,
          containsCheckList: window.containsCheckList,
          embeddingInput,
          windowIndex,
          spanStart: window.spanStart,
          spanEnd: window.spanEnd,
          citationGroupId: sha1(`${metadata.documentId}:${section.id}`),
          linkedDocumentTitles: metadata.linkedDocumentTitles,
        });
        chunkIndex += 1;
      }
    }
  }

  return chunks;
}

export function chunksToEvidenceContext(chunks: StructuredChunk[]): string {
  return chunks
    .map(
      (chunk) =>
        [
          `EvidenceId: ${chunk.id}`,
          `Source: ${buildPreciseCitationLabel(chunk)}`,
          `Document: ${chunk.docTitle}`,
          chunk.articleNo ? `Article: ${chunk.articleNo}` : null,
          chunk.sectionPath.length > 0 ? `Path: ${chunk.sectionPath.join(' > ')}` : null,
          chunk.effectiveDate ? `EffectiveDate: ${chunk.effectiveDate}` : null,
          `Content:\n${chunk.text}`,
        ]
          .filter(Boolean)
          .join('\n'),
    )
    .join('\n\n---\n\n');
}

export function buildCompiledPages(chunks: StructuredChunk[]): CompiledPage[] {
  const grouped = new Map<string, StructuredChunk[]>();
  for (const chunk of chunks) {
    const list = grouped.get(chunk.documentId) ?? [];
    list.push(chunk);
    grouped.set(chunk.documentId, list);
  }

  const pages: CompiledPage[] = [];
  for (const documentChunks of grouped.values()) {
    const first = documentChunks[0];
    const headings = Array.from(new Set(documentChunks.flatMap((chunk) => chunk.sectionPath.slice(1)).filter(Boolean))).slice(0, 8);
    const backlinks = documentChunks.slice(0, 8).map((chunk) => chunk.id);
    const summary = [
      `${first.docTitle} 문서를 바탕으로 만든 구조화 보조 카드입니다.`,
      first.articleNo ? `주요 조문: ${first.articleNo}` : null,
      headings.length > 0 ? `주요 경로: ${headings.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    pages.push({
      id: sha1(`compiled:${first.documentId}`),
      pageType: 'document-summary',
      title: `${first.docTitle} 요약 카드`,
      mode: first.mode,
      sourceDocumentIds: [first.documentId],
      backlinks,
      summary,
      body: [
        `# ${first.docTitle}`,
        '',
        `- 문서유형: ${first.sourceType}`,
        first.effectiveDate ? `- 시행일: ${first.effectiveDate}` : null,
        `- 주요 출처: ${buildCitationLabel(first)}`,
        headings.length > 0 ? `- 대표 경로: ${headings.join(' / ')}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      tags: Array.from(new Set([first.sourceType, first.documentGroup, ...headings.slice(0, 4)])),
    });
  }

  return pages;
}
