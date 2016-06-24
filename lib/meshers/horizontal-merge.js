// TODO: clean this up. fewer globals

var Growable = require('../growable');

// TODO: use object pool for vector arrays
var pool = require('../object-pool');
var timer = require('../timer');
var Coordinator;
var chunkCache;
var chunkSize = 2;
var voxelArraySize = chunkSize * chunkSize * chunkSize;
var tab = " ";
var debug = false;
var out = {};
var texturesByValue;

// helps us load a cube with more than 1 texture
var addFace = function(basePosition, face, info) {
    var textureValue = info.textureValue;
    var start = info.start;
    var end = info.end;
    if (!textureValue && debug) {
        console.log('why are we here?');
    }
    var startX = basePosition[0] + start[0],
        startY = basePosition[1] + start[1],
        startZ = basePosition[2] + start[2],
        endX = basePosition[0] + end[0],
        endY = basePosition[1] + end[1],
        endZ = basePosition[2] + end[2];
    if (!(textureValue in out)) {
        // Start points Growable at 1/10 of chunk with single texture, 353808 floats
        // nah, 1/20 = 88452 floats
        out[textureValue] = {
            position: new Growable('float32', 256),
            texcoord: new Growable('float32', 256),
            normal: new Growable('float32', 256)
        };
    }
    var points = out[textureValue].position;
    var texcoord = out[textureValue].texcoord;
    var normals = out[textureValue].normal;
    // Is points large enough to fit another batch?
    points.need(18);
    // Is texcoord large enough to fit another batch?
    texcoord.need(12);
    normals.need(18);

    // COUNTER CLOCKWISE
    // no need to translate face, we already have
    switch (face) {
        // front and back are wrong
        case 'back':
            points.append([
                startX, startY, startZ + 1, // A
                endX + 1, startY, startZ + 1, // B
                endX + 1, endY + 1, startZ + 1, // C

                startX, startY, startZ + 1, // A
                endX + 1, endY + 1, startZ + 1, // C
                startX, endY + 1, startZ + 1
            ]);
            texcoord.append([
                0, 0,
                endX - startX + 1, 0,
                endX - startX + 1, endY - startY + 1,

                0, 0,
                endX - startX + 1, endY - startY + 1,
                0, endY - startY + 1
            ]);
            normals.append([
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
            ]);
            break;

        case 'front':
            points.append([
                endX + 1, startY, startZ, // A
                startX, startY, startZ, // B
                startX, endY + 1, startZ, // C

                endX + 1, startY, startZ, // A
                startX, endY + 1, startZ, // C
                endX + 1, endY + 1, startZ // D
            ]);
            texcoord.append([
                0, 0,
                endX - startX + 1, 0,
                endX - startX + 1, endY - startY + 1,

                0, 0,
                endX - startX + 1, endY - startY + 1,
                0, endY - startY + 1
            ]);
            normals.append([
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0
            ]);
            break;

        case 'left':
            points.append([
                startX, startY, startZ, // A
                startX, startY, endZ + 1, // B
                startX, endY + 1, endZ + 1, // C

                startX, startY, startZ, // A
                startX, endY + 1, endZ + 1, // C
                startX, startY + 1, startZ
            ]);
            texcoord.append([
                0, 0,
                endZ - startZ + 1, 0,
                endZ - startZ + 1, endY - startY + 1,

                0, 0,
                endZ - startZ + 1, endY - startY + 1,
                0, endY - startY + 1
            ]);
            normals.append([
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0
            ]);
            break;

        case 'right':
            points.append([
                startX + 1, startY, endZ + 1, // A
                startX + 1, startY, startZ, // B
                startX + 1, startY + 1, startZ, // C

                startX + 1, startY, endZ + 1, // A
                startX + 1, startY + 1, startZ, // C
                startX + 1, endY + 1, endZ + 1
            ]);
            texcoord.append([
                0, 0,
                endZ - startZ + 1, 0,
                endZ - startZ + 1, endY - startY + 1,

                0, 0,
                endZ - startZ + 1, endY - startY + 1,
                0, endY - startY + 1
            ]);
            normals.append([
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0
            ]);
            break;

        case 'top':
            points.append([
                startX, startY + 1, endZ + 1, // A
                endX + 1, startY + 1, endZ + 1, // B
                endX + 1, startY + 1, startZ, // C

                startX, startY + 1, endZ + 1, // A
                endX + 1, startY + 1, startZ, // C
                startX, startY + 1, startZ
            ]);
            texcoord.append([
                0, 0,
                endX - startX + 1, 0,
                endX - startX + 1, endZ - startZ + 1,

                0, 0,
                endX - startX + 1, endZ - startZ + 1,
                0, endZ - startZ + 1
            ]);
            normals.append([
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0
            ]);
            break;

        case 'bottom':
            // bottom is
            points.append([
                startX, startY, startZ, // A
                endX + 1, startY, startZ, // B
                endX + 1, startY, endZ + 1, // C
                startX, startY, startZ, // A
                endX + 1, startY, endZ + 1, // C
                startX, startY, endZ + 1
            ]);
            texcoord.append([
                0, 0,
                endX - startX + 1, 0,
                endX - startX + 1, endZ - startZ + 1,

                0, 0,
                endX - startX + 1, endZ - startZ + 1,
                0, endZ - startZ + 1
            ]);
            normals.append([
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0
            ]);
            break;
    }
};

