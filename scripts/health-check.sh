#!/bin/bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/DataMind-OS}"
COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_DIR}/docker-compose.yml}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
POSTGRES_USER="${POSTGRES_USER:-datamind}"

alert() {
  local message="$1"
  echo "ALERT: ${message}"
  if [ -n "${ALERT_WEBHOOK_URL}" ]; then
    curl -fsS -X POST -H "Content-Type: application/json" \
      -d "{\"text\":\"DataMind OS health-check failed: ${message}\"}" \
      "${ALERT_WEBHOOK_URL}" >/dev/null || true
  fi
}

cd "${PROJECT_DIR}"

if [ ! -f "${COMPOSE_FILE}" ]; then
  alert "Compose file not found at ${COMPOSE_FILE}"
  exit 1
fi

echo "Checking container states..."
expected_services="$(docker compose -f "${COMPOSE_FILE}" config --services | wc -l | tr -d ' ')"
running_services="$(docker compose -f "${COMPOSE_FILE}" ps --services --filter=status=running | wc -l | tr -d ' ')"
if [ "${running_services}" -lt "${expected_services}" ]; then
  alert "One or more containers are not running (${running_services}/${expected_services})"
  docker compose -f "${COMPOSE_FILE}" ps
  exit 1
fi

echo "Checking HTTP ports..."
for url in "http://localhost/" "http://localhost/api"; do
  if ! curl -fsS "${url}" >/dev/null; then
    alert "HTTP check failed for ${url}"
    exit 1
  fi
done

echo "Checking database connectivity..."
if ! docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U "${POSTGRES_USER}" >/dev/null; then
  alert "Database connection check failed"
  exit 1
fi

echo "All health checks passed."
