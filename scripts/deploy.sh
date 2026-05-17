#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Building containers..."
docker-compose -f docker-compose.yml up -d --build

echo "Cleaning up..."
docker system prune -f

echo "Deploy complete!"
