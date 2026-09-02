#!/usr/bin/env bash
set -Eeuo pipefail
#
# Installs a prebuilt bundle. The Angular build runs in CI and arrives as an
# artifact; this script only swaps it in and restarts the service.
#
# Usage: ops/deploy-frontend.sh --instance teste|opas --dist <build-dir>

INSTANCE=""
DIST_SRC=""

die() { printf '\n[deploy-frontend] ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[deploy-frontend] %s\n' "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --instance) INSTANCE="${2:-}"; shift 2 ;;
    --dist)     DIST_SRC="${2:-}"; shift 2 ;;
    *) die "unknown option: $1" ;;
  esac
done

case "$INSTANCE" in
  teste) EXPECTED_BRANCH="dev" ;;
  opas)  EXPECTED_BRANCH="homologacao" ;;
  *) die "--instance must be 'teste' or 'opas' (got: '${INSTANCE:-empty}')" ;;
esac

[[ -n "$DIST_SRC" ]] || die "--dist is required"
[[ -f "$DIST_SRC/index.html" ]] || die "the given directory does not look like an Angular build"

# Everything that describes the deploy host lives outside this repository, which
# is public. See ops/deploy.env.example for the expected contents.
DEPLOY_ENV="${GODATA_DEPLOY_ENV:-$HOME/.config/godata/deploy.env}"
[[ -f "$DEPLOY_ENV" ]] || die "deploy settings file not found (see ops/deploy.env.example)"
# shellcheck disable=SC1090
set -a; . "$DEPLOY_ENV"; set +a

service_var="GODATA_SERVICE_${INSTANCE^^}"
PM2_SERVICE="${!service_var:-}"
[[ -n "$PM2_SERVICE" ]] || die "$service_var not set in the deploy settings file"
[[ -n "${GODATA_ROOT:-}" ]] || die "GODATA_ROOT not set in the deploy settings file"

API_DIR="$GODATA_ROOT/$INSTANCE/GoDataSource-API"
FE_DIR="$GODATA_ROOT/$INSTANCE/GoDataSource-FrontEnd"
# The bundle is served statically by the API.
DIST_DST="$API_DIR/client/dist"
DIST_PREV="$API_DIR/client/dist.prev"
[[ -d "$API_DIR/.git" ]] || die "API directory for instance '$INSTANCE' not found"
[[ -d "$FE_DIR/.git" ]]  || die "FrontEnd directory for instance '$INSTANCE' not found"

# The API deploy restarts the same process and lives in another repository,
# which GitHub cannot serialize against this one.
exec 9>"/tmp/godata-deploy-$INSTANCE.lock"
flock -w 900 9 || die "timed out after 15min waiting for another deploy of instance '$INSTANCE'"

# Verbose sub-command output describes the host, and the Actions log is public.
RUN_LOG="/tmp/godata-deploy-$INSTANCE.log"
: >"$RUN_LOG"

# nvm keeps node/pm2 out of a non-interactive PATH.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1090
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
for bin in node pm2 curl; do
  command -v "$bin" >/dev/null 2>&1 || die "'$bin' not found in PATH"
done

PORT="$(node -p "require('$API_DIR/server/config.json').port" 2>/dev/null)" || die "could not read the port of instance '$INSTANCE'"
log "instance=$INSTANCE branch=$EXPECTED_BRANCH"

CURRENT_BRANCH="$(git -C "$FE_DIR" rev-parse --abbrev-ref HEAD)"
[[ "$CURRENT_BRANCH" == "$EXPECTED_BRANCH" ]] || \
  die "FrontEnd of instance '$INSTANCE' is on branch '$CURRENT_BRANCH', expected '$EXPECTED_BRANCH'"

health_check() {
  local tries=15 code=""
  for ((i = 1; i <= tries; i++)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:$PORT/" || true)"
    if [[ "$code" == "200" || "$code" =~ ^3[0-9][0-9]$ ]]; then
      log "health check OK (HTTP $code, attempt $i)"
      return 0
    fi
    sleep 4
  done
  log "health check FAILED after $tries attempts (last code: ${code:-none})"
  return 1
}

# The bundle comes from the artifact, but this tree is what tells humans what
# is running, so it must not drift.
PREV="$(git -C "$FE_DIR" rev-parse HEAD)"
SNAP="$(mktemp -d)"
trap 'rm -rf "$SNAP"' EXIT
mapfile -t DIRTY < <(git -C "$FE_DIR" diff --name-only)
for f in "${DIRTY[@]}"; do
  mkdir -p "$SNAP/$(dirname "$f")"
  cp "$FE_DIR/$f" "$SNAP/$f"
done
log "local files preserved: ${#DIRTY[@]}"
restore_local_config() { for f in "${DIRTY[@]}"; do cp "$SNAP/$f" "$FE_DIR/$f"; done; }

git -C "$FE_DIR" fetch origin "$EXPECTED_BRANCH"
TARGET="$(git -C "$FE_DIR" rev-parse "origin/$EXPECTED_BRANCH")"
if [[ "$TARGET" != "$PREV" ]]; then
  git -C "$FE_DIR" checkout -- .
  git -C "$FE_DIR" merge --ff-only "$TARGET"
  restore_local_config
  log "updated to $(git -C "$FE_DIR" rev-parse --short HEAD)"
fi

# Renaming instead of deleting is what makes the rollback possible. Never run
# `git clean` on the API tree: the bundle directory is untracked.
rm -rf "$DIST_PREV"
if [[ -d "$DIST_DST" ]]; then mv "$DIST_DST" "$DIST_PREV"; fi
mkdir -p "$(dirname "$DIST_DST")"
cp -r "$DIST_SRC" "$DIST_DST"
log "bundle installed ($(du -sh "$DIST_DST" | cut -f1))"

log "restarting service"
pm2 restart "$PM2_SERVICE" --update-env >>"$RUN_LOG" 2>&1 || die "restart failed, see $RUN_LOG on the host"

if health_check; then
  log "deploy finished: $(git -C "$FE_DIR" rev-parse --short HEAD)"
  exit 0
fi

log "starting rollback"
if [[ -d "$DIST_PREV" ]]; then
  rm -rf "$DIST_DST"
  mv "$DIST_PREV" "$DIST_DST"
fi
git -C "$FE_DIR" reset --hard "$PREV"
restore_local_config
pm2 restart "$PM2_SERVICE" --update-env >>"$RUN_LOG" 2>&1 || die "restart failed, see $RUN_LOG on the host"

if health_check; then
  die "deploy failed and was rolled back. The instance is up with the previous bundle."
fi
die "deploy failed AND the rollback did not come up. Instance '$INSTANCE' is DOWN."
