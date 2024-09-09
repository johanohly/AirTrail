#!/bin/bash

BUMP="false"

while getopts 'v:' flag; do
  case "${flag}" in
  v) BUMP=${OPTARG} ;;
  *)
    echo "Invalid args"
    exit 1
    ;;
  esac
done

CURRENT=$(jq -r '.version' package.json)
MAJOR=$(echo "$CURRENT" | cut -d '.' -f1)
MINOR=$(echo "$CURRENT" | cut -d '.' -f2)
PATCH=$(echo "$CURRENT" | cut -d '.' -f3)

if [[ $BUMP == "major" ]]; then
  MAJOR=$((MAJOR + 1))
  MINOR=0
  PATCH=0
elif [[ $BUMP == "minor" ]]; then
  MINOR=$((MINOR + 1))
  PATCH=0
elif [[ $BUMP == "patch" ]]; then
  PATCH=$((PATCH + 1))
elif [[ $BUMP == "false" ]]; then
  echo 'Skipping version bump'
else
  echo 'Expected <major|minor|patch|false> for the version argument'
  exit 1
fi

NEXT=$MAJOR.$MINOR.$PATCH

if [ "$CURRENT" != "$NEXT" ]; then
  echo "Bumping version: $CURRENT => $NEXT"
  jq ".version = \"$NEXT\"" package.json >tmp.json && mv tmp.json package.json
  bun install --frozen-lockfile
  bun run build
fi

echo "APP_VERSION=v$NEXT" >>"$GITHUB_ENV"