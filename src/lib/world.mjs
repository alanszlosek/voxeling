import { Tickable } from './capabilities/tickable.mjs';

class World extends Tickable {
    constructor(game) {
        super();
        let self = this;
        this.game = game;

        // start clearly out of bounds to trigger a load of world chunks
        this.lastRegion = [100,100,100];


        this.coordsElement = document.getElementById('coordinates');
        this.coordsTimestamp = 0;
    }

    changeBlocks(low, high, value) {
        let chunkVoxelIndexValue = {};
        let touching = {};
        for (let x = low[0]; x < high[0]; x++) {
            for (let y = low[1]; y < high[1]; y++) {
                for (let z = low[2]; z < high[2]; z++) {
                    this.game.voxelCache.setBlock(x, y, z, value, chunkVoxelIndexValue, touching);
                }
            }
        }
        this.game.clientWorkerHandle.send(['chunkVoxelIndexValue', chunkVoxelIndexValue, touching]);
    }

    tick(ts) {
        // compare player position with chunk boundaries to trigger regionChange
        var thisRegion = this.game.coordinates.positionToChunk(this.game.player.getPosition());
        var lastRegion = this.lastRegion;
        if (thisRegion[0] !== lastRegion[0] || thisRegion[1] !== lastRegion[1] || thisRegion[2] !== lastRegion[2]) {
            //console.log('region change');
            this.game.clientWorkerHandle.regionChange();
        }
        this.lastRegion = thisRegion;

        // Update coordinates shown at top-right every second
        if (ts - this.coordsTimestamp >= 1000.0) {
            this.coordsTimestamp = ts;
            let pos = this.game.player.getPosition().map(Math.floor);
            this.coordsElement.innerText = pos.join(', ');
        }
    }
}


export { World };
