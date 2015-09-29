var extend = require('extend')
var EventEmitter = require('events').EventEmitter
//var stats = require('voxeling-stats')

module.exports = Generator


var debug = false


// Default is a flat world
var generateVoxel = function(x, y, z, chunkSize) {
  if (y < 1) {
    return 1; // grass and dirt
  }
  return 0;
}


// expects a configured voxel module instance
function Generator(cache, chunkSize) {
  if (!(this instanceof Generator)) return new Generator(cache, chunkSize);
  var self = this;

  if (!chunkSize) {
    throw new Exception('voxel-generator: chunkSize is required');
    return;
  }

  extend(self, new EventEmitter());

  this.chunkSize = chunkSize;
  this.chunkArraySize = self.chunkSize * self.chunkSize * self.chunkSize;
  this.chunkCache = cache;

  // contains new chunks yet to be generated. Handled by game.loadPendingChunks
  this.chunksToGenerate = {};
  this.chunksToGeneratePerPass = 50;
  this.generateVoxel = generateVoxel;

  // every half-second?
  this.interval = setInterval(Generator.prototype.generateChunks.bind(this), 500);
}

Generator.prototype.cacheChunk = function(chunk) {
  if (debug) {
    console.log('Caching ' + chunk.chunkID);
  }
  this.chunkCache[chunk.chunkID] = chunk;
}

// Queue the chunk for generation
Generator.prototype.requestChunk = function(chunkID) {
  if (debug) {
    console.log(chunkID + ' requested');
  }
  var chunk = this.chunkCache[chunkID];
  if (chunk) { // Chunk has already been generated
    // takes care fo removing from this.chunksToGenerate
    this.chunkGenerated(chunk);

  } else if (!(chunkID in this.chunksToGenerate)) {
    // start off as false (not currently being generated)
    this.chunksToGenerate[chunkID] = false;
  }
}

// Call this on tick
Generator.prototype.generateChunks = function() {
  var self = this
  var chunk
  //if (debug) console.log('Generator:generateChunks')
  // How many should we generated in a pass? Probably not all of them

  var count = 0
  for (var chunkID in this.chunksToGenerate) {
    if (count > self.chunksToGeneratePerPass) {
      break
    }
    if (this.chunksToGenerate[chunkID]) { // is this one being generated?
      continue
    }
    this.chunksToGenerate[chunkID] = true
    chunk = this.makeChunkStruct(chunkID)
    this.generateChunk(chunk)
    count++
  }
}

/*
Generate voxels for a chunk, and return them within a chunk struct
*/
Generator.prototype.generateChunk = function(chunk) {
  var self = this
  if (debug) {
    console.log('Generator:generateChunk')
  }
  var started = Date.now()
  this.fillChunkVoxels(chunk, this.generateVoxel, this.chunkSize)
  //stats('generateChunk', started)
  this.chunkGenerated(chunk)
}

// If you override generateChunk(), please call chunkGenerated() with the chunk when you've done so
Generator.prototype.chunkGenerated = function(chunk) {
  var chunkID = chunk.chunkID
  //this.cacheChunk(chunk)
  delete this.chunksToGenerate[chunkID]
  this.emit('chunkGenerated', chunk)
}

// TODO: this needs to be accessible outside an instance, right?
Generator.prototype.fillChunkVoxels = function(chunk, fn, chunkSize) {
  var lo = chunk.position
  var ii = lo[0] + chunkSize
  var jj = lo[1] + chunkSize
  var kk = lo[2] + chunkSize
  var index = 0

  for(var k = lo[2]; k < kk; k++) {
    for (var j = lo[1]; j < jj; j++) {
      for (var i = lo[0]; i < ii; i++, index++) {
        chunk.voxels[index] = fn(i, j, k, chunkSize)
      }
    }
  }
}


Generator.prototype.makeChunkStruct = function(chunkID) {
  var position = chunkID.split('|').map(function(value) {
    return Number(value)
  })
  return {
    position: position,
    chunkID: chunkID
  }
}

// teardown methods
Generator.prototype.destroy = function() {
  clearInterval(this.interval)
}
