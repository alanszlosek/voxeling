import { Generator } from '../generator.mjs';
import { getRandomInt } from '../util.mjs';

let debug = false;


class ServerGeneratorTerraced extends Generator {
    fillChunkVoxels(chunk) {
        let self = this;
        let lo = chunk.position;
        let ii = lo[0] + self.chunkSize;
        let jj = lo[1] + self.chunkSize;
        let kk = lo[2] + self.chunkSize;
        let index = 0;

        // 1 block rise, each ring of chunks out from center
        let generateVoxel = function(x, y, z, chunkSize) {
            if (y == 0) {
                return 1;
            }
            if (y < 0) {
                // N = 800
                // 2 in N chance of obsidian
                // 5 in N chance of empty
                // 1 in N chance of lava
                // 2 in N chance of granite
                // 2 in N chance of slate
                let chance = getRandomInt(1, 800)
                if (chance < 3) {
                    return 4; // obsidian
                } else if (chance < 8) {
                    return 0; // empty
                } else if (chance == 8) {
                    return 7; // lava
                } else if (chance < 11) {
                    return 13; // granite
                } else if (chance < 14) {
                    return 19; //slate
                }
                // Otherwise, dirt
                return 3;
            }
            let chunkX = Math.abs(Math.floor(x / chunkSize));
            //let chunkY = Math.abs(Math.floor(y / chunkSize))
            let chunkZ = Math.abs(Math.floor(z / chunkSize));
            let out = Math.max(chunkX, chunkZ);
            if (y <= out) {
                return 1;
            }
            return 0;
        };

        for(let k = lo[2]; k < kk; k++) {
            for (let j = lo[1]; j < jj; j++) {
                for (let i = lo[0]; i < ii; i++, index++) {
                    chunk.voxels[index] = generateVoxel(i, j, k, self.chunkSize);
                }
            }
        }
    }
}

export default ServerGeneratorTerraced;

