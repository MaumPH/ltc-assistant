# RAG Phase 3 Operational Review Handoff

Date: 2026-05-07
Baseline archive: `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json`

## Purpose

Phase 3 moved the RAG work from benchmark-only validation into operator-visible review signals. This handoff keeps the remaining review work scoped: do not tune ranking again until real operational retrieval logs show repeated ranking-relevant pressure for the same normalized query hash.

## Review Slices

| Slice | Files | Review focus |
|---|---|---|
| Baseline CI | `.github/workflows/ci.yml`, `package.json`, `scripts/rag-baseline-check.ts`, `src/lib/ragBenchmarkBaseline.ts`, `tests/ragBenchmarkBaseline.test.ts` | The CI check must validate the Phase 2 final archive without regenerating benchmarks. Thresholds should remain tied to the archived result unless a new reviewed baseline replaces it. |
| Public authority drift boundary | `src/lib/expertAnswering.ts`, `src/lib/ragPublicDiagnostics.ts`, `tests/ragPublicDiagnostics.test.ts`, `tests/ragEvaluationValidation.test.ts` | Internal authority-drift diagnostics can support evaluation, but user-facing traces should not expose confusing drift labels by default. |
| Operational retrieval log | `src/lib/ragOperationalLog.ts`, `src/lib/nodeRagService.ts`, `tests/ragOperationalLog.test.ts`, `tests/ragOperationalPrivacyBoundary.test.ts` | Log entries must stay in memory, avoid raw query persistence, and preserve the PII-masked preview/hash boundary. |
| Review report | `src/lib/ragOperationalLogReport.ts`, `src/lib/ragOperationalLogView.ts`, `tests/ragOperationalLogReport.test.ts`, `tests/ragOperationalLogView.test.ts` | Report grouping should aggregate by normalized query hash and only recommend `review_ranking` after repeated ranking-relevant signals. |
| Admin API and UX | `server.ts`, `src/components/RagAdminPanel.tsx`, `tests/ragOperationalPrivacyBoundary.test.ts` | Admin-only endpoints must remain behind admin auth. Empty-log and populated-log states should both render without leaking raw questions. |
| Dev smoke support | `vite.config.ts`, `env.example` | `VITE_HMR_PORT` should allow parallel dev-server smoke checks without the default HMR port collision. |

## Suggested Commit Order

1. Baseline and benchmark guardrails.
2. Public diagnostics sanitization.
3. Operational log data model and privacy regression.
4. Report aggregation and ranking decision gate.
5. Admin API and panel integration.
6. Dev smoke/HMR environment support.
7. Documentation handoff.

This ordering keeps the riskiest behavior changes close to their tests and leaves docs last as the review map.

## Operational Decision Gate

Ranking changes are paused until all of the following are true:

| Gate | Required evidence |
|---|---|
| Repeated pressure | The same `normalizedQueryHash` appears at least twice in `/api/admin/rag/retrieval-log/report`. |
| Ranking relevance | The repeated group includes `validation_issue`, `unsupported_claim`, `rank_evidence_gap`, or `residual_ranking_candidate`. |
| Stable scope | The affected query family maps to a known domain such as `evaluation-employee-rights-education` or `evaluation-function-training`. |
| Manual confirmation | An operator checks the top documents, evidence documents, validation codes, and fallback count before editing ranking rules. |

If these gates are not met, keep the decision at `monitor`.

## Admin API Contract

All endpoints in this section require admin authentication.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/rag/retrieval-log` | Returns the in-memory operational retrieval log. It is empty after server restart. |
| `GET` | `/api/admin/rag/retrieval-log/report?limit=20` | Returns grouped review candidates. `limit` is clamped to a maximum of 100. |

All `/api/admin` responses must set `Cache-Control: no-store` because they can expose operator state, bearer-token flow, authentication failures, or sanitized-but-sensitive retrieval review metadata.

The response boundary is intentionally narrow:

- Allowed: normalized query hash, PII-masked preview, signal counts, retrieval mode/profile distributions, top document paths/titles, evidence document paths, validation issue codes, unsupported claim counts, fallback counts, and latency summary.
- Not allowed: raw full user questions, phone numbers, email addresses, resident-registration numbers, secrets, bearer tokens, or per-entry query hashes in grouped report output.

## Verification Snapshot

Last known completed verification from P3-13:

```bash
npx.cmd tsx --test tests/ragOperationalLog.test.ts tests/ragOperationalLogView.test.ts tests/ragOperationalLogReport.test.ts tests/ragOperationalPrivacyBoundary.test.ts
npm.cmd run rag:baseline
npm.cmd run lint
npm.cmd run build
git diff --check
```

Result: passed. Remaining noise: CRLF conversion warnings only.

Additional P3-15/P3-16 verification:

```bash
npx.cmd tsx --test tests/adminOperationalApi.test.ts
npx.cmd tsx --test tests/ragOperationalLog.test.ts tests/ragOperationalLogView.test.ts tests/ragOperationalLogReport.test.ts tests/ragOperationalPrivacyBoundary.test.ts tests/adminOperationalApi.test.ts
npm.cmd run lint
git diff --check
```

Result: passed. Remaining noise: CRLF conversion warnings only.

## Remaining Risks

| Risk | Status | Mitigation |
|---|---|---|
| In-memory logs reset on restart | Accepted for now | Treat logs as review hints, not audit records. Add persistent storage only after the signal model proves useful. |
| Admin report can be overread as automatic tuning advice | Mitigated | The `review_ranking` decision requires repeated ranking-relevant pressure; otherwise it stays `monitor`. |
| Real production traffic may show different query clusters than golden cases | Open | Wait for operational report evidence before ranking changes. |
| README/admin docs drift from endpoint behavior | Open | Keep this handoff and README API summary updated whenever admin endpoints change. |

## Final Handoff

P3 is ready for review/commit splitting rather than more behavior changes. Use the suggested commit order above and keep ranking tuning paused until the operational decision gate is satisfied by real report evidence.

Latest verification bundle:

```bash
npx.cmd tsx --test tests/ragOperationalLog.test.ts tests/ragOperationalLogView.test.ts tests/ragOperationalLogReport.test.ts tests/ragOperationalPrivacyBoundary.test.ts tests/adminOperationalApi.test.ts tests/serverKnowledgeApi.test.ts
npm.cmd run rag:baseline
npm.cmd run lint
npm.cmd run build
git diff --check
```

Latest result: passed. Remaining noise: existing CRLF conversion warnings and existing Vite browser externalization warnings for `fs`/`path` in `src/lib/ragNaturalQuery.ts`.
