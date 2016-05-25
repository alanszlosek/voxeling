var config = require('./config');

var WebSocketEmitter = require('./lib/web-socket-emitter');
var decoder = require('./lib/rle-decoder');
var pool = require('./lib/object-pool');
var Coordinates = require('./lib/coordinates');
var Textures = require('./lib/textures');
var mesher = require('./lib/meshers/horizontal-merge');
var ClientGenerator = require('./lib/generators/client.js');
var timer = require('./lib/timer');
var chunkArrayLength = config.chunkSize * config.chunkSize * config.chunkSize;
var chunkCache = {};

var log = require('./lib/log')('client-worker');
var debug = false;

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
    // When we get chunks from the server, we queue them here
    chunksToDecodeAndMesh: {},
    // When we get chunks from server, or when user changed a voxel, we need to remesh. Queue them here
    chunksToMesh: {},
    // When we get chunks from server and need to send voxel data to client, they're queued here
    voxelsToSend: {},

    // Chunk ids in the order we want them
    chunkPriority: [],
    // Chunk ids we want voxels for
    voxels: [],

    // Chunks we're in the process of requesting from the server
    neededChunks: {},

    emit: function(name, data) {
        postMessage(Array.prototype.slice.apply(arguments));
    },


    connect: function() {
        var self = this;
        var coordinates = new Coordinates(config.chunkSize);
        var textures = new Textures(config.textures);
        var websocket = this.connection = new WebSocketEmitter.client();
        var generator = new ClientGenerator(chunkCache, config.chunkSize);

        mesher.config(config.chunkSize, textures, coordinates, chunkCache);

        websocket.on('open', function() {
            self.connected = true;
            if (debug) {
                log('websocket connection opened');
            }
            self.emit('open');
        });

        websocket.on('close', function() {
            self.connected = false;
            if (debug) {
                log('websocket connection closed');
            }
            self.emit('close');
        });

        websocket.on('error', function(message) {
            log('websocket error, ' + message);
        });

        websocket.on('settings', function(settings, id) {
            if (debug) {
                log('got settings', settings);
            }
            self.emit('settings', settings, id);
        });

        websocket.on('chunk', function(chunkID, encoded) {
            if (debug) {
                log('Websocket received chunk: ' + chunkID);
            }
            var index = self.chunkPriority.indexOf(chunkID);
            if (index == -1) {
                if (debug) {
                    log('Got chunk, but we dont care about it', chunkID, self.chunkPriority);
                }
                return;
            }
            self.chunksToDecodeAndMesh[chunkID] = encoded;

            // Cleanup
            if (chunkID in self.neededChunks) {
                delete self.neededChunks[ chunkID ];
            }
            
        });

        // fires when server sends us voxel edits [chunkID, voxelIndex, value, voxelIndex, value...]
        websocket.on('chunkVoxelIndexValue', function(changes) {
            // Tell the client
            self.emit('chunkVoxelIndexValue', changes);
            // Update our local cache
            for (var chunkID in changes) {
                if (self.chunkPriority.indexOf(chunkID) == -1) {
                    continue;
                }
                if (chunkID in chunkCache) {
                    var chunk = chunkCache[chunkID];
                    var details = changes[chunkID];
                    for (var i = 0; i < details.length; i += 2) {
                        var index = details[i];
                        var val = details[i + 1];
                        chunk.voxels[index] = val;
                    }
                    // Re-mesh this chunk
                    self.chunksToMesh[ chunkID ] = true;
                    if (self.voxels.indexOf(chunkID) > -1) {
                        self.voxelsToSend[ chunkID ] = true;
                    }
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


    // Client told us the order it wants to receive chunks in
    updateNeeds: function(chunkIds, onlyTheseMeshes, onlyTheseVoxels, missingMeshes, missingVoxels) {
        this.chunkPriority = chunkIds;
        this.voxels = onlyTheseVoxels;

        this.connection.emit('onlyTheseChunks', chunkIds);


        // Might be easier to process these later
        for (var i = 0; i < chunkIds.length; i++) {
            var chunkId = chunkIds[i];

            // Did client request this as a mesh?
            if (missingMeshes.indexOf(chunkId) > -1) {
                if (chunkId in chunkCache) {
                    this.chunksToMesh[ chunkId ] = true;
                } else if (!(chunkId in this.neededChunks)) {
                    this.neededChunks[ chunkId ] = true;
                }
            }
            if (missingVoxels.indexOf(chunkId) > -1) {
                if (chunkId in chunkCache) {
                    this.voxelsToSend[ chunkId ] = true;
                }
            }
        }

        // Clean up our request
        var chunkIds = Object.keys(this.neededChunks);
        for (var i = 0; i < chunkIds.length; i++) {
            var chunkId = chunkIds[i];
            if (this.chunkPriority.indexOf(chunkId) == -1) {
                delete this.neededChunks[chunkId];
            }
        }
    },

    /*
    We queue up chunks when we receive them from the server. This method decodes them and meshes them,
    in preparation for rendering.
    */
    processChunks: function() {

        for (var chunkID in this.chunksToDecodeAndMesh) {
            // Skip if we're no longer interested in this chunk
            if (this.chunkPriority.indexOf(chunkID) == -1) {
                continue;
            }
            var encoded = this.chunksToDecodeAndMesh[chunkID];
            var position = chunkID.split('|').map(function(value) {
                return Number(value);
            });
            var data = pool.malloc('uint8', chunkArrayLength);

            var start = Date.now();
            var chunk = {
                chunkID: chunkID,
                position: position,
                voxels: decoder(encoded, data)
            };
            timer.log('rle-decode', Date.now() - start);
            // Cache in webworker
            // TODO: change this to an LRU cache
            chunkCache[chunkID] = chunk;

            if (this.voxels.indexOf(chunkID) > -1) {
                this.voxelsToSend[ chunkID ] = true;
            }
            this.chunksToMesh[ chunkID ] = true;
        }

        // Transfer voxel data to client
        var chunkIds = Object.keys(this.voxelsToSend);
        for (var i = 0; i < chunkIds.length; i++) {
            var chunkId = chunkIds[i];
            if (chunkId in chunkCache) {
                postMessage(
                    ['chunkVoxels', chunkCache[ chunkId ]]
                );
                delete this.voxelsToSend[chunkId];
            } else {
                //log('Error: attempted to send voxels that dont exist in chunkCache', chunkID)
            }
        }

        var chunkIds = Object.keys(this.chunksToMesh);
        for (var i = 0; i < chunkIds.length; i++) {
            var chunkId = chunkIds[i];
            if (!(chunkId in chunkCache)) {
                // Need to error here
                log('Error: attempted to mesh a chunk not found in chunkCache', chunkID);
                continue;
            }

            var chunk = chunkCache[chunkId];
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
                ['chunkMesh', chunkId, transfer],
                transferList
            );
            delete this.chunksToMesh[chunkId];
        }

        this.chunksToDecodeAndMesh = {};
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
                self.chunksToMesh[ chunkID ] = true;
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

    playerPosition: function(position, yaw, pitch, avatar) {
        if (!worker.connected) {
            return;
        }
        worker.connection.emit('myPosition', position, yaw, pitch, avatar);
    }
}

onmessage = function(e) {
    var message = e.data;
    var type = message.shift();

    if (type in worker) {
        worker[type].apply(worker, message);
    } else {
        log('worker does not have handler for ' + type, message);
    }
    
};

var waitingOn = 0;
setInterval(
    function() {
        worker.processChunks();

        var ts = Date.now();
        var chunkIds = [];
        waitingOn = 0;
        // Request in the order the client wants them
        for (var i = 0; i < worker.chunkPriority.length; i++) {
            var chunkId = worker.chunkPriority[i];
            if (!(chunkId in worker.neededChunks)) {
                continue;
            }
            var lastRequested = worker.neededChunks[chunkId];
            if (ts > lastRequested) {
                if (debug) {
                    log('Requesting ', chunkId);
                }
                chunkIds.push(chunkId);
                
                // Wait before requesting this chunk again
                worker.neededChunks[ chunkId ] = ts + 10000;
            }
            waitingOn++;


            // Only wait on 10 at a time
            if (waitingOn > 9) {
                break;
            }
        }

        if (chunkIds.length > 0) {
            worker.connection.emit('needChunks', chunkIds);
        }
    },
    1000 / 10
);

setInterval(
    function() {
        timer.print();
    },
    10000
);
