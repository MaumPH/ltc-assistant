#!/usr/bin/env bash

set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
MAX_ROUNDS="${MAX_ROUNDS:-20}"
CHUNKS_PER_PASS="${RAG_EMBEDDING_MAX_CHUNKS_PER_PASS:-2000}"
SERVICE_NAME="${SERVICE_NAME:-ltc-rag}"

get_health() {
  local json

  for _ in {1..30}; do
    if json="$(curl -fsS "$HEALTH_URL" 2>/dev/null)"; then
      printf '%s' "$json"
      return 0
    fi
    sleep 1
  done

  return 1
}

read_status() {
  node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const health = JSON.parse(input);
      const status = health.indexStatus || {};
      const coverage = status.embeddingCoverage || {};
      console.log([
        status.state || "",
        status.pendingEmbeddingChunks ?? -1,
        coverage.ratio ?? 0,
        coverage.embeddedChunks ?? 0,
        coverage.totalChunks ?? 0,
        status.retrievalReadiness || "",
      ].join(" "));
    });
  '
}

is_ready() {
  local health state pending ratio embedded total readiness

  health="$(get_health)" || return 1
  read -r state pending ratio embedded total readiness <<<"$(printf '%s' "$health" | read_status)"
  echo "[embed] state=$state pending=$pending ratio=$ratio embedded=$embedded/$total readiness=$readiness"

  [[ "$pending" == "0" && "$ratio" == "1" ]]
}

last_pending=""

if is_ready; then
  echo "[embed] complete"
  exit 0
fi

for round in $(seq 1 "$MAX_ROUNDS"); do
  echo "[embed] round $round/$MAX_ROUNDS"

  RAG_EMBEDDING_MAX_CHUNKS_PER_PASS="$CHUNKS_PER_PASS" npm run rag:index

  sudo systemctl restart "$SERVICE_NAME"

  health="$(get_health)"
  read -r state pending ratio embedded total readiness <<<"$(printf '%s' "$health" | read_status)"

  echo "[embed] state=$state pending=$pending ratio=$ratio embedded=$embedded/$total readiness=$readiness"

  if [[ "$pending" == "0" && "$ratio" == "1" ]]; then
    echo "[embed] complete"
    exit 0
  fi

  if [[ "$pending" == "$last_pending" ]]; then
    echo "[embed] pending count did not decrease. Possible API quota or rate limit. Stop here." >&2
    exit 2
  fi

  last_pending="$pending"
  sleep 3
done

echo "[embed] stopped after MAX_ROUNDS=$MAX_ROUNDS before completion" >&2
exit 1
