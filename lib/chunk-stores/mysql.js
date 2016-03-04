var stats = require('../voxel-stats');
var ChunkStore = require('../chunk-store');
var mysql = require('mysql');
var zlib = require('zlib');
var lru = require('lru');
var cache = new lru(200);
var debug = false;

var worldId = 1;

var MysqlChunkStore = function(generator, config) {
    var self = this;
    ChunkStore.call(this, generator);
    this.toSave = {};
    this.mysqlPool = mysql.createPool(config);

    setInterval(
        function() {
            self.save();
        },
        100
    );
};
module.exports = MysqlChunkStore;


MysqlChunkStore.prototype.get = function(chunkID) {
    var self = this;
    var chunk = cache.get(chunkID);
    if (!!chunk) {
        this.emitter.emit('got', chunk);
        return;
    }

    // Check filesystem
    if (debug) {
        console.log('MysqlChunkStore:get ' + chunkID);
    }
    // Very bad things happen when position doesn't hold numbers
    var position = chunkID.split('|').map(function(value) {
        return Number(value);
    });
    //position.unshift( Number(worldId) );
    var sql = 'select voxels from chunk where x=? and y=? and z=?';
    this.mysqlPool.query(sql, position, function(error, results) {
        if (error) {
            console.log('Error in chunk fetch query');
            return;
        }
        if (results.length == 0) {
            // File not found, generate it
            chunk = self.generator.get(chunkID);
            if (chunk) {
                cache.set(chunkID, chunk);
                self.toSave[chunkID] = true;
                if (debug) {
                    console.log('MysqlChunkStore::get queueing for saving: ' + chunkID);
                }
                self.emitter.emit('got', chunk);
            } else {
                console.log('no chunk?');
                // For some reason our generator didn't return a chunk
            }
            return;
        } else if (results.length == 1) {
            if (debug) {
                console.log('MysqlChunkStore:got ' + chunkID);
            }

            // decompress
            zlib.gunzip(results[0].voxels, function(error, buffer) {
                if (error) {
                    console.log('Error gunzipping voxels: ', error);
                    return;
                }
                var chunk = {
                    position: position,
                    chunkID: chunkID,
                    voxels: new Uint8Array(buffer)
                };
                cache.set(chunkID, chunk);
                self.emitter.emit('got', chunk);
            });
        }
    });
};


// Update chunks if we have them in memory
MysqlChunkStore.prototype.gotChunkChanges = function(chunks) {
    var self = this;
    // No race conditions here for memory store, but database and file might be a different story
    for (var chunkID in chunks) {
        var chunk = cache.get(chunkID);
        if (!!chunk) {
            var details = chunks[chunkID];
            for (var i = 0; i < details.length; i += 2) {
                var index = details[i];
                var val = details[i + 1];
                var old = chunk.voxels[index];
                chunk.voxels[index] = val;
                if (old) {
                    if (val) {
                        stats.count('blocks.changed');
                    } else {
                        stats.count('blocks.destroyed');
                    }
                } else {
                    stats.count('blocks.created');
                }

            }
            self.toSave[chunkID] = true;
            if (debug) {
                console.log('MysqlChunkStore::gotChunkChanges queueing for saving: ' + chunkID);
            }
        } else {
            // For some reason, chunk not found in this.chunkCache
        }
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
        var chunk = cache.get(chunkID);
        if (!!chunk) {
            this.saveVoxels(chunkID, chunk);
            delete this.toSave[chunkID];
            i++;
        }
    }
};


MysqlChunkStore.prototype.saveVoxels = function(chunkID, chunk) {
    var self = this;
    var position = chunkID.split('|').map(function(value) {
        return Number(value);
    });
    zlib.gzip(new Buffer(chunk.voxels), function(error, buffer) {
        if (error) {
            console.log('Error compressing voxels', error);
            return;
        }
        self.mysqlPool.query(
            'REPLACE INTO chunk SET ?',
            {
                x: position[0],
                y: position[1],
                z: position[2],
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
