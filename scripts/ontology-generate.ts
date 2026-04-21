import {
  buildGeneratedOntologyManifest,
  loadGeneratedOntologyManifest,
  writeGeneratedOntologyManifest,
} from '../src/lib/ragOntology';
import { buildStructuredChunks } from '../src/lib/ragStructured';
import { loadKnowledgeFilesForIndex } from '../src/lib/nodeRagService';

const projectRoot = process.cwd();
const files = await loadKnowledgeFilesForIndex(projectRoot);
const chunks = buildStructuredChunks(files);
const existing = loadGeneratedOntologyManifest(projectRoot);
const manifest = buildGeneratedOntologyManifest(chunks, existing);
const outputPath = writeGeneratedOntologyManifest(projectRoot, manifest);

const statusCounts = manifest.concepts.reduce<Record<string, number>>((counts, concept) => {
  const status = concept.status ?? 'candidate';
  counts[status] = (counts[status] ?? 0) + 1;
  return counts;
}, {});

console.log(
  [
    `Generated ontology manifest: ${outputPath}`,
    `concepts=${manifest.concepts.length}`,
    `candidate=${statusCounts.candidate ?? 0}`,
    `validated=${statusCounts.validated ?? 0}`,
    `promoted=${statusCounts.promoted ?? 0}`,
    `rejected=${statusCounts.rejected ?? 0}`,
  ].join(' '),
);
