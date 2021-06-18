
import { Growable } from '../growable.mjs';
import ofi from './ofi.mjs';

class RectangleMesher {
    constructor(config, voxToTex, texOffsets, coordinates, cache) {
        this._debug = false;
        this.config = config;
        this.voxelsToTextures = voxToTex;
        this.textureOffsets = texOffsets;
        this.coordinates = coordinates;
        this.cache = cache;

        this.chunkWidth = config.chunkWidth;
        this.chunkWidth2 = config.chunkWidth * config.chunkWidth;
        this.chunkWidth3 = config.chunkWidth * config.chunkWidth * config.chunkWidth;
        this.lastVoxel = config.chunkWidth - 1;

        // Z goes positive toward the viewer, negative into the distance
        // to keep in convention with WebGL, "front" refers to the face that faces the viewer.
        // that should make things less confusing when one has to reason about which faces are being culled.
        // left and right are relative to the viewer
        this.bitwiseFaces = {
            "back": 1,
            "bottom": 2,
            "front": 4,
            "left": 8,
            "right": 16,
            "top": 32
        };
        this.faceIndex = {
            "top": 0,
            "back": 1,
            "front": 2,
            "left": 3,
            "right": 4,
            "bottom": 5
        };
    }

    debug(message) {
        if (this._debug) {
            console.log(message);
        }
    }

    // TODO: test whether generic is slower than sparseSet3() and sparseSet2() which only operate on 2 and 3 nestings, no looping
    sparseSet(out, keys, value) {
        let current = out;
        let last = keys.pop();
        for (let i in keys) {
            let key = keys[i];
            let element = current[key];
            if (element) { // not undefined
                current = element;
            } else {
                current[key] = [];
                current = current[key];
            }
        }
        current[last] = value;
    }
    sparseGet(out, keys) {
        let current = out;
        while (keys.length) {
            let key = keys.shift();
            let element = current[key];
            if (element) { // not undefined
                current = element;
            } else {
                return undefined;
            }
        }
        return current;
    }
    // UNUSED: this is too slow
    sparseDelete(out, keys) {
        let current = out;
        let last = keys.pop();
        for (let i in keys) {
            let key = keys[i];
            let element = current[key];
            if (element) { // not undefined
                current = element;
            } else {
                return undefined;
            }
        }
        delete current[last];
    }

