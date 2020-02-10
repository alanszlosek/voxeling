//var WebSocketEmitter = require('./lib/web-socket-emitter');
var http = require('http');
var WebSocket = require('ws');
var Server = require('./lib/server');

var chunkStore = require('./lib/chunk-stores/file');
var chunkGenerator = require('./lib/generators/server-terraced');
var stats = require('./lib/voxel-stats');
var config = require('../config');
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

// Use mysql chunk storage if the mysql module is installed
var useMysql = false;
try {
    require.resolve('mysql');
    useMysql = true;
} catch(e){}
if (useMysql) {
    if (!('mysql' in config)) {
        throw new Error('Attempted to use mysql for chunk storage, but no mysql params found in config');
    }
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

function clientUsernames() {
    var usernames = [];
    for (var clientId in server.clients) {
        var client = server.clients[clientId];
        usernames.push( client.username );
    }
    console.log('Usernames:', usernames.join(','));
}

// SERVER SETUP
// Create WebSocket and HTTP Servers separately so you can customize...
// maybe you want WebSocket on a different port?

// WEBSOCKET SETUP
var connectionLimit = config.maxPlayers;
var connections = 0;

var httpServer = new http.Server();

httpServer.listen(config.websocketBindPort, config.websocketBindAddress);

var wsServer = new WebSocket.Server({
	  server: httpServer
});

wsServer.on('error', function(error) {
    console.log(error);
});

wsServer.on('connection', function(connection) {
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
    //server.connectClient(connection);
});


var server = new Server(config, clientSettings, chunkStore, wsServer, httpServer);

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

server.on('error', function(error) {
    console.log(error);
});
