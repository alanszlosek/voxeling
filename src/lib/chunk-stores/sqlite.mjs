import { ChunkStore } from '../chunk-store.mjs';
import HLRU from 'hashlru';
import Log from '../log.mjs';
import sqlite3 from 'sqlite3';
import zlib from 'zlib';

var log = Log('SqliteChunkStore', false);

var worldId = 1;

class SqliteChunkStore extends ChunkStore {
    constructor(config) {
        super(config);
        this.sqlite = new sqlite3.Database(config.filename);
        log('Using SqliteChunkStore');
    }

    read(chunkId, chunkPosition) {
        var self = this;
        // Check filesystem
        log('get', chunkId, chunkPosition);

        return new Promise(function(resolve, reject) {
            //position.unshift( Number(worldId) );
            var sql = 'select voxels from chunk where x=? and y=? and z=?';
            self.sqlite.all(sql, chunkPosition, function(error, results) {
                if (error) {
                    reject('Error getting chunk from Sqlite: ' + error);
                    return;
                }
                if (results.length == 0) {
                    reject('Chunk not found');
                } else if (results.length == 1) {
                    log('get', 'select returned ' + chunkId);

                    var chunk = {
                        position: chunkPosition,
                        chunkID: chunkId,
                        voxels: new Uint8Array( zlib.gunzipSync(results[0].voxels) ),
                        compressedVoxels: results[0].voxels
                    };
                    resolve(chunk);
                } else {
                    reject('Something else happened');
                }
            });
        });
    }


    write(chunkId, chunk) {
        var self = this;
        let updated_ms = Date.now();

        return new Promise(function(resolve, reject) {
            self.sqlite.run(
                'UPDATE chunk SET voxels=?, updated_ms=? WHERE x=? AND y=? AND z=?',
                [
                    chunk.compressedVoxels,
                    updated_ms,
                    chunk.position[0], // x
                    chunk.position[1], // y
                    chunk.position[2]
                ],
                function(error) {
                    if (error) {
                        // do insert?
                        reject('SqliteChunkStore::saveVoxels error', error);
                    } else if (this.changes == 1) {
                        resolve();

                    } else if (this.changes == 0) {
                        self.sqlite.run(
                            'INSERT INTO chunk (x,y,z,voxels,updated_ms) VALUES (?,?,?,?,?)',
                            [
                                chunk.position[0], // x
                                chunk.position[1], // y
                                chunk.position[2],
                                chunk.compressedVoxels,
                                updated_ms
                            ],
                            function(error) {
                                if (error) {
                                    reject('SqliteChunkStore::saveVoxels error', error);
                                    return;
                                }
                                resolve();
                            }
                        );

                    } else {
                        reject('SqliteChunkStore::saveVoxels catchall');
                    }
                }
            );
        });
    };

    close() {
        let self = this;
        return new Promise(function(resolve, reject) {
            self.sqlite.close(function(error) {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        })
    }
}

export { SqliteChunkStore };
