import { ChunkStore } from '../chunk-store.mjs';
import zlib from 'zlib';

class MemoryChunkStore extends ChunkStore {
    constructor(runtime, config) {
        super(runtime, config);
        this.log = runtime.log("MemoryChunkStore");
        this.log('Using MemoryChunkStore');
        this.chunks = {};
    }

    read(chunkId, chunkPosition) {
        if (chunkId in this.chunks) {
            return Promise.resolve( this.chunks[chunkId] );
        } else {
            return Promise.reject(chunkId + ' not found');
        }
    }

    write(chunkId, chunk) {
        chunk.compressedVoxels = zlib.gzipSync(chunk.voxels);
        this.chunks[chunkId] = chunk;
        // TODO: update gzipped
        return Promise.resolve( chunk );
    }
}


export { MemoryChunkStore };
