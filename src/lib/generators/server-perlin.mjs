import { Generator } from '../generator.mjs';
import Simplex from 'perlin-simplex';

var debug = true;

// Code is from https://github.com/maxogden/voxel-perlin-terrain

// Perlin stuff
var floor = 0;
var ceiling = 30;
// minecraft's limit
var divisor = 200;

//var seed = 8484747474747;
let simplex = new Simplex(); // =  perlin(seed);

function pointsInside(startX, startY, width, func) {
    for (var x = startX; x < startX + width; x++) for (var y = startY; y < startY + width; y++) func(x, y);
}

function scale(x, fromLow, fromHigh, toLow, toHigh) {
    return (x - fromLow) * (toHigh - toLow) / (fromHigh - fromLow) + toLow;
}

class ServerPerlinGenerator extends Generator {

    fillChunkVoxels(chunk) {
        var position = chunk.position;
        var startX = position[0];
        var startY = position[1];
        var startZ = position[2];
        var voxels = chunk.voxels;
        let width = this.chunkSize;
        pointsInside(startX, startZ, width, function(x, z) {
            var n = simplex.noise(x / divisor, z / divisor);
            var y = ~~scale(n, -1, 1, floor, ceiling);
            if (y === floor || startY < y && y < startY + width) {
                var xidx = Math.abs((width + x % width) % width);
                var yidx = Math.abs((width + y % width) % width);
                var zidx = Math.abs((width + z % width) % width);
                var idx = xidx + yidx * width + zidx * width * width;
                if (y > (ceiling - 4)) {
                    voxels[idx] = 5;
                } else {
                    voxels[idx] = 1;
                }
                // now that we've set the crust, loop down and create dirt underneath
                for (var i = y - 1; i >= startY; i--) {
                    var idx = xidx + Math.abs((width + i % width) % width) * width + zidx * width * width;
                    voxels[idx] = 3;
                }
            }
        });
    }
}


export default ServerPerlinGenerator;
