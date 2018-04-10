var config = require('../config');

var pool = require('./lib/object-pool');
var Coordinates = require('./lib/coordinates');
var Textures = require('./lib/textures');
var mesher = require('./lib/meshers/horizontal-merge');
var ClientGenerator = require('./lib/generators/client.js');
var Frustum = require('./lib/frustum');
var MaxConcurrent = require('./lib/max-concurrent')(10);
var timer = require('./lib/timer');
var chunkArrayLength = config.chunkSize * config.chunkSize * config.chunkSize;
var chunkCache = {};

var log = require('./lib/log')('client-worker');
var debug = false;

/*
INCOMING WEBWORKER MESSAGES

connect - client wants us to connect to the websocket server

regionChange



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

    /*
    When we change regions:

    - need to know which chunk voxel data we don't have
        - compare previous chunkDistances with current chunkDistances
    - which voxels need to be sent to the client
        - compare previous sentVoxels with current setVoxels
    - which voxels need to be meshed and sent to client
        - compare previous sentMeshes with current sentMeshes
    */
    chunkDistances: {},
    sentClientChunks: {},
    sentClientMeshes: {},
    chunkPriority: [],

    // Voxel data we need that's not yet in cache
    missingChunks: {},
    requestedChunks: {},
    clientMissingChunks: {},
    clientMissingMeshes: {},


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

    regionChange: function(playerPosition, rotationQuat, drawDistance) {
        var self = this;

        this.frustum.update(playerPosition, rotationQuat, drawDistance);

        log('regionChange: playerPosition is', playerPosition);

        // Helps us ignore chunks we don't care about, and also prioritize re-drawing nearby chunks
        var chunkDistances = {};
        var sentClientChunks = {};
        var sentClientMeshes = {};
        var chunkPriority = [];

        // Voxel data we need that's not yet in cache
        var missingChunks = {};
        var clientMissingChunks = {};
        var clientMissingMeshes = {};

        var nearbyVoxels = {};


        var len = drawDistance * 3;
        var priority = new Array(len);
        for (var i = 0; i < len; i++) {
            priority[i] = [];
        }
        var addPriority = function(level, chunkID) {
            log('regionChange.addPriority: level', level);
            priority[level].push(chunkID);
        };

        this.coordinates.nearbyChunkIDsEach(
            playerPosition,
            drawDistance,
            function(chunkId, chunkPosition, distanceAway) {

                // TODO: how to square this with requestedChunks, and self.missingChunks
                if (!(chunkId in chunkCache)) {
                    missingChunks[chunkId] = true;
                }

                // We only care about voxel data for the current chunk, and the ring around us
                if (distanceAway < 3) {
                    // If we previous sent this voxel to the client, no need to re-send
                    if (chunkId in self.sentClientChunks) {
                        sentClientChunks[chunkId] = true;
                    } else {
                        clientMissingChunks[chunkId] = true;
                    }
                    nearbyVoxels[chunkId] = true;
                }

                if (chunkId in self.sentClientMeshes) {
                    sentClientMeshes[chunkId] = true;
                } else {
                    clientMissingMeshes[chunkId] = true;
                }
                
                // Set fetch priority
                if (distanceAway < 2) {
                    addPriority(distanceAway, chunkId);
                    chunkDistances[ chunkId ] = distanceAway;
                } else if (distanceAway <= drawDistance) {
                    // If outside frustum, add config.drawDistnace to distanceAway as priority
                    // Use frustum to determine our fetch priority.
                    // We want visible meshes to be fetched and drawn first
                    if (self.frustum.chunkVisible(chunkId, chunkPosition)) {
                        addPriority(distanceAway, chunkId);
                    } else {
                        addPriority(distanceAway + drawDistance, chunkId);
                    }
                    chunkDistances[ chunkId ] = distanceAway;
                }
            }
        );

        var prioritized = [];
        for (var i = 0; i < priority.length; i++) {
            Array.prototype.push.apply(prioritized, priority[i]);
        }

        self.chunkDistances = chunkDistances;
        self.sentClientChunks = sentClientChunks;
        self.sentClientMeshes = sentClientMeshes;
        self.chunkPriority = chunkPriority;

        // Voxel data we need that's not yet in cache
        self.missingChunks = missingChunks;
        //var requestedChunks = {};
        self.clientMissingChunks = clientMissingChunks;
        self.clientMissingMeshes = clientMissingMeshes;


        var requestClosure = function(chunkId) {
            return function(done) {
                var req = new XMLHttpRequest();
                req.open("GET", config.httpServer + "/chunk/" + chunkId, true);
                req.responseType = "arraybuffer";
                req.onload = function (oEvent) {
                    delete self.requestedChunks[chunkId];

                    if (!req.response) {
                        done();
                        return;
                    } // Note: not oReq.responseText

                    // No longer care about this chunk
                    if (!(chunkId in self.chunkDistances)) {
                        done();
                        return;
                    }

                    var position = chunkId.split('|').map(function(value) {
                        return Number(value);
                    });
                    chunkCache[chunkId] = {
                        chunkID: chunkId,
                        position: position,
                        voxels: new Uint8Array(req.response)
                    };
                    done();
                };
                // Handle error
                req.send(null);
                return req;
            };
        };
        // Fetch chunk voxel data that we need
        for (var chunkId in self.missingChunks) {
            if (!(chunkId in self.requestedChunks)) {
                MaxConcurrent( requestClosure(chunkId) );
                self.requestedChunks[chunkId] = true;
            }
        }

        // Ignore chunks we no longer care about
        var chunkIds = Object.keys(this.requestedChunks);
        for (var i = 0; i < chunkIds.length; i++) {
            var chunkId = chunkIds[i];
            if (!(chunkId in chunkDistances)) {
                //this.neededChunks[chunkId].abort();
                delete this.requestedChunks[chunkId];
            }
        }

        postMessage(
            ['meshesToShow', chunkDistances]
        );
        postMessage(
            ['nearbyChunks', nearbyVoxels]
        );

        log('nearbyVoxels', nearbyVoxels);
    },

    /*
    We queue up chunks when we receive them from the server. This method decodes them and meshes them,
    in preparation for rendering.
    */
    processChunks: function() {
        var self = this;

        // Transfer voxel data to client
        for (var chunkId in self.clientMissingChunks) {
            if (chunkId in chunkCache) {
                postMessage(
                    ['chunkVoxels', chunkCache[ chunkId ]]
                );
                delete self.clientMissingChunks[chunkId];
                self.sentClientChunks[chunkId] = true;
            }
        }


        var chunkIds = Object.keys(self.clientMissingMeshes);
        for (var i = 0; i < chunkIds.length; i++) {
            var chunkId = chunkIds[i];
            if (!(chunkId in chunkCache)) {
                // Waiting for chunk data to arrive
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
            delete self.clientMissingMeshes[chunkId];
            self.sentClientMeshes[chunkId] = true;

            // Stop after sending 10 meshes, to make sure we send voxel data in a timely manner
            if (i > 9) {
                break;
            }
        }
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

        //pool.free('uint8', chunk.voxels);
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

setInterval(
    function() {
        worker.processChunks();
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
