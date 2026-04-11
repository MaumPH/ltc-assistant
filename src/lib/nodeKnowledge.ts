import fs from 'fs';
import path from 'path';
import { toKnowledgeFiles, type KnowledgeFile, type PromptMode } from './ragCore';

function stripNullCharacters(value: string): string {
  return value.replace(/\u0000/g, '');
}

function isEvaluationKnowledgePath(filePath: string): boolean {
  return /\/knowledge\/(?:eval|evaluation)\//.test(filePath.replace(/\\/g, '/'));
}

function readKnowledgeTree(dirPath: string, virtualPrefix: string): Record<string, string> {
  if (!fs.existsSync(dirPath)) return {};

  const entries: Record<string, string> = {};

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
      const rawContent = fs.readFileSync(fullPath, 'utf8');
      const sanitizedContent = stripNullCharacters(rawContent);
      if (rawContent.length !== sanitizedContent.length) {
        console.warn(`[knowledge] stripped NUL characters from ${virtualPath}`);
      }
      entries[virtualPath] = sanitizedContent;
    }
  };

  visit(dirPath, virtualPrefix);
  return entries;
}

export function loadKnowledgeCorporaFromDisk(projectRoot: string): Record<PromptMode, KnowledgeFile[]> {
  const knowledgeRoot = path.join(projectRoot, 'knowledge');
  const allEntries = readKnowledgeTree(knowledgeRoot, '/knowledge');
  const allFiles = toKnowledgeFiles(allEntries);

  return {
    integrated: allFiles,
    evaluation: allFiles.filter((file) => isEvaluationKnowledgePath(file.path)),
  };
}
