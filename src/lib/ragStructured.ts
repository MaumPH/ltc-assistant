import { buildCitationLabel, extractArticleNo, normalizeWhitespace, sha1, toDocumentMetadata } from './ragMetadata';
import type { CompiledPage, KnowledgeFile, StructuredChunk, StructuredSection } from './ragTypes';

const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 120;

type SectionBoundary = {
  title: string;
  depth: number;
  articleNo?: string;
  isMarkdownHeading: boolean;
};

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

  if (/^제\s*\d+\s*조(?:\s*의\s*\d+)?/.test(trimmed)) {
    return {
      title: trimmed,
      depth: 3,
      articleNo: extractArticleNo(trimmed),
      isMarkdownHeading: false,
    };
  }

  if (/^\[?별표\s*\d+(?:의\s*\d+)?/.test(trimmed) || /^\[?별지\s*제?\s*\d+호/.test(trimmed)) {
    return {
      title: trimmed,
      depth: 2,
      articleNo: extractArticleNo(trimmed),
      isMarkdownHeading: false,
    };
  }

  if (/^\(?붙임\)?/.test(trimmed) || /^\(?부록\)?/.test(trimmed)) {
    return {
      title: trimmed,
      depth: 2,
      articleNo: extractArticleNo(trimmed),
      isMarkdownHeading: false,
    };
  }

  if (
    /^(q\s*&\s*a|q&a|질문\(q\)|답변\(a\)|질문\s*\d+|답변\s*\d+|사례\s*\d+|문\s*\d+[.)]?)/i.test(trimmed)
  ) {
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
    const boundary = detectBoundary(line);

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

function splitOversizedText(content: string): string[] {
  const pieces: string[] = [];
  let start = 0;

  while (start < content.length) {
    const end = Math.min(start + MAX_CHUNK_CHARS, content.length);
    const segment = content.slice(start, end).trim();
    if (segment) pieces.push(segment);
    if (end >= content.length) break;
    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }

  return pieces;
}

function splitSectionText(content: string): string[] {
  const paragraphs = content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const normalizedParagraphs = paragraphs.flatMap((paragraph) =>
    paragraph.length > MAX_CHUNK_CHARS ? splitOversizedText(paragraph) : [paragraph],
  );

  const chunks: string[] = [];
  let buffer = '';

  for (const paragraph of normalizedParagraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (buffer && candidate.length > MAX_CHUNK_CHARS) {
      chunks.push(buffer.trim());
      buffer = `${buffer.slice(-CHUNK_OVERLAP_CHARS)}\n\n${paragraph}`.trim();
    } else {
      buffer = candidate;
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks.length > 0 ? chunks : [content.trim()];
}

export function buildStructuredChunks(files: KnowledgeFile[]): StructuredChunk[] {
  const chunks: StructuredChunk[] = [];

  for (const file of files) {
    const metadata = toDocumentMetadata(file);
    const sections = buildStructuredSections(file);
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionChunks = splitSectionText(section.content);
      for (const sectionChunk of sectionChunks) {
        const normalizedText = normalizeWhitespace(sectionChunk);
        if (!normalizedText) continue;

        const chunkHash = sha1(`${metadata.documentId}:${section.id}:${chunkIndex}:${normalizedText}`);
        const matchedLabels = [metadata.title, metadata.sourceType, metadata.documentGroup, ...section.path]
          .filter(Boolean)
          .map((value) => String(value));

        chunks.push({
          id: sha1(`${metadata.documentId}:${chunkHash}`),
          documentId: metadata.documentId,
          chunkIndex,
          title: section.title,
          text: normalizedText,
          textPreview: normalizedText.slice(0, 220),
          searchText: normalizeWhitespace(
            [
              metadata.title,
              metadata.fileName,
              metadata.sourceType,
              metadata.documentGroup,
              section.path.join(' '),
              section.articleNo ?? '',
              normalizedText,
            ].join('\n'),
          ),
          mode: metadata.mode,
          sourceType: metadata.sourceType,
          documentGroup: metadata.documentGroup,
          docTitle: metadata.title,
          fileName: metadata.fileName,
          path: metadata.path,
          effectiveDate: metadata.effectiveDate,
          publishedDate: metadata.publishedDate,
          sectionPath: section.path,
          articleNo: section.articleNo,
          matchedLabels,
          chunkHash,
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
      (chunk, index) =>
        [
          `Evidence ${index + 1} [${chunk.id}]`,
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
