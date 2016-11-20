var stats = require('../voxel-stats');
var ChunkStore = require('../chunk-store');

// Stores chunks in an object, keyed by chunkID
var MemoryChunkStore = function(generator) {
    ChunkStore.call(this, generator);
    this.chunkCache = {};
};
module.exports = MemoryChunkStore;


MemoryChunkStore.prototype.get = function(chunkID) {
    var chunk;
    if (chunkID in this.chunkCache) {
        this.emitter.emit('got', this.chunkCache[ chunkID ]);
        return;
    }
    chunk = this.generator.get(chunkID);
    if (chunk) {
        this.chunkCache[ chunkID ] = chunk;
        this.emitter.emit('got', chunk);
    } else {
        // For some reason our generator didn't return a chunk
    }
};


// Update chunks if we have them in memory
MemoryChunkStore.prototype.gotChunkChanges = function(chunks) {
    var self = this;
    // No race conditions here for memory store, but database and file might be a different story
    for (var chunkID in chunks) {
        if (chunkID in self.chunkCache) {
            var chunk = self.chunkCache[chunkID];
            var details = chunks[chunkID];
            // This takes place in the server
            //delete self.encodedChunkCache[chunkID];
            for (var i = 0; i < details.length; i += 2) {
                var index = details[i];
                var val = details[i + 1];
                var old = chunk.voxels[index];
                chunk.voxels[index] = val;
                if (old) {
                    if (val) {
                        stats.count('blocks.changed');
                    } else {
                        stats.count('blocks.destroyed');
                    }
                } else {
                    stats.count('blocks.created');
                }

            }
            //self.emitter.emit('chunkChanged', chunkID);
        } else {
            // For some reason, chunk not found in this.chunkCache
        }
    }
};

