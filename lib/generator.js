//var stats = require('voxeling-stats')
var debug = false;

// Default is a flat world
var generateVoxel = function(x, y, z, chunkSize) {
    if (y < 1) {
        return 1; // grass and dirt
    }
    return 0;
}

var Generator = function(chunkSize) {
    if (!chunkSize) {
        throw new Exception('voxel-generator: chunkSize is required');
        return;
    }

    this.chunkSize = chunkSize;
    this.chunkArraySize = this.chunkSize * this.chunkSize * this.chunkSize;
    this.generateVoxel = generateVoxel;
}
module.exports = Generator


Generator.prototype.get = function(chunkID) {
    if (debug) {
        console.log('Generator:generateChunk ' + chunkID);
    }
    var started = Date.now();
    var chunk = this.makeChunkStruct(chunkID);
    this.fillChunkVoxels(chunk, this.generateVoxel, this.chunkSize);
    //stats('generateChunk', started);
    return chunk;
};


// TODO: this needs to be accessible outside an instance, right?
Generator.prototype.fillChunkVoxels = function(chunk, fn, chunkSize) {
    var lo = chunk.position;
    var ii = lo[0] + chunkSize;
    var jj = lo[1] + chunkSize;
    var kk = lo[2] + chunkSize;
    var index = 0;

    for(var k = lo[2]; k < kk; k++) {
        for (var j = lo[1]; j < jj; j++) {
            for (var i = lo[0]; i < ii; i++, index++) {
                chunk.voxels[index] = fn(i, j, k, chunkSize);
            }
        }
    }
};


Generator.prototype.makeChunkStruct = function(chunkID) {
    var position = chunkID.split('|').map(function(value) {
        return Number(value);
    });
    return {
        position: position,
        chunkID: chunkID,
        voxels: new Uint8Array(this.chunkArraySize)
    };
};

