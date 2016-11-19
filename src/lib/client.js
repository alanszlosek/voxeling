var EventEmitter = require('events').EventEmitter;
var pool = require('./object-pool');
var log = require('./log')('lib/client', false);

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
    var messageHandlers = {
        open: function() {
            self.connected = true;
            log('Client.bindEvents: connection opened');
            self.emitter.emit('open');
        },
        close: function() {
            self.connected = false;
            log('Client.bindEvents: connection closed');
            self.emitter.emit('close');
        },
        error: function(message) {
            log('Client.bindEvents.error: ' + message);
        },
        settings: function(settings, id) {
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
        },

        chunkVoxels: function(chunk) {
            self.game.storeVoxels(chunk);
        },
        // Game no longer needs to hold this voxel data
        nearbyChunks: function(chunks) {
            self.game.nearbyChunks(chunks);
        },
        // Chunk was re-meshed
        chunkMesh: function(chunkID, mesh) {
            self.voxels.showMesh(chunkID, mesh);
        },
        meshesToShow: function(meshDistances) {
            self.voxels.meshesToShow(meshDistances);
        },

        // Worker relays voxel changes from the server to us
        chunkVoxelIndexValue: function(changes) {
            self.game.updateVoxelCache(changes);
        },

        chat: function(message) {
            var messages = document.getElementById('messages');
            var el = document.createElement('dt');
            el.innerText = message.user;
            messages.appendChild(el);
            el = document.createElement('dd');
            el.innerText = message.text;
            messages.appendChild(el);
            messages.scrollTop = messages.scrollHeight;
        },

        // Got batch of player position updates
        players: function(players) {
            delete players[self.id];
            self.emitter.emit('players', players);
        }
    };

    this.worker.onmessage = function(e) {
        var message = e.data;
        var type = message.shift();
        messageHandlers[type].apply(self, message);
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

module.exports = Client;