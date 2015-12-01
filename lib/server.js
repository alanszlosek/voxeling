var EventEmitter = require('events').EventEmitter;
var WebSocketEmitter = require('./web-socket-emitter');
var uuid = require('hat');

// voxel dependencies
var Coordinates = require('./coordinates');
var encoder = require('./rle-encoder');
var fs = require('fs');
var stats = require('./voxel-stats');
var debug = true;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = Server;

function Server(config, chunkCache, serverSettings, clientSettings) {
    // force instantiation via `new` keyword 
    //if(!(this instanceof Server)) { return new Server(serverSettings || {}, clientSettings || {}) }
    this.config = config;
    this.chunkCache = chunkCache;
    this.serverSettings = serverSettings;
    this.clientSettings = clientSettings;

    var chunkSize = config.chunkSize;
    var origin = serverSettings.worldOrigin;
    var diameter = serverSettings.worldDiameter;
    var step = chunkSize * diameter;
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
}

Server.prototype.initialize = function() {
    var self = this;
    this.emitter = new EventEmitter();
    self.coords = Coordinates(self.config.chunkSize);

    // Must pass this in, for now
    self.generator = self.serverSettings.generator;
    self.encodedChunkCache = {};
    self.requestedChunks = {};

    var clients = self.clients = {};
    // Almost ready
    self.requestNearbyMissingChunks(this.clientSettings.avatarInitialPosition);

    // send player position/rotation updates
    // TODO: do this in tick
    setInterval(function() {
        self.sendUpdate();
    }, 1e3 / 3);

    // 3 updates per second
    // Send chunks every half-second
    setInterval(function() {
        var sendChunksBatchSize = 50;
        // Handle chunk generation
        var ids = Object.keys(self.clients);
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var ready = [];
            var chunkIDs;
            if (!(id in self.requestedChunks)) {
                continue;
            }
            chunkIDs = Object.keys(self.requestedChunks[id]);
            for (var j = 0; j < chunkIDs.length; j++) {
                var chunkID = chunkIDs[j];
                if (ready.length > sendChunksBatchSize) {
                    break;
                }
                if (self.chunkCache[chunkID]) {
                    ready.push(chunkID);
                    delete self.requestedChunks[id][chunkID];
                }
            }
            if (ready.length > 0) {
                //console.log('Ready to send: ' + ready.length)
                self.sendChunks(self.clients[id].connection, ready);
            }
        }
        // GENERATE SERVERAL A SECOND
        self.generator.generateChunks();
    }, 1e3 / 5);
};

