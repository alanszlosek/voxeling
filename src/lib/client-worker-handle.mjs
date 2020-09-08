import Log from './log';

let log = Log('client-worker-handle');

class ClientWorkerHandle {
    constructor(game) {
        this.game = game;
    }
    init() {
        var self = this;

        // set up handlers
        return new Promise(function(resolve, reject) {
            self.worker = new Worker('/client-worker.js');

            // TODO: redesign this ... these messages should be handled by something else

            self.worker.onmessage = function(e) {
                var message = e.data;        
                switch (message[0]) {
                    case 'open':
                        self.connected = true;
                        log('Client.bindEvents: connection opened');
                        break;
                    case 'close':
                        self.connected = false;
                        log('Client.bindEvents: connection closed');
                        self.game.userInterface.transition('disconnected');
                        break;
                    case 'error':
                        log('Client.bindEvents.error: ' + message[1]);
                        break;
                    case 'settings':
                        var settings = message[1];
                        var id = message[2];
                        // merge settings from server into those from the client side
                        // TODO: fix this for new engine setup
                        //self.settings = extend(self.settings, settings) // server settings squash client settings
                        log('Client.bindEvents: Got settings', settings);
                        if ('initialPosition' in settings) {
                            self.game.settings.initialPosition = settings.initialPosition;
                        }
                        self.id = id;
                        //self.player.avatarImage = avatarImage
                        log('Client.bindEvents: got id ' + id);
                        // setup complete, do we need to do additional engine setup?
                        resolve();
                        break;
                    case 'chunkVoxels':
                        var chunk = message[1];
                        self.game.voxelCache.addChunk(chunk);
                        break;
                    // Game no longer needs to hold this voxel data
                    case 'nearbyChunks':
                        var chunks = message[1];
                        self.game.voxelCache.nearbyChunks(chunks);
                        break;
        
                    // Chunk was re-meshed
                    case 'chunkMesh':
                        var chunkID = message[1];
                        var mesh = message[2];
                        self.game.voxels.showMesh(chunkID, mesh);
                        break;
                    case 'meshesToShow':
                        var meshDistances = message[1];
                        self.game.voxels.meshesToShow(meshDistances);
                        break;
        
                    // Worker relays voxel changes from the server to us
                    case 'chunkVoxelIndexValue':
                        var changes = message[1];
                        self.game.updateVoxelCache(changes);
                        break;
        
                    case 'chat':
                        var message = message[1];
                        var messages = document.getElementById('messages');
                        var el = document.createElement('dt');
                        el.innerText = message.user;
                        messages.appendChild(el);
                        el = document.createElement('dd');
                        el.innerText = message.text;
                        messages.appendChild(el);
                        messages.scrollTop = messages.scrollHeight;
                        break
        
                    // Got batch of player position updates
                    case 'players':
                        var players = message[1];
                        delete players[self.id];

                        // use lerping instead
                        var ticksPerHalfSecond = 30;
                        var calculateAdjustments = function(output, current, wanted) {
                            for (var i = 0; i < output.length; i++) {
                                output[i] = (wanted[i] - current[i]) / ticksPerHalfSecond;
                            }
                        };

                        for (var id in players) {
                            var updatedPlayerInfo = players[id];
                            let positions = updatedPlayerInfo.positions;
                            var player;
                            if (!('positions' in updatedPlayerInfo)) {
                                continue;
                            }
                            if (id in self.game.players) {
                                player = players[id];
                            } else {
                                player = players[id] = {
                                    latest: updatedPlayerInfo.positions,
                                    current: updatedPlayerInfo.positions,
                                    adjustments: [0, 0, 0, 0, 0, 0],

                                    model: new Player(self.game)
                                };
                            }

                            player.model.setTranslation(
                                updatedPlayerInfo.positions[0],
                                updatedPlayerInfo.positions[1],
                                updatedPlayerInfo.positions[2]
                            );
                            player.model.setRotation(
                                updatedPlayerInfo.positions[3],
                                updatedPlayerInfo.positions[4],
                                updatedPlayerInfo.positions[5]
                            );

                            player.model.setTexture(self.game.textureAtlas.byName[updatedPlayerInfo.avatar] );
                        }
                        // Compare players to others, remove old players
                        for (let id in self.game.player) {
                            if (!(id in players)) {
                                delete self.game.players[id];
                            }
                        }

                        break;
                    default:
                        console.log('Client received unexpected message type from WebWorker: ' + message[0]);
                }
            };
            self.worker.postMessage(['connect']);
        });
    }

    regionChange() {
        let game = this.game;
        console.log(game.config);
        this.worker.postMessage(['regionChange', game.player.getPosition(), game.config.drawDistance]);
    }
}
export { ClientWorkerHandle };
