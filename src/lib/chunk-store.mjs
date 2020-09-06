// callback should match function(error, chunk)
class ChunkStore {
    constructor(config, generator) {
        this.config = config;
        this.generator = generator;
    }

    // Asyncronous
    get = function(chunkID, callback) {
    }

    tick() {
    // Extend this class and do stuff
    }



    /*
    Base chunk store should probably not do anything
    Memory store should update memroy
    File/database store should likely update memory first, and then async flush to disk to avoid race conditions. So file store needs some sort of in-memory, maybe LRU, layer as well.
    */
    gotChunkChanges(chunks) {
    // Can't do much since this chunk store doesn't store any chunks
    }
}
export { ChunkStore };