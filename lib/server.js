var EventEmitter = require('events').EventEmitter;
var WebSocketEmitter = require('./web-socket-emitter');
var uuid = require('hat');

// voxel dependencies
var Coordinates = require('./coordinates');
var encoder = require('./rle-encoder');
var fs = require('fs');
var stats = require('./voxel-stats');
var debug = false;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = Server;

function Server(config, chunkStore, serverSettings, clientSettings) {
    // force instantiation via `new` keyword 
    //if(!(this instanceof Server)) { return new Server(serverSettings || {}, clientSettings || {}) }
    this.config = config;
    this.chunkStore = chunkStore;
    this.serverSettings = serverSettings;
    this.clientSettings = clientSettings;

    var chunkSize = config.chunkSize;
    var origin = [0, 0, 0];
    var step = chunkSize * config.worldRadius;
    this.lastWorldChunks = [
        // Lower chunk
        origin[0] - step,
        origin[1] - step,
        origin[2] - step,

        // Farther chunk
        origin[0] + step,
        origin[1] + step,
        origin[2] + step
    ];
    this.initialize();
};


Server.prototype.initialize = function() {
    var self = this;
    var clients = this.clients = {};
    this.emitter = new EventEmitter();
    this.coords = Coordinates(self.config.chunkSize);

    // Must pass this in, for now
    this.encodedChunkCache = {};
    this.chunksForClients = {};

    this.chunkStore.emitter.on('got', function(chunk) {
        if (debug) {
            console.log('got chunk ' + chunk.chunkID);
        }
        self.sendChunk(chunk);
    });

    // Prime our chunk store or LRU
    self.requestNearbyChunks(this.clientSettings.initialPosition);

    // send player position/rotation updates
    setInterval(function() {
        self.sendPlayers();
    }, 1e3 / 3);

    // 3 updates per second
    // Send chunks every half-second
    /*
    setInterval(function() {
        var sendChunksBatchSize = 20;
        // Handle chunk generation
        for (var id in self.clients) {
            var client = self.clients[id];
            var ready = [];
            var chunkIDs;
            for (var chunkId in client.requestedChunks) {
                if (ready.length > sendChunksBatchSize) {
                    break;
                }
                // Make sure chunkID is valid, not out of range, etc
                if (self.chunkStore.has(chunkID)) {
                    ready.push(chunkID);
                    delete client.requestedChunks[chunkID];
                }
            }
            if (ready.length > 0) {
                //console.log('Ready to send: ' + ready.length)
                self.sendChunks(client.connection, ready);
            }
        }
    }, 1e3 / 5);
    */
};


// Setup the client connection - register events, etc
Server.prototype.connectClient = function(wseSocket) {
    var self = this;
    var id = wseSocket.id = uuid();
    var client = self.clients[id] = {
        id: id,
        // This gets updated when we get their position updates
        // Server should remove stale clients
        lastSeen: 0,
        connected: true,
        connection: wseSocket,
        avatar: 'player',
        position: null,
        yaw: 0,
        pitch: 0,

        requestedChunks: {}
    };
    // setup client response handlers
    self.bindClientEvents(client);
    // send client id and initial game settings
    wseSocket.emit('settings', self.clientSettings, id);
};


