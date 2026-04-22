export interface WikiPage {
  slug: string;
  fileName: string;
  title: string;
  area: string;
  status: string;
  updated: string;
  tags: string[];
  body: string;
}

export interface WikiSection {
  title: string;
  content: string;
}

function readFrontMatterValue(frontMatter: string, key: string): string {
  return frontMatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
}

function parseFrontMatter(raw: string): { frontMatter: string; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontMatter: '', body: raw };
  return { frontMatter: match[1], body: match[2] };
}

function removeLeadingPageHeading(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/^#\s+.+(?:\n+|$)/, '')
    .trim();
}

export function parseEvaluationPage(fileName: string, raw: string): WikiPage {
  const parsed = parseFrontMatter(raw);
  let title = fileName.replace('.md', '');
  let area = '미분류';
  let status = 'active';
  let updated = '';
  let tags: string[] = [];

  if (parsed.frontMatter) {
    title = readFrontMatterValue(parsed.frontMatter, 'title') || title;
    area = readFrontMatterValue(parsed.frontMatter, 'area') || area;
    status = readFrontMatterValue(parsed.frontMatter, 'status') || status;
    updated = readFrontMatterValue(parsed.frontMatter, 'updated') || '';

    const tagsMatch = parsed.frontMatter.match(/^tags:\s*\[([^\]]*)\]/m);
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(',')
        .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
  }

  return {
    slug: fileName.replace('.md', ''),
    fileName,
    title,
    area,
    status,
    updated,
    tags,
    body: removeLeadingPageHeading(parsed.body),
  };
}

export function stripMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitEvaluationSections(body: string): WikiSection[] {
  const normalized = body.replace(/\r\n/g, '\n').trim();
  const matches = Array.from(normalized.matchAll(/^##\s+(.+)$/gm));

  if (matches.length === 0) {
    return normalized ? [{ title: '개요', content: normalized }] : [];
  }

  const sections: WikiSection[] = [];
  const preface = normalized.slice(0, matches[0].index).trim();
  if (preface) sections.push({ title: '개요', content: preface });

  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    const content = normalized.slice(start, end).trim();
    sections.push({ title: match[1].trim(), content });
  });

  return sections;
}

export function buildJudgementSummary(judgementContent: string | undefined, fallbackBody: string): string {
  const source = judgementContent?.trim() ? judgementContent : fallbackBody;
  const primaryLine =
    source
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('-') && !line.startsWith('#')) ?? source;

  return stripMarkdown(primaryLine).slice(0, 220);
}

function stripListMarker(line: string): string {
  let value = line.trim().replace(/^[-*]\s+/, '');
  while (/^-\s+/.test(value)) value = value.replace(/^-\s+/, '');
  return value.trim();
}

function normalizeCriterionText(value: string): string {
  let normalized = value
    .replace(/\*\*/g, '')
    .replace(/^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)\s*(기\s*관|직\s*원|수급자)\s*/u, '$1 ')
    .replace(/^(기\s*관|직\s*원|수급자)\s*/u, '')
    .replace(/\s*(기록|현장|면담|전산|시연|신설|연동)(\s*,\s*(기록|현장|면담|전산|시연|신설|연동))*\s*$/u, '')
    .replace(/\s*(면담신설|기록면담|면담연동|기록연동)\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  normalized = normalized.replace(/^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)\s*$/u, '$1 세부 기준');
  return normalized;
}

function isRoleOnlyLine(value: string): boolean {
  return /^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)\s*(기\s*관|직\s*원|수급자)\s*$/u.test(value.trim());
}

function comparableCriterionText(value: string): string {
  return value.replace(/^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)\s*/u, '').trim();
}

export function prepareEvaluationSectionMarkdown(title: string, content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  if (title !== '평가기준') return normalized;

  const lines = normalized.split('\n');
  const out: string[] = [];
  let currentCriterion = '';

  for (const line of lines) {
    const headingMatch = line.match(/^-\s+\*\*(.+?)\*\*\s*$/u);
    if (headingMatch) {
      currentCriterion = normalizeCriterionText(headingMatch[1]);
      out.push(`- **${currentCriterion}**`);
      continue;
    }

    if (/^\s+-\s+/.test(line)) {
      const rawValue = stripListMarker(line);
      if (isRoleOnlyLine(rawValue)) continue;

      const detail = normalizeCriterionText(rawValue);
      if (!detail || comparableCriterionText(detail) === comparableCriterionText(currentCriterion)) continue;
      out.push(`  - ${detail}`);
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

export function getEvaluationSectionClassName(title: string): string {
  const sectionClassByTitle: Record<string, string> = {
    '한눈에 보기': 'overview',
    '판단 기준': 'judgement',
    평가방향: 'direction',
    평가기준: 'criteria',
    채점기준: 'scoring',
    '충족/미충족 기준': 'pass-fail',
    확인방법: 'methods',
    '확정 근거': 'confirmed-basis',
    관련근거: 'legal-basis',
    '실무 해석': 'practice',
    '준비 서류': 'documents',
    주의사항: 'warnings',
    '관련 지표': 'related',
    개요: 'preface',
  };

  return sectionClassByTitle[title] ?? 'general';
}
