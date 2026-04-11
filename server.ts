import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';
import { NodeRagService } from './src/lib/nodeRagService';
import type { ChatMessage, PromptMode } from './src/lib/ragTypes';
import type { PromptVariant } from './src/lib/promptAssembly';

dotenv.config();

const PROJECT_ROOT = process.cwd();
const PORT = Number(process.env.PORT || 3000);
const ragService = new NodeRagService(PROJECT_ROOT);

const requestQueue: Array<() => Promise<void>> = [];
let queueRunning = false;
const QUEUE_INTERVAL_MS = 1500;

async function enqueueRequest(task: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        await task();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    if (!queueRunning) void drainQueue();
  });
}

async function drainQueue() {
  queueRunning = true;
  while (requestQueue.length > 0) {
    const next = requestQueue.shift();
    if (next) {
      await next();
    }
    if (requestQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, QUEUE_INTERVAL_MS));
    }
  }
  queueRunning = false;
}

function parseAllowedOrigins(): string[] {
  return (process.env.RAG_FRONTEND_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applyCors(app: express.Express) {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.length === 0) return;

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not allowed.`));
      },
    }),
  );
}

function resolveKnowledgeFilePath(requestedPath: string): string | null {
  const normalizedPath = requestedPath.replace(/\\/g, '/').trim();
  if (!normalizedPath || normalizedPath.includes('..')) return null;
  if (!/\.(md|txt)$/i.test(normalizedPath)) return null;

  const relativePath = normalizedPath.replace(/^\/?knowledge\/?/, '');
  const knowledgeDir = path.resolve(PROJECT_ROOT, 'knowledge');
  const filePath = path.resolve(knowledgeDir, relativePath);
  if (!filePath.startsWith(knowledgeDir + path.sep) && filePath !== knowledgeDir) {
    return null;
  }

  return filePath;
}

async function startServer() {
  const app = express();

  applyCors(app);
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await ragService.initialize();
      const indexStatus = await ragService.getIndexStatus();
      res.json({
        ok: true,
        storage: ragService.getStats(),
        indexStatus,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to initialize RAG service.',
      });
    }
  });

  app.get('/api/knowledge', (_req, res) => {
    res.json(ragService.listKnowledgeFiles());
  });

  app.get('/api/index/status', async (_req, res) => {
    try {
      res.json(await ragService.getIndexStatus());
    } catch (error) {
      res.status(500).json({
        error: 'Failed to inspect index status',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/knowledge/file', (req, res) => {
    const requestedPath = typeof req.query.path === 'string' ? req.query.path : '';
    const filePath = resolveKnowledgeFilePath(requestedPath);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  });

  app.get('/api/knowledge/diagnostics', async (req, res) => {
    try {
      const requestedPath = typeof req.query.path === 'string' ? req.query.path : '';
      if (!requestedPath.trim()) {
        return res.status(400).json({ error: 'path must be provided' });
      }

      const diagnostics = await ragService.getDocumentDiagnostics(requestedPath);
      if (!diagnostics) {
        return res.status(404).json({ error: 'Document diagnostics not found' });
      }

      res.json(diagnostics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to inspect document diagnostics',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/knowledge/:filename', (req, res) => {
    const filePath = resolveKnowledgeFilePath(req.params.filename);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
  });

  app.post('/api/retrieval/inspect', async (req, res) => {
    try {
      const {
        query,
        messages,
        mode = 'integrated',
        apiKey,
      }: {
        query?: string;
        messages?: ChatMessage[];
        mode?: PromptMode;
        apiKey?: string;
      } = req.body;

      const hasMessages = Array.isArray(messages) && messages.length > 0;
      if (!query?.trim() && !hasMessages) {
        return res.status(400).json({ error: 'query or messages must be provided' });
      }

      const inspection = await ragService.inspectRetrieval(hasMessages ? messages : (query as string), mode, apiKey);
      res.json(inspection);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to inspect retrieval',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const {
        messages,
        mode = 'integrated',
        model = 'gemini-3-flash-preview',
        promptVariant = 'v2',
        apiKey,
      }: {
        messages?: ChatMessage[];
        mode?: PromptMode;
        model?: string;
        promptVariant?: PromptVariant;
        apiKey?: string;
      } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages must be a non-empty array' });
      }

      await enqueueRequest(async () => {
        const response = await ragService.generateChatResponse({
          messages,
          mode,
          model,
          promptVariant,
          apiKey,
        });

        res.json({
          text: response.text,
          citations: response.citations.map((citation) => ({
            id: citation.id,
            docTitle: citation.docTitle,
            articleNo: citation.articleNo,
            sectionPath: citation.sectionPath,
            effectiveDate: citation.effectiveDate,
          })),
          retrieval: {
            normalizedQuery: response.retrieval.normalizedQuery,
            querySources: response.retrieval.querySources,
            intent: response.search.intent,
            confidence: response.search.confidence,
            mismatchSignals: response.retrieval.mismatchSignals,
            groundingGatePassed: response.retrieval.groundingGatePassed,
            matchedDocumentPaths: response.retrieval.matchedDocumentPaths,
            candidateDiagnostics: response.retrieval.candidateDiagnostics,
            evidence: response.search.evidence.map((item) => ({
              id: item.id,
              docTitle: item.docTitle,
              articleNo: item.articleNo,
              sectionPath: item.sectionPath,
              exactScore: item.exactScore,
              lexicalScore: item.lexicalScore,
              vectorScore: item.vectorScore,
              rerankScore: item.rerankScore,
            })),
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lowered = message.toLowerCase();
      if (
        lowered.includes('429') ||
        lowered.includes('resource_exhausted') ||
        lowered.includes('quota')
      ) {
        return res.status(429).json({
          error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
          details: message,
        });
      }

      res.status(500).json({
        error: 'Failed to generate grounded response',
        details: message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(PROJECT_ROOT, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  void ragService.initialize().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
  });
}

startServer();