Server.prototype.bindClientEvents = function(client) {
    var self = this;
    var id = client.id;
    var connection = client.connection;

    connection.on('error', function(message) {
        console.log('Client connection error: ' + message);
    });

    connection.on('end', function() {
        client.connected = false;
    });

    connection.on('close', function(error) {
        client.connected = false;
        delete self.clients[client.id];
    });

    // forward chat message
    connection.on('chat', function(message) {
        // ignore if no message provided
        if (!message.text) return;
        // limit chat message length
        if (message.text.length > 255) message.text = message.text.substr(0, 140);
        self.broadcast(null, 'chat', message);
        self.emitter.emit('chat', message);
    });

    // when user ready ( game created, etc )
    connection.on('created', function() {
        // emit client.created for module consumers
        self.emitter.emit('client.created', client);
    });

    // client sends new position, rotation
    // don't need to lerp on the server AND the client, just the client
    connection.on('myPosition', function(position, yaw, pitch, avatar) {
        client.position = position;
        client.yaw = yaw;
        client.pitch = pitch;
        client.avatar = avatar;
        self.emitter.emit('client.state', client);
    });

    // Client sent us voxel changes for one or more chunks
    connection.on('chunkVoxelIndexValue', function(changes) {
        // Re-broadcast this to the other players, too
        // TODO: queue up these changes, de-dupe them, and send them out on a schedule
        self.broadcast(client.id, 'chunkVoxelIndexValue', changes);
        // Invalidate our encodedChunkCache
        for (var chunkID in changes) {
            delete self.encodedChunkCache[ chunkID ];
        }
        // Update our chunk store
        self.chunkStore.gotChunkChanges(changes);
    });

    /*
    Client wants chunks. Keep track of which client wants chunks
    */
    connection.on('needChunks', function() {
        var chunkIDs = Array.prototype.slice.apply(arguments);
        if (debug) {
            console.log(client.id + ' needs chunks');
            console.log(chunkIDs);
        }
        for (var i = 0; i < chunkIDs.length; i++) {
            var chunkID = chunkIDs[i];
            if (!(chunkID in self.chunksForClients)) {
                self.chunksForClients[chunkID] = {};
            }
            if (self.isChunkInBounds(chunkID)) {
                self.chunksForClients[ chunkID ][ id ] = true;
                self.chunkStore.get(chunkID);
            }
        }
    });
};


// send message to all clients
Server.prototype.broadcast = function(id, event) {
    var self = this;
    // normalize arguments
    var args = [].slice.apply(arguments);
    // remove client `id` argument
    args.shift();
    // emit on self for module consumers, unless specified not to
    if (id !== 'server') {
        self.emitter.emit.apply(self, args);
    }
    for (var clientId in self.clients) {
        var client;
        var connection;
        // Don't broadcast to the client that sent us the info
        if (clientId === id) {
            continue;
        }
        client = self.clients[clientId];
        if (!client.connected) {
            continue;
        }
        if (debug) {
            console.log('sending to', clientId, args);
        }
        // emit over connection
        client.connection.emit.apply(client.connection, args);
    }
};


// broadcast position, rotation updates for each player
Server.prototype.sendPlayers = function() {
    var self = this;
    var clientIds = Object.keys(self.clients);
    if (clientIds.length === 0) {
        return;
    }
    //console.log('Sending updates for ' + clientIds.length + ' clients')
    var players = {};

    clientIds.map(function(id) {
        var client = self.clients[id];
        if (!client.position) {
            return;
        }
        // TODO: Ignore client if they're really stale
        players[id] = {
            positions: [
                client.position[0],
                client.position[1],
                client.position[2],
                client.pitch,
                client.yaw,
                0
            ],
            avatar: client.avatar
        };
    });

    self.broadcast(null, 'players', players);
};


Server.prototype.requestNearbyChunks = function(position) {
    var self = this;
    this.coords.nearbyChunkIDsEach(position, 2, function(chunkID) {
        self.chunkStore.get(chunkID);
    });
};


Server.prototype.sendChunk = function(chunk) {
    var self = this;
    var chunkID = chunk.chunkID;
    if (!(chunkID in this.chunksForClients)) {
        // Nobody's waiting for this chunk
        return;
    }
    for (var clientId in this.chunksForClients[chunkID]) {
        var client;
        if (clientId in self.clients) {
            client = self.clients[clientId];
            if (client.connected) {
                if (chunkID in this.encodedChunkCache) {
                    encoded = self.encodedChunkCache[chunkID];
                } else {
                    encoded = encoder(chunk.voxels);
                    self.encodedChunkCache[chunkID] = encoded;
                }
                // Send chunkID so we can use it on the receving end as the key in our chunksToDecodeAndMesh object
                client.connection.emit('chunk', chunkID, encoded);
            }
        }
        delete this.chunksForClients[chunkID][clientId];
    }
};


Server.prototype.isChunkInBounds = function(chunkID) {
    var self = this;
    var position = chunkID.split('|').map(function(value) {
        return Number(value);
    });
    if (position[0] < self.lastWorldChunks[0] || position[1] < self.lastWorldChunks[1] || position[2] < self.lastWorldChunks[2] || position[0] > self.lastWorldChunks[3] || position[1] > self.lastWorldChunks[4] || position[2] > self.lastWorldChunks[5]) {
        return false;
    }
    return true;
};


Server.prototype.on = function(name, callback) {
    this.emitter.on(name, callback);
};

