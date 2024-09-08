#!/usr/bin/env bash

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

  echo "Downloading docker-compose.yml..."
  curl -fsSL https://raw.githubusercontent.com/JohanOhly/AirTrail/main/docker-compose.yml -o ./docker-compose.yml

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

  sed -i -e "s/^DB_PASSWORD=.*$/DB_PASSWORD=$DB_PASSWORD/" ./.env
  sed -i -e "s/PASSWORD_HERE/$DB_PASSWORD/" ./.env
  sed -i -e "s|^ORIGIN=.*$|ORIGIN=$ORIGIN|" ./.env

  run_docker_compose

  ip_address=$(hostname -I | cut -d' ' -f1)
  cat <<EOF
---
AirTrail has been deployed successfully!
You can access the website at http://$ip_address:3000
EOF
}

main
ain