var addFaces = function(basePosition, current) {
    for (var face in current) {
        if (current[face] != null) {
            addFace(basePosition, face, current[face]);
        }
    }
};

var resetFaces = function(current) {
    for (var face in current) {
        current[face] = null;
    }
};

var isFaceBlocked = function(basePosition, voxels, chunkSize, face, x, y, z, currentVoxelValue) {
    if (debug) {
        console.log('isFaceBlocked', chunkSize, face, x, y, z);
    }
    // Calculate coordinates of opposing block face
    switch (face) {
      case 'front':
        z--;
        break;

      case 'back':
        z++;
        break;

      case 'left':
        x--;
        break;

      case 'right':
        x++;
        break;

      case 'top':
        y++;
        break;

      case 'bottom':
        y--;
        break;
    }
    // Is this in another chunk? Use basePosition to calculate and check voxel from other chunk
    if (x < 0 || x >= chunkSize || y < 0 || y >= chunkSize || z < 0 || z >= chunkSize) {
        // Convert to world-relative position
        x += basePosition[0];
        y += basePosition[1];
        z += basePosition[2];
        // Get chunk those coordinates are within
        var opposingChunkID = Coordinator.coordinatesToChunkID(x, y, z);
        // Get index within that chunk
        var opposingIndex = Coordinator.coordinatesToVoxelIndex(x, y, z);
        //console.log(opposingChunkID, opposingIndex);
        if (opposingChunkID in chunkCache) {
            var opposingChunk = chunkCache[opposingChunkID];
            var opposingVoxelValue = opposingChunk.voxels[ opposingIndex ];
            return shouldSkipFace(currentVoxelValue, opposingVoxelValue);
        }

        return false;
    }
    var index = Coordinator.coordinatesToVoxelIndex(x, y, z);
    var opposingVoxelValue = voxels[index];

    return shouldSkipFace(currentVoxelValue, opposingVoxelValue);
};

var shouldSkipFace = function(currentVoxelValue, opposingVoxelValue) {
    if (opposingVoxelValue == 0) {
        return false;
    }
    /*
    We don't want to draw the transparent face if it's against an opaque one, but we do want to draw the opaque one
    Don't draw opaque face if opposite opaque face
    Don't draw transparent face if opposite transparent face
    */
    if (currentVoxelValue < 100) {
        if (opposingVoxelValue > 99) {
            return false;
        }
        return true;
    }
    // If we got here, the current face is transparent
    if (opposingVoxelValue > 0) {
        return true;
    }
    return false;    
};

var faceIndex = function(face) {
    var map = {
        top: 0,
        front: 1,
        left: 2,
        back: 3,
        right: 4,
        bottom: 5
    };
    return map[face];
};

