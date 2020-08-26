// TODO: fix me
var EventEmitter = require('events').EventEmitter;
import { Log } from '../log';
var log = Log('lib/client', false);

function Client(settings) {
    var self = this;
    this.settings = settings;
    this.server = settings.server;
    // These will be set later
    this.id = null;
    this.player = null;
    this.avatar = 'player';
    this.players = null;
    this.voxels = null;
    this.camera = null;
    this.game = null;
    this.connected = false;
    this.emitter = new EventEmitter();
    this.receivedChunks = [];

    this.worker = new Worker('/client-worker.js');

    this.bindEvents();
    this.otherSetup();

    this.worker.postMessage(['connect'])
};

// Listen for certain events/data from the server
Client.prototype.bindEvents = function() {
    var self = this;

    this.worker.onmessage = function(e) {
        var message = e.data;

        switch (message[0]) {
            case 'open':
                self.connected = true;
                log('Client.bindEvents: connection opened');
                self.emitter.emit('open');
                break;
            case 'close':
                self.connected = false;
                log('Client.bindEvents: connection closed');
                self.emitter.emit('close');
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
                    self.settings.initialPosition = settings.initialPosition;
                }
                self.id = id;
                //self.player.avatarImage = avatarImage
                log('Client.bindEvents: got id ' + id);
                // setup complete, do we need to do additional engine setup?
                self.emitter.emit('ready');
                break;
            case 'chunkVoxels':
                var chunk = message[1];
                self.game.storeVoxels(chunk);
                break;
            // Game no longer needs to hold this voxel data
            case 'nearbyChunks':
                var chunks = message[1];
                self.game.nearbyChunks(chunks);
                break;

            // Chunk was re-meshed
            case 'chunkMesh':
                var chunkID = message[1];
                var mesh = message[2];
                self.voxels.showMesh(chunkID, mesh);
                break;
            case 'meshesToShow':
                var meshDistances = message[1];
                self.voxels.meshesToShow(meshDistances);
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
                self.emitter.emit('players', players);
                break;
            default:
                console.log('Client received unexpected message type from WebWorker: ' + message[0]);
        }
    };

};

Client.prototype.regionChange = function() {
    this.worker.postMessage(['regionChange', this.player.getPosition(), this.camera.follow.getRotationQuat(), this.settings.drawDistance, this.settings.removeDistance]);
};

Client.prototype.otherSetup = function() {
    var self = this;

    // TODO: send position to web worker
    setInterval(function() {
        if (!self.player) return;
        self.worker.postMessage(
            ['playerPosition', self.player.getPosition(), self.player.getYaw(), self.player.getPitch(), self.avatar ]
        );
    }, 1000 / 10);
};

Client.prototype.on = function(name, callback) {
    this.emitter.on(name, callback);
};

export { Client };