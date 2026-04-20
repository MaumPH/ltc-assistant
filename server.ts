import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';
import { buildKnowledgeCategoryCounts } from './src/lib/knowledgeCategories';
import { NodeRagService } from './src/lib/nodeRagService';
import type { ChatMessage, PromptMode } from './src/lib/ragTypes';
import type { PromptVariant } from './src/lib/promptAssembly';

dotenv.config();

const PROJECT_ROOT = process.cwd();
const PORT = Number(process.env.PORT || 3000);
const RATE_LIMIT_WINDOW_MS = parsePositiveInteger(process.env.RAG_RATE_LIMIT_WINDOW_MS, 60_000);
const CHAT_RATE_LIMIT_MAX = parsePositiveInteger(process.env.RAG_CHAT_RATE_LIMIT_MAX, 20);
const INSPECT_RATE_LIMIT_MAX = parsePositiveInteger(process.env.RAG_INSPECT_RATE_LIMIT_MAX, 20);
const API_KEY_RE = /AIza[0-9A-Za-z\-_]+/g;
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

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCommaSeparatedEnv(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseAllowedOrigins(): string[] {
  return parseCommaSeparatedEnv(process.env.RAG_FRONTEND_ORIGIN);
}

function parseCspConnectSources(): string[] {
  return parseCommaSeparatedEnv(process.env.RAG_CSP_CONNECT_SRC);
}

function sanitizeSensitiveText(value: string): string {
  return value.replace(API_KEY_RE, 'AIza****');
}

function getSafeErrorMessage(error: unknown): string {
  return sanitizeSensitiveText(error instanceof Error ? error.message : String(error));
}

function logServerError(context: string, error: unknown): void {
  console.error(`[server] ${context}: ${getSafeErrorMessage(error)}`);
}

function createApiRateLimiter(max: number) {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler(_req, res) {
      res.setHeader('Retry-After', Math.ceil(RATE_LIMIT_WINDOW_MS / 1000).toString());
      res.status(429).json({
        error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
      });
    },
  });
}

