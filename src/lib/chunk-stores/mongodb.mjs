import { ChunkStore } from '../chunk-store.mjs';
import HLRU from 'hashlru';
import Log from '../log.mjs';
import mongo from 'mongodb';
import zlib from 'zlib';

var log = Log('MongoDBChunkStore', false);

var worldId = 1;

class MongoDbChunkStore extends ChunkStore {
    constructor(config, generator) {
        super(config, generator);
        var self = this;

        this.cache = HLRU(400);
        // ChunkID -> chunk data structure
        this.toSave = {};
        this.changes = {};

        this.applyChangesHandle = setInterval(
            function() {
                self.applyChanges();
            },
            500
        );
        this.saveHandle = setInterval(
            function() {
                self.save();
            },
            1000
        );
    }

    async connect() {
        this.client = await mongo.MongoClient.connect(this.config.uri);
        // Get handle to chunks collection
        this.chunks = this.client.db(this.config.database).collection("chunks");
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
        let query = {x: position[0], y: position[1], z: position[2]};
        self.chunks.findOne(query, {voxels: 0}, function(err, doc) {
            if (!doc) {
                // File not found, generate it
                let voxels = self.generator.get(chunkID);
                if (voxels) {
                    log('get', 'generated. queueing for saving: ' + chunkID);
                    cache.set(chunkID, voxels);
                    callback(null, voxels);
                    self.toSave[chunkID] = voxels;
                } else {
                    log('get', 'generate failed for ' + chunkID);
                    // For some reason our generator didn't return a chunk
                }
                return;
            } else {
                log('get', 'select returned ' + chunkID);

                // decompress
                zlib.gunzip(doc.voxels.buffer, function(error, buffer) {
                    if (error) {
                        log('get', 'Error gunzipping voxels: ', error);
                        return;
                    }
                    let chunk = {
                        position: position,
                        chunkID: chunkID,
                        voxels: new Uint8Array(buffer),
                        compressedVoxels: doc.voxels.buffer
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
    // Callback gets triggered on success or failure
    // Schedule the next timeout afterwards
    save() {
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


    saveVoxels(chunkID, chunk) {
        var self = this;
        let cache = self.cache;
        zlib.gzip(Buffer.from(chunk.voxels), function(error, buffer) {
            if (error) {
                console.log('Error compressing voxels', error);
                return;
            }
            let data = {
                x: chunk.position[0],
                y: chunk.position[1],
                z: chunk.position[2],
                voxels: new mongo.Binary(buffer),
                updated_ms: Date.now()
            };
            console.log('saving');
            console.log(data);
            // https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/
            self.chunks.updateOne(
                // find this doc
                {
                    x: chunk.position[0],
                    y: chunk.position[1],
                    z: chunk.position[2]
                },
                // set / insert this data
                {
                    $set: {
                        x: chunk.position[0],
                        y: chunk.position[1],
                        z: chunk.position[2],
                        voxels: new mongo.Binary(buffer),
                        updated_ms: Date.now()
                    }
                },
                {upsert: true},
                function(error) {
                    if (error) {
                        console.log('MongoDbChunkStore::saveVoxels', error);
                    }
                }
            );
        });
    };

    async end() {
        clearInterval(this.applyChangesHandle);
        clearInterval(this.saveHandle);
        await this.client.close();
    }
};

export { MongoDbChunkStore };
