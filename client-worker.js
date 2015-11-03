var config = require('./config');

var WebSocketEmitter = require('./lib/web-socket-emitter');
var decoder = require('./lib/rle-decoder');
var pool = require('./lib/object-pool');
var Coordinates = require('./lib/coordinates');
var Textures = require('./lib/textures');
var mesher = require('./lib/meshers/horizontal-merge');
var ClientGenerator = require('./lib/generators/client.js');

var debug = true;

/*
INCOMING WEBWORKER MESSAGES

connect - client wants us to connect to the websocket server


OUTGOING WEBWORKER MESSAGES

open - websocket connection opened

close - websocket connection closed

chunk - sending a decoded, meshed chunk to the client

*/


var worker = {
    connected: false,
    connection: null,
    receivedChunks: [],

    emit: function(name, data) {
        postMessage(Array.prototype.slice.apply(arguments));
    },


    connect: function() {
        var self = this;
        var coordinates = new Coordinates(config.chunkSize);
        var textures = new Textures(config.textures);
        var websocket = this.connection = new WebSocketEmitter.client();
        var generator = new ClientGenerator(config.chunkCache, config.chunkSize);

        mesher.config(config.chunkSize, textures, coordinates);

        websocket.on('open', function() {
            self.connected = true;
            if (debug) {
                console.log('webworker: websocket connection opened');
            }
            self.emit('open');
        });

        websocket.on('close', function() {
            self.connected = false;
            if (debug) {
                console.log('webworker: websocket connection closed');
            }
            self.emit('close');
        });

        websocket.on('error', function(message) {
            console.log('webworker: websocket error, ' + message);
        });

        websocket.on('settings', function(settings, id) {
            if (debug) {
                console.log('webworker: got settings');
                console.log(settings);
            }
            self.emit('settings', settings, id);
        });

        websocket.on('chunks', function(pairs) {
            if (debug) {
                console.log('websorker: Websocket received chunks', pairs);
            }
            self.receivedChunks = self.receivedChunks.concat(pairs);
        });

        // fires when server sends us voxel edits [chunkID, voxelIndex, value, voxelIndex, value...]
        // would like to expand this to cover more than 1 chunk at a time
        /*
        websocket.on('chunkVoxelIndexValue', function(chunks) {
            for (var chunkID in chunks) {
                if (chunkID in self.settings.chunkCache) {
                    var chunk = self.settings.chunkCache[chunkID];
                    var details = chunks[chunkID];
                    for (var i = 0; i < details.length; i += 2) {
                        var index = details[i];
                        var val = details[i + 1];
                        chunk.voxels[index] = val;
                    }
                    self.emitter.emit('chunkChanged', chunkID);
                }
            }
        });
*/

        websocket.on('chat', function(message) {
            self.emit('chat', message)
        });

        this.connection.connect(config.server);
    },

    needChunks: function() {
        var chunks = Array.prototype.slice.apply(arguments);
        chunks.unshift('needChunks');
        console.log('sending needChunks', chunks);
        this.connection.emit.apply(this.connection, chunks);
    },

    processChunks: function() {
        for (var i = 0; i < this.receivedChunks.length; i++) {
            var pair = this.receivedChunks[i];
            var encoded = pair[0];
            // maybe data should come as an array, instead of an object, so i don't have to change the object shape when mesh is created
            var chunk = pair[1];
            var data = pool.malloc('uint8', chunk.length);
            var transferList = [];

            chunk.voxels = decoder(encoded, data);
            console.log(chunk);
            chunk.mesh = mesher.mesh(chunk.position, chunk.voxels);

            // We want to transfer voxel and mesh arrays
            transferList.push(chunk.voxels.buffer);
            for (var textureValue in chunk.mesh) {
                var texture = chunk.mesh[textureValue];
                // Go past the Growable, to the underlying ArrayBuffer
                transferList.push(texture.position.data.buffer);
                transferList.push(texture.texcoord.data.buffer);
            }

            // specially list the ArrayBuffer object we want to transfer
            postMessage(
                ['chunk', chunk],
                transferList
            );
        }
        postMessage(['chunksProcessed']);
        this.receivedChunks = [];
    },

    oldChunk: function(chunk) {
        // Chunk is being returned to us. no longer need to show it
        // Keep it in LRU?
        // Delete it?
        return;

        var chunk = this.chunkCache[chunkID];
        if (chunk) {
            pool.free('uint8', chunk.voxels);
            // TODO: free meshes, too
            chunk.voxels = null;
            if ('mesh' in chunk) {
                for (var textureValue in chunk.mesh) {
                    var textureMesh = chunk.mesh[textureValue];
                    textureMesh.position.free();
                    textureMesh.texcoord.free();
                }
                chunk.mesh = null;
            }
        }
        delete this.chunkCache[chunkID];
        delete this.chunksToDraw[chunkID];
        delete this.visibleChunks[chunkID];
        delete this.requestedChunks[chunkID];
    }
}

onmessage = function(e) {
    var message = e.data;
    var type = message.shift();

    if (type in worker) {
        worker[type].apply(worker, message);
    } else {
        console.log('worker does not have handler for ' + type, message);
    }
    
};

setInterval(
    function() {
        worker.processChunks();
    },
    1000 / 10
);
