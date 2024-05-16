
class ClientWorkerHandle {
    constructor(game) {
        this.game = game;
        this.log = game.log("ClientWorkerHandle");
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
                        self.log('Client.bindEvents: connection opened');
                        break;
                    case 'close':
                        self.connected = false;
                        self.log('Client.bindEvents: connection closed');
                        self.game.userInterface.transition('disconnected');
                        break;
                    case 'error':
                        self.log('Client.bindEvents.error: ' + message[1]);
                        break;
                    case 'settings':
                        var settings = message[1];
                        var id = message[2];
                        // merge settings from server into those from the client side
                        // TODO: fix this for new engine setup
                        //self.settings = extend(self.settings, settings) // server settings squash client settings
                        self.log('Client.bindEvents: Got settings', settings);
                        if ('initialPosition' in settings) {
                            self.game.settings.initialPosition = settings.initialPosition;
                        }
                        self.id = id;
                        //self.player.avatarImage = avatarImage
                        self.log('Client.bindEvents: got id ' + id);
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
                        self.game.voxels.showChunk(chunkID, mesh);
                        break;
                    case 'chunksToShow':
                        var chunkDistances = message[1];
                        self.game.voxels.chunksToShow(chunkDistances);
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
                        let players = message[1];
                        // remove ourselves from the player updates list
                        delete players[ self.id ];
                        self.game.multiplayer.show(players);
                        break;
                    default:
                        console.log('Client received unexpected message type from WebWorker: ' + message[0]);
                }
            };
            self.worker.postMessage(['connect']);
        });
    }

    send(message) {
        this.worker.postMessage(message);
    }

    regionChange(position) {
        let game = this.game;
        this.worker.postMessage(['regionChange', position, game.config.drawDistance]);
    }

}
export { ClientWorkerHandle };
