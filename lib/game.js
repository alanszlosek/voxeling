var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var pool = require('../lib/object-pool');

// miscellaneous state
var previousTimeStamp = 0;

var st;

var Game = function(config, voxels, generator, mesher, coordinates, player) {
    var self = this;
    this.currentVoxel = new Array(3);
    // if this is vec3.create(), floating point messes things up
    this.lastRegion = [ 0, 0, 0 ];
    this.voxels = voxels;
    this.player = player;
    // Extract relevant values from config
    this.chunkCache = config.chunkCache;
    this.config = config;
    this.generator = generator;
    this.coordinates = coordinates;
    this.mesher = mesher;
    // Chunks currently being shown
    this.visibleChunks = {};
    // Chunks we'll show when generator gives them to us
    this.requestedChunks = {};
    // Queue of chunks to draw or remove the next time we get around to such things
    this.chunksToDraw = {};
    this.ticktock = false;
    generator.on('chunkGenerated', function(chunk) {
        // Do we still care about this chunk?
        // TODO: if we don't care about this chunk, client shouldn't bother decoding it
        if (chunk.chunkID in self.requestedChunks) {
            delete self.requestedChunks[chunk.chunkID];
            self.cacheAndDrawChunk(chunk);
        }
    });
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
        if (chunk) {
            pool.free('uint8', chunk.voxels);
            // TODO: free meshes, too
            chunk.voxels = null;
            if ('mesh' in chunk) {
                for (var textureValue in chunk.mesh) {
                    var textureMesh = chunk.mesh[textureValue];
                    textureMesh.position.free();
                    textureMesh.texcoord.free();
                }
                chunk.mesh = null;
            }
        }
        delete this.chunkCache[chunkID];
        delete this.chunksToDraw[chunkID];
        delete this.visibleChunks[chunkID];
        delete this.requestedChunks[chunkID];
        // we no longer care about this chunk. If generator takes a long time to return it, ignore it
        this.voxels.removeChunkMesh(chunkID);
    }
    this.requestNearbyMissingChunks(playerPosition);
};

Game.prototype.requestNearbyMissingChunks = function(position) {
    var self = this;
    this.coordinates.nearbyChunkIDsEach(position, this.config.horizontalDistance, this.config.verticalDistance, function(chunkID) {
        // If a chunk is visible it should be in cache. If it's not visible, shouldn't be in chunkCache
        if (!(chunkID in self.visibleChunks)) {
            self.requestedChunks[chunkID] = true;
            self.generator.requestChunk(chunkID);
        }
    });
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
    this.chunkCache[chunk.chunkID] = chunk;
    this.drawChunkNextUpdate(chunk.chunkID);
};

// TODO: not quite sure how to push meshes into webgl
Game.prototype.showChunk = function(chunkID) {
    var chunk = this.chunkCache[chunkID];
    var meshed = this.mesher.mesh(chunk.position, chunk.voxels);
    chunk.mesh = meshed;
    // Use chunkID for the id of this chunk's buffers
    this.voxels.addVoxelMesh(chunk.chunkID, meshed);
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
        return [ chunkID, voxelIndex, value ];
    }
};

/*
Game.prototype.raycast = function(normals) {
  var distance = 10
  var position = self.scene.camera.getPosition()
  var direction = [ self.scene.camera.inverse[2], self.scene.camera.inverse[6], self.scene.camera.inverse[10] ]
  var hit = raycast(game, position, direction, distance, this.currentVoxel, normals)
  if (hit > 0) {
    this.currentVoxel[0] = Math.floor(this.currentVoxel[0])
    this.currentVoxel[1] = Math.floor(this.currentVoxel[1])
    this.currentVoxel[2] = Math.floor(this.currentVoxel[2])
    return this.currentVoxel
  }
  return null
}
*/
// drawing and whatnot
Game.prototype.tick = function() {
    if (this.ticktock) {
        this.drawChunks();
        this.ticktock = false;
    } else {
        this.generator.generateChunks();
        this.ticktock = true;
    }
    this.positionChange(this.player.getPosition());
};

/*
Game.prototype.tickInput = function(delta) {
  // for gamepad support
  
  self.scene.camera.rotateY(cameraRotation)
  self.scene.camera.pitchDelta(cameraPitch)
  cameraRotation = 0
  cameraPitch = 0

  // Change highlight - but this is off by one somehow
  var lo = this.raycast(10)
  if (lo != null) {
    var hi = [lo[0] + 1, lo[1] + 1, lo[2] + 1]
    self.scene.lines.fill( Shapes.cube(lo, hi) )
  } else {
    // clear
    self.scene.lines.skip(true)
  }
}
*/
Game.prototype.setPlayers = function(players) {
    return;
};

module.exports = Game;