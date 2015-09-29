var EventEmitter = require('events').EventEmitter;
var WebSocketEmitter = require('./web-socket-emitter');
var decoder = require('./rle-decoder');
var pool = require('./object-pool');
var debug = false;

function Client(server, settings, generator) {
    var self = this;
    this.settings = settings;
    this.server = server;
    // These will be set later
    this.id = null;
    this.player = null;
    this.game = null;
    this.connected = false;
    this.connection = new WebSocketEmitter.client();
    this.emitter = new EventEmitter();
    this.generator = generator;
    this.receivedChunks = [];
    this.bindEvents();
    this.otherSetup();
    this.connection.connect(server);
}

Client.prototype.connect = function() {
    this.connection.open(this.server);
};

// Listen for certain events/data from the server
Client.prototype.bindEvents = function() {
    var self = this;
    var emitter = self.connection;

    emitter.on('open', function() {
        self.connected = true;
        if (debug) {
            console.log('connection opened');
        }
        self.emitter.emit('open');
    });

    emitter.on('close', function() {
        self.connected = false;
        if (debug) {
            console.log('connection closed');
        }
        self.emitter.emit('close');
    });

    emitter.on('error', function(message) {
        console.log(message);
    });

    emitter.on('settings', function(settings, id) {
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
    });

    // decode chunks in batches
    self.receivedChunks = [];
    // This shouldn't happen until after we tell the server "created" above
    emitter.on('chunks', function(pairs) {
        if (debug) {
            console.log('Received ' + pairs.length + ' chunks');
        }
        self.emitter.emit('chunks');
        // push this data off to a webworker for decoding
        // kinda need to push some uint8arrays from the pool, too
        self.receivedChunks = self.receivedChunks.concat(pairs);
    });

    // fires when server sends us voxel edits [chunkID, voxelIndex, value, voxelIndex, value...]
    // would like to expand this to cover more than 1 chunk at a time
    emitter.on('chunkVoxelIndexValue', function(details) {
        var chunkID = details.shift();
        if (debug) {
            console.log('Setting ' + chunkID + ' indexes');
        }
        var chunk = self.settings.chunkCache[chunkID];
        if (!chunk) {
            return;
        }
        for (var i = 0; i < details.length; i += 2) {
            var index = details[i];
            var val = details[i + 1];
            chunk.voxels[index] = val;
        }
        self.game.drawChunkNextUpdate(chunkID);
    });

    emitter.on('chat', function(message) {
        var li = document.createElement('li');
        var messages = document.getElementById('messages');
        li.innerHTML = message.user + ': ' + message.text;
        messages.appendChild(li);
        messages.scrollTop = messages.scrollHeight;
    });

    // Got batch of player position updates
    emitter.on('players', function(updates) {
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
    });
};

// TODO: finish this. where should it all go?
Client.prototype.otherSetup = function() {
    var self = this;

    setInterval(function() {
        if (!self.connected || !self.player) return;
        var state = [ self.player.getX(), self.player.getY(), self.player.getZ(), self.player.getYaw(), self.player.getPitch() ];
        self.connection.emit('myPosition', state);
    }, 1000 / 10);

    // damnit, game.setInterval doesn't work
    setInterval(function() {
        // TODO: perhaps keep track of how long we've spent on this step. we know we run this 10 times a second, so don't spend more
        // than 60 milliseconds, probably
        // TODO: once we shuttle this off to a worker thread, batch size shouldn't be an issue
        var pairs = self.receivedChunks.splice(0, 40);
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            var encoded = pair[0];
            // maybe data should come as an array, instead of an object, so i don't have to change the object shape when mesh is created
            var chunk = pair[1];
            var data = pool.malloc('uint8', chunk.length);
            chunk.voxels = decoder(encoded, data);
            self.generator.chunkGenerated(chunk);
        }
    }, 1000 / 10);
};

Client.prototype.on = function(name, callback) {
    this.emitter.on(name, callback);
};

module.exports = Client;