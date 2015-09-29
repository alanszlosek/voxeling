var Generator = require('../generator');

var inherits = require('util').inherits;

module.exports = ClientGenerator;

var debug = false;

function ClientGenerator(cache, chunkSize) {
    Generator.call(this, cache, chunkSize);
    this.chunksToRequest = {};
    this.chunksToGeneratePerPass = 500;
}

inherits(ClientGenerator, Generator);

ClientGenerator.prototype.setEmitter = function(emitter) {
    this.emitter = emitter;
};

ClientGenerator.prototype.requestChunk = function(chunkID) {
    this.chunksToRequest[chunkID] = true;
};

ClientGenerator.prototype.generateChunks = function() {
    var chunkIDs = Object.keys(this.chunksToRequest);
    if (chunkIDs.length == 0) {
        return;
    }
    if (debug) {
        console.log('generateChunks');
    }
    this.emitter.emit('needChunks', chunkIDs);
    this.chunksToRequest = {};
};