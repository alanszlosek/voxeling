'use strict';

import { Gzip as zlib } from 'zlib';

var debug = false;

class Generator {
    constructor(chunkSize) {
        if (!chunkSize) {
            throw new Exception('voxel-generator: chunkSize is required');
            return;
        }

        this.chunkSize = chunkSize;
        this.chunkArraySize = this.chunkSize * this.chunkSize * this.chunkSize;
    }


    get(chunkID) {
        if (debug) {
            console.log('Generator:generateChunk ' + chunkID);
        }
        var started = Date.now();
        var chunk = this.makeChunkStruct(chunkID);
        this.fillChunkVoxels(chunk, this.chunkSize);
        chunk.compressedVoxels = zlib.gzipSync(chunk.voxels);
        return chunk;
    }


    fillChunkVoxels(chunk, chunkSize) {
        var lo = chunk.position;
        var ii = lo[0] + chunkSize;
        var jj = lo[1] + chunkSize;
        var kk = lo[2] + chunkSize;
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


    makeChunkStruct(chunkID) {
        var position = chunkID.split('|').map(function(value) {
            return Number(value);
        });
        return {
            position: position,
            chunkID: chunkID,
            voxels: new Uint8Array(this.chunkArraySize),
            compressedVoxels: null
        };
    }
}

export { Generator };
