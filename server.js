var WebSocketEmitter = require('./lib/web-socket-emitter');
var Server = require('./lib/server');
var fs = require('fs');

var chunkStore = require('./lib/chunk-stores/file');
var chunkGenerator = require('./lib/generators/server-terraced');
var stats = require('./lib/voxel-stats');
var config = require('./config');
var debug = false;

// This only gets filled by require if config.mysql isn't empty
var mysqlPool;

var clientSettings = {
    initialPosition: config.initialPosition
};

/*
var chunkStore = new chunkStore(
    new chunkGenerator(config.chunkSize),
    config.chunkFolder
);
*/
if (config.mysql) {
    mysqlPool = require('mysql').createPool(config.mysql);
    var chunkStore = new chunkStore(
        new chunkGenerator(config.chunkSize),
        config.mysql
    );
} else {
    var chunkStore = new chunkStore(
        new chunkGenerator(config.chunkSize),
        config.chunkFolder
    );
}

var serverSettings = {
    // test with memory chunk store for now
    worldRadius: config.worldRadius || 10,
    maxPlayers: config.maxPlayers || 10
};

// Chunk persistence
var chunksToSave = {};

var server = new Server(config, chunkStore, serverSettings, clientSettings);

/*
server.on('client.join', function(client) {
});

server.on('client.leave', function(client) {
});

server.on('client.state', function(state) {
});
*/

server.on('chat', function(message) {
    stats.count('chat.messages.sent');
    if (mysqlPool) {
        var row = {
            created_ms: Date.now(),
            username: message.user,
            message: message.text
        };
        mysqlPool.query('insert into chat SET ?', row);
    }
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

// WEBSOCKET SETUP
var connectionLimit = config.maxPlayers;
var connections = 0;

var wseServer = new WebSocketEmitter.server({
    host: config.websocketBindAddress,
    port: config.websocketBindPort
});

wseServer.on('error', function(error) {
    console.log(error);
});

wseServer.on('connection', function(connection) {
    stats.count('connections.incoming');
    // Have we reached our player max?
    var ts = new Date();
    console.log(ts.toUTCString(), 'Incoming client connection');
    connections++;
    console.log('Connections: ' + connections);

    connection.on('close', function() {
        connections--;
        var ts = new Date();
        console.log(ts.toUTCString(), 'Connections: ' + connections);
    });
    if (connections > connectionLimit) {
        console.log('Denying connection, at our limit');
        connection.close();
        return;
    }
    server.connectClient(connection);
});
