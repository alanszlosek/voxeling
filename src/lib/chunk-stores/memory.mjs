import { ChunkStore } from '../chunk-store.mjs';
import Log from '../log.mjs';
import zlib from 'zlib';

var log = Log('MemoryChunkStore', false);

class MemoryChunkStore extends ChunkStore {
    constructor(config) {
        super(config);
        log('Using MemoryChunkStore');
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
