// callback should match function(error, chunk)
class ChunkStore {
    constructor(config) {
        this.config = config;
    }

    read(chunk) {
        return Promise.reject('Child class should implement read()');
    }

    write(chunk) {
        return Promise.reject('Child class should implement write()');
    }

    close() { }
}
export { ChunkStore };