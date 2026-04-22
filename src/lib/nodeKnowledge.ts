import fs from 'fs';
import path from 'path';
import type { KnowledgeFile, PromptMode } from './ragCore';

const loggedNulStripPaths = new Set<string>();

function stripNullCharacters(value: string): string {
  return value.replace(/\u0000/g, '');
}

function isEvaluationKnowledgePath(filePath: string): boolean {
  return /\/knowledge\/(?:eval|evaluation)\//.test(filePath.replace(/\\/g, '/'));
}

function readKnowledgeTree(dirPath: string, virtualPrefix: string): KnowledgeFile[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries: KnowledgeFile[] = [];

  const visit = (currentDir: string, currentPrefix: string) => {
    const children = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const child of children) {
      if (child.name.startsWith('.')) continue;

      const fullPath = path.join(currentDir, child.name);
      const virtualPath = `${currentPrefix}/${child.name}`.replace(/\\/g, '/');

      if (child.isDirectory()) {
        visit(fullPath, virtualPath);
        continue;
      }

      if (!child.isFile() || !/\.(md|txt)$/i.test(child.name)) continue;
      const stat = fs.statSync(fullPath);
      const rawContent = fs.readFileSync(fullPath, 'utf8');
      const sanitizedContent = stripNullCharacters(rawContent);
      const nulStripped = rawContent.length !== sanitizedContent.length;
      if (rawContent.length !== sanitizedContent.length && !loggedNulStripPaths.has(virtualPath)) {
        loggedNulStripPaths.add(virtualPath);
        console.warn(`[knowledge] stripped NUL characters from ${virtualPath}`);
      }
      entries.push({
        path: virtualPath,
        name: child.name,
        size: Buffer.byteLength(sanitizedContent, 'utf8'),
        content: sanitizedContent,
        updatedAt: stat.mtime.toISOString(),
        nulStripped,
      });
    }
  };

  visit(dirPath, virtualPrefix);
  return entries.sort((left, right) => left.path.localeCompare(right.path, 'ko'));
}

export function loadKnowledgeCorporaFromDisk(projectRoot: string): Record<PromptMode, KnowledgeFile[]> {
  const knowledgeRoot = path.join(projectRoot, 'knowledge');
  const allFiles = readKnowledgeTree(knowledgeRoot, '/knowledge');

  return {
    integrated: allFiles,
    evaluation: allFiles.filter((file) => isEvaluationKnowledgePath(file.path)),
  };
}
