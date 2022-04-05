import chunkGenerator from './lib/generators/server-terraced.mjs';


import config from '../config-client.mjs';
import configServer from '../config-server.mjs';
import { Coordinates } from './lib/coordinates.mjs';
import { existsSync, readFileSync } from 'fs';
import HLRU from 'hashlru';
import http from 'http';
import url from 'url';
import uuid from 'hat';
import WebSocket from 'websocket';
import zlib from 'zlib';


// UNCOMMENT ONE OF THESE DURING SETUP
//import mysql from 'mysql';
import { MongoDbChunkStore } from './lib/chunk-stores/mongodb.mjs';
// import { ChunkStore } from '../chunk-store.mjs';


let coordinates = new Coordinates(config.chunkSize);


//var stats = require('./lib/voxel-stats');
var debug = false;

let chunkStore;
let mysqlPool;


if ('mysql' in configServer && mysql) {
    console.log('Using MySQL Chunk Store');
    mysqlPool = mysql.createPool(configServer.mysql);
    chunkStore = new MysqlChunkStore(
        configServer.mysql,
        new chunkGenerator(config.chunkSize)
    );
} else if ('mongo' in configServer && MongoDbChunkStore) {
    console.log('Using MongoDB Chunk Store');
    chunkStore = new MongoDbChunkStore(
        configServer.mongo,
        new chunkGenerator(config.chunkSize)
    );
    chunkStore.connect();

} else {
    log('Using file-based Chunk Store');
    chunkStore = new chunkStore(
        new chunkGenerator(config.chunkSize),
        config.chunkFolder
    );
}




function clientUsernames() {
    var usernames = [];
    for (var clientId in server.clients) {
        var client = server.clients[clientId];
        usernames.push( client.username );
    }
    self.log('Usernames:', usernames.join(','));
}



class Server {
    constructor(config, configServer, chunkStore) {
        this.config = config;
        this.configServer = configServer;
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
            var parsedUrl = url.parse(request.url);
            var path = decodeURIComponent(parsedUrl.path);
            if (request.method.toUpperCase() != 'GET') {
                console.log('Returning 405 for unexpected HTTP method: ' + request.method);
                // not supported
                response.writeHead(405, 'Method Not Allowed');
                response.end();
                return;
            }
            // TODO: fix this deprecation
            if (path.substr(0, 7) == '/chunk/') {
                var chunkId = path.substr(7);
                if (!chunkId) {
                    response.end();
                    return;
                }
                // Bail if someone requested a chunk outside our world radius
                if (!self.isChunkInBounds(chunkId)) {
                    console.log('Chunk out of bounds: ' + chunkId);
                    response.writeHead(404, 'Not Found');
                    response.end();
                    return;
                }
                console.log('HTTP, fetch chunk: ' + chunkId);
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
            } else {
                // We don't need to serve many files ... 
                // this is a bit manual but express would be overkill
                let contentType;
                if (path == '/' || path == '/index.html') {
                    if (path == '/') {
                        path = '/index.html';
                    }
                    contentType = 'text/html';

                } else if (path == '/client.js' || '/client-worker.js') {
                    contentType = 'application/javascript';
                // TODO: fix these .. bad mime?
                } else if( path.match(/^\/[a-zA-Z0-9\/]+\.(png)$/) ) {
                    contentType = 'image/png';

                } else {
                    self.log('HTTP path: ' + path);
                    response.writeHead(404, 'Not Found');
                    response.end();
                    return;
                }
                path = 'www' + path;
                console.log('path: ' + path);
                if (existsSync(path)) {
                    // TODO: gzip
                    response.writeHead(200, {
                        'Content-type': contentType
                    });
                    response.end(readFileSync(path));
                } else {
                    response.writeHead(404, 'Not Found');
                    response.end();
                }
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

        httpServer.listen(self.configServer.httpBindPort, self.configServer.httpBindAddress);

        setInterval(function() {
            self.sendPlayers();
        }, 1000 / 10);
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
        var players = {};

        for (let id in this.clients) {
            var client = self.clients[id];
            if (!client.position) {
                return;
            }
            players[id] = {
                position: client.position,
                yaw: client.yaw,
                pitch: client.pitch,
                avatar: client.avatar
            };
        }

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
        if (position.length != 3) {
            return false;
        }
        if (position[0] < self.lastWorldChunks[0] || position[1] < self.lastWorldChunks[1] || position[2] < self.lastWorldChunks[2] || position[0] > self.lastWorldChunks[3] || position[1] > self.lastWorldChunks[4] || position[2] > self.lastWorldChunks[5]) {
            return false;
        }
        return true;
    }

    sendMessage(websocket, name, payload) {
        //console.log(JSON.stringify([name, payload]));
        websocket.send( JSON.stringify([name, payload]) );
    }
}




let s = new Server(config, configServer, chunkStore);
s.init();
