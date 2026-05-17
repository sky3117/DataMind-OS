#!/bin/bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/DataMind-OS}"
COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_DIR}/docker-compose.yml}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"
HEALTH_POLL_INTERVAL_SECONDS="${HEALTH_POLL_INTERVAL_SECONDS:-5}"
PRESERVE_PATTERNS=(
  ".env"
  ".env.*"
  "nginx/certs/"
)

log() {
  local level="$1"
  shift
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${level}" "$*"
}

fail() {
  log "ERROR" "$*"
  exit 1
}

on_error() {
  log "ERROR" "Deployment failed at line ${BASH_LINENO[0]}."
  docker compose -f "${COMPOSE_FILE}" ps || true
}
trap on_error ERR

wait_for_container_health() {
  local container_id="$1"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  local container_name status health

  container_name="$(docker inspect --format '{{.Name}}' "${container_id}" 2>/dev/null | sed 's#^/##')"
  [ -n "${container_name}" ] || container_name="${container_id}"

  while [ "${SECONDS}" -lt "${deadline}" ]; do
    status="$(docker inspect --format '{{.State.Status}}' "${container_id}" 2>/dev/null || echo 'missing')"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${container_id}" 2>/dev/null || echo 'missing')"

    if [ "${status}" != "running" ]; then
      fail "Container ${container_name} is not running (status=${status})."
    fi

    if [ "${health}" = "healthy" ] || [ "${health}" = "none" ]; then
      log "INFO" "Container ${container_name} is ${health}."
      return 0
    fi

    if [ "${health}" = "unhealthy" ] || [ "${health}" = "missing" ]; then
      fail "Container ${container_name} health check failed (health=${health})."
    fi

    log "INFO" "Waiting for ${container_name} health check (health=${health})..."
    sleep "${HEALTH_POLL_INTERVAL_SECONDS}"
  done

  fail "Timed out waiting for health checks for ${container_name}."
}

log "INFO" "Starting deployment."
cd "${PROJECT_DIR}"

[ -f "${COMPOSE_FILE}" ] || fail "Compose file not found at ${COMPOSE_FILE}."
[ -d ".git" ] || fail "Directory ${PROJECT_DIR} is not a git repository."

log "INFO" "Discarding tracked local changes."
git reset --hard HEAD

log "INFO" "Removing untracked files while preserving .env and nginx/certs."
clean_args=(-fdx)
for pattern in "${PRESERVE_PATTERNS[@]}"; do
  clean_args+=(-e "${pattern}")
done
git clean "${clean_args[@]}"

log "INFO" "Pulling latest code from ${GIT_REMOTE}/${GIT_BRANCH}."
if ! git pull --ff-only "${GIT_REMOTE}" "${GIT_BRANCH}"; then
  fail "Git fast-forward pull failed. Local branch may have diverged from ${GIT_REMOTE}/${GIT_BRANCH}. Align the branch and retry deployment."
fi

log "INFO" "Stopping existing containers."
docker compose -f "${COMPOSE_FILE}" down --remove-orphans

log "INFO" "Building frontend image with no cache to prevent stale Next.js artifacts."
docker compose -f "${COMPOSE_FILE}" build --no-cache frontend
log "INFO" "Frontend image rebuild completed."

log "INFO" "Starting containers with rebuild."
docker compose -f "${COMPOSE_FILE}" up -d --build

log "INFO" "Forcing frontend container recreation from freshly built image."
docker compose -f "${COMPOSE_FILE}" up -d --no-deps --force-recreate frontend
log "INFO" "Frontend container recreated successfully."

expected_services="$(docker compose -f "${COMPOSE_FILE}" config --services | wc -l | tr -d ' ')"
running_services="$(docker compose -f "${COMPOSE_FILE}" ps --services --filter=status=running | wc -l | tr -d ' ')"
if [ "${running_services}" -lt "${expected_services}" ]; then
  docker compose -f "${COMPOSE_FILE}" ps
  fail "Not all services are running after startup (${running_services}/${expected_services})."
fi

log "INFO" "Validating health status of running containers."
container_id_output="$(docker compose -f "${COMPOSE_FILE}" ps -q --filter=status=running)" || fail "Failed to list running containers."
mapfile -t container_ids <<<"${container_id_output}"
[ "${#container_ids[@]}" -gt 0 ] || fail "No running containers were found after deployment."

for container_id in "${container_ids[@]}"; do
  wait_for_container_health "${container_id}"
done

log "INFO" "Deployment completed successfully."