var calculate = function(basePosition, voxels) {
    var outside = chunkSize - 1;
    // Make position relative ... lower bound to 0 and adjust everything else
    for (var y = 0; y < chunkSize; y++) {
        // points to current start/end object for this face
        var adjacent = {
            front: null,
            back: null,
            top: null,
            bottom: null
        };
        var part = y * chunkSize;
        for (var z = 0; z < chunkSize; z++) {
            var index = part + (z * chunkSize * chunkSize);
            resetFaces(adjacent);
            for (var x = 0; x < chunkSize; x++) {
                var voxelTextureValue = voxels[index + x];
                if (voxelTextureValue == 0) {
                    addFaces(basePosition, adjacent);
                    resetFaces(adjacent);
                    continue;
                }
                if (!(voxelTextureValue in texturesByValue)) {
                    voxelTextureValue = 3;
                    console.log('falling back to 3');
                }
                // handle left and right faces separately
                // is left blocked, add it
                // is right blocked? add it
                // only loop through current pointer faces
                for (var face in adjacent) {
                    var isBlocked = false;
                    var textureValue;
                    if ('sides' in texturesByValue[voxelTextureValue]) {
                        textureValue = texturesByValue[voxelTextureValue].sides[faceIndex(face)];
                    } else {
                        textureValue = voxelTextureValue;
                    }
                    isBlocked = isFaceBlocked(basePosition, voxels, chunkSize, face, x, y, z, textureValue);
                    if (debug) {
                        console.log('face: ' + face);
                    }
                    if (isBlocked) {
                        if (adjacent[face] != null) {
                            addFace(basePosition, face, adjacent[face]);
                            adjacent[face] = null;
                        }
                    } else {
                        // should we create a new face pointer?
                        if (adjacent[face] == null) {
                            if (debug) {
                                console.log('new pointer');
                            }
                            adjacent[face] = {
                                textureValue: textureValue,
                                start: [ x, y, z ],
                                end: [ x, y, z ]
                            };
                            if (debug) {
                                console.log(adjacent);
                            }
                        } else if (adjacent[face].textureValue == textureValue) {
                            if (debug) {
                                console.log('same texture');
                            }
                            // yes, update end position
                            adjacent[face].end[0] = x;
                            adjacent[face].end[1] = y;
                            adjacent[face].end[2] = z;
                        } else {
                            if (debug) {
                                console.log('else');
                            }
                            // no, close and create a new pointer for this face
                            addFace(basePosition, face, adjacent[face]);
                            adjacent[face] = {
                                textureValue: textureValue,
                                start: [ x, y, z ],
                                end: [ x, y, z ]
                            };
                        }
                    }
                }
            }
            // end X
            // Done with row, do we have any outstanding faces to add?
            addFaces(basePosition, adjacent);
            resetFaces(adjacent);
        } // end Z

        adjacent = {
            left: null,
            right: null
        };
        for (var x = 0; x < chunkSize; x++) {
            var index = part + x;
            resetFaces(adjacent);
            for (var z = 0; z < chunkSize; z++) {
                var voxelTextureValue = voxels[index + (z * chunkSize * chunkSize)];
                if (voxelTextureValue == 0) {
                    addFaces(basePosition, adjacent);
                    resetFaces(adjacent);
                    continue;
                }
                if (!(voxelTextureValue in texturesByValue)) {
                    voxelTextureValue = 3;
                    console.log('falling back to 3');
                }
                // handle left and right faces separately
                // is left blocked, add it
                // is right blocked? add it
                // only loop through current pointer faces
                for (var face in adjacent) {
                    var isBlocked = false;
                    var textureValue;
                    if ('sides' in texturesByValue[voxelTextureValue]) {
                        textureValue = texturesByValue[voxelTextureValue].sides[faceIndex(face)];
                    } else {
                        textureValue = voxelTextureValue;
                    }
                    isBlocked = isFaceBlocked(basePosition, voxels, chunkSize, face, x, y, z, textureValue);
                    if (debug) {
                        console.log('face: ' + face, 'blocked:', isBlocked);
                    }
                    if (isBlocked > 0) {
                        if (adjacent[face] != null) {
                            addFace(basePosition, face, adjacent[face]);
                            adjacent[face] = null;
                        }
                    } else {
                        // should we create a new face pointer?
                        if (adjacent[face] == null) {
                            if (debug) {
                                console.log('new pointer');
                            }
                            adjacent[face] = {
                                textureValue: textureValue,
                                start: [ x, y, z ],
                                end: [ x, y, z ]
                            };
                            if (debug) {
                                console.log(adjacent);
                            }
                        } else if (adjacent[face].textureValue == textureValue) {
                            // yes, update end position
                            adjacent[face].end[0] = x;
                            adjacent[face].end[1] = y;
                            adjacent[face].end[2] = z;
                            if (debug) {
                                console.log('same texture', adjacent[face]);
                            }
                        } else {
                            if (debug) {
                                console.log('else');
                            }
                            // no, close and create a new pointer for this face
                            addFace(basePosition, face, adjacent[face]);
                            adjacent[face] = {
                                textureValue: textureValue,
                                start: [ x, y, z ],
                                end: [ x, y, z ]
                            };
                        }
                    }
                }
            }
            // end Z
            // Done with row, do we have any outstanding faces to add?
            addFaces(basePosition, adjacent);
            resetFaces(adjacent);
        } // end X
    } // end Y

};

if (!module) {
    var module = {};
}

var Meshing = module.exports = {
    config: function(cs, textures, coordinatorHandle, cache) {
        chunkSize = cs;
        voxelArraySize = chunkSize * chunkSize * chunkSize;
        texturesByValue = textures.byValue;
        Coordinator = coordinatorHandle;
        chunkCache = cache;
    },
    // position is chunk lower boundary
    mesh: function(position, voxels) {
        if (!voxels || voxels.length == 0) {
            console.log('Empty voxels');
            return null;
        }
        // Reset
        out = {};
        var start = Date.now();
        calculate(position, voxels);
        timer.log('mesher', Date.now() - start);
        return out;
    }
};
