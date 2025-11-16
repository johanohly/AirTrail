#!/usr/bin/env bash

set -euo pipefail

# Ensure Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found in PATH. Please install/start Docker and try again." >&2
  exit 1
fi

BUILDER_NAME="airtrail-builder"

echo "Checking for buildx plugin..."
if ! docker buildx version >/dev/null 2>&1; then
  echo "docker buildx is not available. Please install Docker Buildx (Docker 20.10+ or Docker Desktop) and retry." >&2
  exit 1
fi

# Optionally ensure binfmt/QEMU is installed for cross-building when not on Docker Desktop
if ! docker run --privileged --rm tonistiigi/binfmt --help >/dev/null 2>&1; then
  echo "Pulling helper image for binfmt..."
  docker pull tonistiigi/binfmt:latest >/dev/null
fi

echo "Enabling cross-arch emulation via binfmt (requires privileged Docker)..."
docker run --privileged --rm tonistiigi/binfmt --install all >/dev/null 2>&1 || true

if docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  echo "Using existing builder: $BUILDER_NAME"
else
  echo "Creating builder: $BUILDER_NAME"
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --use
fi

echo "Bootstrapping builder..."
docker buildx inspect --bootstrap >/dev/null

echo "Buildx setup complete. Current builder:"
docker buildx ls | sed -n "1,/${BUILDER_NAME}/p" | tail -n +1
