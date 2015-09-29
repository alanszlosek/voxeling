var Generator = require('voxel-generator');

var inherits = require('util').inherits;

var fs = require('fs');

var noise = require('perlin').noise;

module.exports = ServerGenerator;

var debug = true;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function ServerGenerator(cache, chunkSize, folder) {
    Generator.call(this, cache, chunkSize);
    this.chunkFolder = folder;
}

inherits(ServerGenerator, Generator);

ServerGenerator.prototype.generateChunk = function(chunk) {
    var self = this;
    var chunkID = chunk.chunkID;
    var filename = chunkID.replace(/\|/g, '.').replace(/-/g, 'n');
    if (debug) console.log('ServerGenerator:generateChunk ' + chunkID);
    fs.readFile(this.chunkFolder + filename, function(err, data) {
        if (err) {
            //console.log('No chunk file ' + filename)
            chunk.voxels = new Uint8Array(self.chunkArraySize);
            //self.fillChunkVoxels(chunk, generateVoxel, self.chunkSize)
            self.fillChunk(chunk, self.chunkSize);
            self.cacheChunk(chunk);
            delete self.chunksToGenerate[chunkID];
            self.emit('chunkGenerated', chunk);
            return;
        }
        if (debug) console.log('Loaded ' + filename);
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

// flat checkerboard of grass and brick
/*
var generateVoxel = function(x, y, z) {
  if (y == 0) {
    if (x % 2) {
      return (z % 2 ? 2 : 1)
    } else {
      return (z % 2 ? 1 : 2)
    }
    return 1 // grass and dirt
  }
  return 0
}
*/
var floor = 0;

var ceiling = 20;

// minecraft's limit
var divisor = 50;

var seed = 8484747474747;

noise.seed(seed);

ServerGenerator.prototype.fillChunk = function(chunk, width) {
    var position = chunk.position;
    var startX = position[0];
    var startY = position[1];
    var startZ = position[2];
    var voxels = chunk.voxels;
    pointsInside(startX, startZ, width, function(x, z) {
        var n = noise.simplex2(x / divisor, z / divisor);
        var y = ~~scale(n, -1, 1, floor, ceiling);
        if (y === floor || startY < y && y < startY + width) {
            var xidx = Math.abs((width + x % width) % width);
            var yidx = Math.abs((width + y % width) % width);
            var zidx = Math.abs((width + z % width) % width);
            var idx = xidx + yidx * width + zidx * width * width;
            voxels[idx] = 1;
            // now that we've set the crust, loop down and create earth underneath
            for (var i = y; i >= startY; i--) {
                var idx = xidx + Math.abs((width + i % width) % width) * width + zidx * width * width;
                voxels[idx] = 1;
            }
        }
    });
};

function pointsInside(startX, startY, width, func) {
    for (var x = startX; x < startX + width; x++) for (var y = startY; y < startY + width; y++) func(x, y);
}

function scale(x, fromLow, fromHigh, toLow, toHigh) {
    return (x - fromLow) * (toHigh - toLow) / (fromHigh - fromLow) + toLow;
}