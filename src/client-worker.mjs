import config from '../config';
import { Coordinates } from './lib/coordinates';
//import mesher from './lib/meshers/horizontal-merge2';
import { RectangleMesher } from '../src/lib/meshers/rectangle9.mjs';
import Log from './lib/log';
import MC from './lib/max-concurrent';
import textureOffsets from '../texture-offsets';
import pool from './lib/object-pool.mjs';
import timer from './lib/timer';

// Note: Increasing concurrent fetching here won't change initial world load speed
// since the meshing is most-likely the bottleneck
let MaxConcurrent = MC(10);
var chunkArrayLength = config.chunkSize * config.chunkSize * config.chunkSize;
var chunkCache = {};

var log = Log('client-worker');
var debug = true;

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

    /*
    When we change regions:

    - need to know which chunk voxel data we don't have
        - compare previous chunkDistances with current chunkDistances
    - which voxels need to be sent to the client
        - compare previous sentVoxels with current setVoxels
    - which voxels need to be meshed and sent to client
        - compare previous sentMeshes with current sentMeshes
    */
    nearbyChunks: {},
    chunkDistances: {},
    sentClientChunks: {},
    sentClientMeshes: {},

    // Voxel data we need that's not yet in cache
    missingChunks: {},
    requestedChunks: {},
    clientMissingChunks: {},
    clientMissingMeshes: {},

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
        var websocket = this.connection = new WebSocket(config.websocketServer);

        //mesher.config(config, config.voxels, textureOffsets, coordinates, chunkCache);
        this.mesher = new RectangleMesher(config, config.voxels, textureOffsets, coordinates);

        websocket.onopen = function() {
            self.connected = true;
            if (debug) {
                log('websocket connection opened');
            }
            postMessage(['open']);
        };

        websocket.onclose = function() {
            self.connected = false;
            if (debug) {
                log('websocket connection closed');
            }
            postMessage(['close']);
        };

        websocket.onerror = function(message) {
            log('websocket error, ' + message);
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
                        log('got settings', payload);
                    }
                    postMessage(['settings', payload['settings'], payload['id']]);
                    break;
                // fires when server sends us voxel edits [chunkID, voxelIndex, value, voxelIndex, value...]
                case 'chunkVoxelIndexValue':
                    var changes = payload;
                    // Tell the client
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
                            self.clientMissingMeshes[ chunkID ] = true;
                            if (chunkID in self.nearbyChunks) {
                                self.clientMissingChunks[ chunkID ] = true;
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
                    console.log('WebWorker received unexpected message type from server: ' + type);
                    break;
            }
        };

    },

    regionChange: function(playerPosition, drawDistance) {
        var self = this;

        log('regionChange: playerPosition is', playerPosition);

        // Helps us ignore chunks we don't care about, and also prioritize re-drawing nearby chunks
        var chunkDistances = {};
        var sentClientChunks = {};
        var sentClientMeshes = {};

        // Voxel data we need that's not yet in cache
        var missingChunks = {};
        var clientMissingChunks = {};
        var clientMissingMeshes = {};

        var nearbyChunks = {};


        var requestClosure = function(chunkId, position) {
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

        this.coordinates.nearbyChunkIDsEach(
            playerPosition,
            drawDistance,
            function(chunkId, chunkPosition, distanceAway) {
                // Don't request chunks beyond our world radius
                if (self.chunkOutOfBounds(chunkPosition)) {
                    return;
                }

                if (!(chunkId in chunkCache)) {
                    if (!(chunkId in self.requestedChunks)) {
                        MaxConcurrent( requestClosure(chunkId, chunkPosition) );
                        // TODO: shoudl probably keep a handle to the request so we can cancel it if we no longer care
                        self.requestedChunks[chunkId] = true;
                    }
                }

                // We only care about voxel data for the current chunk, and the ring around us
                if (distanceAway < 3) {
                    // If we previous sent this voxel to the client, no need to re-send
                    if (chunkId in self.sentClientChunks) {
                        sentClientChunks[chunkId] = true;
                    } else {
                        clientMissingChunks[chunkId] = true;
                    }
                    nearbyChunks[chunkId] = true;
                }

                if (chunkId in self.sentClientMeshes) {
                    sentClientMeshes[chunkId] = true;
                } else {
                    clientMissingMeshes[chunkId] = true;
                }
                
                chunkDistances[ chunkId ] = distanceAway;
            }
        );

        self.nearbyChunks = nearbyChunks;
        self.chunkDistances = chunkDistances;
        self.sentClientChunks = sentClientChunks;
        self.sentClientMeshes = sentClientMeshes;
        self.clientMissingChunks = clientMissingChunks;
        self.clientMissingMeshes = clientMissingMeshes;


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
            ['nearbyChunks', nearbyChunks]
        );

        log('nearbyChunks', nearbyChunks);
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
            //var mesh = mesher.mesh(chunk.position, chunk.voxels);
            var mesh = this.mesher.run(chunk.position, chunk.voxels);

            var transfer = {};
            var transferList = [];

            // points are meshed into a buffer group per faceIndex
            for (var bufferGroupId in mesh) {
                var bufferGroup = mesh[bufferGroupId];

                // We pass data.buffer, the underlying ArrayBuffer
                transfer[bufferGroupId] = {
                    position: {
                        buffer: bufferGroup.position.data.buffer,
                        offset: bufferGroup.position.offset,
                        offsetBytes: bufferGroup.position.offset * 4,
                        tuples: bufferGroup.position.offset / 3
                    },
                    texcoord: {
                        buffer: bufferGroup.texcoord.data.buffer,
                        offset: bufferGroup.texcoord.offset,
                        offsetBytes: bufferGroup.texcoord.offset * 4
                    }
                };
                transferList.push(bufferGroup.position.data.buffer);
                transferList.push(bufferGroup.texcoord.data.buffer);
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
                self.clientMissingMeshes[ chunkID ] = true;
            }
        }

        // Along with these voxel changes, there may be nearby chunks that we need to re-mesh
        // so we don't "see through the world"
        for (var chunkID in touching) {
            if (chunkID in chunkCache) {
                self.clientMissingMeshes[ chunkID ] = true;
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

/*
setInterval(
    function() {
        timer.print();
    },
    10000
);
*/