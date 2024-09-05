<div align="center">
  <a href="https://github.com/othneildrew/Best-README-Template">
    <img src="static/favicon.png" alt="AirTrail logo" width="80" height="80">
  </a>

  <h3 align="center">AirTrail</h3>

  <p align="center">
    A web application that allows users to track their flights and view their flight history.
  </p>
</div>

<img src="static/showcase/toggle.png" alt="AirTrail Preview">

## ✨ Features

- **World Map**: View all your flights on an interactive world map.
- **Flight History**: Keep track of all your flights in one place.
- **Statistics**: Get insights into your flight history with statistics.
- **User Authentication**: Allow multiple users and secure your data with user authentication.
- **Responsive Design**: Use the application on any device with a responsive design.
- **Dark Mode**: Switch between light and dark mode.
- **Import Flights**: Import flights from various sources.

## 🚀 Getting Started

Docker Compose is the recommended way to run the application. The following steps will guide you through the process.

### Step 1: Download the required files

Create a new directory to hold the `docker-compose.yml` and `.env` files.

```bash
mkdir airtrail
cd airtrail
```

Download the `docker-compose.yml` and `.env` files.

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

> [!NOTE]
> If you get an error `unknown shorthand flag: 'd' in -d`, you are probably running the wrong Docker version. (This
> happens, for example, with the docker.io package in Ubuntu 22.04.3 LTS.) You can correct the problem by `apt remove`
> ing
> Ubuntu's docker.io package and installing docker and docker-compose
> via [Docker's official repository](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository).
>
> Note that the correct command really is `docker compose`, not `docker-compose`.

### Step 4: Upgrading

When a new version of the application is released, you can upgrade by running the following command:

```bash
docker compose pull && docker compose up -d
```

## Acknowledgements

### Data Sources

> [Airport Data](https://github.com/komed3/airportmap-database)

> [Country Flags](https://flagpedia.net)

### Logo

The logo is from Lucide, which is a free icon pack that can be found [here](https://www.lucide.dev/).
> Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (
> c) for Lucide are held by Lucide Contributors 2022.