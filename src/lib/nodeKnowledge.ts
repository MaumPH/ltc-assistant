import fs from 'fs';
import path from 'path';
import { toKnowledgeFiles, type KnowledgeFile, type PromptMode } from './ragCore';

function readKnowledgeDirectory(dirPath: string, virtualPrefix: string): Record<string, string> {
  if (!fs.existsSync(dirPath)) return {};

  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  const entries: Record<string, string> = {};

  for (const file of files) {
    if (!file.isFile()) continue;
    if (!/\.(md|txt)$/i.test(file.name)) continue;

    const fullPath = path.join(dirPath, file.name);
    const virtualPath = `${virtualPrefix}/${file.name}`.replace(/\\/g, '/');
    entries[virtualPath] = fs.readFileSync(fullPath, 'utf8');
  }

  return entries;
}

export function loadKnowledgeCorporaFromDisk(projectRoot: string): Record<PromptMode, KnowledgeFile[]> {
  const knowledgeRoot = path.join(projectRoot, 'knowledge');
  const rootEntries = readKnowledgeDirectory(knowledgeRoot, '/knowledge');
  const evalEntries = readKnowledgeDirectory(path.join(knowledgeRoot, 'eval'), '/knowledge/eval');

  return {
    integrated: toKnowledgeFiles({ ...rootEntries, ...evalEntries }),
    evaluation: toKnowledgeFiles({ ...evalEntries }),
  };
}
