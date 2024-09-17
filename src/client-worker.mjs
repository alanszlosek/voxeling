import config from '../config-client.mjs';
import { Coordinates } from './lib/coordinates.mjs';
import distances from './lib/distances.mjs';
//import mesher from './lib/meshers/horizontal-merge2';
import { RectangleMesher } from '../src/lib/meshers/rectangle12.mjs';
import Log from './lib/log.mjs';
import MC from './lib/max-concurrent.js';
import textureOffsets from '../texture-offsets.js';
import pool from './lib/object-pool.mjs';
//import timer from './lib/timer';

// Note: Increasing concurrent fetching here won't change initial world load speed
// since the meshing is most-likely the bottleneck
let MaxConcurrent = MC(10);
var chunkArrayLength = config.chunkSize * config.chunkSize * config.chunkSize;
var chunkCache = {};

var logger = Log(["none"])('client-worker');
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

let workerLocation = self.location;

var worker = {
    coordinates: null,
    connected: false,
    connection: null,

    /*
    When we change regions:

    - need to know which chunk voxel data we don't have
        - compare previous chunkDistances with current chunkDistances
    - which voxels need to be sent to the client
        - compare previous sentVoxels with current setVoxels
    - which voxels need to be meshed and sent to client
        - compare previous sentMeshes with current sentMeshes
    */
    chunkDistances: {}, // the chunks we care about for current region and drawDistance
    nearbyChunks: {}, // chunk voxels the client cares about (for collision detection and building)
    nearCutoff: 3,
    chunksToRequest: {}, // chunks not yet in our chunkCache
    numChunkRequests: 0, // for concurrency control
    requestedChunks: {}, // chunks we've started fetching
    clientNeedsVoxels: {},
    clientNeedsMeshes: {},
    clientHasVoxels: {}, // which chunks we've sent voxel data to client
    clientHasMeshes: {}, // which chunks we've meshed and sent to client
    requestorHandle: null,

    // Keep track of world boundaries
    lastWorldChunks: [
        // Lower chunk
        -(config.chunkSize * config.worldRadius),
        -(config.chunkSize * config.worldRadius),
        -(config.chunkSize * config.worldRadius),

        // Farther chunk
        config.chunkSize * config.worldRadius,
        config.chunkSize * config.worldRadius,
        config.chunkSize * config.worldRadius
    ],

    connect: function() {
        var self = this;
        var coordinates = this.coordinates = new Coordinates(config.chunkSize);

        // Prepare server URLs using worker location 
        config.websocketServer = new URL(workerLocation);
        if (workerLocation.protocol == 'https:') {
            config.websocketServer.protocol = 'wss:';
        } else {
            config.websocketServer.protocol = 'ws:';
        }
        config.websocketServer.pathname = '/ws';
        config.httpServer = new URL(workerLocation);
        config.httpServer.pathname = '';
        

        var websocket = this.connection = new WebSocket(config.websocketServer);

        //mesher.config(config, config.voxels, textureOffsets, coordinates, chunkCache);
        this.mesher = new RectangleMesher(config, config.voxels, textureOffsets, coordinates);

        websocket.onopen = function() {
            self.connected = true;
            if (debug) {
                logger('websocket connection opened');
            }
            postMessage(['open']);
        };

        websocket.onclose = function() {
            self.connected = false;
            if (debug) {
                logger('websocket connection closed');
            }
            postMessage(['close']);
        };

        websocket.onerror = function(message) {
            logger('websocket error, ' + message);
        };

        websocket.onmessage = function(event) {
            // Decode message
            // Handle errors and exceptions
            var decoded = JSON.parse(event.data);
            var type = decoded[0];
            var payload = decoded[1];
            switch (type) {
                case 'settings':
                    if (debug) {
                        logger('got settings', payload);
                    }
                    postMessage(['settings', payload['settings'], payload['id']]);
                    break;
                // fires when server sends us voxel edits [chunkID, voxelIndex, value, voxelIndex, value...]
                case 'chunkVoxelIndexValue':
                    var changes = payload;
                    // Tell the client
                    // TODO: why this? don't we resend voxels and meshes below if necessary?

                    postMessage(['chunkVoxelIndexValue', changes]);
                    // Update our local cache
                    for (var chunkID in changes) {
                        if (!(chunkID in self.chunkDistances)) {
                            continue;
                        }
                        if (chunkID in chunkCache) {
                            var chunk = chunkCache[chunkID];
                            var details = changes[chunkID];
                            for (var i = 0; i < details.length; i += 2) {
                                var index = details[i];
                                var val = details[i + 1];
                                chunk.voxels[index] = val;

                                // TODO: If changes are along a chunk boundary, re-mesh adjacent chunk
                            }
                            // Re-mesh this chunk
                            self.clientNeedsMeshes[ chunkID ] = true;
                            if (chunkID in self.nearbyChunks) {
                                self.clientNeedsChunks[ chunkID ] = true;
                            }
                        }
                    }
                    break;

                case 'chat':
                    postMessage(['chat', payload]);
                    break;

                case 'players':
                    postMessage(['players', payload]);
                    break;
                default:
                    console.logger('WebWorker received unexpected message type from server: ' + type);
                    break;
            }
        };
        this.requestChunks();

    },

    regionChange: function(playerPosition, drawDistance) {
        var self = this;

        logger('regionChange: playerPosition is', playerPosition);

        // Helps us ignore chunks we don't care about, and also prioritize re-drawing nearby chunks
        var chunkDistances = {};

        // Voxel data we need that's not yet in cache
        var missingChunks = {};
        var clientNeedsChunks = {};
        var clientNeedsMeshes = {};

        var nearbyChunks = {};


        playerPosition = this.coordinates.positionToChunk(playerPosition);
        // loop from here up to drawDistance
        for (let distanceAway = 0; distanceAway < drawDistance; distanceAway++) {
            let chunks = distances[distanceAway];
            chunks.forEach(function(chunkPosition) {
                let actualChunkPosition = [];
                for (let i = 0; i < 3; i++) {
                    actualChunkPosition[i] = playerPosition[i] + chunkPosition[i];
                }
                let chunkId = actualChunkPosition.join('|');

                chunkDistances[chunkId] = distanceAway;
                let nearby = false;
                if (distanceAway < self.nearCutoff) {
                    nearby = true;
                    nearbyChunks[chunkId] = true;
                }
                if (chunkId in chunkCache) {
                    if (nearby) {
                        if (!(chunkId in self.clientHasVoxels)) {
                            self.clientNeedsVoxels[chunkId] = true;
                        } else {
                            logger('Chunk ' + chunkId + ' in clientHasVoxels, skipping');
                        }
                    }
                    if (!(chunkId in self.clientHasMeshes)) {
                        self.clientNeedsMeshes[chunkId] = true;
                    } else {
                        logger('Chunk ' + chunkId + ' in clientHasMeshes, skipping');
                    }

                } else {
                    // Does client need voxels or meshes for it?
                    if (chunkId in self.requestedChunks) {
                        logger('Chunk ' + chunkId + ' in requestedChunks, skipping');
                        return;
                    }
                    if (chunkId in self.chunksToRequest) {
                        logger('Chunk ' + chunkId + ' in chunksToRequest, skipping');
                        return;
                    }
                    self.chunksToRequest[chunkId] = actualChunkPosition;
                }
            });
        }

        for (let chunkId in this.chunkCache) {
            if (!(chunkId in chunkDistances)) {
                delete this.chunkCache[chunkId];
            }
        }

        self.nearbyChunks = nearbyChunks;
        self.chunkDistances = chunkDistances;

        postMessage(
            ['chunksToShow', chunkDistances]
        );
        postMessage(
            ['nearbyChunks', nearbyChunks]
        );

        // clear our worker chunkCache?

        logger('nearbyChunks', nearbyChunks);
    },
    requestChunks: function() {
        let self = this;
        let next = function(delay) {
            setTimeout(
                self.requestChunks.bind(self),
                delay
            );
        };
        let keys = Object.keys(this.chunksToRequest);
        if (keys.length == 0) {
            // wait for more chunks
            next(100);
            return;
        }
        let maxConcurrent = 10;

        let num = Math.min(keys.length, maxConcurrent - self.numChunkRequests); // up to 5 concurrently
        for (let i = 0; i < num; i++) {
            let chunkId = keys[i];
            let chunkPosition = self.chunksToRequest[chunkId];
            delete self.chunksToRequest[chunkId];

            // Do we still want this chunk?
            if (!(chunkId in this.chunkDistances)) {
                // No, we don't
                continue;
            }

            // perhaps so we can cancel?
            self.requestedChunks[chunkId] = fetch(config.httpServer + "chunk/" + chunkId)
                .then(function(response) {
                    if (!response.ok) {
                        delete self.requestedChunks[chunkId];
                        self.numChunkRequests--;
                        if (self.numChunkRequests == 0) {
                            next(100);
                        }
                        return;
                    }
                    return response.arrayBuffer();
                })
                .then(function(body) {
                    self.numChunkRequests--;
                    delete self.requestedChunks[chunkId];
                    if (!(chunkId in self.chunkDistances)) {
                        // No longer care about this chunk
                        if (self.numChunkRequests == 0) {
                            next(100);
                        }
                        return;
                    }
                    let distanceAway = self.chunkDistances[chunkId];

                    chunkCache[chunkId] = {
                        chunkID: chunkId,
                        position: chunkPosition,
                        voxels: new Uint8Array(body)
                    };

                    // We only care about voxel data for the current chunk, and the ring around us
                    if (distanceAway < self.nearCutoff) {
                        if (!(chunkId in self.clientHasVoxels)) {
                            self.clientNeedsVoxels[chunkId] = true;
                        }
                    }
                    if (!(chunkId in self.clientHasMeshes)) {
                        self.clientNeedsMeshes[chunkId] = true;
                    }

                    if (self.numChunkRequests == 0) {
                        next(100);
                    }
                });
            self.numChunkRequests++;
        }
    },

    /*
    We queue up chunks when we receive them from the server. This method decodes them and meshes them,
    in preparation for rendering.
    */
    processChunks: function() {
        var self = this;

        // Transfer voxel data to client
        for (var chunkId in self.clientNeedsVoxels) {
            delete self.clientNeedsVoxels[chunkId];
            if (!(chunkId in self.chunkDistances) || self.chunkDistances[chunkId] >= self.nearCutoff) {
                // We no longer care about this chunk
                continue;
            }
            postMessage(
                ['chunkVoxels', chunkCache[ chunkId ]]
            );
            self.clientHasVoxels[chunkId] = true;
        }

        for (let chunkId in self.clientNeedsMeshes) {
            delete self.clientNeedsMeshes[chunkId];
            if (!(chunkId in self.chunkDistances)) {
                // We no longer care about this chunk
                continue;
            }

            var chunk = chunkCache[chunkId];
            //var mesh = mesher.mesh(chunk.position, chunk.voxels);
            var mesh = this.mesher.run(chunk.position, chunk.voxels);

            // don't burden the client by sending empty meshes
            let i = 0;
            if (Object.keys(mesh).length > 0) {
                // transferring work with a sparse array?
                var transfer = [];
                var transferList = [];

                // TODO: is there any way i can optimize this?
                // in terms of reducing GC, nesting, something?
                for (var bufferGroupId in mesh) {
                    var bufferGroup = mesh[bufferGroupId];

                    // We pass data.buffer, the underlying ArrayBuffer
                    transfer[bufferGroupId] = {
                        tuples: bufferGroup.position.offset / 3,
                        position: bufferGroup.position.data.buffer,
                        texcoord: bufferGroup.texcoord.data.buffer,
                        sampler: bufferGroup.sampler
                    };
                    transferList.push(bufferGroup.position.data.buffer);
                    transferList.push(bufferGroup.texcoord.data.buffer);
                }

                // specially list the ArrayBuffer object we want to transfer
                postMessage(
                    ['chunkMesh', chunkId, transfer],
                    transferList
                );
                i++;
            }
            self.clientHasMeshes[chunkId] = true;
            
            // Stop after sending N meshes, to make sure we send voxel data in a timely manner
            if (i > 16) {
                break;
            }
        }

        for (let chunkId in self.clientHasVoxels) {
            if (!(chunkId in self.chunkDistances) || self.chunkDistances[chunkId] > 1) {
                delete self.clientHasVoxels[chunkId];
            }
        }
        for (let chunkId in self.clientHasMeshes) {
            if (!(chunkId in self.chunkDistances)) {
                delete self.clientHasMeshes[chunkId];
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
                self.clientNeedsMeshes[ chunkID ] = true;
            }
        }

        // Along with these voxel changes, there may be nearby chunks that we need to re-mesh
        // so we don't "see through the world"
        for (var chunkID in touching) {
            if (chunkID in chunkCache) {
                self.clientNeedsMeshes[ chunkID ] = true;
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
        for (var bufferGroupId in mesh) {
            var bufferGroup = mesh[bufferGroupId];
            // We pass ArrayBuffers across worker boundary, so need to we-wrap in the appropriate type
            pool.free('float32', new Float32Array(bufferGroup.position.buffer));
            pool.free('float32', new Float32Array(bufferGroup.texcoord.buffer));
        }
    },
    /*
    Client no longer needs this chunk (voxels and mesh)
    Add the arrays back to the pool
    */
    freeChunk: function(chunk) {
        var mesh = chunk.mesh;
        for (var bufferGroupId in mesh) {
            var bufferGroup = mesh[bufferGroupId];
            bufferGroup.position.free();
            bufferGroup.texcoord.free();
        }

        //pool.free('uint8', chunk.voxels);
    },

    myPosition: function(position, yaw, pitch, avatar) {
        if (!worker.connected) {
            return;
        }
        
        // convert Float32Array to normal so comes out as array in JSON instead of object
        let p = [
            position[0],
            position[1],
            position[2]
        ];

        sendMessage(worker.connection, 'myPosition', [p, yaw, pitch, avatar]);
    },

    chunkOutOfBounds: function(position) {
        var self = this;
        if (
            // Check lower bound
            position[0] < self.lastWorldChunks[0] || position[1] < self.lastWorldChunks[1] || position[2] < self.lastWorldChunks[2]
            ||
            // Check upper bound
            position[0] > self.lastWorldChunks[3] || position[1] > self.lastWorldChunks[4] || position[2] > self.lastWorldChunks[5]
        ) {
            return true;
        }
        return false;
    }
}

onmessage = function(e) {
    var message = e.data;
    var type = message.shift();

    if (type in worker) {
        worker[type].apply(worker, message);
    } else {
        logger('worker does not have handler for ' + type, message);
    }
    
};

setInterval(
    function() {
        worker.processChunks();
    },
    // Ten times a second didn't seem fast enough
    1000 / 20
);


/*
setInterval(
    function() {
        timer.print();
    },
    10000
);
*/