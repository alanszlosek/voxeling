import { ChunkStore } from '../chunk-store.mjs';
import HLRU from 'hashlru';
import zlib from 'zlib';
//const { DatabaseSync } = require('node:sqlite');
import { DatabaseSync } from 'node:sqlite';

var worldId = 1;

class SqliteChunkStore extends ChunkStore {
    constructor(runtime, config) {
        super(runtime, config);
        this.log = runtime.log("SqliteChunkStore");
        this.sqlite = new DatabaseSync(config.filename);
        this.log('Using SqliteChunkStore');

        // Prepared statements
        this.readChunk = this.sqlite.prepare('select voxels from chunk where x=? and y=? and z=?');
        this.readChunkHistory = this.sqlite.prepare('select voxels from history where x=? and y=? and z=? AND created_ms < ? ORDER BY created_ms DESC LIMIT 1');
        this.readSnapshots = this.sqlite.prepare("select distinct datetime(created_ms/1000, 'unixepoch') as name, created_ms as snapshot_ms from history order by created_ms desc");
        this.updateChunk = this.sqlite.prepare('UPDATE chunk SET voxels=?, updated_ms=? WHERE x=? AND y=? AND z=?');
        this.insertChunk = this.sqlite.prepare('INSERT INTO chunk (voxels,updated_ms,x,y,z) VALUES (?,?,?,?,?)');
    }

    read(chunkId, chunkPosition, cutoff) {
        var self = this;
        // Check filesystem
        self.log('get', chunkId, chunkPosition);

        if (this.wayback > 0) {
            console.log("getting up to ", this.wayback);
            var row = this.readChunkHistory.get(chunkPosition[0], chunkPosition[1], chunkPosition[2], this.wayback);
        } else {
            var row = this.readChunk.get(chunkPosition[0], chunkPosition[1], chunkPosition[2]);
        }

        if (row === undefined) {
            return Promise.reject('SqliteChunkStore::read(): Chunk not found');
        }

        var chunk = {
            position: chunkPosition,
            chunkID: chunkId,
            voxels: new Uint8Array( zlib.gunzipSync(row.voxels) ),
            compressedVoxels: row.voxels
        };
        return Promise.resolve(chunk);
    }

    write(chunkId, chunk) {
        var self = this;
        if (this.wayback > 0) {
            return Promise.resolve();
        }
        let updated_ms = Date.now();

        var result = this.updateChunk.run(
            chunk.compressedVoxels,
            updated_ms,
            chunk.position[0], // x
            chunk.position[1], // y
            chunk.position[2]
        );
        if (result.changes == 1) {
            return Promise.resolve();
        }
        
        var result = this.insertChunk.run(
            chunk.compressedVoxels,
            updated_ms,
            chunk.position[0], // x
            chunk.position[1], // y
            chunk.position[2]
        );
        if (result.changes == 1) {
            return Promise.resolve();
        }
        return Promise.reject('SqliteChunkStore::write(): Failed to insert');
    }


    // archive what has changed since last snapshot
    snapshot() {
        var self = this;
        // get last snapshot time
        // INSERT ... SELECT all that has changed since last snapshot time
        // INSERT INTO snapshots (x,y,z,voxels,snapshot_seconds) SELECT (x,y,z,voxels, "" as snapshot_seconds) FROM chunk WHERE update_ms > %s"

        return;

        var cutoff = 0;

        const previous = this.sqlite.prepare('SELECT created_ms FROM history ORDER BY created_ms DESC LIMIT 1');
        var row = previous.run();
        if (row !== undefined) {
            cutoff = row["created_ms"];
        }

        const copy = this.sqlite.prepare("INSERT INTO history (world_id,x,y,z,voxels,created_ms) "
            + "SELECT 0 AS world_id,x,y,z,voxels," + created_ms + " AS created_ms FROM chunk WHERE updated_ms > ?");

        backup.run(cutoff);
    };

    getSnapshots() {
        var snapshots = this.readSnapshots.all();
        return snapshots;
    }

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
