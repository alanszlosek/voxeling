// TODO: clean this up. fewer globals

// TODO: use object pool for vector arrays
var Growable = require('../growable');
var pool = require('../object-pool');
var timer = require('../timer');
var Coordinator;
var chunkCache;
var chunkSize = 2;
var voxelArraySize = chunkSize * chunkSize * chunkSize;
var tab = " ";
var debug = false;
var out = {};
var voxelsToTextures;
var textureOffsets;

// helps us load a cube with more than 1 texture
// addFace(basePosition, x, y, z, face, xFaceLength[face], xFaceTexture[face]);
var addFace = function(basePosition, x, y, z, face, len, textureValue) {
    if (!textureValue && debug) {
        console.log('why are we here?');
    }
    x += basePosition[0];
    y += basePosition[1];
    z += basePosition[2];

    if (!(textureValue in out)) {
        // Start points Growable at 1/10 of chunk with single texture, 353808 floats
        // nah, 1/20 = 88452 floats

        // Going for no allocations
        out[textureValue] = {
            position: new Growable('float32', 32000),
            texcoord: new Growable('float32', 32000),
            normal: new Growable('float32', 32000)
        };
    } else {
        // Is points large enough to fit another batch?
        out[textureValue].position.need(18);
        // Is texcoord large enough to fit another batch?
        out[textureValue].texcoord.need(12);
        out[textureValue].normal.need(18);
    }
    var points = out[textureValue].position;
    var texcoord = out[textureValue].texcoord;
    var normals = out[textureValue].normal;
    var n = [0.0, 0.0, 0.0];

    if (!(textureValue in textureOffsets)) {
        console.log(textureValue + 'not in ' + textureOffsets);
    }

    var textureBottom = textureOffsets[textureValue][0];
    var textureTop = textureOffsets[textureValue][1];
    var textureRight = textureOffsets[textureValue][2];


    // Default winding for WebGL is counter clockwise
    /*
    top: 0,
    front: 1,
    left: 2,
    back: 3,
    right: 4,
    bottom: 5
    */
    switch (face) {
        // front and back are wrong
        // front should be facing towards positive z, i think
        //case 'back':
        case 3:
            z++;
            n[2] = 1.0;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;

            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;
            break;

        //case 'front':
        case 1:
            //x += len
            n[2] = -1.0;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;

            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;
            break;

        //case 'left':
        case 2:
            n[0] = -1.0;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z - len;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;

            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z - len;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z - len;
            break;

        //case 'right':
        case 4:
            x++;
            //z += len;
            n[0] = 1.0;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z - len;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z - len;

            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z - len;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y + 1;
            points.data[ points.offset++ ] = z;
            break;

        //case 'top':
        case 0:
            y++;
            z++;
            n[1] = 1.0;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z - 1;

            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z - 1;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z - 1;
            break;

        //case 'bottom':
        case 5:
            n[1] = -1.0;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z + 1;

            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z;
            points.data[ points.offset++ ] = x;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z + 1;
            points.data[ points.offset++ ] = x - len;
            points.data[ points.offset++ ] = y;
            points.data[ points.offset++ ] = z + 1;
            break;
    }

    texcoord.data[ texcoord.offset++ ] = 0.0;
    texcoord.data[ texcoord.offset++ ] = textureBottom;
    texcoord.data[ texcoord.offset++ ] = 1.0 * len;
    texcoord.data[ texcoord.offset++ ] = textureBottom;
    texcoord.data[ texcoord.offset++ ] = 1.0 * len;
    texcoord.data[ texcoord.offset++ ] = textureTop; //endY - startY + 1 + textureOffset;
    texcoord.data[ texcoord.offset++ ] = 0;
    texcoord.data[ texcoord.offset++ ] = textureBottom;
    texcoord.data[ texcoord.offset++ ] = 1.0 * len;
    texcoord.data[ texcoord.offset++ ] = textureTop;
    texcoord.data[ texcoord.offset++ ] = 0;
    texcoord.data[ texcoord.offset++ ] = textureTop;

    /*
    texcoord.data[ texcoord.offset++ ] = 0.0;
    texcoord.data[ texcoord.offset++ ] = textureBottom;
    texcoord.data[ texcoord.offset++ ] = 1.0;
    texcoord.data[ texcoord.offset++ ] = textureBottom;
    texcoord.data[ texcoord.offset++ ] = 1.0;
    texcoord.data[ texcoord.offset++ ] = textureTop; //endY - startY + 1 + textureOffset;
    texcoord.data[ texcoord.offset++ ] = 0;
    texcoord.data[ texcoord.offset++ ] = textureBottom;
    texcoord.data[ texcoord.offset++ ] = 1.0;
    texcoord.data[ texcoord.offset++ ] = textureTop;
    texcoord.data[ texcoord.offset++ ] = 0;
    texcoord.data[ texcoord.offset++ ] = textureTop;
    */

    normals.data[ normals.offset++ ] = n[0];
    normals.data[ normals.offset++ ] = n[1];
    normals.data[ normals.offset++ ] = n[2];
    normals.data[ normals.offset++ ] = n[0];
    normals.data[ normals.offset++ ] = n[1];
    normals.data[ normals.offset++ ] = n[2];
    normals.data[ normals.offset++ ] = n[0];
    normals.data[ normals.offset++ ] = n[1];
    normals.data[ normals.offset++ ] = n[2];
    normals.data[ normals.offset++ ] = n[0];
    normals.data[ normals.offset++ ] = n[1];
    normals.data[ normals.offset++ ] = n[2];
    normals.data[ normals.offset++ ] = n[0];
    normals.data[ normals.offset++ ] = n[1];
    normals.data[ normals.offset++ ] = n[2];
    normals.data[ normals.offset++ ] = n[0];
    normals.data[ normals.offset++ ] = n[1];
    normals.data[ normals.offset++ ] = n[2];
};

