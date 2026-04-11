#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_SERVICE_NAME="${DEPLOY_SERVICE_NAME:-ltc-rag}"
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://127.0.0.1:3000/api/health}"

cd "$REPO_DIR"

log() {
  printf '[deploy] %s\n' "$1"
}

has_changes() {
  local pattern="$1"

  if [[ -z "${CHANGED_FILES:-}" ]]; then
    return 1
  fi

  grep -Eq "$pattern" <<<"$CHANGED_FILES"
}

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]]; then
  log "current branch is '$CURRENT_BRANCH', expected '$DEPLOY_BRANCH'."
  log "switch to the deploy branch first or override DEPLOY_BRANCH."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  log "tracked local changes detected. Commit or stash them before deploying."
  git status --short
  exit 1
fi

OLD_SHA="$(git rev-parse HEAD)"
log "pulling latest changes from origin/$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"
NEW_SHA="$(git rev-parse HEAD)"

if [[ "$OLD_SHA" == "$NEW_SHA" ]]; then
  log "already up to date at $NEW_SHA"
  CHANGED_FILES=""
else
  CHANGED_FILES="$(git diff --name-only "$OLD_SHA" "$NEW_SHA")"
  log "updated $OLD_SHA -> $NEW_SHA"
  printf '%s\n' "$CHANGED_FILES"
fi

SHOULD_INSTALL=0
if [[ ! -d node_modules ]]; then
  SHOULD_INSTALL=1
fi
if [[ "${FORCE_INSTALL:-0}" == "1" ]]; then
  SHOULD_INSTALL=1
fi
if has_changes '^(package\.json|package-lock\.json)$'; then
  SHOULD_INSTALL=1
fi

SHOULD_INDEX=0
if [[ "${SKIP_INDEX:-0}" != "1" ]]; then
  if [[ "${FORCE_INDEX:-0}" == "1" ]]; then
    SHOULD_INDEX=1
  fi
  if has_changes '^(knowledge/|scripts/rag-index\.ts|src/lib/nodeKnowledge\.ts|src/lib/nodeRagService\.ts|src/lib/rag[^/]*\.ts|db/rag-schema\.sql)'; then
    SHOULD_INDEX=1
  fi
fi

if has_changes '^db/rag-schema\.sql$'; then
  log "db/rag-schema.sql changed. Review whether a manual schema migration is required."
fi

if [[ "$SHOULD_INSTALL" == "1" ]]; then
  log "installing npm dependencies"
  npm install
else
  log "npm install skipped"
fi

if [[ "$SHOULD_INDEX" == "1" ]]; then
  log "running rag:index"
  npm run rag:index
else
  log "rag:index skipped"
fi

SHOULD_RESTART=1
if [[ "${NO_RESTART:-0}" == "1" ]]; then
  SHOULD_RESTART=0
fi
if [[ "${FORCE_RESTART:-0}" == "1" ]]; then
  SHOULD_RESTART=1
fi
if [[ "$OLD_SHA" == "$NEW_SHA" && "$SHOULD_INSTALL" == "0" && "$SHOULD_INDEX" == "0" && "${FORCE_RESTART:-0}" != "1" ]]; then
  SHOULD_RESTART=0
fi

if [[ "$SHOULD_RESTART" == "1" ]]; then
  log "restarting systemd service: $DEPLOY_SERVICE_NAME"
  sudo systemctl restart "$DEPLOY_SERVICE_NAME"
  sudo systemctl status "$DEPLOY_SERVICE_NAME" --no-pager
else
  log "service restart skipped"
fi

if [[ "${SKIP_HEALTHCHECK:-0}" == "1" ]]; then
  log "health check skipped"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  log "curl is not installed, skipping health check"
  exit 0
fi

log "checking backend health: $DEPLOY_HEALTHCHECK_URL"
sleep 2
curl --fail --silent --show-error "$DEPLOY_HEALTHCHECK_URL"
printf '\n'
