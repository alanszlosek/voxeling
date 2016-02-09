var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var pool = require('../lib/object-pool');

// miscellaneous state
var previousTimeStamp = 0;

var st;

var Game = function(config, voxels, coordinates, player, callbacks) {
    var self = this;
    this.currentVoxel = new Array(3);
    // if this is vec3.create(), floating point messes things up
    this.lastRegion = [ 0, 0, 0 ];
    this.voxels = voxels;
    this.player = player;
    this.callbacks = callbacks;

    // Extract relevant values from config
    this.config = config;
    this.coordinates = coordinates;

    // Meshes we currently have. chunkID => mesh object
    this.currentMeshes = {};
    // Meshes we should have / want. chunkID => true
    this.nearbyMeshes = {};
    // Same as above, but for voxel arrays
    this.currentVoxels = {};
    this.nearbyVoxels = {};
};

/*
Getting tired and confused. Trying to simplify handling of mesh and voxel cache. Game needs some access, but I'd like lib/client to not have to go to game for all operations. Hum. Needs a rethink
*/

Game.prototype.showMesh = function(chunkID, mesh) {
    if (chunkID in this.nearbyMeshes) {
        this.voxels.addVoxelMesh(chunkID, mesh);
        this.currentMeshes[chunkID] = true;
    } else {
        // Got a mesh that we no longer want
        if (chunkID in this.currentMeshes) {
            // We also already had a mesh, somehow it didn't get cleaned up
            this.callbacks.releaseMesh(mesh);
            this.callbacks.releaseMesh( this.currentMeshes[chunkID] );
            delete this.currentMeshes[ chunkID ];
        } else {
            this.callbacks.releaseMesh(mesh);
        }
    }
};

Game.prototype.storeVoxels = function(chunk) {
    var chunkID = chunk.chunkID;
    if (chunkID in this.nearbyVoxels) {
        this.currentVoxels[ chunkID ] = chunk;
    } else {
        if (chunkID in this.currentVoxels) {
            delete this.currentVoxels[ chunkID ];
        }
    }
};

Game.prototype.positionChange = function(position) {
    var thisRegion = this.coordinates.positionToChunk(position);
    var lastRegion = this.lastRegion;
    if (thisRegion[0] !== lastRegion[0] || thisRegion[1] !== lastRegion[1] || thisRegion[2] !== lastRegion[2]) {
        this.regionChange(position);
    }
    this.lastRegion = thisRegion;
};

Game.prototype.regionChange = function(playerPosition) {
    var self = this;
    // These chunks are the only ones allowed to be visible
    this.nearbyMeshes = {};
    this.nearbyVoxels = {};

    var chunksWanted = {};
    var chunksToRequest = [];
    var voxelsToRequest = [];

    this.coordinates.nearbyChunkIDsEach(
        playerPosition,
        self.config.removeDistance,
        function(chunkID, distanceAway) {
            // Count those within our remove distance as nearby
            self.nearbyMeshes[chunkID] = true;

            // But only request if they're within our drawDistance
            if (distanceAway <= self.config.drawDistance && !(chunkID in self.currentMeshes)) {
                chunksToRequest.push(chunkID);
                // If we're requesting chunks, no need to request the same voxels
            }

            // And we only ever care about voxel block data within a 3x3x3 cube
            if (distanceAway < 2) {
                self.nearbyVoxels[chunkID] = true;

                // Only request voxels for this chunk if we already have the mesh
                if (chunkID in self.currentMeshes && !(chunkID in self.currentVoxels)) {
                    voxelsToRequest.push(chunkID);
                }
            }
        }
    );
    // Request meshes we don't have
    if (chunksToRequest.length > 0) {
        this.callbacks.requestChunks(chunksToRequest);
    }
    if (voxelsToRequest.length > 0) {
        this.callbacks.requestVoxels(voxelsToRequest);
    }

    // Remove meshes we don't need any more
    for (var chunkID in self.currentMeshes) {
        if (chunkID in self.nearbyMeshes) {
            // If it's nearby don't remove, we want it to be visible
            continue;
        }
        var mesh = self.currentMeshes[ chunkID ];

        this.voxels.removeChunkMesh(chunkID);
        self.callbacks.releaseMesh(mesh);

        delete self.currentMeshes[ chunkID ];
    }

    for (var chunkID in self.currentVoxels) {
        // If a chunk is visible it should be in cache. If it's not visible, shouldn't be in chunkCache
        if (!(chunkID in self.nearbyVoxels)) {
            var chunk = self.currentVoxels[ chunkID ];
            self.callbacks.releaseVoxels(chunk);
            delete self.currentVoxels[chunkID];
        }

    }
};

Game.prototype.voxelAtPosition = function(position) {
    var chunkID = this.coordinates.positionToChunkID(position);
    if (chunkID in this.currentVoxels) {
        var voxelIndex = this.coordinates.positionToVoxelIndex(position);
        return this.currentVoxels[chunkID].voxels[voxelIndex];
    }
    return 0;
};

Game.prototype.getBlock = function(x, y, z) {
    var chunkID = this.coordinates.coordinatesToChunkID(x, y, z);
    if (chunkID in this.currentVoxels) {
        var voxelIndex = this.coordinates.coordinatesToVoxelIndex(x, y, z);
        return this.currentVoxels[chunkID].voxels[voxelIndex];
    } else {
        console.log('chunkid not found');
    }
    // if chunk doesn't exist, act like it's full of blocks (keep player out)
    return 1;
};

Game.prototype.setBlock = function(x, y, z, value) {
    var chunkID = this.coordinates.coordinatesToChunkID(x, y, z);
    if (chunkID in this.currentVoxels) {
        var voxelIndex = this.coordinates.coordinatesToVoxelIndex(x, y, z);
        this.currentVoxels[chunkID].voxels[voxelIndex] = value;
        this.callbacks.requestMesh( chunkID );
        return [voxelIndex, value, chunkID];
    }
};

// When webworker gets voxel changes, lib/client relays them here
Game.prototype.updateVoxelCache = function(changes) {
    var self = this;
    for (var chunkID in changes) {
        if (chunkID in self.currentVoxels) {
            var chunk = self.currentVoxels[chunkID];
            var details = changes[chunkID];
            for (var i = 0; i < details.length; i += 2) {
                var index = details[i];
                var val = details[i + 1];
                chunk.voxels[index] = val;
            }
        }
    }
};

// drawing and whatnot
Game.prototype.tick = function() {
    this.positionChange(this.player.getPosition());
};

Game.prototype.setPlayers = function(players) {
    return;
};

module.exports = Game;