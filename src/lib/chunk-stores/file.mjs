import ChunkStore from '../chunk-store';
import fs from 'fs';
import HLRU from 'hashlru';
import MaxConcurrent from '../max-concurrent';
var concurrent = MaxConcurrent(50);
var cache = HLRU(200);
var debug = false;

if (debug) {
    cache.on('evict',function(data) {
        console.log('evicted: ' + data.value.chunkID);
    });
}

/*
Note: with our current setup, there's a very small chance we could lose data due to race conditions

# User1 requests ChunkA that we need to generate
# ChunkA is generated and added to toSave
# User1 makes a change to ChunkA, somehow before it has been saved to disk. We save every 3 seconds, so maybe a node.js hiccup?
# ChunkA is evicted from lru cache due to pressure from requests for other chunks
# User2 moves near and requests ChunkA
# ChunkA doesn't exist in cache, so is regenerated and added to toSave (squashing the previous changes)
# ChunkA is finally saved to disk, but doesn't reflect what User1 expects

*/

var FileChunkStore = function(generator, chunkFolder) {
    var self = this;
    ChunkStore.call(this, generator);
    this.chunkFolder = chunkFolder;
    this.toSave = {};

    setInterval(
        function() {
            self.save();
        },
        // Save chunks every 3 seconds
        3000
    );
};


FileChunkStore.prototype.get = function(chunkID, callback) {
    var self = this;
    var chunk;
    var filename;
    var readCallback;
    chunk = cache.get(chunkID);
    if (!!chunk) {
        callback(null, chunk);
        return;
    }

    // Queue these up so we don't exhaust our file handle limit
    // wrap the call and callback to make sure we keep triggering calls until we've emptied our queue

    // Check filesystem
    filename = chunkID.replace(/\|/g, '.').replace(/-/g, 'n');
    if (debug) {
        console.log('FileChunkStore:get ' + chunkID);
    }
    concur(function(done) {
        fs.readFile(self.chunkFolder + filename, function(err, data) {
            if (err) {
                if (debug) {
                    console.log('FileChunkStore:get chunk not found');
                }
                // File not found, generate it
                chunk = self.generator.get(chunkID);
                if (chunk) {
                    cache.set(chunkID, chunk);
                    self.toSave[chunkID] = chunk;
                    callback(null, chunk);
                } else {
                    console.log('no chunk?');
                    // For some reason our generator didn't return a chunk
                }
                done();
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
            callback(null, chunk);
            done();
        });
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
            self.toSave[chunkID] = chunk;
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
    var op = function(filename, chunk) {
        return function(done) {
            fs.writeFile(self.chunkFolder + filename, Buffer.from(chunk.voxels), function(err) {
                if (err) {
                    done();
                    return console.log(err);
                }
                console.log('Saved chunk ' + chunkID);
                done();
            });
        };
    };
    for (var chunkID in this.toSave) {
        var filename = chunkID.replace(/\|/g, '.').replace(/-/g, 'n');
        var chunk = this.toSave[chunkID];
        if (chunk) {
            concur(op(filename, chunk));
        } else {
            console.log('Need to save chunk, but chunk was sent to us', chunkID);
        }
    }
    this.toSave = {};
};

export { FileChunkStore };
