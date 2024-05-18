// callback should match function(error, chunk)
class ChunkStore {
    constructor(runtime, config) {
        this.log = runtime.log("ChunkStore");
        this.config = config;
    }

    read(chunk) {
        return Promise.reject('Child class should implement read()');
    }

    write(chunk) {
        return Promise.reject('Child class should implement write()');
    }

    close() { }

    snapshot() { }
}
export { ChunkStore };