function applySecurityHeaders(app: express.Express) {
  const connectSources = Array.from(new Set(["'self'", ...parseCspConnectSources()]));

  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"],
                objectSrc: ["'none'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                fontSrc: ["'self'", 'data:'],
                connectSrc: connectSources,
              },
            }
          : false,
    }),
  );
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
  const chatRateLimit = createApiRateLimiter(CHAT_RATE_LIMIT_MAX);
  const inspectRateLimit = createApiRateLimiter(INSPECT_RATE_LIMIT_MAX);

  applySecurityHeaders(app);
  applyCors(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await ragService.initialize();
      const indexStatus = await ragService.getIndexStatus();
      res.json({
        ok: true,
        storage: ragService.getStats(),
        indexStatus,
        retrievalReadiness: indexStatus.retrievalReadiness,
        pendingEmbeddingChunks: indexStatus.pendingEmbeddingChunks,
        nextEmbeddingRetryAt: indexStatus.nextEmbeddingRetryAt,
      });
    } catch (error) {
      logServerError('health check failed', error);
      res.status(500).json({
        ok: false,
        error: getSafeErrorMessage(error) || 'Failed to initialize RAG service.',
      });
    }
  });

  app.get('/api/home/overview', async (_req, res) => {
    try {
      await ragService.initialize();
      const stats = ragService.getStats();
      const indexStatus = await ragService.getIndexStatus();
      const knowledgeFiles = ragService.listKnowledgeFiles();
      const latestKnowledgeUpdatedAt = knowledgeFiles
        .map((file) => file.updatedAt)
        .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
        .sort((left, right) => right.getTime() - left.getTime())[0]
        ?.toISOString();

      res.json({
        knowledgeDocumentCount: knowledgeFiles.length,
        knowledgeCategoryCounts: buildKnowledgeCategoryCounts(knowledgeFiles),
        chunkCount: stats.chunks,
        compiledPageCount: stats.compiledPages,
        retrievalReadiness: indexStatus.retrievalReadiness,
        pendingEmbeddingChunks: indexStatus.pendingEmbeddingChunks,
        storageMode: stats.storageMode,
        indexGeneratedAt: indexStatus.generatedAt,
        latestKnowledgeUpdatedAt,
      });
    } catch (error) {
      logServerError('home overview failed', error);
      res.status(500).json({
        error: 'Failed to load home overview',
        details: getSafeErrorMessage(error),
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
      logServerError('index status failed', error);
      res.status(500).json({
        error: 'Failed to inspect index status',
        details: getSafeErrorMessage(error),
      });
    }
  });

  app.get('/api/chat/capabilities', async (_req, res) => {
    try {
      res.json(await ragService.getChatCapabilities());
    } catch (error) {
      logServerError('chat capabilities failed', error);
      res.status(500).json({
        error: 'Failed to inspect chat capabilities',
        details: getSafeErrorMessage(error),
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
      logServerError('knowledge diagnostics failed', error);
      res.status(500).json({
        error: 'Failed to inspect document diagnostics',
        details: getSafeErrorMessage(error),
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

  app.post('/api/retrieval/inspect', inspectRateLimit, async (req, res) => {
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
      logServerError('retrieval inspect failed', error);
      res.status(500).json({
        error: 'Failed to inspect retrieval',
        details: getSafeErrorMessage(error),
      });
    }
  });

  app.post('/api/chat', chatRateLimit, async (req, res) => {
    let requestedModel = 'gemini-3-flash-preview';
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
      requestedModel = model;

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
          model: requestedModel,
          answer: response.answer,
          text: response.text,
          citations: response.citations.map((citation) => ({
            evidenceId: citation.id,
            label: citation.fileName || citation.docTitle,
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
            retrievalReadiness: response.retrieval.retrievalReadiness,
            hybridReadinessReason: response.retrieval.hybridReadinessReason,
            evidenceBalance: response.retrieval.evidenceBalance,
            agentDecision: response.retrieval.agentDecision,
            mismatchSignals: response.retrieval.mismatchSignals,
            groundingGatePassed: response.retrieval.groundingGatePassed,
            matchedDocumentPaths: response.retrieval.matchedDocumentPaths,
            candidateDiagnostics: response.retrieval.candidateDiagnostics,
            stageTrace: response.retrieval.stageTrace,
            neighborWindows: response.retrieval.neighborWindows,
            rejectionReasons: response.retrieval.rejectionReasons,
            routingDocuments: response.retrieval.routingDocuments,
            primaryExpansionDocuments: response.retrieval.primaryExpansionDocuments,
            finalEvidenceDocuments: response.retrieval.finalEvidenceDocuments,
            selectedRetrievalMode: response.retrieval.selectedRetrievalMode,
            workflowEventsHit: response.retrieval.workflowEventsHit,
            subquestions: response.retrieval.subquestions,
            basisCoverage: response.retrieval.basisCoverage,
            plannerTrace: response.retrieval.plannerTrace,
            normalizationTrace: response.retrieval.normalizationTrace,
            aliasResolutions: response.retrieval.aliasResolutions,
            parsedLawRefs: response.retrieval.parsedLawRefs,
            ontologyHits: response.retrieval.ontologyHits,
            graphExpansionTrace: response.retrieval.graphExpansionTrace,
            fallbackTriggered: response.retrieval.fallbackTriggered,
            fallbackSources: response.retrieval.fallbackSources,
            evidence: response.search.evidence.map((item) => ({
              evidenceId: item.id,
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
      const safeMessage = sanitizeSensitiveText(message);
      const lowered = message.toLowerCase();
      logServerError('chat request failed', error);
      if (
        lowered.includes('429') ||
        lowered.includes('resource_exhausted') ||
        lowered.includes('quota')
      ) {
        return res.status(429).json({
          error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
        });
      }

      if (lowered.includes('404') || lowered.includes('not_found') || lowered.includes('not found')) {
        return res.status(404).json({
          error: '요청한 모델 또는 API 리소스를 찾지 못했습니다.',
          model: requestedModel,
          details: safeMessage,
        });
      }

      if (lowered.includes('504') || lowered.includes('deadline_exceeded') || lowered.includes('deadline exceeded')) {
        return res.status(504).json({
          error: '선택한 모델이 제한 시간 안에 응답을 마치지 못했습니다.',
          model: requestedModel,
          details: safeMessage,
        });
      }

      if (lowered.includes('503') || lowered.includes('unavailable') || lowered.includes('overloaded')) {
        return res.status(503).json({
          error: '선택한 모델 서비스가 일시적으로 과부하 상태입니다.',
          model: requestedModel,
          details: safeMessage,
        });
      }

      if (lowered.includes('500') || lowered.includes('internal')) {
        return res.status(502).json({
          error: '모델 호출 중 서버 측 오류가 발생했습니다.',
          model: requestedModel,
          details: safeMessage,
        });
      }

      if (lowered.includes('api key is required')) {
        return res.status(400).json({
          error: '개인 Gemini API 키가 필요합니다.',
          model: requestedModel,
          details: safeMessage,
        });
      }

      res.status(500).json({
        error: 'Failed to generate grounded response',
        model: requestedModel,
        details: safeMessage,
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
    logServerError('initial RAG initialize failed', error);
  });
}

void startServer().catch((error) => {
  logServerError('server start failed', error);
});
