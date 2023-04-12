import { ChunkStore } from '../chunk-store.mjs';
import HLRU from 'hashlru';
import Log from '../log.mjs';
import mysql from 'mysql';
import zlib from 'zlib';

var log = Log('MysqlChunkStore', true);

var worldId = 1;

class MysqlChunkStore extends ChunkStore {
    constructor(config, generator) {
        super(config, generator);
        this.mysqlPool = mysql.createPool(config);
        log('Using MysqlChunkStore');
    }

    read(chunkId, chunkPosition) {
        var self = this;

        // Check filesystem
        log('get', chunkId, chunkPosition);

        return new Promise(function(resolve, reject) {
            var sql = 'select voxels from chunk where x=? and y=? and z=?';
            self.mysqlPool.query(sql, chunkPosition, function(error, results) {
                if (error) {
                    reject('Error getting chunk from MySQL: ' + error);
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
                }
            });
        });
    }

    write(chunkId, chunk) {
        var self = this;
        return new Promise(function(resolve, reject) {
            self.mysqlPool.query(
                'REPLACE INTO chunk SET ?',
                {
                    x: chunk.position[0],
                    y: chunk.position[1],
                    z: chunk.position[2],
                    voxels: chunk.compressedVoxels,
                    updated_ms: Date.now()
                },
                function(error) {
                    if (error) {
                        reject('MysqlChunkStore::saveVoxels', error);
                        return;
                    }
                    resolve();
                }
            );
        });
    };

    close() {
        this.mysqlPool.end();
    }
}

export { MysqlChunkStore };
