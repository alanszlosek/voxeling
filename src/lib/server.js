var zlib = require('zlib');
var EventEmitter = require('events').EventEmitter;
var uuid = require('hat');

// voxel dependencies
var Coordinates = require('./coordinates');
var HLRU = require('hashlru');
var debug = false;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

var sendMessage = function(websocket, name, payload) {
    websocket.send( JSON.stringify([name, payload]) );
};

module.exports = Server;

function Server(config, clientSettings, chunkStore, wsServer, httpServer) {
    // force instantiation via `new` keyword
    //if(!(this instanceof Server)) { return new Server(serverSettings || {}, clientSettings || {}) }
    this.config = config;
    this.clientSettings = clientSettings;
    this.chunkStore = chunkStore;
    this.wsServer = wsServer;
    this.httpServer = httpServer;

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
    this.clients = {};
    this.emitter = new EventEmitter();
    this.coords = Coordinates(self.config.chunkSize);

    this.encodedChunkCache = new HLRU(10);

    // Prime our chunk store or LRU
    //self.requestNearbyChunks(this.clientSettings.initialPosition);

    // send player position/rotation updates
    setInterval(function() {
        self.sendPlayers();
    }, 1000 / 3);


    // Handle requests for chunk voxels
    self.httpServer.on('request', function(request, response) {
        var url = require('url').parse(request.url);
        var path = decodeURIComponent(url.path);
        if (path.substr(0, 7) == '/chunk/') {
            var chunkId = path.substr(7);
            if (!chunkId) {
                response.end();
                return;
            }
            // Bail if someone requested a chunk outside our world radius
            if (!self.isChunkInBounds(chunkId)) {
                response.end();
                return;
            }
            self.chunkStore.get(chunkId, function(error, chunk) {
                var acceptEncoding = request.headers['accept-encoding'] || '';

                // Note: This is not a conformant accept-encoding parser.
                // See https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
                if (/\bgzip\b/.test(acceptEncoding)) {
                    response.writeHead(
                        200,
                        {
                            'Content-Type': 'application/octet-stream',
                            'Content-Encoding': 'gzip',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'no-cache'
                        }
                    );
                    if ('compressedVoxels' in chunk && chunk.compressedVoxels) {
                        response.end( chunk.compressedVoxels );
                    } else {
                        response.end( zlib.gzipSync(chunk.voxels) );
                    }
                } else {
                    response.writeHead(200, {});
                    response.end( chunk.voxels );
                }
            });
        }
    });

    self.wsServer.on('connection', function(connection) {
        var id = uuid();
        self.clients[id] = {
            id: id,
            // This gets updated when we get their position updates
            // Server should remove stale clients
            lastSeen: 0,
            connected: true,
            connection: connection,
            avatar: 'player',
            position: null,
            yaw: 0,
            pitch: 0,

            // The chunk ids this client cares about
            onlyTheseChunks: []
        };

        connection.on('error', function(message) {
            console.log('Client connection error: ' + message);
        });

        connection.on('end', function() {
            self.clients[id].connected = false;
        });

        connection.on('close', function(error) {
            self.clients[id].connected = false;
            delete self.clients[id];
        });

        connection.on('message', function(message) {
            // Decode message
            // Handle errors and exceptions
            var client = self.clients[id];
            var decoded = JSON.parse(message);
            var type = decoded[0];
            var payload = decoded[1];
            switch (type) {
                case 'chat':
                    // ignore if no message provided
                    if (!payload.text) return;
                    if (payload.text.match(/script/i)) {
                        console.log('Found script tag in message. Dropping');
                        return;
                    }
                    // limit chat message length
                    if (payload.text.length > 255) payload.text = payload.text.substr(0, 140);
                    self.broadcast(null, 'chat', payload);
                    self.emitter.emit('chat', payload);
                    break;

                // when user ready ( game created, etc )
                case 'created':
                    // emit client.created for module consumers
                    self.emitter.emit('client.created', payload);
                    break;
                case 'myPosition':
                    // client sends new position, rotation
                    //connection.on('myPosition', function(position, yaw, pitch, avatar) {
                    client.position = payload[0];
                    client.yaw = payload[1];
                    client.pitch = payload[2];
                    client.avatar = payload[3];
                    self.emitter.emit('client.state', client);
                    break;

                // Client sent us voxel changes for one or more chunks
                case 'chunkVoxelIndexValue':
                    var changes = payload;
                    // Update our chunk store
                    self.chunkStore.gotChunkChanges(changes);

                    // Re-broadcast this to the other players, too
                    for (var chunkId in changes) {
                        var chunkChanges = {};
                        if (!self.isChunkInBounds(chunkId)) {
                            continue;
                        }
                        chunkChanges[chunkId] = changes[chunkId];

                        self.encodedChunkCache.remove(chunkId);
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
                            sendMessage(client.connection, 'chunkVoxelIndexValue', chunkChanges);
                        }
                    }
                    break;

                // Client tells us which chunks it wants to hear about
                case 'onlyTheseChunks':
                    if (debug) {
                        console.log('Client only cares about these chunks', payload);
                    }
                    self.clients[id].onlyTheseChunks = payload;
                    break;
                default:
                    if (debug) {
                        console.log('Unexpected WebSocket message: ', decoded);
                    }
                    break;
            }
        });

        sendMessage(connection, 'settings', {id: id, settings: self.clientSettings});
    });
};


// send message to all clients
Server.prototype.broadcast = function(id, event, payload) {
    var self = this;
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
            console.log('sending to', clientId, payload);
        }
        // emit over connection
        sendMessage(client.connection, event, payload);
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
