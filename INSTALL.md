BUILD AND RUN LOCALLY
====

## Prerequisites

* Linux or MacOS (haven't tested on Windows)
* Git
* unzip command for extracting zip archives
* Python 3 and pip
* Node and npm
* Optional NPM modules: mysql, mongodb, sqlite3

## Get the code

First, clone the voxeling git repo into your current working directory.

```shell
git clone https://github.com/alanszlosek/voxeling.git
cd voxeling
```

## Copy example configs

```shell
cp config-client-example.mjs config-client.mjs
cp config-server-example.mjs config-server.mjs
```

## Generate texture atlases

Run the `scripts/textures.sh` script to get textures, and generate texture atlases.

```shell
./scripts/textures.sh
```

## Configure data storage

Now decide whether you want to store world state in Sqlite3, MongoDB, MySQL, or files. Visit the appopriate sub-section below.

### Option 1 (default): Store world state in Sqlite3

Create an sqlite3 database and apply the schema.

```shell
cat src/lib/chunk-stores/schema-sqlite.sql | sqlite3 database/voxeling.sqlite3
```

Install the npm module for Sqlite3 if running locally.

```shell
npm install sqlite3
```

Open `config-server.mjs` and find the `sqlite3` block. Set `filename` to the full path of your sqlite3 database file if you created it in a different location. The default value is intended to work with running in a docker container.

```json
"sqlite3": {
    "filename": "/FULL/PATH/TO/voxeling/database/voxeling.sqlite3"
}
```

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


## Configure networking parameters

By default the server listens on port `3000`. Set the `PORT` environment variable to override.

By default the server listens on `0.0.0.0` (all network interfaces). Set the `BIND_INTERFACE` environment variable to override.


## Build and Run

First, install npm dependencies.

```shell
npm install
```

Now build and bundle the client/browser side code into `www` (uses esbuild).

```shell
npm run build
```

Now use npm to run the server.

```shell
npm run server
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

Read the introduction for controls and keybindings.