var isFaceBlocked = function(basePosition, voxels, chunkSize, face, x, y, z, currentVoxelValue) {
    if (debug) {
        console.log('isFaceBlocked', chunkSize, face, x, y, z);
    }
    /*
    top: 0,
    front: 1,
    left: 2,
    back: 3,
    right: 4,
    bottom: 5
    */
    // Calculate coordinates of opposing block face
    switch (face) {
        // front
        case 1:
            z--;
            break;

        // back
        case 3:
            z++;
            break;

        // left
        case 2:
            x--;
            break;

        // right
        case 4:
            x++;
            break;

        // top
        case 0:
            y++;
            break;

        // bottom
        case 5:
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

var calculate = function(basePosition, voxels) {
    var outside = chunkSize - 1;

    var xFaceLength = [0,0,0,0]
    var xFaceTexture = [0,0,0,0]
    var zFaceLength = [
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0]
    ];
    var zFaceTexture = [
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0],
        [0,0]
    ];


    // Make position relative ... lower bound to 0 and adjust everything else
    for (var y = 0; y < chunkSize; y++) {
        var part = y * chunkSize;

        // reset xFace* and zFace*
        for (var i = 0; i < 32; i++) {
            zFaceLength[i].fill(0, 0, 2);
            zFaceTexture[i].fill(0, 0, 2);
        }

        for (var z = 0; z < chunkSize; z++) {
            var index = part + (z * chunkSize * chunkSize);

            // reset X merge lengths
            xFaceLength.fill(0, 0, 4);
            // reset X current voxel
            xFaceTexture.fill(0, 0, 4);

            for (var x = 0; x < chunkSize; x++) {
                var voxelValue = voxels[index + x];

                if (voxelValue == 16) {
                    voxelValue = 5;
                }
                if (voxelValue == 20) {
                    voxelValue = 5;
                }

                if (voxelValue == 0) {
                    // Top, front, back, bottom
                    var faces = [0, 1, 3, 5];
                    for (var i = 0; i < faces.length; i++) {
                        var face = faces[i];
                        if (xFaceLength[i] > 0) {
                            addFace(basePosition, x, y, z, face, xFaceLength[i], xFaceTexture[i]);
                            xFaceLength[i] = 0;
                            xFaceTexture[i] = 0;
                        }
                    }
                    var faces = [2, 4];
                    for (var i = 0; i < faces.length; i++) {
                        var face = faces[i];
                        if (zFaceLength[x][i] > 0) {
                            addFace(basePosition, x, y, z, face, zFaceLength[x][i], zFaceTexture[x][i]);
                            zFaceLength[x][i] = 0;
                            zFaceTexture[x][i] = 0;
                        }
                    }
                    continue;
                }
                if (!(voxelValue in voxelsToTextures)) {
                    console.log(voxelValue + ' not in voxelsToTextures, falling back to 3');
                    voxelValue = 3;
                }

                var textures = voxelsToTextures[voxelValue].textures;
                var faces = [0, 1, 3, 5];
                for (var i = 0; i < faces.length; i++) {
                    var face = faces[i];
                    // Is a face blocked? If so, do we have
                    var textureValue = textures[face];
                    var isBlocked = isFaceBlocked(basePosition, voxels, chunkSize, face, x, y, z, textureValue);

                    if (isBlocked) {
                        if (xFaceLength[i] > 0) {
                            addFace(basePosition, x, y, z, face, xFaceLength[i], xFaceTexture[i]);
                            xFaceLength[i] = 0;
                            xFaceTexture[i] = 0;
                        }
                    } else {
                        // Are textureValues same?
                        if (xFaceTexture[i] == 0) {
                            xFaceLength[i]++;
                            xFaceTexture[i] = textureValue;
                        } else if(textureValue == xFaceTexture[i]) {
                            xFaceLength[i]++;
                        } else {
                            addFace(basePosition, x, y, z, face, xFaceLength[i], xFaceTexture[i]);
                            xFaceLength[i] = 1;
                            xFaceTexture[i] = textureValue;
                        }
                    }
                }

                // Do Z direction now
                var faces = [2, 4];
                for (var i = 0; i < faces.length; i++) {
                    var face = faces[i];
                    // Is a face blocked? If so, do we have
                    var textureValue = textures[face];
                    var isBlocked = isFaceBlocked(basePosition, voxels, chunkSize, face, x, y, z, textureValue);

                    if (isBlocked) {
                        if (zFaceLength[x][i] > 0) {
                            addFace(basePosition, x, y, z, face, zFaceLength[x][i], zFaceTexture[x][i]);
                            zFaceLength[x][i] = 0;
                            zFaceTexture[x][i] = 0;
                        }
                    } else {
                        // Are textureValues same?
                        if (zFaceTexture[x][i] == 0) {
                            zFaceLength[x][i]++;
                            zFaceTexture[x][i] = textureValue;
                        } else if(textureValue == zFaceTexture[x][i]) {
                            zFaceLength[x][i]++;
                        } else {
                            addFace(basePosition, x, y, z, face, zFaceLength[x][i], zFaceTexture[x][i]);
                            zFaceLength[x][i] = 1;
                            zFaceTexture[x][i] = textureValue;
                        }
                    }
                }
            } // end X

            // Now wrap up any lingering faces from X
            var faces = [0, 1, 3, 5];
            for (var i = 0; i < faces.length; i++) {
                var face = faces[i];
                if (xFaceLength[i] > 0) {
                    // X will be 32 here, and that's fine
                    addFace(basePosition, x, y, z, face, xFaceLength[i], xFaceTexture[i]);
                }
            }
        } // end Z

        // Now wrap up any lingering faces from Z
        var faces = [2, 4];
        for (var x = 0; x < chunkSize; x++) {
            for (var i = 0; i < faces.length; i++) {
                var face = faces[i];
                if (zFaceLength[x][i] > 0) {
                    // z will be 32 here, and that's fine
                    addFace(basePosition, x, y, z, face, zFaceLength[x][i], zFaceTexture[x][i]);
                }
            }
        }
    } // end Y

};

if (!module) {
    var module = {};
}

var Meshing = module.exports = {
    config: function(cs, voxToTex, texOffsets, coordinatorHandle, cache) {
        chunkSize = cs;
        voxelArraySize = chunkSize * chunkSize * chunkSize;
        voxelsToTextures = voxToTex;
        textureOffsets = texOffsets;
        console.log(textureOffsets);
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
