RUN VOXELING IN DOCKER
====

Follow these instructions if you want to run voxeling within a Docker container.

We use a python3 virtual environment to prepare textures, but that runs locally to avoid bloating the container with deps and scripts that aren't needed to directly run the app. All node and npm commands run within a container.

## Prerequisites

* Linux or MacOS (haven't tested on Windows)
* Git
* unzip command for extracting zip archives
* Python 3 and pip
* Docker

## Get the code

First, clone the voxeling git repo into your current working directory.

```shell
git clone https://github.com/alanszlosek/voxeling.git
```

## Copy example configs

```shell
cp config-client-example.mjs config-client.mjs
cp config-server-example.mjs config-server.mjs
```

## Generate texture atlases

Run the `scripts/textures.sh` script to get textures, and generate texture atlases.

```shell
cd voxeling
./scripts/textures.sh
```

## Configure data storage

By default, when running in Docker, world state is stored in an Sqlite3 database located at `/app/database/voxeling.sqlite`.

The `Dockerfile` creates an sqlite3 database for you and applies the schema.

## Configure networking parameters

By default the server listens on port `3000`. Set the `PORT` environment variable to override.

By default the server listens on `0.0.0.0` (all network interfaces). Set the `BIND_INTERFACE` environment variable to override.


## Build

Inspect the `Dockerfile` and make any necessary changes. By default it configures `sqlite3` and does `npm install` within the container during build.

Build the container.

```shell
docker build -t voxeling:latest .
```

Run the voxeling container.

```shell
docker run --name voxeling -dp 3000:3000 voxeling:latest
```

Note: You can set the `PORT` and `BIND_INTERFACE` environment variables to customize where the voxeling server listens for connections.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser, replacing the IP with the IP of your Docker host.

Read the introduction for controls and keybindings.
