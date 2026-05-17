#!/bin/bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/DataMind-OS}"
COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_DIR}/docker-compose.yml}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"
HEALTH_POLL_INTERVAL_SECONDS="${HEALTH_POLL_INTERVAL_SECONDS:-5}"

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
git clean -fdx -e .env -e '.env.*' -e nginx/certs -e 'nginx/certs/**'

log "INFO" "Pulling latest code from ${GIT_REMOTE}/${GIT_BRANCH}."
git pull --ff-only "${GIT_REMOTE}" "${GIT_BRANCH}"

log "INFO" "Stopping existing containers."
docker compose -f "${COMPOSE_FILE}" down --remove-orphans

log "INFO" "Starting containers with rebuild."
docker compose -f "${COMPOSE_FILE}" up -d --build

log "INFO" "Validating container health."
container_ids="$(docker compose -f "${COMPOSE_FILE}" ps -q)"
[ -n "${container_ids}" ] || fail "No containers were started by docker compose."

for container_id in ${container_ids}; do
  wait_for_container_health "${container_id}"
done

log "INFO" "Deployment completed successfully."
