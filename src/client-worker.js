var config = require('../config');

var decoder = require('./lib/rle-decoder');
var pool = require('./lib/object-pool');
var Coordinates = require('./lib/coordinates');
var Textures = require('./lib/textures');
var mesher = require('./lib/meshers/horizontal-merge');
var ClientGenerator = require('./lib/generators/client.js');
var Frustum = require('./lib/frustum');
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


var sendMessage = function(websocket, name, payload) {
    websocket.send( JSON.stringify([name, payload]) );
};


var worker = {
    coordinates: null,
    connected: false,
    connection: null,
    frustum: null,
    // When we get chunks from the server, we queue them here
    chunksToDecodeAndMesh: {},
    // When we get chunks from server, or when user changed a voxel, we need to remesh. Queue them here
    chunksToMesh: {},
    // When we get chunks from server and need to send voxel data to client, they're queued here
    voxelsToSend: {},

    // Chunk ids (and meshes) in the order we want them
    chunkPriority: [],
    // Meshes we've recently sent
    meshesSent: {},
    // Chunk ids we want voxels for
    voxels: [],
    currentVoxels: {},

    // Chunks we're in the process of requesting from the server
    neededChunks: {},

    createFrustum: function(verticalFieldOfView, ratio, farDistance) {
        this.frustum = new Frustum(verticalFieldOfView, ratio, 0.1, farDistance);
    },

    emit: function(name, data) {
        var len = arguments.length;
        var args = new Array(len);
        for (var i = 0; i < len; i++) {
            args[i] = arguments[i];
        }
        postMessage(args);
    },


    connect: function() {
        var self = this;
        var coordinates = this.coordinates = new Coordinates(config.chunkSize);
        var textures = new Textures(config.textures);
        var websocket = this.connection = new WebSocket(config.server);
        var generator = new ClientGenerator(chunkCache, config.chunkSize);

        mesher.config(config.chunkSize, textures, coordinates, chunkCache);

        websocket.onopen = function() {
            self.connected = true;
            if (debug) {
                log('websocket connection opened');
            }
            self.emit('open');
        };

        websocket.onclose = function() {
            self.connected = false;
            if (debug) {
                log('websocket connection closed');
            }
            self.emit('close');
        };

        websocket.onerror = function(message) {
            log('websocket error, ' + message);
        };

        websocket.onmessage = function(event) {
            // Decode message
            // Handle errors and exceptions
            console.log('' + event.data);
            var decoded = JSON.parse(event.data);
            var type = decoded[0];
            var payload = decoded[1];
            switch (type) {
                case 'settings':
                    if (debug) {
                        log('got settings', payload);
                    }
                    self.emit('settings', payload['settings'], payload['id']);
                    break;
                // fires when server sends us voxel edits [chunkID, voxelIndex, value, voxelIndex, value...]
                case 'chunkVoxelIndexValue':
                    var changes = payload['changes'];
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
                    break;

                case 'chat':
                    self.emit('chat', payload.message);
                    break;

                case 'player':
                    self.emit('players', payload.players);
                    break;
            }
        };

    },

    regionChange: function(playerPosition, rotationQuat, drawDistance, removeDistance) {
        var self = this;

        // TODO update the frustum
        this.frustum.update(playerPosition, rotationQuat, drawDistance);

        log('regionChange: playerPosition is', playerPosition);

        // These help us remove voxels and meshes we no longer need
        var nearbyVoxels = {};
        // We tell our web worker about these, so it knows what to fetch and return
        var onlyTheseVoxels = [];
        var missingVoxels = [];

        // Helps us ignore chunks we don't care about, and also prioritize re-drawing nearby chunks
        var chunkDistances = {};
        var len = drawDistance * 3;
        var priority = new Array(len);
        for (var i = 0; i < len; i++) {
            priority[i] = [];
        }
        var addPriority = function(level, chunkID) {
            log('regionChange.addPriority: level', level);
            priority[level].push(chunkID);
        };

        // Hmm, I seem to have removed the removeDistance logic. do we still want that 1 chunk buffer zone?

        this.coordinates.nearbyChunkIDsEach(
            playerPosition,
            removeDistance,
            function(chunkID, chunkPosition, distanceAway) {
                // We only care about voxel data for the current chunk, and the ring around us
                if (distanceAway < 3) {
                    nearbyVoxels[chunkID] = 0;
                    onlyTheseVoxels.push(chunkID);
                    if (!(chunkID in self.currentVoxels)) {
                        missingVoxels.push(chunkID);
                    }
                }
                // We only care about meshes up to our draw distance
                /*
                if (distanceAway <= self.removeDistance) {
                    nearbyMeshes[chunkID] = 0;
                }
                */
                
                // Set fetch priority
                if (distanceAway < 2) {
                    addPriority(distanceAway, chunkID);
                    chunkDistances[ chunkID ] = distanceAway;
                } else if (distanceAway <= drawDistance) {
                    // If outside frustum, add config.drawDistnace to distanceAway as priority
                    // Use frustum to determine our fetch priority.
                    // We want visible meshes to be fetched and drawn first
                    if (self.frustum.chunkVisible(chunkID, chunkPosition)) {
                        addPriority(distanceAway, chunkID);
                    } else {
                        addPriority(distanceAway + removeDistance, chunkID);
                    }
                    chunkDistances[ chunkID ] = distanceAway;
                } else if (distanceAway <= removeDistance) {

                }
            }
        );

        var prioritized = [];
        for (var i = 0; i < priority.length; i++) {
            Array.prototype.push.apply(prioritized, priority[i]);
        }

        self.updateNeeds(prioritized, chunkDistances, onlyTheseVoxels, missingVoxels);
        postMessage(
            ['meshesToShow', chunkDistances]
        );
        postMessage(
            ['nearbyChunks', nearbyVoxels]
        );

        log('nearbyVoxels', nearbyVoxels);
    },


    // Client told us the order it wants to receive chunks in
    updateNeeds: function(chunkIds, chunkDistances, onlyTheseVoxels, missingVoxels) {
        var self = this;
        // Prioritized list of meshes that we want
        this.chunkPriority = chunkIds;
        this.voxels = onlyTheseVoxels;
        console.log('updateNeeds');

        // Tell server that we only care about these chunks
        sendMessage(this.connection, 'onlyTheseChunks', chunkIds);

        var requestClosure = function(chunkId) {
            var req = new XMLHttpRequest();
            req.open("GET", config.httpServer + "/chunk/" + chunkId, true);
            req.responseType = "arraybuffer";
            req.onload = function (oEvent) {
                if (!req.response) {
                    return;
                } // Note: not oReq.responseText
                var position = chunkId.split('|').map(function(value) {
                    return Number(value);
                });
                var chunk = {
                    chunkID: chunkId,
                    position: position,
                    voxels: new Uint8Array(req.response)
                };
                self.chunksToDecodeAndMesh[chunkId] = chunk;
            };
            req.send(null);
            return req;
        };

        // Might be easier to process these later
        for (var i = 0; i < chunkIds.length; i++) {
            var chunkId = chunkIds[i];

            // If we haven't recently sent this mesh to the client
            if (!(chunkId in this.meshesSent)) {
                if (chunkId in chunkCache) {
                    this.chunksToMesh[ chunkId ] = true;
                } else if (!(chunkId in this.neededChunks)) {
                    // Request this chunk from server if we haven't yet
                    // Keep handle to HTTP req, so we can cancel it
                    self.neededChunks[chunkId] = requestClosure(chunkId);
                }
            }
            if (missingVoxels.indexOf(chunkId) > -1) {
                if (chunkId in chunkCache) {
                    this.voxelsToSend[ chunkId ] = true;
                }
            }
        }
        
        // We keep track of which meshes we've sent to the client,
        // remove the ones we no longer care about
        for (var chunkId in this.meshesSent) {
            if (!(chunkId in chunkDistances)) {
                delete this.meshesSent[chunkId];
            }
        }

        // Ignore chunks we no longer care about
        var chunkIds = Object.keys(this.neededChunks);
        for (var i = 0; i < chunkIds.length; i++) {
            var chunkId = chunkIds[i];
            if (this.chunkPriority.indexOf(chunkId) == -1) {
                this.neededChunks[chunkId].abort();
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
            var chunk = this.chunksToDecodeAndMesh[chunkID];
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

                // We pass data.buffer, the underlying ArrayBuffer
                transfer[textureValue] = {
                    position: {
                        buffer: texture.position.data.buffer,
                        offset: texture.position.offset,
                        offsetBytes: texture.position.offset * 4,
                        tuples: texture.position.offset / 3
                    },
                    texcoord: {
                        buffer: texture.texcoord.data.buffer,
                        offset: texture.texcoord.offset,
                        offsetBytes: texture.texcoord.offset * 4
                    },
                    normal: {
                        buffer: texture.normal.data.buffer,
                        offset: texture.normal.offset,
                        offsetBytes: texture.normal.offset * 4
                    }
                };
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
            this.meshesSent[chunkId] = true;

            // Stop after sending 10 meshes, to make sure we send voxel data in a timely manner
            if (i > 9) {
                break;
            }
        }

        this.chunksToDecodeAndMesh = {};
    },

    // Update our local cache and tell the server
    chunkVoxelIndexValue: function(changes, touching) {
        var self = this;
        sendMessage(self.connection, 'chunkVoxelIndexValue', changes);
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

        // Along with these voxel changes, there may be nearby chunks that we need to re-mesh
        // so we don't "see through the world"
        for (var chunkID in touching) {
            if (chunkID in chunkCache) {
                self.chunksToMesh[ chunkID ] = true;
            }
        }
    },

    chat: function(message) {
        var self = this;
        sendMessage(self.connection, 'chat', message);
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
        sendMessage(worker.connection, 'myPosition', [position, yaw, pitch, avatar]);
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

        /*
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
        */
    },
    // Ten times a second didn't seem fast enough
    1000 / 20
);

setInterval(
    function() {
        timer.print();
    },
    10000
);
