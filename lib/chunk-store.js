var EventEmitter = require('events').EventEmitter;

// callback should match function(error, chunk)
var ChunkStore = function(generator) {
    this.emitter = new EventEmitter();
    this.generator = generator;
};

// Asyncronous
ChunkStore.prototype.get = function(chunkID) {
};

ChunkStore.prototype.tick = function() {
    // Extend this class and do stuff
};

module.exports = ChunkStore;


/*
Base chunk store should probably not do anything
Memory store should update memroy
File/database store should likely update memory first, and then async flush to disk to avoid race conditions. So file store needs some sort of in-memory, maybe LRU, layer as well.
*/
ChunkStore.prototype.gotChunkChanges = function(chunks) {
    // Can't do much since this chunk store doesn't store any chunks
};