    run(basePosition, voxels) {
        if (!voxels || voxels.length == 0) {
            this.debug('Empty voxels');
            return null;
        }
        let self = this;

        let out = []; // changing from obj to array so indexes are numeric
        let sh = "  ";
        this.debug('Mesh basePosition: ' + basePosition);

        // contiguous[textureValue][faceIndex][plane][col][row]
        // voxelValue, endX position, length of contiguous run
        let contiguous = [];
        /*
        [
            3 = [
                1 = [
                    1 = 1
                ]
            ]
        ];
        */

        // keep track of previously seen textureValue
        // previous[faceIndex][plane][row] = textureValue
        let previous = [];
        let plane, column, row;

        // Build up contiguous runs per face, voxel, x and y
        for (let z = 0, indexZ = 0; z < this.chunkWidth; z++, indexZ += this.chunkWidth2) {
            for (let y = 0, indexY = indexZ; y < this.chunkWidth; y++, indexY += this.chunkWidth) {
                for (let x = 0; x < this.chunkWidth; x++) {
                    this.debug('Checking ' + [x,y,z].join(','));
                    let index = x + indexY; // indexY builds upon indexZ in the y loop, so indexZ is already involved
                    let voxelValue = voxels[index];

                    // If empty voxel, clear info about previously seen face textures
                    if (voxelValue == 0) {
                        this.debug('Empty voxel');
                        for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
                            // TODO: DRY this
                            switch (faceIndex) {
                                // Top
                                case 0:
                                    plane = y;
                                    column = x;
                                    row = z;
                                    break;
                                // Back
                                case 1:
                                    plane = z;
                                    column = x;
                                    row = y;
                                    break;
                                // Front
                                case 2:
                                    plane = z;
                                    column = x;
                                    row = y;
                                    break;
                                // Left
                                case 3:
                                    plane = x;
                                    column = z;
                                    row = y;
                                    break;
                                // Right
                                case 4:
                                    plane = x;
                                    column = z;
                                    row = y;
                                    break;
                                // Bottom
                                case 5:
                                    plane = y;
                                    column = x;
                                    row = z;
                                    break;
                            }
                            if (this.sparseGet(previous, [faceIndex, plane, row])) {
                                this.debug('Clearing previous');

                                delete previous[ faceIndex ][ plane ][ row ];
                            }
                        }
                        continue;
                    }


                    // hiddenFaceCheckIndex helps us determine whether cube faces are hidden.
                    // It holds the index to check for presence of a voxel to determine if a face is hidden.
                    // At outer edges, just use self index.
                    let oppositeFaceIndices = ofi[index];

                    
                    // Loop over faces
                    // front is easiest to reason about, start there
                    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
                        let faceTexture = this.voxelsToTextures[voxelValue].textures[ faceIndex ];

                        //if (!(faceIndex == 2 || faceIndex == 1)) continue;

                        switch (faceIndex) {
                            // Top
                            case 0:
                                plane = y;
                                column = x;
                                row = z;
                                break;
                            // Back
                            case 1:
                                plane = z;
                                column = x;
                                row = y;
                                break;
                            // Front
                            case 2:
                                plane = z;
                                column = x;
                                row = y;
                                break;
                            // Left
                            case 3:
                                plane = x;
                                column = z;
                                row = y;
                                break;
                            // Right
                            case 4:
                                plane = x;
                                column = z;
                                row = y;
                                break;
                            // Bottom
                            case 5:
                                plane = y;
                                column = x;
                                row = z;
                                break;
                        }

                        let sparseHelper = function(faceTexture, faceIndex, plane, column, row, del) {
                            let oppositeFaceIndex = oppositeFaceIndices[ faceIndex ];
                            if (oppositeFaceIndex != -1 && voxels[ oppositeFaceIndex ] > 0) {
                                // Clear info about previously seen face texture
                                if (del) {
                                    delete previous[ faceIndex ][ plane ][ row ];
                                }
                                //self.sparseDelete(previous, [faceIndex, plane, row]);
                                self.debug('Clearing previous face info');
                            } else {
                                // value of 0 might be handled implicitly, not sure
                                let newPrev = {
                                    faceTexture: faceTexture,
                                    start: column,
                                    length: 1
                                };
                                //self.debug('Setting previous at: ' + [faceIndex, plane, row].join(','));
                                //self.debug(newPrev);
                                self.sparseSet(previous, [faceIndex, plane, row], newPrev);
                                self.sparseSet(contiguous, [faceTexture, faceIndex, plane, column, row], newPrev);
                            }
                        };
                        
                        let prev = this.sparseGet(previous, [faceIndex, plane, row]);
                        if (prev) {
                            if (prev.faceTexture != faceTexture) {
                                // Run has ended, check for blocked face
                                // TODO: could conditionally create oppositeFaceIndices here
                                sparseHelper(faceTexture, faceIndex, plane, column, row, true);
                            } else {
                                prev.length++;

                                if (prev.length == 14) {
                                    sparseHelper(faceTexture, faceIndex, plane, column, row, true);
                                }
                            }
                        } else { // No info about previously seen faces
                            this.debug('No immediately previous face');
                            // possible start of a run, check for blocked face
                            // TODO: could conditionally create oppositeFaceIndices here
                            sparseHelper(faceTexture, faceIndex, plane, column, row, false);
                        }
                    }
                }
            }
        } // End z,y,x loop building up contiguous blocks

        //this.debug( JSON.stringify(previous) );
        //this.debug( JSON.stringify(contiguous) );


        // Now emit points
        // for .. in will return keys as strings. Not what we want.
        for (let textureValue = 0; textureValue < contiguous.length; textureValue++) {
            if (!contiguous[textureValue]) continue;
            //face order: top, back, front, left, right, bottom
            for (let faceIndex = 0; faceIndex < contiguous[textureValue].length; faceIndex++) {
                if (!contiguous[textureValue][faceIndex]) continue;
                // Loop over planes
                for (plane = 0; plane < contiguous[textureValue][faceIndex].length; plane++) {
                    if (!contiguous[textureValue][faceIndex][plane]) continue;
                    // Loop over columns
                    for (column = 0; column < contiguous[textureValue][faceIndex][plane].length; column++) {
                        if (!contiguous[textureValue][faceIndex][plane][column]) continue;
                        // Loop over rows
                        // loop over info on contiguous blocks, each index is plane row within the same column
                        let previousRow;
                        let rowStart = 0;
                        for (row = 0; row < contiguous[textureValue][faceIndex][plane][column].length; row++) {
                            this.debug('row: ' + row);
                            let currentRow = contiguous[ textureValue ][ faceIndex ][ plane ][ column ][ row ];
                            if (previousRow) {
                                if (currentRow) {
                                    if (previousRow.length == currentRow.length) {
                                        this.debug('Found adjacent row with same length of same texture! ' + [plane,column,row].join(','));

                                        // our texture atlas only supports up 14x14
                                        if (row - rowStart == 14) {
                                            this.debug('Reached our contiguous limit. Flushing ! ' + [plane,column,row].join(','));
                                            // We'll re-map plane, column, row in addPoints
                                            this.addPoints(
                                                out,
                                                basePosition,
                                                faceIndex, // this determines how plane, column, row are interpreted
                                                textureValue,
                                                plane,
                                                column,
                                                rowStart,
                                                // columns
                                                previousRow.length,
                                                // rows
                                                row - rowStart
                                            );
                                            rowStart = row;
                                            previousRow = currentRow;
                                        }
                                    } else {
                                        this.debug('Found different row. Flushing ! ' + [plane,column,row].join(','));
                                        // We'll re-map plane, column, row in addPoints
                                        this.addPoints(
                                            out,
                                            basePosition,
                                            faceIndex, // this determines how plane, column, row are interpreted
                                            textureValue,
                                            plane,
                                            column,
                                            rowStart,
                                            // columns
                                            previousRow.length,
                                            // rows
                                            row - rowStart
                                        );
                                        rowStart = row;
                                        previousRow = currentRow;
                                    }
                                } else {
                                    this.debug('Flushing previous. No identical contiguous at current row: ' + [plane,column,row].join(','));
                                    this.addPoints(
                                        out,
                                        basePosition,
                                        faceIndex, // this determines how plane, column, row are interpreted
                                        textureValue,
                                        plane,
                                        column,
                                        rowStart,
                                        // columns
                                        previousRow.length,
                                        // rows
                                        row - rowStart
                                    );
                                    previousRow = undefined;
                                }
                            } else {
                                if (currentRow) {
                                    this.debug('Found contiguous row at: ' + [plane,column,row].join(','));
                                    rowStart = row;
                                    previousRow = currentRow;
                                }
                            }
                        }
                        // Done row loop, add any previousRow items not yet processed
                        if (previousRow) {
                            // TODO: we might have quirkiness here
                            this.debug('Processing final row: ' + row + ' rowStart: ' + rowStart);
                            this.addPoints(
                                out,
                                basePosition,
                                faceIndex, // this determines how plane, column, row are interpreted
                                textureValue,
                                plane,
                                column,
                                rowStart,
                                // columns
                                previousRow.length,
                                // rows
                                row - rowStart
                            );
                        }
                    }
                }
            }
        }
        return out;
    }




    /*
    to understand sides, consider if the cube were a dresser
    - front represents the face you see first
    - back represents the back side you can't see
    - left is the side corresponding to you left hand
    - and so on
    */

    addPoints(out, basePosition, faceIndex, textureValue, plane, column, row, columns, rows) {
        if (!(textureValue in this.textureOffsets['offsets'])) {
            this.debug('textureValue ' + textureValue + ' not in textureOffsets');
            return;
        }

        let outIndex = faceIndex;
        // if face texture has transparency, put it in a separate bucket
        if (textureValue in this.config.texturesWithTransparency) {
            // might have string conversion issues
            outIndex += 6;
            //console.log(textureValue + ' has transp, remapping to face ' + faceIndex);
        }

        if (outIndex in out) {
            // Is points large enough to fit another batch?
            out[outIndex].position.need(18);
            // Is texcoord large enough to fit another batch?
            out[outIndex].texcoord.need(12);
        } else {
            // Start points Growable at 1/10 of chunk with single texture, 353808 floats
            // nah, 1/20 = 88452 floats

            // Going for no allocations
            out[outIndex] = {
                position: new Growable('float32', 32000),
                texcoord: new Growable('float32', 32000)
            };
        }

        var points = out[outIndex].position;
        var texcoord = out[outIndex].texcoord;
        let x, y, z;

        // i changed this to be different from horiz merge mesher ... hope it doesn't screw stuff up
        switch (faceIndex) {
            case this.faceIndex.back:
                x = column + basePosition[0];
                y = row + basePosition[1];
                z = plane + basePosition[2];
                // winding should be clockwise for this back face
                // starting from the left if you're around the back side of the cube
                // think this will keep the texture wrapping order the same
                // TODO: this might be right
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;
                break;

            case this.faceIndex.front:
                x = column + basePosition[0];
                y = row + basePosition[1];
                z = plane + basePosition[2];
                z++;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;
                break;

            case this.faceIndex.left:
                x = plane + basePosition[0];
                y = row + basePosition[1];
                z = column + basePosition[2];
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + columns;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z + columns;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z + columns;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;
                break;

            case this.faceIndex.right:
                x = plane + basePosition[0];
                y = row + basePosition[1];
                z = column + basePosition[2];
                x++;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + columns;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + columns;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + rows;
                points.data[ points.offset++ ] = z + columns;
                break;

            case this.faceIndex.top:
                x = column + basePosition[0];
                y = plane + basePosition[1];
                z = row + basePosition[2];
                y++;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + rows;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + rows;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + rows;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                break;

            case this.faceIndex.bottom:
                x = column + basePosition[0];
                y = plane + basePosition[1];
                z = row + basePosition[2];
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + rows;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + columns;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + rows;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + rows;
                break;
            default:
                this.debug('unexpected');
        }

        let offsetsInAtlas = this.textureOffsets['offsets'][textureValue];
        let textureDimensions = this.textureOffsets['textureDimensions'];
        let textureWidth = textureDimensions[0];
        let textureHeight = textureDimensions[1];

        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[0];
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[1];
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[0] + (textureWidth * columns);
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[1];
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[0] + (textureWidth * columns);
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[1] + (textureHeight * rows);

        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[0];
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[1];
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[0] + (textureWidth * columns);
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[1] + (textureHeight * rows);
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[0];
        texcoord.data[ texcoord.offset++ ] = offsetsInAtlas[1] + (textureHeight * rows);
    }
}

export { RectangleMesher };
