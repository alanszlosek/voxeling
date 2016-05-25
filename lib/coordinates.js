var distances = require('./distances.js')

module.exports = function(opts) {
    return new Coordinates(opts)
};

//module.exports.Coordinates = Coordinates;

function Coordinates(chunkSize) {
    this.chunkSize = chunkSize || 32;

    if (this.chunkSize & this.chunkSize-1 !== 0) {
        throw new Error('chunkSize must be a power of 2');
    }
    this.voxelMask = this.chunkSize - 1;
    this.chunkMask = ~this.voxelMask;
};

Coordinates.prototype.nearbyChunkIDsEach = function(position, maxDistance, callback) {
    var current = this.positionToChunk(position);
    var x = current[0];
    var y = current[1];
    var z = current[2];

    for (var distanceAway = 0; distanceAway <= maxDistance; distanceAway++) {
        var chunks = distances[distanceAway];
        for (var j = 0; j < chunks.length; j++) {
            // Create a copy so we can modity
            var chunk = chunks[j].slice();
            chunk[0] += x;
            chunk[1] += y;
            chunk[2] += z;
            callback(chunk.join('|'), chunk, distanceAway);
        }
    }
};

// Use lower boundary as the chunk position/ID
Coordinates.prototype.coordinatesToChunkID = function(x, y, z) {
    var mask = this.chunkMask
    var cx = x & mask
    var cy = y & mask
    var cz = z & mask
    return cx + '|' + cy + '|' + cz
}

Coordinates.prototype.positionToChunk = function(position) {
    return this.coordinatesToChunk(position[0], position[1], position[2])
}

Coordinates.prototype.coordinatesToChunk = function(x, y, z) {
    var mask = this.chunkMask
    var cx = x & mask
    var cy = y & mask
    var cz = z & mask
    return [cx, cy, cz]
}

Coordinates.prototype.positionToChunkID = function(position) {
    return this.coordinatesToChunkID(position[0], position[1], position[2])
};

Coordinates.prototype.coordinatesToVoxelIndex = function(x, y, z) {
    var mask = this.voxelMask
    var mx = (x & mask)
    var my = (y & mask)
    var mz = (z & mask)
    //var val = chunk.voxels.get(mx, my, mz)
    var index = mx + (my*this.chunkSize) + (mz*this.chunkSize*this.chunkSize)
    return index
}

Coordinates.prototype.positionToVoxelIndex = function(pos) {
    return this.coordinatesToVoxelIndex(pos[0], pos[1], pos[2])
}