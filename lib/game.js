var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var pool = require('../lib/object-pool');

// miscellaneous state
var previousTimeStamp = 0;

var st;

var Game = function(config, chunkCache, voxels, coordinates, player, requestChunks, releaseChunk) {
    var self = this;
    this.currentVoxel = new Array(3);
    // if this is vec3.create(), floating point messes things up
    this.lastRegion = [ 0, 0, 0 ];
    this.voxels = voxels;
    this.player = player;
    this.requestChunks = requestChunks;
    this.releaseChunk = releaseChunk;
    // Extract relevant values from config
    this.chunkCache = chunkCache;
    this.config = config;
    this.coordinates = coordinates;
    // Chunks currently being shown
    this.visibleChunks = {};
    // Queue of chunks to draw or remove the next time we get around to such things
    this.chunksToDraw = {};
};

Game.prototype.removeFarChunks = function(playerPosition) {
    // These chunks are the only ones allowed to be visible
    var nearbyChunks = {};
    this.coordinates.nearbyChunkIDsEach(playerPosition, this.config.horizontalRemoveDistance, this.config.verticalRemoveDistance, function(chunkID) {
        nearbyChunks[chunkID] = true;
    });
    for (var chunkID in this.visibleChunks) {
        if (chunkID in nearbyChunks) {
            // If it's nearby don't remove, we want it to be visible
            continue;
        }
        var chunk = this.chunkCache[chunkID];
        delete this.chunkCache[chunkID];
        delete this.chunksToDraw[chunkID];
        delete this.visibleChunks[chunkID];

        this.voxels.removeChunkMesh(chunkID);
        this.releaseChunk(chunk);
    }
    this.requestNearbyMissingChunks(playerPosition);
};

Game.prototype.requestNearbyMissingChunks = function(position) {
    var self = this;
    var chunks = [];
    this.coordinates.nearbyChunkIDsEach(position, this.config.horizontalDistance, this.config.verticalDistance, function(chunkID) {
        // If a chunk is visible it should be in cache. If it's not visible, shouldn't be in chunkCache
        if (!(chunkID in self.visibleChunks)) {
            chunks.push(chunkID);
        }
    });
    this.requestChunks(chunks);
};

Game.prototype.drawChunkNextUpdate = function(chunkID) {
    this.chunksToDraw[chunkID] = true;
};

Game.prototype.drawChunks = function() {
    var i = 1;
    var drawPerTick = 5;
    for (var chunkID in this.chunksToDraw) {
        // Draw whatever we've got
        this.drawChunk(chunkID);
        if (i >= drawPerTick) {
            break;
        }
        i++;
    }
};

Game.prototype.drawChunk = function(chunkID) {
    this.showChunk(chunkID);
    delete this.chunksToDraw[chunkID];
};

Game.prototype.drawAllChunks = function() {
    for (var chunkID in this.chunksToDraw) {
        this.showChunk(chunkID);
    }
    this.chunksToDraw = {};
};

Game.prototype.cacheAndDrawChunk = function(chunk) {
    var chunkID = chunk.chunkID;
    this.chunkCache[chunkID] = chunk;
    this.drawChunkNextUpdate(chunkID);
};

// TODO: not quite sure how to push meshes into webgl
Game.prototype.showChunk = function(chunkID) {
    var chunk = this.chunkCache[chunkID];
    // Use chunkID for the id of this chunk's buffers
    this.voxels.addVoxelMesh(chunkID, chunk.mesh);
    this.visibleChunks[chunkID] = true;
};

Game.prototype.positionChange = function(position) {
    var thisRegion = this.coordinates.positionToChunk(position);
    var lastRegion = this.lastRegion;
    if (thisRegion[0] !== lastRegion[0] || thisRegion[1] !== lastRegion[1] || thisRegion[2] !== lastRegion[2]) {
        this.regionChange(position);
    }
    this.lastRegion = thisRegion;
};

Game.prototype.regionChange = function(position) {
    this.removeFarChunks(position);
};

Game.prototype.voxelAtPosition = function(position) {
    var chunkID = this.coordinates.positionToChunkID(position);
    if (chunkID in this.chunkCache) {
        var voxelIndex = this.coordinates.positionToVoxelIndex(position);
        return this.chunkCache[chunkID].voxels[voxelIndex];
    }
    return 0;
};

Game.prototype.getBlock = function(x, y, z) {
    var chunkID = this.coordinates.coordinatesToChunkID(x, y, z);
    if (chunkID in this.chunkCache) {
        var voxelIndex = this.coordinates.coordinatesToVoxelIndex(x, y, z);
        return this.chunkCache[chunkID].voxels[voxelIndex];
    }
    // if chunk doesn't exist, act like it's full of blocks (keep player out)
    return 1;
};

Game.prototype.setBlock = function(x, y, z, value) {
    var chunkID = this.coordinates.coordinatesToChunkID(x, y, z);
    if (chunkID in this.chunkCache) {
        var voxelIndex = this.coordinates.coordinatesToVoxelIndex(x, y, z);
        this.chunkCache[chunkID].voxels[voxelIndex] = value;
        this.drawChunkNextUpdate(chunkID);
        return [voxelIndex, value, chunkID];
    }
};

// drawing and whatnot
Game.prototype.tick = function() {
    this.drawChunks();
    this.positionChange(this.player.getPosition());
};

Game.prototype.setPlayers = function(players) {
    return;
};

module.exports = Game;