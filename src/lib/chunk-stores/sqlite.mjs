import { ChunkStore } from '../chunk-store.mjs';
import HLRU from 'hashlru';
import Log from '../log.mjs';
import sqlite3 from 'sqlite3';
import zlib from 'zlib';

var log = Log('SqlitelChunkStore', true);

var worldId = 1;

class SqliteChunkStore extends ChunkStore {
    constructor(config, generator) {
        super(config, generator);
        var self = this;

        this.cache = HLRU(400);
        // ChunkID -> chunk data structure
        this.toSave = {};
        this.changes = {};
        this.sqlite = new sqlite3.Database(config.filename);

        this.applyChangesHandle = setInterval(
            function() {
                self.applyChanges();
            },
            500
        );
        // to initialize the save timeout
        this.save();
    }


    get(chunkID, callback) {
        var self = this;
        let cache = self.cache;
        var chunk = cache.get(chunkID);
        
        if (chunk) {
            callback(null, chunk);
            return;
        }
        //console.log('Chunk not found in HLRU cache, fetching from mysql');

        // Check filesystem
        log('get', chunkID);

        // Very bad things happen when position doesn't hold numbers
        var position = chunkID.split('|').map(function(value) {
            return Number(value);
        });
        //position.unshift( Number(worldId) );
        var sql = 'select voxels from chunk where x=? and y=? and z=?';
        this.sqlite.all(sql, position, function(error, results) {
            if (error) {
                callback('Error getting chunk from MySQL: ' + error);
                return;
            }
            if (results.length == 0) {
                // File not found, generate it
                chunk = self.generator.get(chunkID);
                if (chunk) {
                    log('get', 'generated. queueing for saving: ' + chunkID);
                    cache.set(chunkID, chunk);
                    callback(null, chunk);
                    self.toSave[chunkID] = chunk;
                } else {
                    log('get', 'generate failed for ' + chunkID);
                    // For some reason our generator didn't return a chunk
                }
                return;
            } else if (results.length == 1) {
                log('get', 'select returned ' + chunkID);

                // decompress
                zlib.gunzip(results[0].voxels, function(error, buffer) {
                    if (error) {
                        log('get', 'Error gunzipping voxels: ', error);
                        return;
                    }
                    var chunk = {
                        position: position,
                        chunkID: chunkID,
                        voxels: new Uint8Array(buffer),
                        compressedVoxels: results[0].voxels
                    };
                    cache.set(chunkID, chunk);
                    callback(null, chunk);
                });
            }
        });
    };


    // Update chunks if we have them in memory
    gotChunkChanges(chunks) {
        var self = this;
        let cache = self.cache;
        // Merge these changes into our current queue of changes to save
        for (var chunkID in chunks) {
            if (!(chunkID in self.changes)) {
                self.changes[chunkID] = [];
            }
            Array.prototype.push.apply(self.changes[chunkID], chunks[chunkID]);
            // changes are an index+value pair, so divide by 2 to get total number of changes
            //stats.count('blocks.changed', chunks[chunkID].length / 2);
        }
    };

    // TODO: this should be a sync queued operation
    applyChanges() {
        var self = this;
        let cache = self.cache;
        var merge = function(chunk, changes) {
            for (var i = 0; i < changes.length; i += 2) {
                var index = changes[i];
                var val = changes[i + 1];
                var old = chunk.voxels[index];
                chunk.voxels[index] = val;
            }
        // Schedule for saving
        };
        var ids = Object.keys(self.changes);
        for (var i = 0; i < ids.length; i++) {
            var chunkID = ids[i];
            var details;
            var chunk = cache.get(chunkID);
            if (!chunk) {
                // Request the chunk from ourselves, the mysql store, so we can modify it and then save it
                self.get(chunkID, function(error, chunk) {
                    //merge(chunk, self.changes[chunkID]);
                });
                continue;
            }
            // If we have the chunk in our LRU cache, update it and queue for a save
            merge(chunk, self.changes[chunkID]);
            chunk.compressedVoxels = false;
            // Update LRU cache
            cache.set(chunkID, chunk);
            /*
            if (old) {
                if (val) {
                    stats.count('blocks.changed');
                } else {
                    stats.count('blocks.destroyed');
                }
            } else {
                stats.count('blocks.created');
            }
            */

            self.toSave[chunkID] = chunk;
            delete self.changes[chunkID];
            log('applyChanges', 'queueing for saving: ' + chunkID);
        }
    };

    // Call this on a timeout
    // Schedule the next timeout afterwards
    save() {
        let keys = Object.keys(this.toSave);
        if (keys.length > 0) {
            let chunkID = keys[0];
            let chunk = this.toSave[chunkID];
            this.saveVoxels(chunkID, chunk, this.save.bind(this));
            delete this.toSave[chunkID];
        } else {
            setTimeout(
                this.save.bind(this),
                5000
            );
        }
    };


    saveVoxels(chunkID, chunk, next) {
        var self = this;
        let cache = self.cache;
        zlib.gzip(Buffer.from(chunk.voxels), function(error, buffer) {
            if (error) {
                console.log('Error compressing voxels', error);
                next();
                return;
            }
            let updated_ms = Date.now();
            self.sqlite.run(
                'UPDATE chunk SET voxels=?, updated_ms=? WHERE x=? AND y=? AND z=?',
                [
                    buffer,
                    updated_ms,
                    chunk.position[0], // x
                    chunk.position[1], // y
                    chunk.position[2]
                ],
                function(error) {
                    if (error) {
                        // do insert?
                        console.log('SqliteChunkStore::saveVoxels error', error);
                        next();
                    } else if (this.changes == 1) {
                        next();

                    } else if (this.changes == 0) {
                        self.sqlite.run(
                            'INSERT INTO chunk (x,y,z,voxels,updated_ms) VALUES (?,?,?,?,?)',
                            [
                                chunk.position[0], // x
                                chunk.position[1], // y
                                chunk.position[2],
                                buffer,
                                updated_ms
                            ],
                            function(error) {
                                if (error) {
                                    // do insert?
                                    console.log('SqliteChunkStore::saveVoxels error', error);
                                }
                                next();
                            }
                        );

                    } else {
                        console.log('SqliteChunkStore::saveVoxels catchall');
                        next();
                    }
                }
            );
        });
    };

    end() {
        clearInterval(this.applyChangesHandle);
        clearInterval(this.saveHandle);
        this.sqlite.close();
    }
}

export { SqliteChunkStore };
