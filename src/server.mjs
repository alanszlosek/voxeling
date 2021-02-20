import chunkGenerator from './lib/generators/server-terraced.mjs';
import { MysqlChunkStore } from './lib/chunk-stores/mysql.mjs';
import config from '../config.mjs';
import configServer from '../config-server.mjs';
import { Coordinates } from './lib/coordinates.mjs';
import HLRU from 'hashlru';
import http from 'http';
import mysql from 'mysql';
import url from 'url';
import uuid from 'hat';
import WebSocket from 'websocket';
import zlib from 'zlib';

let coordinates = new Coordinates(config.chunkSize);



//var stats = require('./lib/voxel-stats');
var debug = false;

// This only gets filled by require if config.mysql isn't empty
var mysqlPool;


/*
var chunkStore = new chunkStore(
    new chunkGenerator(config.chunkSize),
    config.chunkFolder
);
*/

// Use mysql chunk storage if the mysql module is installed
/*
var useMysql = false;
try {
    require.resolve('mysql');
    useMysql = true;
} catch(e){}
if (useMysql) {
    */
    if (!('mysql' in configServer)) {
        throw new Error('Attempted to use mysql for chunk storage, but no mysql params found in configServer');
    }
    mysqlPool = mysql.createPool(configServer.mysql);
    var chunkStore = new MysqlChunkStore(
        configServer.mysql,
        new chunkGenerator(config.chunkSize)
    );
    /*
} else {
    var chunkStore = new chunkStore(
        new chunkGenerator(config.chunkSize),
        config.chunkFolder
    );
}
*/



function clientUsernames() {
    var usernames = [];
    for (var clientId in server.clients) {
        var client = server.clients[clientId];
        usernames.push( client.username );
    }
    self.log('Usernames:', usernames.join(','));
}



class Server {
    constructor(config, chunkStore) {
        this.config = config;
        this.chunkStore = chunkStore;
        this.encodedChunkCache = new HLRU(10);
        // SERVER SETUP
        // Create WebSocket and HTTP Servers separately so you can customize...
        // maybe you want WebSocket on a different port?
        this.connections = 0;
        this.clients = {};
        this.serverSettings = {
            // test with memory chunk store for now
            worldRadius: config.worldRadius || 10,
            maxPlayers: config.maxPlayers || 10
        };
        this.clientSettings = {
            initialPosition: config.initialPosition
        };

        var chunkSize = config.chunkSize;
        var origin = [0, 0, 0];
        var step = chunkSize * config.worldRadius;
        this.lastWorldChunks = [
            // Lower chunk
            origin[0] - step,
            origin[1] - step,
            origin[2] - step,

            // Farther chunk
            origin[0] + step,
            origin[1] + step,
            origin[2] + step
        ];


        this.httpServer = new http.Server();
        this.wsServer = new WebSocket.server({
            httpServer: this.httpServer
        });
    }

