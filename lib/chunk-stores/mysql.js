var stats = require('../voxel-stats');
var ChunkStore = require('../chunk-store');
var mysql = require('mysql');
var zlib = require('zlib');
var lru = require('../lru');
var log = require('../log')('MysqlChunkStore');
var cache = new lru(200);
var debug = false;

var worldId = 1;

var MysqlChunkStore = function(generator, config) {
    var self = this;
    ChunkStore.call(this, generator);
    // ChunkID -> chunk data structure
    this.toSave = {};
    this.changes = {};
    this.requested = {};
    this.mysqlPool = mysql.createPool(config);

    // We just loaded a chunk
    this.emitter.on('got', function(chunk) {
        if (chunk.chunkID in self.requested) {
            delete self.requested[chunkID];
        }
    });

    setInterval(
        function() {
            self.applyChanges();
            self.save();
        },
        500
    );
};
module.exports = MysqlChunkStore;


MysqlChunkStore.prototype.get = function(chunkID) {
    var self = this;
    var chunk = cache.get(chunkID);
    if (chunk) {
        this.emitter.emit('got', chunk);
        return;
    }

    // Check filesystem
    if (debug) {
        log('get', chunkID);
    }
    // Very bad things happen when position doesn't hold numbers
    var position = chunkID.split('|').map(function(value) {
        return Number(value);
    });
    //position.unshift( Number(worldId) );
    var sql = 'select voxels from chunk where x=? and y=? and z=?';
    this.mysqlPool.query(sql, position, function(error, results) {
        if (error) {
            log('get', 'Error in chunk select query');
            return;
        }
        if (results.length == 0) {
            // File not found, generate it
            chunk = self.generator.get(chunkID);
            if (chunk) {
                if (debug) {
                    log('get', 'generated. queueing for saving: ' + chunkID);
                }
                cache.set(chunkID, chunk);
                self.emitter.emit('got', chunk);
                self.toSave[chunkID] = chunk;
            } else {
                log('get', 'generate failed for ' + chunkID);
                // For some reason our generator didn't return a chunk
            }
            return;
        } else if (results.length == 1) {
            if (debug) {
                log('get', 'select returned ' + chunkID);
            }

            // decompress
            zlib.gunzip(results[0].voxels, function(error, buffer) {
                if (error) {
                    log('get', 'Error gunzipping voxels: ', error);
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

MysqlChunkStore.prototype.applyChanges = function() {
    var self = this;
    for (var chunkID in self.changes) {
        var details;
        var chunk = cache.get(chunkID);
        if (!chunk) {
            // Request the chunk, so we can modify it and then save it
            if (chunkID in self.requested) {
                continue;
            }
            self.get(chunkID);
            self.requested[chunkID] = true;
            continue;
        }

        // If we have the chunk in our LRU cache, update it and queue for a save
        details = self.changes[chunkID];
        for (var i = 0; i < details.length; i += 2) {
            var index = details[i];
            var val = details[i + 1];
            var old = chunk.voxels[index];
            chunk.voxels[index] = val;
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
        }
        self.toSave[chunkID] = chunk;
        delete self.changes[chunkID];
        if (debug) {
            log('applyChanges', 'queueing for saving: ' + chunkID);
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
        var chunk = this.toSave[chunkID];
        this.saveVoxels(chunkID, chunk);
        delete this.toSave[chunkID];
        i++;
    }
};


MysqlChunkStore.prototype.saveVoxels = function(chunkID, chunk) {
    var self = this;
    zlib.gzip(new Buffer(chunk.voxels), function(error, buffer) {
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
