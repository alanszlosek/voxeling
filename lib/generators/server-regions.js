var Generator = require('../generator');
var inherits = require('util').inherits;
var fs = require('fs');
var noise = require('perlin').noise;
var debug = true;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function ServerRegionsGenerator(cache, chunkSize, folder) {
    Generator.call(this, cache, chunkSize);
    this.chunkFolder = folder;
}

module.exports = ServerRegionsGenerator;
inherits(ServerRegionsGenerator, Generator);

ServerRegionsGenerator.prototype.fillChunkVoxels = function(chunk, fn, width) {
    var position = chunk.position;
    var startX = position[0];
    var startY = position[1];
    var startZ = position[2];
    // Clear, so we can add voxels gradually
    for (var i = 0; i < 32768; i++) {
        chunk.voxels[i] = 0;
    }
    // determine the region
    if (startY < 0) {
        terrains.ground(chunk, width);
        return;
    }
    // clouds
    if (32 <= startY && startY <= 64) {
        terrains.clouds(chunk, width);
    }
    // Ground level and up, to the right past 64, high mountains
    if (startY >= 0 && startX >= 32) {
        terrains.high(chunk, width);
        return;
    }
};

var perlin = function(seed, floor, ceiling, divisor) {
    floor = floor || 0;
    ceiling = ceiling || 20;
    // minecraft's limit
    divisor = divisor || 50;
    noise.seed(seed);
    return function(chunk, width) {
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
};

function pointsInside(startX, startY, width, func) {
    for (var x = startX; x < startX + width; x++) {
        for (var y = startY; y < startY + width; y++) {
            func(x, y);
        }
    }
}

function scale(x, fromLow, fromHigh, toLow, toHigh) {
    return (x - fromLow) * (toHigh - toLow) / (fromHigh - fromLow) + toLow;
}

var terrains = {
    high: perlin('something', 0, 50, 50),
    rolling: perlin(8484747474747, 0, 20, 50),
    'sea-level': function(chunk, chunkSize) {
        var fn = function(x, y, z, chunkSize) {
            if (y == 0) {
                return 1;
            }
        };
        var lo = chunk.position;
        var ii = lo[0] + chunkSize;
        var jj = lo[1] + chunkSize;
        var kk = lo[2] + chunkSize;
        var index = 0;
        for (var k = lo[2]; k < kk; k++) {
            for (var j = lo[1]; j < jj; j++) {
                for (var i = lo[0]; i < ii; i++, index++) {
                    chunk.voxels[index] = fn(i, j, k, chunkSize);
                }
            }
        }
    },
    ground: function(chunk, chunkSize) {
        for (var i = 0; i < 32768; i++) {
            chunk.voxels[i] = 1;
        }
    },
    clouds: function(chunk, chunkSize) {
        var padding = 5;
        var positionX = getRandomInt(padding, chunkSize - padding);
        var positionZ = getRandomInt(padding, chunkSize - padding);
        var width = getRandomInt(2, 12) / 2;
        var depth = getRandomInt(2, 12) / 2;
        var fromX = positionX - width;
        var fromZ = positionZ - depth;
        var toX = positionX + width;
        var toZ = positionZ + depth;
        var cy = 8;
        var index;
        for (var cx = fromX; cx <= toX; cx++) {
            for (var cz = fromZ; cz <= toZ; cz++) {
                index = cx + cy * chunkSize + cz * chunkSize * chunkSize;
                chunk.voxels[index] = 5;
            }
        }
    }
};
