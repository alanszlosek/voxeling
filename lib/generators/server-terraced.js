var Generator = require('../generator');
var inherits = require('util').inherits;
var debug = false;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}


var ServerGenerator = function(chunkSize) {
    Generator.call(this, chunkSize);
    // 1 block rise, each ring of chunks out from center
    this.generateVoxel = function(x, y, z, chunkSize) {
        if (y == 0) {
            return 1;
        }
        if (y < 0) {
            // 5 in 50 chance of obsidian
            // 10 in 50 chance of empty
            // 1 in 50 chance of lava
            // 5 in 50 chance of granite
            // 5 in 50 chance of slate
            /*
        var chance = getRandomInt(1, 50)
        if (chance < 6) {
          return 4 // obsidian
        } else if (chance < 16) {
          return 0 // empty
        } else if (chance == 16) {
          return 7 // lava
        } else if (chance < 22) {
          return 13 // granite
        } else if (chance < 27) {
          return 19 //slate
        }
        */
            return 3;
        }
        var chunkX = Math.abs(Math.floor(x / chunkSize));
        //var chunkY = Math.abs(Math.floor(y / chunkSize))
        var chunkZ = Math.abs(Math.floor(z / chunkSize));
        var out = Math.max(chunkX, chunkZ);
        if (y <= out) {
            return 1;
        }
        return 0;
    };
};
inherits(ServerGenerator, Generator);

module.exports = ServerGenerator;

