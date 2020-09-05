class VoxelCache {
    constructor(game) {
        this.coordinates = game.coordinates;
        this.cache = {};
    }

    addChunk(chunk) {
        var chunkID = chunk.chunkID;
        log('Game.storeVoxels: storing voxels for ' + chunkID);
        this.cache[ chunkID ] = chunk;
    }

    nearbyChunks = function(chunks) {
        for (var chunkId in this.cache) {
            if (!(chunkId in chunks)) {
                delete this.cache[chunkId];
            }
        }
    }

    // This is only used for collision detection
    getBlock(x, y, z) {
        var chunkID = this.coordinates.coordinatesToChunkID(x, y, z);
        if (chunkID in this.cache) {
            var voxelIndex = this.coordinates.coordinatesToVoxelIndex(x, y, z);
            var voxelValue = this.cache[chunkID].voxels[voxelIndex];
            // Uncomment the following when I'm ready to make water walkable
            return (voxelValue > 0); // && voxelValue != 6);
        } else {
            log('Game.getBlock: chunkid not found');
        }
        // if chunk doesn't exist, act like it's full of blocks (keep player out)
        return 1;
    }

    /*
    Modifies the chunkVoxelIndexValue data structure
    */
    setBlock(x, y, z, value, chunkVoxelIndexValue, touching) {
        var parts = this.coordinates.coordinatesToChunkAndVoxelIndex(x, y, z, touching);
        var chunkID = parts[0];
        var voxelIndex = parts[1];
        this.cache[chunkID].voxels[voxelIndex] = value;

        // Maybe some memoize setup could help with this
        if (chunkID in chunkVoxelIndexValue) {
            chunkVoxelIndexValue[chunkID].push(voxelIndex, value);
        } else {
            chunkVoxelIndexValue[chunkID] = [
                voxelIndex,
                value
            ];        
        }
    }

    // When webworker gets voxel changes, lib/client relays them here
    batchUpdate(changes) {
        var self = this;
        for (var chunkID in changes) {
            if (chunkID in self.cache) {
                var chunk = self.cache[chunkID];
                var details = changes[chunkID];
                for (var i = 0; i < details.length; i += 2) {
                    var index = details[i];
                    var val = details[i + 1];
                    chunk.voxels[index] = val;
                }
            }
        }
    }
}

export { VoxelCache }
