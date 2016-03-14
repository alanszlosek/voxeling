var distances = require('./distances.js')

module.exports = function(opts) {
    return new Coordinator(opts)
};

//module.exports.Coordinator = Coordinator;

function Coordinator(chunkSize) {
    this.chunkSize = chunkSize || 32;

    if (this.chunkSize & this.chunkSize-1 !== 0) {
        throw new Error('chunkSize must be a power of 2');
    }
    this.voxelMask = this.chunkSize - 1;
    this.chunkMask = ~this.voxelMask;
};

Coordinator.prototype.nearbyChunkIDsEach = function(position, distance, callback) {
    var current = this.positionToChunk(position);
    var x = current[0];
    var y = current[1];
    var z = current[2];

    for (var i = 0; i <= distance; i++) {
        var chunks = distances[i];
        for (var j = 0; j < chunks.length; j++) {
            var chunk = chunks[j];
            callback((x + chunk[0]) + '|' + (y + chunk[1]) + '|' + (z + chunk[2]), i);
        }
    }
};

// Use lower boundary as the chunk position/ID
Coordinator.prototype.coordinatesToChunkID = function(x, y, z) {
  var mask = this.chunkMask
  var cx = x & mask
  var cy = y & mask
  var cz = z & mask
  return cx + '|' + cy + '|' + cz
}

Coordinator.prototype.positionToChunk = function(position) {
  return this.coordinatesToChunk(position[0], position[1], position[2])
}

Coordinator.prototype.coordinatesToChunk = function(x, y, z) {
  var mask = this.chunkMask
  var cx = x & mask
  var cy = y & mask
  var cz = z & mask
  return [cx, cy, cz]
}

Coordinator.prototype.positionToChunkID = function(position) {
  return this.coordinatesToChunkID(position[0], position[1], position[2])
};

Coordinator.prototype.coordinatesToVoxelIndex = function(x, y, z) {
  var mask = this.voxelMask
  var mx = (x & mask)
  var my = (y & mask)
  var mz = (z & mask)
  //var val = chunk.voxels.get(mx, my, mz)
  var index = mx + (my*this.chunkSize) + (mz*this.chunkSize*this.chunkSize)
  return index
}

Coordinator.prototype.positionToVoxelIndex = function(pos) {
  return this.coordinatesToVoxelIndex(pos[0], pos[1], pos[2])
}