    init() {
        let self = this;
        let httpServer = this.httpServer;
        let wsServer = this.wsServer;
        let chunkStore = this.chunkStore;

        // Handle requests for chunk voxels
        httpServer.on('request', function(request, response) {
            self.log('HTTPRequest');
            var parsedUrl = url.parse(request.url);
            var path = decodeURIComponent(parsedUrl.path);
            if (request.method.toUpperCase() != 'GET') {
                console.log('Returning 405 for unexpected HTTP method: ' + request.method);
                // not supported
                response.writeHead(405, 'Method Not Allowed');
                response.end();
                return;
            }
            if (path.substr(0, 7) == '/chunk/') {
                var chunkId = path.substr(7);
                if (!chunkId) {
                    response.end();
                    return;
                }
                // Bail if someone requested a chunk outside our world radius
                if (!self.isChunkInBounds(chunkId)) {
                    console.log('Chunk out of bounds: ' + chunkId);
                    response.end();
                    return;
                }
                console.log('Fetching chunk: ' + chunkId);
                chunkStore.get(chunkId, function(error, chunk) {
                    if (error) {
                        console.log(error);
                        return;
                    }
                    var acceptEncoding = request.headers['accept-encoding'] || '';

                    // Note: This is not a conformant accept-encoding parser.
                    // See https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
                    if (/\bgzip\b/.test(acceptEncoding)) {
                        response.writeHead(
                            200,
                            {
                                'Content-Type': 'application/octet-stream',
                                'Content-Encoding': 'gzip',
                                // TODO: fix this to lock it down
                                'Access-Control-Allow-Origin': '*',
                                'Cache-Control': 'no-cache'
                            }
                        );
                        if ('compressedVoxels' in chunk && chunk.compressedVoxels) {
                            response.end( chunk.compressedVoxels );
                        } else {
                            response.end( zlib.gzipSync(chunk.voxels) );
                        }
                    } else {
                        response.writeHead(200, {});
                        response.end( chunk.voxels );
                    }
                });
            }
        });


        wsServer.on('request', function(request) {
            self.log('WSRequest');
            // TODO: craft origin with schema, host, port and compare
            /*
            if (request.origin != self.config.websocketBindAddress) {
                self.log('Rejecting due to origin mismatch: ' +request.origin)
                request.reject();
                return;
            }
            */
            if (self.connections > self.config.maxPlayers) {
                self.log('Denying connection, at our limit');
                request.reject();
                return;
            }

            var connection = request.accept(null, request.origin);
            var id = uuid();

            var ts = new Date();
            self.log(ts.toUTCString(), 'Incoming client connection');
            self.connections++;
            self.log('Connections: ' + self.connections);

            self.clients[id] = {
                id: id,
                // This gets updated when we get their position updates
                // Server should remove stale clients
                lastSeen: 0,
                connected: true,
                connection: connection,
                avatar: 'player',
                position: null,
                yaw: 0,
                pitch: 0,

                // The chunk ids this client cares about
                onlyTheseChunks: []
            };


            
            connection.on('message', function(frame) {
                let message = frame.utf8Data;
                // Decode message
                // Handle errors and exceptions
                var client = self.clients[id];
                var decoded = JSON.parse(message);
                var type = decoded[0];
                var payload = decoded[1];
                switch (type) {
                    case 'chat':
                        // ignore if no message provided
                        if (!payload.text) return;
                        if (payload.text.match(/script/i)) {
                            self.log('Found script tag in message. Dropping');
                            return;
                        }
                        // limit chat message length
                        if (payload.text.length > 255) payload.text = payload.text.substr(0, 140);
                        self.broadcast(null, 'chat', payload);

                        // save message to database
                        // stats.count('chat.messages.sent');
                        if (mysqlPool) {
                            var row = {
                                created_ms: Date.now(),
                                username: message.user,
                                message: message.text
                            };
                            mysqlPool.query('insert into chat SET ?', row);
                        }

                        break;

                    // when user ready ( game created, etc )
                    case 'created':
                        // emit client.created for module consumers
                        break;
                    case 'myPosition':
                        // client sends new position, rotation
                        //connection.on('myPosition', function(position, yaw, pitch, avatar) {
                        self.log('Got position');
                        client.position = payload[0];
                        client.yaw = payload[1];
                        client.pitch = payload[2];
                        client.avatar = payload[3];
                        break;

                    // Client sent us voxel changes for one or more chunks
                    case 'chunkVoxelIndexValue':
                        var changes = payload;
                        // Update our chunk store
                        self.chunkStore.gotChunkChanges(changes);

                        // Re-broadcast this to the other players, too
                        for (var chunkId in changes) {
                            var chunkChanges = {};
                            if (!self.isChunkInBounds(chunkId)) {
                                continue;
                            }
                            chunkChanges[chunkId] = changes[chunkId];

                            self.encodedChunkCache.remove(chunkId);
                            for (var clientId in self.clients) {
                                var client;
                                var connection;
                                // Don't broadcast to the client that sent us the info
                                if (clientId === id) {
                                    continue;
                                }
                                client = self.clients[clientId];
                                if (!client.connected) {
                                    continue;
                                }
                                if (debug) {
                                    self.log('sending to', clientId, args);
                                }
                                // emit over connection
                                self.sendMessage(client.connection, 'chunkVoxelIndexValue', chunkChanges);
                            }
                        }
                        break;

                    // Client tells us which chunks it wants to hear about
                    case 'onlyTheseChunks':
                        if (debug) {
                            self.log('Client only cares about these chunks', payload);
                        }
                        self.clients[id].onlyTheseChunks = payload;
                        break;
                    default:
                        if (debug) {
                            self.log('Unexpected WebSocket message: ', decoded);
                        }
                        break;
                }

            });

            connection.on('error', function(error) {
                self.log('Connection ' + id + ' error: ' + error);
            });

            connection.on('close', function(reasonCode, description) {
                self.clients[id].connected = false;
                delete self.clients[id];
                self.connections--;
                self.log('Connections: ' + self.connections);
            });

            self.sendMessage(connection, 'settings', {id: id, settings: self.clientSettings});
        });

        wsServer.on('error', function(error) {
            self.log('WebSocket error: ' + error);
        });

        httpServer.listen(self.config.websocketBindPort, self.config.websocketBindAddress);

        setInterval(function() {
            self.sendPlayers();
        }, 1000 / 3);
    }

    log(message) {
        var ts = new Date();
        console.log(ts.toUTCString() + ' ' + message);
    }

    // send message to all clients
    broadcast(id, event, payload) {
        var self = this;
        for (var clientId in self.clients) {
            var client;
            var connection;
            // Don't broadcast to the client that sent us the info
            if (clientId === id) {
                continue;
            }
            client = self.clients[clientId];
            if (!client.connected) {
                continue;
            }
            if (debug) {
                self.log('Sending to ' + clientId + ': ' + payload);
            }
            // emit over connection
            self.sendMessage(client.connection, event, payload);
        }
    }

    // broadcast position, rotation updates for each player
    sendPlayers() {
        var self = this;
        var clientIds = Object.keys(self.clients);
        if (clientIds.length === 0) {
            return;
        }
        //self.log('Sending updates for ' + clientIds.length + ' clients')
        var players = {};

        clientIds.map(function(id) {
            var client = self.clients[id];
            if (!client.position) {
                return;
            }
            // TODO: Ignore client if they're really stale
            players[id] = {
                positions: [
                    client.position[0],
                    client.position[1],
                    client.position[2],
                    client.pitch,
                    client.yaw,
                    0
                ],
                avatar: client.avatar
            };
        });

        self.broadcast(null, 'players', players);
    }

    requestNearbyChunks(position) {
        var self = this;
        this.coords.nearbyChunkIDsEach(position, 2, function(chunkID) {
            self.chunkStore.get(chunkID);
        });
    }


    isChunkInBounds(chunkID) {
        var self = this;
        var position = chunkID.split('|').map(function(value) {
            return Number(value);
        });
        if (position[0] < self.lastWorldChunks[0] || position[1] < self.lastWorldChunks[1] || position[2] < self.lastWorldChunks[2] || position[0] > self.lastWorldChunks[3] || position[1] > self.lastWorldChunks[4] || position[2] > self.lastWorldChunks[5]) {
            return false;
        }
        return true;
    }

    sendMessage(websocket, name, payload) {
        websocket.send( JSON.stringify([name, payload]) );
    }
}




let s = new Server(config, chunkStore);
s.init();
