#!/bin/bash

create_directory() {
  local -r directory='./airtrail'
  echo "Creating directory $directory..."
  if [ -d "$directory" ]; then
    echo "Directory $directory already exists. Skipping..."
  else
    mkdir "$directory"
  fi

  cd "$directory" || exit
}

download_files() {
  if ! command -v curl &> /dev/null; then
    echo "curl is required to download files. Please install curl and try again."
    exit 1
  fi
  if ! docker compose version &> /dev/null; then
    echo "Docker Compose v2 is required (the 'docker compose' command). See https://docs.docker.com/compose/install/"
    exit 1
  fi

  echo "Downloading docker-compose.yml..."
  curl -fsSL https://raw.githubusercontent.com/JohanOhly/AirTrail/main/docker/production/compose.yml -o ./docker-compose.yml

  echo "Downloading .env file..."
  curl -fsSL https://raw.githubusercontent.com/JohanOhly/AirTrail/main/.env.example -o ./.env
}

generate_random_password() {
  tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16
}

prompt_origin() {
  read -r -p "Enter the domain name or IP address that the application will be accessed from (default: http://localhost:3000): " ORIGIN
  if [ -z "$ORIGIN" ]; then
    ORIGIN="http://localhost:3000"
  fi
}

# Portable in-place edit: BSD sed (macOS) and GNU sed disagree on `-i`.
set_env() {
  local -r key="$1" value="$2"
  local -r tmp="$(mktemp)"
  sed -e "s|^$key=.*$|$key=$value|" ./.env >"$tmp" && mv "$tmp" ./.env
}

host_address() {
  if hostname -I &>/dev/null; then
    hostname -I | cut -d' ' -f1
  else
    echo localhost
  fi
}

run_docker_compose() {
  echo "Running docker compose..."
  if ! docker compose up --remove-orphans -d; then
    echo "Failed to run docker compose. Please check the logs and try again."
    exit 1
  fi
}

main() {
  echo "Starting installation..."

  create_directory
  download_files

  DB_PASSWORD=$(generate_random_password)

  prompt_origin

  # DB_URL embeds the password, so both must change together or the app cannot
  # connect to the database it just initialised.
  set_env DB_PASSWORD "$DB_PASSWORD"
  set_env DB_URL "postgres://airtrail:$DB_PASSWORD@db:5432/airtrail"
  set_env ORIGIN "$ORIGIN"

  run_docker_compose

  cat <<EOF
---
AirTrail has been deployed successfully!
You can access the website at $ORIGIN (or http://$(host_address):3000 on your network).
Next steps: https://airtrail.johan.ohly.dk/docs/install/post-installation
EOF
}

main