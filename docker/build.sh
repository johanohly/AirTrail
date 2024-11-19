#!/usr/bin/env bash

command -v docker >/dev/null 2>&1 || {
    echo "Docker is not running. Please start Docker and try again."
    exit 1
}

DOCKER_DIR="$(readlink -f "$(dirname "$0")")"
PWD="$(readlink -f "$DOCKER_DIR/../")"

GIT_SHA="$(git rev-parse HEAD)"
APP_VERSION="$(git name-rev --tags --name-only "$GIT_SHA" | head -n 1 | sed 's/\^0//')"

echo "Building docker image for project at $PWD"
echo "App version: $APP_VERSION"
echo "Git SHA: $GIT_SHA"

docker build -f "$DOCKER_DIR/Dockerfile" \
    -t "johly/airtrail:latest" \
    "$PWD"