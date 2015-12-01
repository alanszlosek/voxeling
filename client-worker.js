var config = require('./config');

var WebSocketEmitter = require('./lib/web-socket-emitter');
var decoder = require('./lib/rle-decoder');
var pool = require('./lib/object-pool');
var Coordinates = require('./lib/coordinates');
var Textures = require('./lib/textures');
var mesher = require('./lib/meshers/horizontal-merge');
var ClientGenerator = require('./lib/generators/client.js');
var chunkArrayLength = config.chunkSize * config.chunkSize * config.chunkSize;
var chunkCache = {};

var debug = true;

/*
INCOMING WEBWORKER MESSAGES

connect - client wants us to connect to the websocket server


OUTGOING WEBWORKER MESSAGES

open - websocket connection opened

close - websocket connection closed

chunk - sending a decoded, meshed chunk to the client

*/


var worker = {
    connected: false,
    connection: null,
    chunksToDecodeAndMesh: [],
    chunksToMesh: [],

    emit: function(name, data) {
        postMessage(Array.prototype.slice.apply(arguments));
    },


    connect: function() {
        var self = this;
        var coordinates = new Coordinates(config.chunkSize);
        var textures = new Textures(config.textures);
        var websocket = this.connection = new WebSocketEmitter.client();
        var generator = new ClientGenerator(chunkCache, config.chunkSize);

        mesher.config(config.chunkSize, textures, coordinates);

        websocket.on('open', function() {
            self.connected = true;
            if (debug) {
                console.log('webworker: websocket connection opened');
            }
            self.emit('open');
        });

        websocket.on('close', function() {
            self.connected = false;
            if (debug) {
                console.log('webworker: websocket connection closed');
            }
            self.emit('close');
        });

        websocket.on('error', function(message) {
            console.log('webworker: websocket error, ' + message);
        });

        websocket.on('settings', function(settings, id) {
            if (debug) {
                console.log('webworker: got settings');
                console.log(settings);
            }
            self.emit('settings', settings, id);
        });

        websocket.on('chunks', function(tuples) {
            if (debug) {
                console.log('websorker: Websocket received chunks', tuples);
            }
            self.chunksToDecodeAndMesh = self.chunksToDecodeAndMesh.concat(tuples);
        });

        // fires when server sends us voxel edits [chunkID, voxelIndex, value, voxelIndex, value...]
        // would like to expand this to cover more than 1 chunk at a time
        websocket.on('chunkVoxelIndexValue', function(changes) {
            // Tell the client
            self.emit('chunkVoxelIndexValue', changes);
            // Update our local cache
            for (var chunkID in changes) {
                if (chunkID in chunkCache) {
                    var chunk = chunkCache[chunkID];
                    var details = changes[chunkID];
                    for (var i = 0; i < details.length; i += 2) {
                        var index = details[i];
                        var val = details[i + 1];
                        chunk.voxels[index] = val;
                    }
                    // Re-mesh this chunk
                    self.chunksToMesh.push(chunkID);
                }
            }
        });

        websocket.on('chat', function(message) {
            self.emit('chat', message);
        });

        websocket.on('players', function(players) {
            self.emit('players', players);
        });

        this.connection.connect(config.server);
    },

    needChunks: function() {
        var chunks = Array.prototype.slice.apply(arguments);
        chunks.unshift('needChunks');
        if (debug) {
            console.log('sending needChunks', chunks);
        }
        this.connection.emit.apply(this.connection, chunks);
    },

    /*
    We queue up chunks when we receive them from the server. This method decodes them and meshes them,
    in preparation for rendering.
    */
    processChunks: function() {
        var tuples = this.chunksToDecodeAndMesh;
        for (var i = 0; i < tuples.length; i+=3) {
            var chunkID = tuples[i];
            var position = tuples[i + 1];
            var encoded = tuples[i + 2];
            var data = pool.malloc('uint8', chunkArrayLength);

            var chunk = {
                chunkID: chunkID,
                position: position,
                voxels: decoder(encoded, data)
            };
            var mesh = mesher.mesh(chunk.position, chunk.voxels);

            var transfer = {
                chunkID: chunkID,
                position: position,
                voxels: chunk.voxels,
                mesh: {}
            };
            var transferList = [];

            // Cache in webworker
            chunkCache[chunkID] = chunk;

            // We don't want to transfer the voxel array, just copy it
            for (var textureValue in mesh) {
                var texture = mesh[textureValue];

                transfer.mesh[textureValue] = {
                    position: {
                        buffer: texture.position.data.buffer,
                        offset: texture.position.offset
                    },
                    texcoord: {
                        buffer: texture.texcoord.data.buffer,
                        offset: texture.texcoord.offset
                    },
                    normal: {
                        buffer: texture.normal.data.buffer,
                        offset: texture.normal.offset
                    }
                };
                // Go past the Growable, to the underlying ArrayBuffer
                transferList.push(texture.position.data.buffer);
                transferList.push(texture.texcoord.data.buffer);
                transferList.push(texture.normal.data.buffer);
            }

            // specially list the ArrayBuffer object we want to transfer
            postMessage(
                ['chunk', transfer],
                transferList
            );
        }
        postMessage(['chunksProcessed']);
        this.chunksToDecodeAndMesh = [];

        for (var i = 0; i < this.chunksToMesh.length; i++) {
            var chunkID = this.chunksToMesh[i];
            if (!(chunkID in chunkCache)) {
                continue;
            }

            var chunk = chunkCache[chunkID];
            var mesh = mesher.mesh(chunk.position, chunk.voxels);

            var transfer = {};
            var transferList = [];

            for (var textureValue in mesh) {
                var texture = mesh[textureValue];

                // Just send over ArrayBuffers
                transfer[textureValue] = {
                    position: {
                        buffer: texture.position.data.buffer,
                        offset: texture.position.offset
                    },
                    texcoord: {
                        buffer: texture.texcoord.data.buffer,
                        offset: texture.texcoord.offset
                    },
                    normal: {
                        buffer: texture.normal.data.buffer,
                        offset: texture.normal.offset
                    }
                };
                // Go past the Growable, to the underlying ArrayBuffer
                transferList.push(texture.position.data.buffer);
                transferList.push(texture.texcoord.data.buffer);
                transferList.push(texture.normal.data.buffer);
            }

            // specially list the ArrayBuffer object we want to transfer
            postMessage(
                ['chunkMesh', chunkID, transfer],
                transferList
            );
        }
        this.chunksToMesh = [];
    },

    // Update our local cache and tell the server
    chunkVoxelIndexValue: function(changes) {
        var self = this;
        self.connection.emit('chunkVoxelIndexValue', changes);
        for (var chunkID in changes) {
            if (chunkID in chunkCache) {
                var chunk = chunkCache[chunkID];
                var details = changes[chunkID];
                for (var i = 0; i < details.length; i += 2) {
                    var index = details[i];
                    var val = details[i + 1];
                    chunk.voxels[index] = val;
                }
                // Re-mesh this chunk
                self.chunksToMesh.push(chunkID);
            }
        }
    },

    chat: function(message) {
        var self = this;
        self.connection.emit('chat', message);
    },

    /*
    Client no longer needs this mesh
    */
    freeMesh: function(mesh) {
        for (var textureValue in mesh) {
            var textureMesh = mesh[textureValue];
            // We pass ArrayBuffers across worker boundary, so need to we-wrap in the appropriate type
            pool.free('float32', new Float32Array(textureMesh.position.buffer));
            pool.free('float32', new Float32Array(textureMesh.texcoord.buffer));
            pool.free('float32', new Float32Array(textureMesh.normal.buffer));
        }
    },
    /*
    Client no longer needs this chunk (voxels and mesh)
    Add the arrays back to the pool
    */
    freeChunk: function(chunk) {
        var mesh = chunk.mesh;
        for (var textureValue in mesh) {
            var textureMesh = mesh[textureValue];
            textureMesh.position.free();
            textureMesh.texcoord.free();
            textureMesh.normal.free();
        }

        pool.free('uint8', chunk.voxels);
    },

    playerPosition: function(position, yaw, pitch) {
        if (!worker.connected) {
            return;
        }
        worker.connection.emit('myPosition', position, yaw, pitch);
    }
}

onmessage = function(e) {
    var message = e.data;
    var type = message.shift();

    if (type in worker) {
        worker[type].apply(worker, message);
    } else {
        console.log('worker does not have handler for ' + type, message);
    }
    
};

setInterval(
    function() {
        worker.processChunks();
    },
    1000 / 10
);
