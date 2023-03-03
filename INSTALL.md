INSTALLATION INSTRUCTIONS
====

## Prerequisites

* Linux or MacOS (haven't tested on Windows)
* Git
* unzip command for extracting zip archives
* Python3
* Node and npm
* Optional NPM modules: mysql or mongodb

## Get the code

First, clone the voxeling git repo into your current working directory.

```shell
git clone https://github.com/alanszlosek/voxeling.git
```

## Install dependencies and generate texture atlases

Run the `setup.sh` script to get textures, install deps, generate texture atlases.

```shell
cd voxeling
./scripts/setup.sh
```

## Configure data storage

Now decide whether you want to store world state in Sqlite3, MongoDB, MySQL, or files. Visit the appopriate sub-section below.

### Option 1: Store world state in files

Create a folder for the world chunk files and set path in server config.

```shell
mkdir -p chunks/FOLDER_FOR_YOUR_DATA
```

Now set chunkFolder in config-server.mjs accordingly.

### Option 2: Store world state in MariaDB/MySQL

Create a database and user account in your MariaDB/MySQL server.

Apply the schema from `src/lib/chunk-stores/schema-mariadb.sql` to create the required tables.

Install the npm module for mysql.

```shell
npm install mysql
```

Open `config-server.mjs` and uncomment the `mysql`. Adjust the values to match your MariaDB/MySQL server configuration.

```
mysql: {
    connectionLimit: 10,
    user: 'voxeling',
    password: 'voxeling',
    database: 'voxeling',
    host: 'localhost'
}
```

### Option 3: Store world state in MongoDB

Install the npm module for MongoDB.

```shell
npm install mongodb
```

Open `config-server.mjs` and uncomment the `mongo` block. Adjust the values to match your MongoDB server configuration.

```
"mongo": {
    "uri": "mongodb://192.168.1.100",
    "database": "voxeling"
}
```

### Option 4: Store world state in Sqlite3

Create an sqlite3 database and apply the schema.

```shell
cat src/lib/chunk-stores/schema-sqlite.sql | sqlite3 voxeling.db
```

Install the npm module for Sqlite3.

```shell
npm install sqlite3
```

Open `config-server.mjs` and uncomment the `sqlite3` block. Set `filename` to the full path to your sqlite3 database file.

```
"sqlite3": {
    "filename": "/path/to/sqlite3/voxeling.db"
}
```

## Configure the remaining parameters

Open `config-client.mjs` and adjust the following parameters.

The browser will connect to `httpServer` to fetch chunks. It will connect to `websocketServer` to send and receive voxel changes as players build. Use `ws://` for unsecure websocket connections, and `wss://` if your websocket server is configured for SSL.

```
"httpServer": "http://192.168.1.128:9966",
"websocketServer": "ws://192.168.1.128:9966/ws",
```

Open `config-server.mjs` and adjust these parameters.

```
"httpBindAddress": "127.0.0.1",
"httpBindPort": 10005,
```

* Change websocketBindAddress to the address of the interface you want to listen on
* websocketServer is the address the client uses to make a websocket connection. Use the "wss://" protocol for secure websocket connection from the browser, "ws://" otherwise

## Build client and client-worker bundles

Now use esbuild to bundle the client/browser side code.

```shell
./esb.sh
```

## Start the server

Now use npm to run the server

```shell
npm start
```

If you want to put a webserver in front of your node HTTP server, see the sample Caddy server config in `third-party/Caddyfile`. Run it with:

```shell
caddy run -config ./third-party/Caddyfile -adapter caddyfile
```

You may want to do this so all requests are made using HTTPS, or to increase throughput for HTML, JavaScript, CSS and chunk files (if you have Caddy serve them).

## Try it out

Now, point your browser to http://127.0.0.1:9966. Read the introduction for controls and keybindings. 