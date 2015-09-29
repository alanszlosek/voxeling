module.exports = function(opts) {
  return new Coordinator(opts)
}

module.exports.Coordinator = Coordinator

function Coordinator(chunkSize) {
  this.chunkSize = chunkSize || 32

  if (this.chunkSize & this.chunkSize-1 !== 0) {
    throw new Error('chunkSize must be a power of 2')
  }
  this.voxelMask = this.chunkSize - 1
  this.chunkMask = ~this.voxelMask
}

Coordinator.prototype.nearbyChunkIDsEach = function(position, horizontalDistance, verticalDistance, callback) {
  var current = this.positionToChunk(position)
  var step = this.chunkSize
  horizontalDistance = horizontalDistance * step
  verticalDistance = verticalDistance * step
  var x = current[0]
  var y = current[1]
  var z = current[2]
  var fromX = x - horizontalDistance
  var fromY = y - verticalDistance
  var fromZ = z - horizontalDistance
  var toX = x + horizontalDistance
  var toY = y + verticalDistance
  var toZ = z + horizontalDistance
  for (var cx = fromX; cx <= toX; cx += step) {
    for (var cy = fromY; cy <= toY; cy += step) {
      for (var cz = fromZ; cz <= toZ; cz += step) {
        callback(cx + '|' + cy + '|' + cz)
      }
    }
  }
}

// Use lower boundary as the chunk position/ID
Coordinator.prototype.coordinatesToChunkID = function(x, y, z) {
  var mask = this.chunkMask
  var cx = x & mask
  var cy = y & mask
  var cz = z & mask
  return cx + '|' + cy + '|' + cz
}

Coordinator.prototype.positionToChunk = function(position) {
  return this.coordinatesToChunk(position[0], position[1], position[2])
}

Coordinator.prototype.coordinatesToChunk = function(x, y, z) {
  var mask = this.chunkMask
  var cx = x & mask
  var cy = y & mask
  var cz = z & mask
  return [cx, cy, cz]
}

Coordinator.prototype.positionToChunkID = function(position) {
  return this.coordinatesToChunkID(position[0], position[1], position[2])
};

Coordinator.prototype.coordinatesToVoxelIndex = function(x, y, z) {
  var mask = this.voxelMask
  var mx = (x & mask)
  var my = (y & mask)
  var mz = (z & mask)
  //var val = chunk.voxels.get(mx, my, mz)
  var index = mx + (my*this.chunkSize) + (mz*this.chunkSize*this.chunkSize)
  return index
}

Coordinator.prototype.positionToVoxelIndex = function(pos) {
  return this.coordinatesToVoxelIndex(pos[0], pos[1], pos[2])
}