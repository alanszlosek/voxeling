import { Growable } from '../growable.mjs';
import timer from '../timer.mjs';

// heavily inspired by: https://devforum.roblox.com/t/how-to-make-a-greedy-mesher/474436

/*
2021-01-23
reduce redundant "is face blocked" checks
requires us to update face info on 2 faces every time we check. and somehow use this info first

would be awesome if we could use this to easily skip over blocks that are fully hidden as well
*/

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

        /*
        this.chunkWidth = 2;
        this.chunkWidth2 = 4;
        this.lastVoxel = 1;
        */
        this.visited = new Uint8Array( this.chunkWidth3 );
        this.frontHidden = new Uint8Array( this.chunkWidth3 );
        this.backHidden = new Uint8Array( this.chunkWidth3 );
        this.leftHidden = new Uint8Array( this.chunkWidth3 );
        this.rightHidden = new Uint8Array( this.chunkWidth3 );
        this.topHidden = new Uint8Array( this.chunkWidth3 );
        this.bottomHidden = new Uint8Array( this.chunkWidth3 );

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
    }

    debug(message) {
        if (this._debug) {
            console.log(message);
        }
    }

    run(basePosition, voxels) {
        if (!voxels || voxels.length == 0) {
            this.debug('Empty voxels');
            return null;
        }

        let out = {};
        let sh = "  ";
        this.debug('meshing at ' + basePosition);

        this.visited.fill(0);
        this.frontHidden.fill(0);
        this.backHidden.fill(0);
        this.leftHidden.fill(0);
        this.rightHidden.fill(0);
        this.topHidden.fill(0);
        this.bottomHidden.fill(0);

        // Update face visibility
        for (let z = 0, indexZ = 0; z < this.chunkWidth; z++, indexZ += this.chunkWidth2) {
            for (let y = 0, indexY = indexZ; y < this.chunkWidth; y++, indexY += this.chunkWidth) {
                for (let x = 0; x < this.chunkWidth; x++) {
                    this.debug('Checking ' + [x,y,z].join(','));
                    let index = x + indexY; // indexY builds upon indexZ in the y loop, so indexZ is already involved
                    let voxelValue = voxels[index];
                    if (voxelValue == 0) {
                        // TODO: we actually don't need to do anything here, since hidden defaults to false
                        /*
                        // update adjacent blocks, without going out of bounds
                        if (x < this.lastVoxel) {
                            this.leftHidden[ index + 1 ] = 0;
                        }
                        if (y < this.lastVoxel) {
                            this.bottomHidden[ index + this.chunkWidth ] = 0;
                        }
                        if (z < this.lastVoxel) {
                            this.backHidden[ index + this.chunkWidth2 ] = 0;
                        }
                        */
                    } else {
                        // Just set to adjacent block's value, since that's falsey enough for "is hidden"
                        if (x < this.lastVoxel) {
                            this.rightHidden[ index ] = voxels[ index + 1 ];
                            this.leftHidden[ index + 1 ] = voxelValue;
                        }
                        if (y < this.lastVoxel) {
                            this.topHidden[ index ] = voxels[ index + this.chunkWidth ];
                            this.bottomHidden[ index + this.chunkWidth ] = voxelValue;
                        }
                        if (z < this.lastVoxel) {
                            this.frontHidden[ index ] = voxels[ index + this.chunkWidth2 ];
                            this.backHidden[ index + this.chunkWidth2 ] = voxelValue;
                        }
                    }
                }
            }
        }

        for (let z = 0, indexZ = 0; z < this.chunkWidth; z++, indexZ += this.chunkWidth2) {
            for (let y = 0, indexY = indexZ; y < this.chunkWidth; y++, indexY += this.chunkWidth) {
                for (let x = 0; x < this.chunkWidth; x++) {
                    this.debug('Checking ' + [x,y,z].join(','));
                    let index = x + indexY; // indexY builds upon indexZ in the y loop, so indexZ is already involved

                    let voxelValue = voxels[index];

                    if (voxelValue == 0) {
                        this.debug(sh + 'Empty voxel, moving on');
                        continue;
                    }

                    // PROCESS FRONT AND BACK FACES/PLANES

                    let faces = [
                        // the order needs to line up with order specified in config->voxels->textures
                        [this.bitwiseFaces.top, x, z, this.topHidden],
                        [this.bitwiseFaces.back, x, y, this.backHidden],
                        [this.bitwiseFaces.front, x, y, this.frontHidden],
                        [this.bitwiseFaces.left, z, y, this.leftHidden],
                        [this.bitwiseFaces.right, z, y, this.rightHidden],
                        [this.bitwiseFaces.bottom, x, z, this.bottomHidden]
                    ];
                    for (let faceIndex in faces) {
                        let item = faces[faceIndex];
                        this.debug(item);
                        let bitwiseFace = item[0];
                        let startColumn = item[1];
                        let startRow = item[2];
                        let hidden = item[3];
                        
                        if (this.visited[index] & bitwiseFace) {
                            this.debug(sh + 'Face is visited, skipping');
                            continue;
                        } else if (hidden[index]) {
                            this.debug(sh + 'Face is blocked. Marking as visited at index: ' + index);
                            this.visited[index] |= bitwiseFace;
                            continue;
                        }

                        let endColumn = startColumn;
                        let endRow = startRow;
                        let tryColumn = true;
                        let tryRow = true;
                        let voxelFaceValue = this.voxelsToTextures[voxelValue].textures[ faceIndex ];
                        this.debug(sh + 'Marking face visited at index: ' + index);
                        this.visited[index] |= bitwiseFace;

                        // TODO: be able to enforce limits on expansion, maybe to 2x2, etc
                        while (tryColumn || tryRow) {
                            while (tryColumn) {
                                if (endColumn >= this.lastVoxel) {
                                    //this.debug(sh + 'Done with column');
                                    tryColumn = false;
                                    break;
                                }
                                let newEndColumn = endColumn + 1;
                                let index2;
                                // columns on four planes map to X
                                // columns on two panes map to Z
                                switch (bitwiseFace) {
                                    case this.bitwiseFaces.back:
                                    case this.bitwiseFaces.front:
                                    case this.bitwiseFaces.top:
                                    case this.bitwiseFaces.bottom:
                                        index2 = newEndColumn + (y * this.chunkWidth) + (z * this.chunkWidth2);
                                        break;
                                    case this.bitwiseFaces.left:
                                    case this.bitwiseFaces.right:
                                        index2 = x + (y * this.chunkWidth) + (newEndColumn * this.chunkWidth2);
                                        break;
                                }

                                let voxelValue2 = voxels[index2];
                                if (voxelValue2 == 0) {
                                    tryColumn = false;
                                    break;
                                }
                                let voxelFaceValue2 = this.voxelsToTextures[voxelValue2].textures[ faceIndex ];

                                this.debug(sh + 'Testing expansion to new column at: ' + [newEndColumn, endRow].join(','));

                                if (
                                    this.visited[index2] & bitwiseFace
                                    ||
                                    voxelFaceValue != voxelFaceValue2
                                    ||
                                    hidden[index2]
                                ) {
                                    tryColumn = false;
                                    this.debug(sh + 'Expanding to new column not possible');
                                    break;
                                }
                                this.debug(sh + 'Expanded to new column at ' + [newEndColumn, endRow].join(','));
        
                                // Mark relevant faces as visited
                                this.debug(sh + 'Marking face visited at index: ' + index2);
                                this.visited[index2] |= bitwiseFace;
        
                                endColumn = newEndColumn;
                            }
                            
                            // this does redundant row processing
                            let rows = 0;
                            while (tryRow) {
                                if (endRow >= this.lastVoxel) {
                                    //this.debug(sh + 'Done processing row');
                                    tryRow = false;
                                    break;
                                }
                                let newEndRow = endRow + 1;

        
                                for (let col = startColumn; col <= endColumn; col++) {
                                    let index2;
                                    switch (bitwiseFace) {
                                        case this.bitwiseFaces.back:
                                        case this.bitwiseFaces.front:
                                            index2 = col + (newEndRow * this.chunkWidth) + (z * this.chunkWidth2);
                                            this.debug(sh + 'Back index: ' + index2);
                                            break;
                                        case this.bitwiseFaces.top:
                                        case this.bitwiseFaces.bottom:
                                            index2 = col + (y * this.chunkWidth) + (newEndRow * this.chunkWidth2);
                                            break;
                                        case this.bitwiseFaces.left:
                                        case this.bitwiseFaces.right:
                                            index2 = x + (newEndRow * this.chunkWidth) + (col * this.chunkWidth2);
                                            break;
                                    }

                                    let voxelValue2 = voxels[index2];
                                    this.debug('voxelValue2: ' + voxelValue2);
                                    if (voxelValue2 == 0) {
                                        this.debug(sh + 'Empty voxel, skipping row');
                                        tryRow = false;
                                        break;
                                    }
                                    this.debug('voxelValue2: ' + voxelValue2);
                                    this.debug(voxelValue2);
                                    let voxelFaceValue2 = this.voxelsToTextures[voxelValue2].textures[ faceIndex ];

                                    this.debug(sh + 'Testing expansion on new row at: ' + [col, newEndRow].join(','));
                                    
                                    if (
                                        this.visited[index2] & bitwiseFace
                                        ||
                                        voxelFaceValue != voxelFaceValue2
                                        ||
                                        hidden[ index2 ]
                                    ) {
                                        tryRow = false;
                                        //this.debug(sh + 'Expanding to new row not possible');
                                        break;
                                    }
                                }
                                if (!tryRow) {
                                    break;
                                }
                                this.debug(sh + 'Expanded to new row at ' + [endColumn, newEndRow].join(','));

                                let indexWithoutX;
                                let indexWithoutZ;
                                // mark the row as visited
                                switch (bitwiseFace) {
                                    case this.bitwiseFaces.back:
                                    case this.bitwiseFaces.front:
                                        indexWithoutX = (newEndRow * this.chunkWidth) + (z * this.chunkWidth2);
                                        for (let col = startColumn; col <= endColumn; col++) {
                                            this.visited[col + indexWithoutX] |= bitwiseFace;
                                        }
                                        break;
                                    case this.bitwiseFaces.top:
                                    case this.bitwiseFaces.bottom:
                                        indexWithoutX = (y * this.chunkWidth) + (newEndRow * this.chunkWidth2);
                                        for (let col = startColumn; col <= endColumn; col++) {
                                            this.visited[col + indexWithoutX] |= bitwiseFace;
                                        }
                                        break;
                                    case this.bitwiseFaces.left:
                                    case this.bitwiseFaces.right:
                                        indexWithoutZ = x + (newEndRow * this.chunkWidth);
                                        for (let col = startColumn; col <= endColumn; col++) {
                                            let indexZ = col * this.chunkWidth2;
                                            this.debug(sh + 'Marking right face visited at index: ' + (indexWithoutZ + indexZ));
                                            this.visited[indexWithoutZ + indexZ] |= bitwiseFace;
                                        }
                                        break;
                                }

                                endRow = newEndRow;
                                rows++;
                                if (newEndRow >= this.lastVoxel) {
                                    tryRow = false;
                                    //this.debug(sh + 'Done for face along row');
                                    break;
                                }
                                if (rows > (this.config.meshedTriangleMaxRowSpan - 1)) {
                                    this.debug('Expanded to max of 8 rows');
                                    tryRow = false;
                                    break;
                                }

                            }

                            // insert points for triangles
                            switch (bitwiseFace) {
                                case this.bitwiseFaces.back:
                                case this.bitwiseFaces.front:
                                    this.addPoints(
                                        out,
                                        basePosition[0] + x,
                                        basePosition[1] + y,
                                        basePosition[2] + z,
                                        basePosition[0] + endColumn,
                                        basePosition[1] + endRow,
                                        basePosition[2] + z,
                                        voxelFaceValue,
                                        bitwiseFace
                                    );
                                    break;
                                case this.bitwiseFaces.top:
                                case this.bitwiseFaces.bottom:
                                    this.addPoints(
                                        out,
                                        basePosition[0] + x,
                                        basePosition[1] + y,
                                        basePosition[2] + z,
                                        basePosition[0] + endColumn,
                                        basePosition[1] + y,
                                        basePosition[2] + endRow,
                                        voxelFaceValue,
                                        bitwiseFace
                                    );
                                    break;
                                case this.bitwiseFaces.left:
                                case this.bitwiseFaces.right:
                                    this.addPoints(
                                        out,
                                        basePosition[0] + x,
                                        basePosition[1] + y,
                                        basePosition[2] + z,
                                        basePosition[0] + x,
                                        basePosition[1] + endRow,
                                        basePosition[2] + endColumn,
                                        voxelFaceValue,
                                        bitwiseFace
                                    );
                                    break;
                            }


                            this.debug(sh + 'Added face points for texture: ' + voxelValue);
                        }
                    }
                }
            }
        }
        return out;
    }

    // Checks whether face is blocked by another cube withink this chunk
    // TODO: add neighbor-chunk awareness
    // TODO: don't skip if adjacent block has transparency and is different (see logic from previous mesher)
    skipFace(voxels, x, y, z, face) {
        switch (face) {
            case this.bitwiseFaces.back:
                if (z == 0) {
                    this.debug('  Back at outside edge, dont skip');
                    return false;
                }
                z--;
                break;
            case this.bitwiseFaces.front:
                if (z == this.lastVoxel) {
                    this.debug('  Front at outer edge, dont skip');
                    return false;
                }
                z++;
                break;

            case this.bitwiseFaces.left:
                if (x == 0) {
                    this.debug('  Left at outside edge, dont skip');
                    return false;
                }
                x--;
                break;
            case this.bitwiseFaces.right:
                if (x == this.lastVoxel) {
                    this.debug('  Right at outer edge, dont skip');
                    return false;
                }
                x++;
                break;
        
            case this.bitwiseFaces.top:
                if (y == this.lastVoxel) {
                    this.debug('  Top at outside edge, dont skip');
                    return false;
                }
                y++;
                break;
            case this.bitwiseFaces.bottom:
                if (y == 0) {
                    this.debug('  Bottom at outer edge, dont skip');
                    return false;
                }
                y--;
                break;

        }
        let index = x + (y * this.chunkWidth) + (z * this.chunkWidth2);
        return voxels[ index ] != 0;
    }


    /*
    to understand sides, consider if the cube were a dresser
    - front represents the face you see first
    - back represents the back side you can't see
    - left is the side corresponding to you left hand
    - and so on
    */

    addPoints(out, x, y, z, x2, y2, z2, textureValue, face) {
        if (!(textureValue in this.textureOffsets['offsets'])) {
            this.debug('textureValue ' + textureValue + ' not in textureOffsets');
            return;
        }

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
        let textureRows;
        let textureColumns;

        // i changed this to be different from horiz merge mesher ... hope it doesn't screw stuff up
        switch (face) {
            case this.bitwiseFaces.back:
                // winding should be clockwise for this back face
                // starting from the left if you're around the back side of the cube
                // think this will keep the texture wrapping order the same
                n[2] = -1.0;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;

                textureColumns = (x2 + 1) - x;
                textureRows = (y2 + 1) - y;
                break;

            // 2020-01-13 - winding on this seems right
            case this.bitwiseFaces.front:
                z++;
                n[2] = 1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;

                textureColumns = (x2 + 1) - x;
                textureRows = (y2 + 1) - y;
                break;

            case this.bitwiseFaces.left:
                n[0] = -1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z2 + 1;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;

                textureColumns = (z2 + 1) - z;
                textureRows = (y2 + 1) - y;
                break;

            case this.bitwiseFaces.right:
                x++;
                n[0] = 1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y2 + 1;
                points.data[ points.offset++ ] = z2 + 1;

                textureColumns = (z2 + 1) - z;
                textureRows = (y2 + 1) - y;
                break;

            case this.bitwiseFaces.top:
                y++;
                n[1] = 1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;

                textureColumns = (x2 + 1) - x;
                textureRows = (z2 + 1) - z;
                break;

            case this.bitwiseFaces.bottom:
                n[1] = -1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;

                textureColumns = (x2 + 1) - x;
                textureRows = (z2 + 1) - z;
                break;
        }

        let textureBottom = this.textureOffsets['offsets'][textureValue];
        let textureTop = textureBottom + (this.textureOffsets['textureRowHeight'] * textureRows);

        texcoord.data[ texcoord.offset++ ] = 0.0;
        texcoord.data[ texcoord.offset++ ] = textureBottom;
        texcoord.data[ texcoord.offset++ ] = 1.0 * textureColumns;
        texcoord.data[ texcoord.offset++ ] = textureBottom;
        texcoord.data[ texcoord.offset++ ] = 1.0 * textureColumns;
        texcoord.data[ texcoord.offset++ ] = textureTop
        texcoord.data[ texcoord.offset++ ] = 0;
        texcoord.data[ texcoord.offset++ ] = textureBottom;
        texcoord.data[ texcoord.offset++ ] = 1.0 * textureColumns;
        texcoord.data[ texcoord.offset++ ] = textureTop;
        texcoord.data[ texcoord.offset++ ] = 0;
        texcoord.data[ texcoord.offset++ ] = textureTop;


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
    }

}

export { RectangleMesher };
