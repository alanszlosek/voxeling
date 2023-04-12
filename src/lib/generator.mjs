'use strict';

var debug = false;

class Generator {
    constructor(chunkSize) {
        if (!chunkSize) {
            throw new Exception('voxel-generator: chunkSize is required');
            return;
        }

        this.chunkSize = chunkSize;
    }

    generate(chunk) {
        if (debug) {
            console.log('Generator:generateChunk ' + chunkId);
        }
        var started = Date.now();
        this.fillChunkVoxels(chunk);
        return chunk;
    }

    fillChunkVoxels(chunk) {
        var lo = chunk.position;
        var ii = lo[0] + self.chunkSize;
        var jj = lo[1] + self.chunkSize;
        var kk = lo[2] + self.chunkSize;
        var index = 0;

        for(var k = lo[2]; k < kk; k++) {
            for (var j = lo[1]; j < jj; j++) {
                for (var i = lo[0]; i < ii; i++, index++) {
                    // 0 is ground level, so fill with grass
                    chunk.voxels[index] = (j < 1 ? 1 : 0);
                }
            }
        }
    }


}

export { Generator };
