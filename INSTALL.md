INSTALLATION INSTRUCTIONS
====

## Prerequisites

* Linux or MacOS (haven't tested on Windows)
* Git
* unzip command for extracting zip archives
* Python3
* Node and npm
* Optional NPM modules: mysql, mongodb, sqlite3

## Get the code

First, clone the voxeling git repo into your current working directory.

```shell
git clone https://github.com/alanszlosek/voxeling.git
```

## Copy configs and generate texture atlases

Run the `setup.sh` script to copy example config files, get textures, and generate texture atlases.

Note: Run this locally first even if you plan to run voxeling from a docker container.

```shell
cd voxeling
./scripts/setup.sh
```

## Configure data storage

Now decide whether you want to store world state in Sqlite3, MongoDB, MySQL, or files. Visit the appopriate sub-section below.

Note: The `scripts/setup.sh` script mentioned above copies `config-client-example.mjs` to `config-client.mjs` and `config-server-example.mjs` to `config-server.mjs`. If you didn't run the script, make copies of those files manually.

### Option 1 (Recommended): Store world state in Sqlite3

Create an sqlite3 database and apply the schema.

```shell
cat src/lib/chunk-stores/schema-sqlite.sql | sqlite3 voxeling.db
```

Install the npm module for Sqlite3 if running locally.

```shell
npm install sqlite3
```

Open `config-server.mjs` and uncomment the `sqlite3` block.

```json
"sqlite3": {
    "filename": "/path/to/sqlite3/voxeling.db"
}
```

Set `filename` to the full path of your sqlite3 database file.


### Option 2: Store world state in MariaDB/MySQL

Create a database and user account in your MariaDB/MySQL server.

In that database, run the SQL from `src/lib/chunk-stores/schema-mariadb.sql` to create the required tables.

Install the npm module for mysql if running locally.

```shell
npm install mysql
```

Open `config-server.mjs` and uncomment the `mysql`. 

```json
mysql: {
    connectionLimit: 10,
    user: 'voxeling',
    password: 'voxeling',
    database: 'voxeling',
    host: 'localhost'
}
```

Adjust the values in the `mysql` block to match your MariaDB/MySQL server configuration.

### Option 3: Store world state in MongoDB

Install the npm module for MongoDB if running locally.

```shell
npm install mongodb
```

Open `config-server.mjs` and uncomment the `mongo` block. 

```json
"mongo": {
    "uri": "mongodb://192.168.1.100",
    "database": "voxeling"
}
```

Adjust the values in the `mongo` block to match your MongoDB server configuration.

### Option 4: Store world state in files

Create a folder for the world chunk files.

```shell
mkdir -p chunks/FOLDER_FOR_YOUR_DATA
```

Now, set `chunkFolder` in `config-server.mjs` to the newly-created folder.

```json
    "chunkFolder": "chunks/FOLDER_FOR_YOUR_DATA/",
```


## Configure networking parameters

Open `config-server.mjs` and configure the port and interface the HTTP server listens on. By default, it listens on port 11000 on all network interfaces.

```json
"httpBindAddress": "0.0.0.0",
"httpBindPort": 11000,
```

Now, open `config-client.mjs` to configure where the client should connect to.

The `config-client.mjs` file is used by the browser portions of voxeling, which includes a webworker that runs in a separate thread from the main game. It needs to connect to an HTTP server to fetch snapshots of world state, and a WebSocket server to receive incremental updates. Both of these servers are handled by `src/server.mjs`

By default, the client will connect to the same host and port it was run from, but it will override a few things. When making an HTTP connection to fetch chunk data it will use the HTTP protocol, and an empty URL as the base path for `/chunk/N_N_N` requests. When making a WebSocket connection it will use the `ws` protocol and a base path of `/ws`.

The defaults should be fine, but feel free to customize these overrides if you change where and how your server works.

```json
    "httpServerOverrides": {
        "protocol": "http:",
        "pathname": ""
    },
    "websocketServerOverrides": {
        "protocol": "ws:", // non-SSL for now
        "pathname": "/ws"
    },
```

Note: Use the `ws:` protocol for unsecure websocket connections, and `wss:` if your websocket server is configured for SSL.


## Build and Run

### Building and running using Docker

Inspect the `Dockerfile` and make any necessary changes. By default is configures `sqlite3` and does `npm install` within the container during build.

Build the container.

```shell
docker build -t voxeling:latest .
```

Run the voxeling container.

```shell
docker run --name voxeling -dp 11000:11000 voxeling:latest
```

Open `http://192.168.1.1:11000` in your browser, replacing the IP with the IP of your Docker host.

### Building and running locally

First, install npm dependencies.

```shell
npm install
```

Now use esbuild to bundle the client/browser side code.

```shell
./esb.sh
```

Now use npm to run the server.

```shell
npm start
```

Open [http://127.0.0.1:11000](http://127.0.0.1:11000) in your browser.

Read the introduction for controls and keybindings.

## Other considerations

If you want to put a webserver in front of your node HTTP server, see the sample Caddy server config in `third-party/Caddyfile`. Run it with:

```shell
caddy run -config ./third-party/Caddyfile -adapter caddyfile
```

You may want to do this so all requests are made using HTTPS, or to increase throughput for HTML, JavaScript, CSS and chunk files (if you have Caddy serve them).
