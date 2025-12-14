// callback should match function(error, chunk)
class ChunkStore {
    constructor(runtime, config) {
        this.log = runtime.log("ChunkStore");
        this.config = config;
        this.wayback = 0;
    }

    read(chunkId, chunkPosition) {
        return Promise.reject('Child class should implement read()');
    }

    write(chunkId, chunk) {
        return Promise.reject('Child class should implement write()');
    }

    close() { }

    snapshot() { }

    getSnapshots() {
        return [];
    }
}
export { ChunkStore };