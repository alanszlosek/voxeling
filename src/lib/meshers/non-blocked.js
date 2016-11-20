var Growable = require('../growable');

var Coordinator;

var chunkSize = 2;

var voxelArraySize = chunkSize * chunkSize * chunkSize;

var debug = true;

var out = {};

var textureByValue;

// helps us load a cube with more than 1 texture
var addPoints = function(basePosition, face, textureValue, x, y, z) {
    if (!textureValue) {
        console.log('why are we here?');
    }
    x += basePosition[0];
    y += basePosition[1];
    z += basePosition[2];
    // Remap textureValue for a cube with more than 1 texture
    var texture = textureByValue[textureValue];
    if ('sides' in texture) {
        switch (face) {
          case 'top':
            textureValue = texture.sides[0];
            break;

          case 'front':
            textureValue = texture.sides[1];
            break;

          case 'left':
            textureValue = texture.sides[2];
            break;

          case 'back':
            textureValue = texture.sides[3];
            break;

          case 'right':
            textureValue = texture.sides[4];
            break;

          case 'bottom':
            textureValue = texture.sides[5];
            break;
        }
    }
    if (!(textureValue in out)) {
        // Start points Growable at 1/10 of chunk with single texture, 353808 floats
        // nah, 1/20 = 88452 floats
        out[textureValue] = {
            position: new Growable('float32', 88452),
            texcoord: new Growable('float32', 88452)
        };
    }
    var points = out[textureValue].position;
    var texcoord = out[textureValue].texcoord;
    // Is points large enough to fit another batch?
    points.need(18);
    // Is texcoord large enough to fit another batch?
    texcoord.need(12);
    // COUNTER CLOCKWISE
    // no need to translate face, we already have
    switch (face) {
      case 'front':
        points.append([ x, y, z, // A
        x + 1, y, z, // B
        x + 1, y + 1, z, // C
        x, y, z, // A
        x + 1, y + 1, z, // C
        x, y + 1, z ]);
        break;

      case 'back':
        points.append([ x + 1, y, z, // A
        x, y, z, // B
        x, y + 1, z, // C
        x + 1, y, z, // A
        x, y + 1, z, // C
        x + 1, y + 1, z ]);
        break;

      case 'left':
        points.append([ x, y, z, // A
        x, y, z + 1, // B
        x, y + 1, z + 1, // C
        x, y, z, // A
        x, y + 1, z + 1, // C
        x, y + 1, z ]);
        break;

      case 'right':
        points.append([ x, y, z + 1, // A
        x, y, z, // B
        x, y + 1, z, // C
        x, y, z + 1, // A
        x, y + 1, z, // C
        x, y + 1, z + 1 ]);
        break;

      case 'top':
        points.append([ x, y, z + 1, // A
        x + 1, y, z + 1, // B
        x + 1, y, z, // C
        x, y, z + 1, // A
        x + 1, y, z, // C
        x, y, z ]);
        break;

      case 'bottom':
        points.append([ x, y, z, // A
        x + 1, y, z, // B
        x + 1, y, z + 1, // C
        x, y, z, // A
        x + 1, y, z + 1, // C
        x, y, z + 1 ]);
        break;
    }
    // Always the same
    texcoord.append([ 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1 ]);
};

var calculate = function(basePosition, voxels, textureInfo) {
    var outside = chunkSize - 1;
    // Make position relative ... lower bound to 0 and adjust everything else
    var index = 0;
    for (var z = 0; z < chunkSize; z++) {
        for (var y = 0; y < chunkSize; y++) {
            for (var x = 0; x < chunkSize; x++, index++) {
                var textureValue = voxels[index];
                if (textureValue == 0) {
                    continue;
                }
                // For each face
                // Front
                if (z == outside) {
                    // Add
                    addPoints(basePosition, 'front', textureValue, x, y, z + 1);
                } else {
                    var oppositeFaceIndex = Coordinator.coordinatesToVoxelIndex(x, y, z + 1);
                    if (voxels[oppositeFaceIndex] == 0) {
                        // not blocked
                        // Add
                        addPoints(basePosition, 'front', textureValue, x, y, z + 1);
                    }
                }
                // Back
                if (z == 0) {
                    // Add
                    addPoints(basePosition, 'back', textureValue, x, y, z);
                } else {
                    var oppositeFaceIndex = Coordinator.coordinatesToVoxelIndex(x, y, z - 1);
                    if (voxels[oppositeFaceIndex] == 0) {
                        // not blocked
                        // Add
                        addPoints(basePosition, 'back', textureValue, x, y, z);
                    }
                }
                // Left
                if (x == 0) {
                    // Add
                    addPoints(basePosition, 'left', textureValue, x, y, z);
                } else {
                    var oppositeFaceIndex = Coordinator.coordinatesToVoxelIndex(x - 1, y, z);
                    if (voxels[oppositeFaceIndex] == 0) {
                        // not blocked
                        // Add
                        addPoints(basePosition, 'left', textureValue, x, y, z);
                    }
                }
                // Right
                if (x == outside) {
                    // Add
                    addPoints(basePosition, 'right', textureValue, x + 1, y, z);
                } else {
                    var oppositeFaceIndex = Coordinator.coordinatesToVoxelIndex(x + 1, y, z);
                    if (voxels[oppositeFaceIndex] == 0) {
                        // not blocked
                        // Add
                        addPoints(basePosition, 'right', textureValue, x + 1, y, z);
                    }
                }
                // Top
                if (y == outside) {
                    // Add
                    addPoints(basePosition, 'top', textureValue, x, y + 1, z);
                } else {
                    var oppositeFaceIndex = Coordinator.coordinatesToVoxelIndex(x, y + 1, z);
                    if (voxels[oppositeFaceIndex] == 0) {
                        // not blocked
                        // Add
                        addPoints(basePosition, 'top', textureValue, x, y + 1, z);
                    }
                }
                // Bottom
                if (y == 0) {
                    // Add
                    addPoints(basePosition, 'bottom', textureValue, x, y, z);
                } else {
                    var oppositeFaceIndex = Coordinator.coordinatesToVoxelIndex(x, y - 1, z);
                    if (voxels[oppositeFaceIndex] == 0) {
                        // not blocked
                        // Add
                        addPoints(basePosition, 'bottom', textureValue, x, y, z);
                    }
                }
            }
        }
    }
};

if (!module) {
    var module = {};
}

var Meshing = module.exports = {
    config: function(cs, texturesByValue, coordinatorHandle) {
        chunkSize = cs;
        voxelArraySize = chunkSize * chunkSize * chunkSize;
        textureByValue = texturesByValue;
        Coordinator = coordinatorHandle;
    },
    // position is chunk lower boundary
    mesh: function(position, voxels) {
        out = {};
        calculate(position, voxels);
        return out;
    }
};