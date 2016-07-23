var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var pool = require('../lib/object-pool');
var log = require('./log')('lib/game', false);

// miscellaneous state
var previousTimeStamp = 0;

var Game = function(config, voxels, coordinates, player, frustum, callbacks) {
    var self = this;
    this.currentVoxel = new Array(3);
    // if this is vec3.create(), floating point messes things up
    this.lastRegion = [ 0, 0, 0 ];
    this.voxels = voxels;
    this.player = player;
    this.frustum = frustum;
    this.callbacks = callbacks;

    // Extract relevant values from config
    this.config = config;
    this.coordinates = coordinates;

    // Meshes we currently have. chunkID => mesh object
    this.currentMeshes = {};
    // Same as above, but for voxel arrays
    this.currentVoxels = {};
};

/*
Getting tired and confused. Trying to simplify handling of mesh and voxel cache. Game needs some access, but I'd like lib/client to not have to go to game for all operations. Hum. Needs a rethink
*/

Game.prototype.showMesh = function(chunkID, mesh) {
    this.voxels.addVoxelMesh(chunkID, mesh);
    this.currentMeshes[ chunkID ] = mesh;
};

Game.prototype.storeVoxels = function(chunk) {
    var chunkID = chunk.chunkID;
    log('Game.storeVoxels: storing voxels for ' + chunkID);
    this.currentVoxels[ chunkID ] = chunk;
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

    log('Game.regionChange: playerPosition is', playerPosition);

    // These help us remove voxels and meshes we no longer need
    var nearbyMeshes = {};
    var nearbyVoxels = {};
    // We tell our web worker about these, so it knows what to fetch and return
    var onlyTheseMeshes = [];
    var onlyTheseVoxels = [];
    var missingMeshes = [];
    var missingVoxels = [];

    /*
    Venn-diagram-ish:
        onlyTheseMeshes > onlyTheseVoxels
    */

    var len = self.config.drawDistance * 3;
    var priority = new Array(len);
    for (var i = 0; i < len; i++) {
        priority[i] = [];
    }
    var addPriority = function(level, chunkID) {
        log('Game.regionChange.addPriority: level', level);
        priority[level].push(chunkID);
    };

    // Hmm, I seem to have removed the removeDistance logic. do we still want that 1 chunk buffer zone?

    this.coordinates.nearbyChunkIDsEach(
        playerPosition,
        self.config.removeDistance,
        function(chunkID, chunkPosition, distanceAway) {
            // We only care about voxel data for the current chunk, and the ring around us
            if (distanceAway < 2) {
                nearbyVoxels[chunkID] = 0;
                onlyTheseVoxels.push(chunkID);
                if (!(chunkID in self.currentVoxels)) {
                    missingVoxels.push(chunkID);
                }
            }
            // We only care about meshes up to our draw distance
            if (distanceAway <= self.config.removeDistance) {
                nearbyMeshes[chunkID] = 0;
                onlyTheseMeshes.push(chunkID);
                if (!(chunkID in self.currentMeshes)) {
                    missingMeshes.push(chunkID);
                }
            }
            
            // Set fetch priority
            if (distanceAway < 2) {
                addPriority(distanceAway, chunkID);
            } else if (distanceAway <= self.config.drawDistance) {
                // If outside frustum, add config.drawDistnace to distanceAway as priority
                // Use frustum to determine our fetch priority.
                // We want visible meshes to be fetched and drawn first
                if (self.frustum.chunkVisible(chunkID, chunkPosition)) {
                    addPriority(distanceAway, chunkID);
                } else {
                    addPriority(distanceAway + self.config.removeDistance, chunkID);
                }
            } else if (distanceAway <= self.config.removeDistance) {

            }
        }
    );

    var prioritized = [];
    for (var i = 0; i < priority.length; i++) {
        Array.prototype.push.apply(prioritized, priority[i]);
    }

    self.callbacks.updateNeeds(prioritized, onlyTheseMeshes, onlyTheseVoxels, missingMeshes, missingVoxels);

    log('nearbyVoxels', nearbyVoxels);

    // Remove meshes we don't need any more
    var chunkIds = Object.keys(self.currentMeshes);
    for (var i = 0; i < chunkIds.length; i++) {
        var chunkId = chunkIds[i];
        if (chunkId in nearbyMeshes) {
            // If it's nearby don't remove, we want it to be visible
            continue;
        }
        var mesh = self.currentMeshes[ chunkId ];

        this.voxels.removeChunkMesh(chunkId);
        self.callbacks.releaseMesh(mesh);
        delete self.currentMeshes[ chunkId ];
    }

    var chunkIds = Object.keys(self.currentVoxels);
    for (var i = 0; i < chunkIds.length; i++) {
        var chunkId = chunkIds[i];
        // If a chunk is visible it should be in cache. If it's not visible, shouldn't be in chunkCache
        if (chunkId in nearbyVoxels) {
            continue;
        }
        log('Game.regionChange removing from currentVoxels', chunkId)
        var chunk = self.currentVoxels[ chunkId ];
        self.callbacks.releaseVoxels(chunk);
        delete self.currentVoxels[chunkId];
    }
};

// This is only used for collision detection
Game.prototype.getBlock = function(x, y, z) {
    var chunkID = this.coordinates.coordinatesToChunkID(x, y, z);
    if (chunkID in this.currentVoxels) {
        var voxelIndex = this.coordinates.coordinatesToVoxelIndex(x, y, z);
        var voxelValue = this.currentVoxels[chunkID].voxels[voxelIndex];
        // Uncomment the following when I'm ready to make water walkable
        return (voxelValue > 0); // && voxelValue != 6);
    } else {
        log('Game.getBlock: chunkid not found');
    }
    // if chunk doesn't exist, act like it's full of blocks (keep player out)
    return 1;
};

// Think we should have a fourth parameter that gets filled with details so we don't have to construct a chunkVoxelIndexValue afterwards
/*
Modifies the chunkVoxelIndexValue data structure
*/
Game.prototype.setBlock = function(x, y, z, value, chunkVoxelIndexValue, touching) {
    var parts = this.coordinates.coordinatesToChunkAndVoxelIndex(x, y, z, touching);
    var chunkID = parts[0];
    var voxelIndex = parts[1];
    this.currentVoxels[chunkID].voxels[voxelIndex] = value;

    // Maybe some memoize setup could help with this
    if (chunkID in chunkVoxelIndexValue) {
        chunkVoxelIndexValue[chunkID].push(voxelIndex, value);
    } else {
        chunkVoxelIndexValue[chunkID] = [
            voxelIndex,
            value
        ];        
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