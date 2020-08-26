import { stats } from '../voxel-stats';
import { ChunkStore } from '../chunk-store';
import { mysql } from 'mysql';
import { zlib } from 'zlib';
import { HLRU } from 'hashlru';
import { Log } from '../log';
var cache = HLRU(400);
var log = Log('MysqlChunkStore', false);

var worldId = 1;

var MysqlChunkStore = function(generator, config) {
    var self = this;
    ChunkStore.call(this, generator);
    // ChunkID -> chunk data structure
    this.toSave = {};
    this.changes = {};
    this.mysqlPool = mysql.createPool(config);

    setInterval(
        function() {
            self.applyChanges();
        },
        500
    );
    setInterval(
        function() {
            self.save();
        },
        5000
    );
};


MysqlChunkStore.prototype.get = function(chunkID, callback) {
    var self = this;
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
    this.mysqlPool.query(sql, position, function(error, results) {
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
MysqlChunkStore.prototype.gotChunkChanges = function(chunks) {
    var self = this;
    // Merge these changes into our current queue of changes to save
    for (var chunkID in chunks) {
        if (!(chunkID in self.changes)) {
            self.changes[chunkID] = [];
        }
        Array.prototype.push.apply(self.changes[chunkID], chunks[chunkID]);
        // changes are an index+value pair, so divide by 2 to get total number of changes
        stats.count('blocks.changed', chunks[chunkID].length / 2);
    }
};

// TODO: this should be a sync queued operation
MysqlChunkStore.prototype.applyChanges = function() {
    var self = this;
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
// Callback gets triggered on success or failure
// Schedule the next timeout afterwards
MysqlChunkStore.prototype.save = function() {
    var i = 0;
    for (var chunkID in this.toSave) {
        if (i > 10) {
            break;
        }
        var chunk = this.toSave[chunkID];
        this.saveVoxels(chunkID, chunk);
        delete this.toSave[chunkID];
        i++;
    }
};


MysqlChunkStore.prototype.saveVoxels = function(chunkID, chunk) {
    var self = this;
    zlib.gzip(Buffer.from(chunk.voxels), function(error, buffer) {
        if (error) {
            console.log('Error compressing voxels', error);
            return;
        }
        self.mysqlPool.query(
            'REPLACE INTO chunk SET ?',
            {
                x: chunk.position[0],
                y: chunk.position[1],
                z: chunk.position[2],
                voxels: buffer,
                updated_ms: Date.now()
            },
            function(error) {
                if (error) {
                    console.log('MysqlChunkStore::saveVoxels', error);
                }
            }
        );
    });
};

export { MysqlChunkStore };