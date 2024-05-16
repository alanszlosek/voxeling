import { ChunkStore } from '../chunk-store.mjs';
import HLRU from 'hashlru';
import mongo from 'mongodb';
import zlib from 'zlib';

var worldId = 1;

class MongoDbChunkStore extends ChunkStore {
    constructor(runtime, config, generator) {
        super(runtime, config, generator);
        this.log = runtime.log("MongoDbChunkStore");
        this._connect();
        this.log('Using MongoDbChunkStore');
    }

    async _connect() {
        this.client = await mongo.MongoClient.connect(this.config.uri);
        // Get handle to chunks collection
        this.chunks = this.client.db(this.config.database).collection("chunks");
    }

    read(chunkId, chunkPosition) {
        let self = this;
        return new Promise(function(resolve, reject) {
            let query = {x: chunkPosition[0], y: chunkPosition[1], z: chunkPosition[2]};
            self.chunks.findOne(query, {voxels: 0}, function(err, doc) {
                if (!doc) {
                    reject('Error getting chunk from MongoDB: ' + err);
                    return;
                }
                
                self.log('get', 'select returned ' + chunkId);

                let chunk = {
                    position: chunkPosition,
                    chunkID: chunkId,
                    voxels: new Uint8Array( zlib.gunzipSync(doc.voxels.buffer) ),
                    compressedVoxels: doc.voxels.buffer
                };
                resolve(chunk);
            });
        });
    }


    write(chunkId, chunk) {
        var self = this;

        return new Promise(function(resolve, reject) {
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
                        voxels: new mongo.Binary(chunk.compressedVoxels),
                        updated_ms: Date.now()
                    }
                },
                {upsert: true},
                function(error) {
                    if (error) {
                        reject('MongoDbChunkStore::saveVoxels', error);
                        return;
                    }
                    resolve();
                }
            );
        });
    };

    close() {
        return this.client.close();
    }
};

export { MongoDbChunkStore };
