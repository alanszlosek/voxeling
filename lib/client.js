var EventEmitter = require('events').EventEmitter;
var pool = require('./object-pool');
var debug = true;

function Client(settings) {
    var self = this;
    this.settings = settings;
    this.server = settings.server;
    // These will be set later
    this.id = null;
    this.player = null;
    this.game = null;
    this.connected = false;
    this.emitter = new EventEmitter();
    this.receivedChunks = [];

    this.worker = new Worker('/client-worker.js');

    this.bindEvents();
    //this.otherSetup();

    this.worker.postMessage(['connect'])
}

// Listen for certain events/data from the server
Client.prototype.bindEvents = function() {
    var self = this;

    this.worker.onmessage = function(e) {
        var message = e.data;
        var type = message.shift();

        var handlers = {
            open: function() {
                self.connected = true;
                if (debug) {
                    console.log('connection opened');
                }
                self.emitter.emit('open');
            },
            close: function() {
                self.connected = false;
                if (debug) {
                    console.log('connection closed');
                }
                self.emitter.emit('close');
            },
            error: function(message) {
                console.log(message);
            },
            settings: function(settings, id) {
                // merge settings from server into those from the client side
                // TODO: fix this for new engine setup
                //self.settings = extend(self.settings, settings) // server settings squash client settings
                if (debug) {
                    console.log('Got settings');
                    console.log(settings);
                }
                if ('initialPosition' in settings) {
                    self.settings.initialPosition = settings.initialPosition;
                }
                self.id = id;
                //self.player.avatarImage = avatarImage
                if (debug) {
                    console.log('got id ' + id);
                }
                // setup complete, do we need to do additional engine setup?
                self.emitter.emit('ready');
            },

            chunk: function(chunk) {
                if (debug) {
                    console.log('Received chunk', chunk);
                }
                self.game.cacheAndDrawChunk(chunk);
            },
            // First batch of chunks processed and ready for drawing, turn on WebGL and Physics
            chunksProcessed: function() {
                self.emitter.emit('hasChunks');
            },

            // fires when server sends us voxel edits [chunkID, voxelIndex, value, voxelIndex, value...]
            // would like to expand this to cover more than 1 chunk at a time
            chunkVoxelIndexValue: function(chunks) {
                for (var chunkID in chunks) {
                    if (chunkID in self.settings.chunkCache) {
                        var chunk = self.settings.chunkCache[chunkID];
                        var details = chunks[chunkID];
                        for (var i = 0; i < details.length; i += 2) {
                            var index = details[i];
                            var val = details[i + 1];
                            chunk.voxels[index] = val;
                        }
                        self.emitter.emit('chunkChanged', chunkID);
                    }
                }
            },

            chat: function(message) {
                var li = document.createElement('li');
                var messages = document.getElementById('messages');
                li.innerHTML = message.user + ': ' + message.text;
                messages.appendChild(li);
                messages.scrollTop = messages.scrollHeight;
            },

            // Got batch of player position updates
            players: function(updates) {
                delete updates[self.id];
                /*
                var pos = {
                  hey: {
                    position: [15.5, 6, 15.5]
                  }
                }
                */
                //self.game.setPlayers(updates)
                return;
                Object.keys(updates.positions).map(function(player) {
                    var update = updates.positions[player];
                    if (player === self.playerID) {
                        return;
                    }
                    // TODO: is this a new player? modify our players data structure
                    // TODO: prune players that have left: we didn't get have updates from
                    // TODO: where is this method?
                    // TODO: use update.position (which now includes X and Y rotations)
                    self.setPlayerTargetPosition(player, update);
                });
            }
        };

        handlers[type].apply(self, message);
    };
    
};

Client.prototype.otherSetup = function() {
    var self = this;

    // TODO: send position to web worker
    setInterval(function() {
        if (!self.connected || !self.player) return;
        var state = [ self.player.getX(), self.player.getY(), self.player.getZ(), self.player.getYaw(), self.player.getPitch() ];
        self.connection.emit('myPosition', state);
    }, 1000 / 10);

};

Client.prototype.on = function(name, callback) {
    this.emitter.on(name, callback);
};

module.exports = Client;