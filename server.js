var WebSocketEmitter = require('./lib/web-socket-emitter');
var Server = require('./lib/server');
var fs = require('fs');
var ServerGenerator = require('./lib/generators/server-terraced');
var stats = require('./lib/voxel-stats');
var config = require('./config');
var debug = false;

var chunkCache = {};

var clientSettings = {
    avatarInitialPosition: config.initialPosition
};

var generator = new ServerGenerator(chunkCache, config.chunkSize, config.chunkFolder);

// Chunk persistence
var chunksToSave = {};

var server = new Server(config, chunkCache, clientSettings, generator);

server.on('client.join', function(client) {

});

server.on('client.leave', function(client) {

});

server.on('client.state', function(state) {

});

/*
server.on('client.frames', function(id, frames) {
    console.log('got frame data from client');
    var ts = Date.now();
    var filename = id + '.' + ts;
    fs.writeFile('./framelog/' + filename, JSON.stringify(frames));
});
*/


server.on('error', function(error) {
    console.log(error);
});

server.on('chunkChanged', function(chunkID) {
    if (!(chunkID in chunksToSave)) {
        // is it generated yet?
        if (chunkID in server.chunkCache) {
            chunksToSave[chunkID] = server.chunkCache[chunkID];
        }
    }
});

generator.on('chunkGenerated', function(chunk) {
    if (debug) {
        console.log('Chunk generated, queueing for save to disk');
    }
    // Save when chunks are generated, too
    var chunkID = chunk.chunkID;
    if (!(chunkID in chunksToSave)) {
        // is it generated yet?
        if (chunkID in server.chunkCache) {
            chunksToSave[chunkID] = server.chunkCache[chunkID];
        }
    }
});

// TODO: this needs to be in the server-generator chunk generator
// flush maps to disk
setInterval(function() {
    var keys = Object.keys(chunksToSave);
    for (var i = 0; i < keys.length; i++) {
        var chunkID = keys[i];
        var filename = chunkID.replace(/\|/g, '.').replace(/-/g, 'n');
        var chunk = chunksToSave[chunkID];
        var callbackClosure = function(chunkID) {
            return function(err) {
                if (err) {
                    return console.log(err);
                }
                if (debug) {
                    console.log('Saved chunk ' + chunkID);
                }
            };
        }(chunkID);
        fs.writeFile(config.chunkFolder + filename, new Buffer(chunk.voxels), callbackClosure);
    }
    chunksToSave = {};
}, 1000);

// WEBSOCKET SETUP
var connectionLimit = config.maxPlayers;
var connections = 0;

var wseServer = new WebSocketEmitter.server({
    host: config.websocketBindAddress,
    port: config.websocketBindPort
});

wseServer.on('connection', function(connection) {
    stats.count('connections.incoming');
    // Have we reached our player max?
    console.log('Incoming client connection');
    connections++;
    console.log('Connections: ' + connections);
    connection.on('close', function() {
        connections--;
        console.log('Connections: ' + connections);
    });
    if (connections > connectionLimit) {
        console.log('Denying connection, at our limit');
        connection.close();
        return;
    }
    server.connectClient(connection);
});