var WebSocketEmitter = require('./lib/web-socket-emitter');
var Server = require('./lib/server');
var fs = require('fs');
var ServerGenerator = require('./lib/generators/server-terraced');
var stats = require('./lib/voxel-stats');
var config = require('./config');

var clientSettings = {
    avatarInitialPosition: [ 16, 31, 16 ],
    avatars: [ '/player.png', '/substack.png', '/viking.png' ]
};

var serverSettings = {
    generator: new ServerGenerator(config.chunkCache, config.chunkSize, config.chunkFolder),
    worldOrigin: [ 0, 0, 0 ],
    worldDiameter: 20,
    maxPlayers: 2
};

// Chunk persistence
var chunksToSave = {};

var server = new Server(config, serverSettings, clientSettings);

server.on('missingChunk', function(chunk) {
    console.log('missing chunk');
});

server.on('client.join', function(client) {
    console.log('client join');
});

server.on('client.leave', function(client) {});

server.on('client.state', function(state) {});

server.on('client.frames', function(id, frames) {
    console.log('got frame data from client');
    var ts = Date.now();
    var filename = id + '.' + ts;
    fs.writeFile('./framelog/' + filename, JSON.stringify(frames));
});

server.on('chat', function(message) {});

server.on('set', function(pos, val, client) {});

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

serverSettings.generator.on('chunkGenerated', function(chunk) {
    console.log('Chunk generated, queueing for save to disk');
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
                console.log('Saved chunk ' + chunkID);
            };
        }(chunkID);
        fs.writeFile(config.chunkFolder + filename, new Buffer(chunk.voxels), callbackClosure);
    }
    chunksToSave = {};
}, 1000);

// WEBSOCKET SETUP
var connectionLimit = 10;
var connections = 0;

var wseServer = new WebSocketEmitter.server({
    port: 10005
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
        console.log('Denying connection');
        connection.close();
        return;
    }
    server.connectClient(connection);
});