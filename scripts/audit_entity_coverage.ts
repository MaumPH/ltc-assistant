import fs from 'node:fs';
import path from 'node:path';
import { ENTITY_ANCHORS } from '../src/lib/entityAnchors';

type HeadingFrame = {
  level: number;
  text: string;
};

type EntityHit = {
  path: string;
  lineNumber: number;
  heading: string;
  matchedTerm: string;
};

function listMarkdownFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function collectEntityHits(filePath: string): Array<{ entityId: string; hit: EntityHit }> {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  const headings: HeadingFrame[] = [];
  const results: Array<{ entityId: string; hit: EntityHit }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingMatch = line.match(/^(#+)\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      while (headings.length > 0 && headings[headings.length - 1].level >= level) {
        headings.pop();
      }
      headings.push({ level, text });
    }

    const compactLine = compact(line);
    for (const anchor of ENTITY_ANCHORS) {
      const matchedTerm = anchor.synonyms.find((term) => compactLine.includes(compact(term)));
      if (!matchedTerm) continue;
      results.push({
        entityId: anchor.id,
        hit: {
          path: filePath,
          lineNumber: index + 1,
          heading: headings[headings.length - 1]?.text ?? path.basename(filePath),
          matchedTerm,
        },
      });
    }
  }

  return results;
}

function main(): void {
  const projectRoot = process.cwd();
  const knowledgeRoot = path.join(projectRoot, 'knowledge');
  const files = listMarkdownFiles(knowledgeRoot);
  const hits = files.flatMap((filePath) => collectEntityHits(filePath));

  const payload = {
    generatedAt: new Date().toISOString(),
    entities: ENTITY_ANCHORS.map((anchor) => {
      const anchorHits = hits.filter((item) => item.entityId === anchor.id).map((item) => item.hit);
      const byHeading = new Map<string, EntityHit[]>();

      for (const hit of anchorHits) {
        const key = `${hit.heading}@@${path.relative(projectRoot, hit.path)}`;
        const list = byHeading.get(key) ?? [];
        list.push(hit);
        byHeading.set(key, list);
      }

      return {
        id: anchor.id,
        synonyms: anchor.synonyms,
        totalMatches: anchorHits.length,
        indicators: Array.from(byHeading.entries())
          .map(([key, headingHits]) => {
            const [heading, relativePath] = key.split('@@');
            return {
              heading,
              path: relativePath,
              count: headingHits.length,
              matchedTerms: Array.from(new Set(headingHits.map((hit) => hit.matchedTerm))),
              lines: headingHits.slice(0, 5).map((hit) => hit.lineNumber),
            };
          })
          .sort((left, right) => right.count - left.count || left.heading.localeCompare(right.heading, 'ko')),
      };
    }),
  };

  const outputPath = path.join(knowledgeRoot, '_entity_scope.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(projectRoot, outputPath)} with ${payload.entities.length} entity buckets.`);
}

main();
