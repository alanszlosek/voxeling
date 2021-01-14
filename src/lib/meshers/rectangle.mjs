import { Growable } from '../growable.mjs';
import timer from '../timer.mjs';


class RectangleMesher {
    constructor(config, voxToTex, texOffsets, coordinates, cache) {
        this.config = config;
        this.voxelsToTextures = voxToTex;
        this.textureOffsets = texOffsets;
        this.coordinates = coordinates;
        this.cache = cache;

        this.chunkWidth = 32;
        this.chunkWidth2 = 32 * 32;
        this.lastVoxel = 31;

        this.chunkWidth = 2;
        this.chunkWidth2 = 4;
        this.lastVoxel = 1;
        this.visited = new Uint8Array( this.chunkWidth * this.chunkWidth * this.chunkWidth);
        // there might be room to exclude faces that are internal that are internal and surrounded by other blocks
        // but that will be hard to calculate
        //this.willBeDrawn = new Uint8Array( this.chunkWidth * this.chunkWidth * this.chunkWidth);


        this.bitwiseFaces = {
            "back": 1,
            "bottom": 2,
            "front": 4,
            "left": 8,
            "right": 16,
            "top": 32
        };
    }

    run(basePosition, voxels) {
        if (!voxels || voxels.length == 0) {
            console.log('Empty voxels');
            return null;
        }

        let out = {};
        var start = Date.now();

        this.visited.fill(0);

        console.log(basePosition, voxels);

        // PROCESS FRONT AND BACK FACES/PLANES
        for (let z = 0; z < this.chunkWidth; z++) {
            for (let y = 0; y < this.chunkWidth; y++) {
                let indexWithoutX = (y * this.chunkWidth) + (z * this.chunkWidth2);
                for (let x = 0; x < this.chunkWidth; x++) {
                    console.log('Checking ' + [x,y,z].join(','));
                    let index = indexWithoutX + x;

                    let voxelValue = voxels[index];
                    if (voxelValue in this.config.voxelRemap) {
                        voxelValue = this.config.voxelRemap[voxelValue];
                    }

                    if (voxelValue == 0) {
                        console.log('Empty voxel, moving on');
                        continue;
                    }


                    // BACK
                    let skipBack = (
                        this.visited[index] & this.bitwiseFaces.back
                        ||
                        this.skipFace(voxels, x, y, z, this.bitwiseFaces.back)
                    );
                    let tryBackX = !skipBack;
                    let tryBackY = !skipBack;
                    let startBackX = x;
                    let startBackY = y ;
                    let endBackX = x;
                    let endBackY = y;

                    if (!skipBack) {
                        console.log('Back is neither visited nor blocked');
                    } else {
                        console.log('Back is visited or blocked, should skip');
                    }

                    while (tryBackX || tryBackY) {
                        while (tryBackX) {
                            if (endBackX >= this.lastVoxel) {
                                console.log('Done for back in X direction');
                                tryBackX = false;
                                break;
                            }
                            let newEndBackX = endBackX + 1;
                            let index2 = newEndBackX + (y * this.chunkWidth) + (z * this.chunkWidth2);

                            let voxelValue2 = voxels[index2];
                            if (voxelValue2 in this.config.voxelRemap) {
                                voxelValue2 = this.config.voxelRemap[voxelValue2];
                            }

                            console.log('Test back expanding along X at : ' + [newEndBackX, y, z].join(','));
    
                            if (
                                this.visited[index2] & this.bitwiseFaces.back
                                ||
                                voxelValue != voxelValue2
                                ||
                                this.skipFace(voxels, newEndBackX, y, z, this.bitwiseFaces.back)
                            ) {
                                tryBackX = false;
                                console.log('Expanding back along X not possible');
                                break;
                            }
                            console.log('Expanding back possible');
    
                            // Mark relevant faces as visited
                            this.visited[index2] |= this.bitwiseFaces.back;
    
                            endBackX = newEndBackX;
                        }
                        
                        // this does redundant row processing
                        while (tryBackY) {
                            if (endBackY >= this.lastVoxel) {
                                console.log('Done for back in Y direction');
                                tryBackY = false;
                                break;
                            }
                            let newEndBackY = endBackY + 1;
    
                            for (let dx = startBackX; dx <= endBackX; dx++) {
                                let index2 = dx + (newEndBackY * this.chunkWidth) + (z * this.chunkWidth2);

                                let voxelValue2 = voxels[index2];
                                if (voxelValue2 in this.config.voxelRemap) {
                                    voxelValue2 = this.config.voxelRemap[voxelValue2];
                                }

                                console.log('Test back expanding along Y at : ' + [dx, newEndBackY, z].join(','));
        
                                if (
                                    this.visited[index2] & this.bitwiseFaces.back
                                    ||
                                    voxelValue != voxelValue2
                                    ||
                                    this.skipFace(voxels, dx, newEndBackY, z, this.bitwiseFaces.back)
                                ) {
                                    tryBackY = false;
                                    console.log('Expanding back along Y not possible');
                                    break;
                                }
                            }
                            if (!tryBackY) {
                                break;
                            }
                            console.log('Expanded back along Y of ' + newEndBackY);
                            // mark the row as visited
                            let indexWithoutX = (newEndBackY * this.chunkWidth) + (z * this.chunkWidth2);
                            for (let dx = startBackX; dx <= endBackX; dx++) {
                                this.visited[dx + indexWithoutX] |= this.bitwiseFaces.back;
                            }
                            endBackY = newEndBackY;
                            if (newEndBackY >= this.lastVoxel) {
                                tryBackY = false;
                                console.log('Done for back in Y direction');
                                break;
                            }
                        }

                        // insert triangles
                        // front startBackX to endBackX, from startBackY to endBackY
                        this.addPoints(out, x, y, z, endBackX, endBackY, z, voxelValue, this.bitwiseFaces.back);
                        console.log('Added back face points for texture: ' + voxelValue);
                    }
                    // END BACK


                    // FRONT
                    let skipFront = (
                        this.visited[index] & this.bitwiseFaces.front
                        ||
                        this.skipFace(voxels, x, y, z, this.bitwiseFaces.front)
                    );
                    let tryFrontX = !skipFront;
                    let tryFrontY = !skipFront;
                    let startFrontX = x;
                    let startFrontY = y ;
                    let endFrontX = x;
                    let endFrontY = y;

                    if (!skipFront) {
                        console.log('Front is neither visited nor blocked');
                    } else {
                        console.log('Front is visited or blocked, should skip');
                    }

                    while (tryFrontX || tryFrontY) {
                        while (tryFrontX) {
                            if (endFrontX >= this.lastVoxel) {
                                console.log('Done for front in Y direction');
                                tryFrontX = false;
                                break;
                            }
                            let newEndFrontX = endFrontX + 1;
                            let index2 = newEndFrontX + (y * this.chunkWidth) + (z * this.chunkWidth2);

                            let voxelValue2 = voxels[index2];
                            if (voxelValue2 in this.config.voxelRemap) {
                                voxelValue2 = this.config.voxelRemap[voxelValue2];
                            }

                            console.log('Test front expanding along X at : ' + [newEndFrontX, y, z].join(','));
    
                            if (
                                this.visited[index2] & this.bitwiseFaces.Front
                                ||
                                voxelValue != voxelValue2
                                ||
                                this.skipFace(voxels, newEndFrontX, y, z, this.bitwiseFaces.front)
                            ) {
                                tryFrontX = false;
                                console.log('Expanding front along X not possible');
                                break;
                            }
                            console.log('Expanding front possible');
    
                            // Mark relevant faces as visited
                            this.visited[index2] |= this.bitwiseFaces.front;
    
                            endFrontX = newEndFrontX;
                        }
                        
                        // this does redundant row processing
                        while (tryFrontY) {
                            if (endFrontY >= this.lastVoxel) {
                                console.log('Done for front in Y direction');
                                tryFrontY = false;
                                break;
                            }
                            let newEndFrontY = endFrontY + 1;
    
                            for (let dx = startFrontX; dx <= endFrontX; dx++) {
                                let index2 = dx + (newEndFrontY * this.chunkWidth) + (z * this.chunkWidth2);

                                let voxelValue2 = voxels[index2];
                                if (voxelValue2 in this.config.voxelRemap) {
                                    voxelValue2 = this.config.voxelRemap[voxelValue2];
                                }

                                console.log('Test expanding front along Y at : ' + [dx, newEndFrontY, z].join(','));
        
                                if (
                                    this.visited[index2] & this.bitwiseFaces.front
                                    ||
                                    voxelValue != voxelValue2
                                    ||
                                    this.skipFace(voxels, dx, newEndFrontY, z, this.bitwiseFaces.front)
                                ) {
                                    tryFrontY = false;
                                    console.log('Expanding front along Y not possible');
                                    break;
                                }
                            }
                            if (!tryFrontY) {
                                break;
                            }
                            console.log('Expanded front along Y of ' + newEndFrontY);
                            // mark the row as visited
                            let indexWithoutX = (newEndFrontY * this.chunkWidth) + (z * this.chunkWidth2);
                            for (let dx = startFrontX; dx <= endFrontX; dx++) {
                                this.visited[dx + indexWithoutX] |= this.bitwiseFaces.front;
                            }
                            endFrontY = newEndFrontY;
                            if (newEndFrontY >= this.lastVoxel) {
                                tryFrontY = false;
                                console.log('Done for front in Y direction');
                                break;
                            }
                        }

                        // insert triangles
                        // front startFrontX to endFrontX, from startFrontY to endFrontY
                        this.addPoints(out, x, y, z, endFrontX, endFrontY, z, voxelValue, this.bitwiseFaces.front);
                        console.log('Added front face points at texture: ' + voxelValue);
                    }
                    // END FRONT

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
                    console.log('Back at outside edge, dont skip');
                    return false;
                }
                z--;
                console.log('Checking Z: ' + z);
                break;
            case this.bitwiseFaces.front:
                if (z == this.lastVoxel) {
                    console.log('Front at outer edge, dont skip');
                    return false;
                }
                z++;
                break;

            case this.bitwiseFaces.left:
                if (x == 0) {
                    console.log('Left at outside edge, dont skip');
                    return false;
                }
                x--;
                console.log('Checking Z: ' + z);
                break;
            case this.bitwiseFaces.right:
                if (x == this.lastVoxel) {
                    console.log('Right at outer edge, dont skip');
                    return false;
                }
                x++;
                break;
        
            case this.bitwiseFaces.top:
                if (y == this.lastVoxel) {
                    console.log('Top at outside edge, dont skip');
                    return false;
                }
                y++;
                console.log('Checking Z: ' + z);
                break;
            case this.bitwiseFaces.bottom:
                if (y == 0) {
                    console.log('Bottom at outer edge, dont skip');
                    return false;
                }
                y--;
                break;

        }
        let index = x + (y * this.chunkWidth) + (z * this.chunkWidth2);
        return voxels[ index ] != 0;
    }


    /*
    to understand sides, consider oneself as the cube
    - back represents your back
    - front your front
    - top your head
    - bottom you feet

    with 0,0,0 being left, bottom, back

    LOGIC ERROR
    can't distill rect boundaries to lower left and upper left points ... that doens't work for all faces
    maybe instead distill to left, right, top, bottom values
    */

    addPoints(out, x, y, z, x2, y2, z2, textureValue, face) {

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

        if (!(textureValue in this.textureOffsets)) {
            console.log(textureValue + ' not in ' + this.textureOffsets);
        }
        console.log('Texture: ' + textureValue);

        var textureBottom = this.textureOffsets[textureValue][0];
        var textureTop = this.textureOffsets[textureValue][1];
        var textureRight = this.textureOffsets[textureValue][2];
        
        // i changed this to be different from horiz merge mesher ... hope it doesn't screw stuff up
        switch (face) {
            // front should be normal in positive z, i think
            // back
            // 2020-01-13 - winding on this seems right
            case this.bitwiseFaces.back:
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
                break;

            // 2020-01-13 - winding on this seems right
            case this.bitwiseFaces.front:
                z++;
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
                break;

            //case 'left':
            case 2:
                n[0] = -1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + w;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + h;
                points.data[ points.offset++ ] = z;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + w;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + h;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + h;
                points.data[ points.offset++ ] = z + w;
                break;

            //case 'right':
            case 4:
                x++;
                n[0] = 1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + w;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + h;
                points.data[ points.offset++ ] = z + w;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + h;
                points.data[ points.offset++ ] = z + w;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y + h;
                points.data[ points.offset++ ] = z;
                break;

            //case 'top':
            case 0:
                y++;
                n[1] = 1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + w;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + w;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + h;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + w;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + h
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + h;
                break;

            //case 'bottom':
            case 5:
                n[1] = -1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + h;
                points.data[ points.offset++ ] = x + w;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + h;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x + w;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z + h;
                points.data[ points.offset++ ] = x + w;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                break;
        }

        /*

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
        */


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
    }

}

/*
- start with small chunk
- precompute logic to visit all 3 planes that pass through 0,0,0
    - start at 0,0,0
    - for front and back checks
        - loop over x direction
            - loop over y direction
                - if empty block, skip
                - if not visited before
                    - create struct
                - if previous neighbor is same type .. this is going to be tricky to handle in generated code
    - check indices pertaining to front and back
    - then top and bottom
    - then left and right
    - at each block check whether it's visible
    - keep a temp map of each block that points to the structure that contains it, null otherwise
    - then add 1 to each coord to result in 1,1,1
    - repeat face checks
*/


export { RectangleMesher };
