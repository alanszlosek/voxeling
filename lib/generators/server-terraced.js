var Generator = require('voxel-generator');
var inherits = require('util').inherits;
var fs = require('fs');
var debug = true;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function ServerGenerator(cache, chunkSize, folder) {
    Generator.call(this, cache, chunkSize);
    this.chunkFolder = folder;
}

module.exports = ServerGenerator;
inherits(ServerGenerator, Generator);

ServerGenerator.prototype.generateChunk = function(chunk) {
    var self = this;
    var chunkID = chunk.chunkID;
    var filename = chunkID.replace(/\|/g, '.').replace(/-/g, 'n');
    if (debug) {
        console.log('ServerGenerator:generateChunk ' + chunkID);
    }
    fs.readFile(this.chunkFolder + filename, function(err, data) {
        if (err) {
            //console.log('No chunk file ' + filename)
            chunk.voxels = new Uint8Array(self.chunkArraySize);
            self.fillChunkVoxels(chunk, generateVoxel, self.chunkSize);
            self.cacheChunk(chunk);
            delete self.chunksToGenerate[chunkID];
            self.emit('chunkGenerated', chunk);
            return;
        }
        if (debug) {
            console.log('Loaded ' + filename);
        }
        chunk.voxels = data;
        self.cacheChunk(chunk);
        delete self.chunksToGenerate[chunkID];
    });
};

// 1 block rise, each ring of chunks out from center
var generateVoxel = function(x, y, z, chunkSize) {
    if (y == 0) {
        return 1;
    }
    if (y < 0) {
        // 5 in 50 chance of obsidian
        // 10 in 50 chance of empty
        // 1 in 50 chance of lava
        // 5 in 50 chance of granite
        // 5 in 50 chance of slate
        /*
    var chance = getRandomInt(1, 50)
    if (chance < 6) {
      return 4 // obsidian
    } else if (chance < 16) {
      return 0 // empty
    } else if (chance == 16) {
      return 7 // lava
    } else if (chance < 22) {
      return 13 // granite
    } else if (chance < 27) {
      return 19 //slate
    }
    */
        return 3;
    }
    var chunkX = Math.abs(Math.floor(x / chunkSize));
    //var chunkY = Math.abs(Math.floor(y / chunkSize))
    var chunkZ = Math.abs(Math.floor(z / chunkSize));
    var out = Math.max(chunkX, chunkZ);
    if (y <= out) {
        return 1;
    }
    return 0;
};