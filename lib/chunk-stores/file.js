var stats = require('../voxel-stats');
var ChunkStore = require('../chunk-store');
var fs = require('fs');
var concur = require('../min-concurrent');
var lru = require('../lru');
var cache = new lru(200);
var debug = false;

if (debug) {
    cache.on('evict',function(data) {
        console.log('evicted: ' + data.value.chunkID);
    });
}

var FileChunkStore = function(generator, chunkFolder) {
    var self = this;
    ChunkStore.call(this, generator);
    this.chunkFolder = chunkFolder;
    this.toSave = {};

    setInterval(
        function() {
            self.save();
        },
        1000
    );
};
module.exports = FileChunkStore;


FileChunkStore.prototype.get = function(chunkID) {
    var self = this;
    var chunk;
    var filename;
    var readCallback;
    chunk = cache.get(chunkID);
    if (!!chunk) {
        this.emitter.emit('got', chunk);
        return;
    }

    // Queue these up so we don't exhaust our file handle limit
    // wrap the call and callback to make sure we keep triggering calls until we've emptied our queue

    // Check filesystem
    filename = chunkID.replace(/\|/g, '.').replace(/-/g, 'n');
    if (debug) {
        console.log('FileChunkStore:get ' + chunkID);
    }
    readCallback = function(err, data) {
        if (err) {
            if (debug) {
                console.log('FileChunkStore:get chunk not found');
            }
            // File not found, generate it
            chunk = self.generator.get(chunkID);
            if (chunk) {
                cache.set(chunkID, chunk);
                self.toSave[chunkID] = true;
                self.emitter.emit('got', chunk);
            } else {
                console.log('no chunk?');
                // For some reason our generator didn't return a chunk
            }
            return;
        }
        if (debug) {
            console.log('Loaded ' + filename);
        }
        var position = chunkID.split('|').map(function(value) {
            return Number(value);
        });
        chunk = {
            position: position,
            chunkID: chunkID,
            // TODO: fix this hardcoded value
            voxels: new Uint8Array(data)
        };
        cache.set(chunkID, chunk);
        self.emitter.emit('got', chunk);
    };
    concur.operation(function() {
        fs.readFile(self.chunkFolder + filename, concur.callback(readCallback));
    });
};


// Update chunks if we have them in memory
FileChunkStore.prototype.gotChunkChanges = function(chunks) {
    var self = this;
    // No race conditions here for memory store, but database and file might be a different story
    for (var chunkID in chunks) {
        var chunk = cache.get(chunkID);
        if (!!chunk) {
            var details = chunks[chunkID];
            // This takes place in the server
            //delete self.encodedChunkCache[chunkID];
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
            //self.emitter.emit('chunkChanged', chunkID);
        } else {
            // For some reason, chunk not found in this.chunkCache
        }
    }
};


// Call this on a timeout
// Callback gets triggered on success or failure
// Schedule the next timeout afterwards
FileChunkStore.prototype.save = function() {
    var self = this;
    // TODO: include saves in the same file handle queue as gets
    // is there an abstraction (npm module) to help with this?
    var op = function(filename, chunk, callbackClosure) {
        return function() {
            fs.writeFile(self.chunkFolder + filename, new Buffer(chunk.voxels), callbackClosure);
        };
    };
    var callbackClosure = function(chunkID) {
        return function(err) {
            if (err) {
                return console.log(err);
            }
            console.log('Saved chunk ' + chunkID);
        };
    };
    for (var chunkID in this.toSave) {
        var filename = chunkID.replace(/\|/g, '.').replace(/-/g, 'n');
        var chunk = cache.get(chunkID);
        concur.operation(op(filename, chunk, concur.callback(callbackClosure(chunkID))));
    }
    this.toSave = {};
};

