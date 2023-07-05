import Log from './log.mjs';
import zlib from 'zlib';

var log = Log('Chunk', false);

class Chunk {
    constructor(config, chunkStore, generator) {
        this.config = config;
        this.chunkStore = chunkStore;
        this.generator = generator;

        // each value is a list of change lists
        this.chunkChanges = {};
        this.reads = new Map();

        this.numActiveReads = 0;
    }

    read(chunkId, chunkPosition) {
        let self = this;
        if (this.reads.has(chunkId)) {
            log('read', 'Returning promise');
            return this.reads[chunkId].promise;
        }
        log('read', 'Creating new promise');
        let o = {
            chunkPosition: chunkPosition,
            promise: null,
            started: false,
            resolve: null,
            reject: null
        };
        this.reads.set(chunkId, o);
        o.promise = new Promise(function(resolve, reject) {
            let a = self.reads.get(chunkId);
            a.resolve = resolve;
            a.reject = reject;
        });
        self._process();
        return o.promise;
    }

    // ??
    write(chunkId, voxels) {

    }

    changeBlocks(changes) {
        log('changeBlocks', 'Got changes');
        for (var chunkId in changes) {
            if (chunkId in this.chunkChanges) {
                this.chunkChanges[chunkId].push( changes[chunkId] );
            } else {
                this.chunkChanges[chunkId] = [
                    changes[chunkId]
                ];
            }
        }
    }

    _process() {
        let self = this;
        let maxActiveReads = 10;
        log('_process', 'Processing');

        let readsIterator = this.reads.entries();
        for (let i = this.numActiveReads; i < maxActiveReads; i++) {
            let entry = readsIterator.next();
            if (entry.done || entry.value[1].started) {
                continue;
            }
            /*
            while ( entry && entry.value[1].started ) {
                entry = entry.next();
            }
            */
            
            let pair = entry.value;
            let chunkId = pair[0];
            let readInfo = pair[1];
            readInfo.started = true;
            self._read(chunkId, readInfo);
            this.numActiveReads++;
        }

        // Now do any outstanding changes
    }

    _read(chunkId, readInfo) {
        let self = this;
        this.chunkStore.read(chunkId, readInfo.chunkPosition).then(
            function(chunk) {
                self.numActiveReads--;
                // changes to apply?
                if (chunkId in self.chunkChanges) {
                    log('_read', 'Applying block changes after read');
                    self._applyBlockChanges(chunk, self.chunkChanges[chunkId]);
                    chunk.compressedVoxels = zlib.gzipSync(chunk.voxels);
                    delete self.chunkChanges[chunkId];

                    self.chunkStore.write(chunkId, chunk);
                }

                readInfo.resolve(chunk);
                delete self.reads.delete(chunkId);
                self._process();
            },
            function(error) {
                self.numActiveReads--;
                // TODO: create chunk struct here then pass into generator?
                // generate then save
                log('_read', 'Generating because ' + error);
                let chunk = {
                    position: readInfo.chunkPosition,
                    chunkID: chunkId,
                    voxels: new Uint8Array(self.config.chunkArraySize),
                    compressedVoxels: null
                };
                self.generator.generate(chunk);
                chunk.compressedVoxels = zlib.gzipSync(chunk.voxels);
                // save
                self.chunkStore.write(chunkId, chunk).then(function() {
                    readInfo.resolve(chunk);
                    delete self.reads.delete(chunkId);
                    self._process();

                }).catch(function(error) {
                    console.log(error);
                });

            }
        );
    }

    _applyBlockChanges(chunk, changes) {
        for (let i = 0; i < changes.length; i++) {
            let changeBatch = changes[i];
            for (var j = 0; j < changeBatch.length; j += 2) {
                var index = changeBatch[j];
                var val = changeBatch[j + 1];
                var old = chunk.voxels[index];
                chunk.voxels[index] = val;
            }
        }
    }
}
export { Chunk };