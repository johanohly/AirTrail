---
sidebar_position: 2
---

# Docker Compose

The easiest way to install AirTrail is to use Docker Compose.
Below are the steps to get started.
AirTrail requires Docker Compose version 2.x or higher.

### Step 1: Download the required files

Create a new directory to hold the `docker-compose.yml` and `.env` files.

```bash
mkdir airtrail
cd airtrail
```

Download the [docker-compose.yml](https://raw.githubusercontent.com/JohanOhly/AirTrail/main/docker-compose.yml) and [.env](https://raw.githubusercontent.com/JohanOhly/AirTrail/main/.env.example) files.

```bash
wget -O docker-compose.yml https://raw.githubusercontent.com/JohanOhly/AirTrail/main/docker-compose.yml
wget -O .env https://raw.githubusercontent.com/JohanOhly/AirTrail/main/.env.example
```

or download the files manually from the repository.

Note: If you download the files manually, the `.env.example` file should be renamed to `.env`.

### Step 2: Configure the environment variables

- Set the `ORIGIN` variable to the domain name or IP address that the application will be accessed from.
- Populate custom database information if necessary.
- Consider changing DB_PASSWORD to a custom value. Postgres is not publically exposed, so this password is only used for
  local authentication. To avoid issues with Docker parsing this value, it is best to use only the characters A-Za-z0-9.

### Step 3: Start the application

From the directory where the `docker-compose.yml` amd `.env` files are located, run the following command:

```bash
docker compose up -d
```

:::info Docker version
If you get an error `unknown shorthand flag: 'd' in -d`, you are probably running the wrong Docker version. (This
happens, for example, with the docker.io package in Ubuntu 22.04.3 LTS.) You can correct the problem by `apt remove`
ing
Ubuntu's docker.io package and installing docker and docker-compose
via [Docker's official repository](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository).

Note that the correct command really is `docker compose`, not `docker-compose`.
:::

### Updating

See the [Updating](/docs/install/updating) guide for instructions on how to upgrade to a new version of AirTrail.