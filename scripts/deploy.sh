#!/bin/bash
set -euo pipefail

if [ -n "$(git status --porcelain)" ]; then
  echo "Repository has uncommitted changes. Please commit or stash before deploying."
  exit 1
fi

echo "Pulling latest code..."
git pull origin main

echo "Building containers..."
docker compose -f docker-compose.yml up -d --build

echo "Verifying services are running..."
expected_services="$(docker compose -f docker-compose.yml config --services | wc -l | tr -d ' ')"
running_services="$(docker compose -f docker-compose.yml ps --services --filter=status=running | wc -l | tr -d ' ')"
if [ "${running_services}" -lt "${expected_services}" ]; then
  echo "Deployment verification failed: ${running_services}/${expected_services} services are running."
  docker compose -f docker-compose.yml ps
  exit 1
fi

echo "Cleaning up..."
docker system prune -f

echo "Deploy complete!"
