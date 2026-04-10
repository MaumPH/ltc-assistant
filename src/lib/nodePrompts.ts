import fs from 'fs';
import path from 'path';
import type { PromptSourceSet } from './promptAssembly';

function readPrompt(projectRoot: string, relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

export function loadPromptSourceSet(projectRoot: string): PromptSourceSet {
  return {
    baseline: readPrompt(projectRoot, 'system_prompt.md'),
    base: readPrompt(projectRoot, 'prompts/v2/base.md'),
    overlays: {
      integrated: readPrompt(projectRoot, 'prompts/v2/integrated.overlay.md'),
      evaluation: readPrompt(projectRoot, 'prompts/v2/evaluation.overlay.md'),
    },
  };
}