// Setup the client connection - register events, etc
Server.prototype.connectClient = function(wseSocket) {
    var self = this;
    var avatars = self.clientSettings.avatars;
    var id = wseSocket.id = uuid();
    var client = self.clients[id] = {
        id: id,
        // This gets updated when we get their position updates
        // Server should remove stale clients
        lastSeen: 0,
        connected: true,
        connection: wseSocket,
        // TODO: let them choose their avatar
        avatarImage: avatars[getRandomInt(0, avatars.length)],
        position: null,
        yaw: 0,
        pitch: 0
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
        console.log('connection closed');
        delete self.clients[client.id];
    });

    // forward chat message
    connection.on('chat', function(message) {
        // ignore if no message provided
        if (!message.text) return;
        // limit chat message length
        if (message.text.length > 140) message.text = message.text.substr(0, 140);
        stats.count('chat.messages.sent');
        self.broadcast(null, 'chat', message);
    });

    // when user ready ( game created, etc )
    connection.on('created', function() {
        // emit client.created for module consumers
        self.emitter.emit('client.created', client);
    });

    // client sends new position, rotation
    // don't need to lerp on the server AND the client, just the client
    connection.on('myPosition', function(position, yaw, pitch) {
        client.position = position;
        client.yaw = yaw;
        client.pitch = pitch;
        self.emitter.emit('client.state', client);
    });

    // client modifies a block
    connection.on('set', function(pos, val) {
        console.log('DEPRECATED: "set" is no longer supported');
    });

    connection.on('chunkVoxelIndexValue', function(chunks) {
        // Make sure this is a number
        for (var chunkID in chunks) {
            if (chunkID in self.chunkCache) {
                var chunk = self.chunkCache[chunkID];
                var details = chunks[chunkID];
                delete self.encodedChunkCache[chunkID];
                for (var i = 0; i < details.length; i += 2) {
                    var index = details[i];
                    var val = details[i + 1];
                    var old = chunk.voxels[index];
                    chunk.voxels[index] = val;
                    if (old) {
                        if (val) {
                            stats.count('blocks.changed');
                        } else {
                            stats.count('blocks.destroyed');
                        }
                    } else {
                        stats.count('blocks.created');
                    }

                }
                self.emitter.emit('chunkChanged', chunkID);
            }
        }
        // broadcast 'set' to all players
        // Let's change this to be chunkID, index, value
        // The idea being to remove the need for math on the client side
        //self.broadcast(client.id, 'set', pos, val)
        self.broadcast(client.id, 'chunkVoxelIndexValue', chunks);
    });

    connection.on('needChunks', function() {
        var chunkIDs = Array.prototype.slice.apply(arguments);
        if (debug) {
            console.log(client.id + ' needs chunks');
            console.log(chunkIDs);
        }
        if (!(id in self.requestedChunks)) {
            self.requestedChunks[id] = {};
        }
        for (var i = 0; i < chunkIDs.length; i++) {
            var chunkID = chunkIDs[i];
            // Request if we don't have this chunk
            if (!self.chunkCache[chunkID]) {
                // Only request if this isn't outside our world boundaries
                var position = chunkID.split('|').map(function(value) {
                    return Number(value);
                });
                if (position[0] < self.lastWorldChunks[0] || position[1] < self.lastWorldChunks[1] || position[2] < self.lastWorldChunks[2] || position[0] > self.lastWorldChunks[3] || position[1] > self.lastWorldChunks[4] || position[2] > self.lastWorldChunks[5]) {
                    console.log('Ignoring ' + chunkID + '. Outside world bounds');
                } else {
                    self.generator.requestChunk(chunkID);
                }
            }
            self.requestedChunks[id][chunkID] = false;
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
    Object.keys(self.clients).map(function(clientId) {
        if (clientId === id) return;
        var client = self.clients[clientId];
        if (!client.connected) return;
        var connection = client.connection;
        console.log('sending to', clientId, args);
        // emit over connection
        connection.emit.apply(connection, args);
    });
};

// broadcast position, rotation updates for each player
Server.prototype.sendUpdate = function() {
    var self = this;
    var clientIds = Object.keys(self.clients);
    if (clientIds.length === 0) {
        return;
    }
    //console.log('Sending updates for ' + clientIds.length + ' clients')
    var positions = {};

    clientIds.map(function(id) {
        var client = self.clients[id];
        // TODO: Ignore client if they're really stale
        positions[id] = {
            position: client.position,
            yaw: client.yaw,
            pitch: client.pitch,
            avatarImage: client.avatarImage
        };
    });

    //console.log(positions);
    self.broadcast(null, 'players', positions);
};

Server.prototype.requestNearbyMissingChunks = function(position) {
    var self = this;
    this.coords.nearbyChunkIDsEach(position, this.clientSettings.horizontalDistance, this.clientSettings.verticalDistance, function(chunkID) {
        self.generator.requestChunk(chunkID);
    });
};

Server.prototype.prepareChunkForSending = function(chunkID) {
    var self = this;
    var chunk = self.chunkCache[chunkID];
    var encoded = self.encodedChunkCache[chunkID];
    //if (debug) console.log('prepareChunk: ' + chunkID)
    if (!chunk) {
        // Generate chunk
        // add to engine.pendingChunks
        // then loadPendingChunks
        console.log('prepareChunkForSending on non-existent chunk ' + chunkID);
        return false;
    }
    if (!encoded) {
        encoded = encoder(chunk.voxels);
        self.encodedChunkCache[chunkID] = encoded;
    }
    return [
        encoded,
        {
            position: chunk.position,
            chunkID: chunkID,
            voxels: null
        }
    ];
};

Server.prototype.sendChunks = function(connection, chunkIDs) {
    var self = this;
    var out = [];
    console.log('sending chunks', chunkIDs);
    for (var i = 0; i < chunkIDs.length; i++) {
        var chunkID = chunkIDs[i];
        var chunk;
        var encoded;

        if (!(chunkID in self.chunkCache)) {
            console.log('prepareChunkForSending on non-existent chunk ' + chunkID);
            continue;
        }
        chunk = self.chunkCache[chunkID];

        encoded = self.encodedChunkCache[chunkID];
        if (!encoded) {
            encoded = encoder(chunk.voxels);
            self.encodedChunkCache[chunkID] = encoded;
        }
        out.push(
            chunkID,
            chunk.position,
            encoded
        );
    }
    if (out.length > 0) {
        console.log('Sent ' + out.length + ' chunks');
        connection.emit('chunks', out);
    }
};

Server.prototype.on = function(name, callback) {
    this.emitter.on(name, callback);
};