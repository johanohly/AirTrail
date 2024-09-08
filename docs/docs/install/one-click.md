---
sidebar_position: 2
---

# One-Click Installation

:::warning EXPERIMENTAL
This method is experimental and may not work on all systems. For a more reliable installation, we recommend using the [Docker Compose](/docs/install/docker-compose) method.
:::

## Requirements

See the software [requirements](/docs/install/requirements).

## Usage

Run the following command in your terminal to install AirTrail:

```bash
curl -o- https://raw.githubusercontent.com/JohanOhly/AirTrail/main/install.sh | bash
```

This will
- create a new directory called `airtrail` in your current working directory
- inside it, it will download the [docker-compose.yml](https://raw.githubusercontent.com/JohanOhly/AirTrail/main/docker-compose.yml) and [.env](https://raw.githubusercontent.com/JohanOhly/AirTrail/main/env) files from the repository
- start the AirTrail services using Docker Compose

:::tip
After the installation is complete, you should follow the [post-installation steps](/docs/install/post-installation).
:::