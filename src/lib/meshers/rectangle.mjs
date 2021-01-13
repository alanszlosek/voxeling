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

    // TODO: should this also check for complete blockage since it's gotta query peers anyway?
    // plane: x, y, z
    skipFace(voxels, x, y, z, face) {
        switch (face) {
            case this.bitwiseFaces.back: // concerned with z-- and z++
                if (z == 0) {
                    console.log('Back at outside edge, dont skip');
                    return false;
                }
                z--;
                console.log('Checking Z: ' + z);
                break;
            case this.bitwiseFaces.front: // concerned with z-- and z++
                if (z == this.lastVoxel) {
                    console.log('Front at outer edge, dont skip');
                    return false;
                }
                z++;
                break;

        }
        let index = x + (y * this.chunkWidth) + (z * this.chunkWidth2);
        return voxels[ index ] != 0;
    }

    run2(position, voxels) {
        if (!voxels || voxels.length == 0) {
            console.log('Empty voxels');
            return null;
        }

        let out = {};
        var start = Date.now();
        //this.addPoints(position, voxels);
        
        // maps an index to the data structure that will take care of rendering it
        /*
         * bitwise faces
         * 0 none
         * 1 top
         * 2 back
         * 4 left
         * 8 front
         * 16 right
         * 32 bottom
         * */
        this.visited.fill(0);

        // GENERATED
        let currentBlock;
        let x, y, z;
        // block to shapes

        // END GENERATED
        // planes for front and back meshing
        for (z = 0; z < this.chunkWidth; z++) {
            // front and back - X direction?
            for (y = 0; y < this.chunkWidth; y++) {
                let indexWithoutX = (y * this.chunkWidth) + (z * this.chunkWidth2);
                for (let x = 0; x < this.chunkWidth; x++) {
                    console.log('Checking ' + [x,y,z].join(','));
                    let index = indexWithoutX + x;

                    let voxelValue = voxels[index];
                    if (voxelValue in this.config.voxelRemap) {
                        voxelValue = this.config.voxelRemap[voxelValue];
                    }
                    if (voxelValue == 0) {
                        console.log('Empty voxel, skipping');
                        continue;
                    }

                    // need one of these that understands faces
                    // front, back ... might need to switch these
                    var faces = [1, 3];
                    // back first
                    // have we processed this face yet?
                    // is this face blocked?
                    // is column to the right uniform, AND not blocked AND matching current face?
                    // is row above uniform AND not blocked AND matching our current face?

                    let dims = this.expandXY(voxels, x, y, z, 3, 2);
                    console.log(dims);
                    // mark face as visited
                    for (let w = 0; w < dims[0]; w++) {
                        for (let h = 0; h < dims[1]; h++) {
                            index = (x + w) + ((y + h) * this.chunkWidth) + (z * this.chunkWidth2);
                            this.visited[index] |= 2;
                        }
                    }
                    // add points

                    // now front face
                    dims = this.expandXY(voxels, x, y, z, 1, 8);
                    // mark face as visited
                    for (let w = 0; w < dims[0]; w++) {
                        for (let h = 0; h < dims[1]; h++) {
                            index = (x + w) + ((y + h) * this.chunkWidth) + (z * this.chunkWidth2);
                            this.visited[index] |= 8;
                        }
                    }
                    // now add points, but for which face?
                    
                    if (!(currentBlock in out)) {
                        out[currentBlock] = {};
                    }
                    out[currentBlock][x + ',' + y + ',' + z] = dims;
                }
            }
        }
        /*
        // loop for left and right meshing
        for (let x = 0; x < this.chunkWidth; x++) {
            // front and back - X direction?
            for (y = 0; y < this.chunkWidth; y++) {
                let indexWithoutZ = x + (y * this.chunkWidth);
                for (z = 0; z < this.chunkWidth; z++) {
                    let index = indexWithoutZ + (z * this.chunkWidth * this.chunkWidth);
                    this.visited[index] = true;
                    // left and right ?
                    var faces = [2, 4];
                }
            }
        }
        // loop for top and bottom meshing
        for (z = 0; z < this.chunkWidth; z++) {
            // front and back - X direction?
            for (y = 0; y < this.chunkWidth; y++) {
                let indexWithoutY = x + (z * this.chunkWidth * this.chunkWidth);
                for (let x = 0; x < this.chunkWidth; x++) {
                    let index = indexWithoutY + (y * this.chunkWidth);
                    this.visited[index] = true;

                    // Top, bottom
                    var faces = [0, 5];
                }
            }
        }
        */

        timer.log('mesher', Date.now() - start);
        return out;
    }


    expandXY(voxels, x, y, z, voxelsToTexturesFace, visitedFace) {
        // start off with current dims of 0 because we don't know whether face is
        // visible yet. it might be obstructed by another block
        let width = 1;
        let height = 1;
        console.log('expandXY ' + [x,y,z].join(','));

        let indexY = y * this.chunkWidth;
        let indexZ = z * this.chunkWidth2;
        let index = x + indexY + indexZ;
        let voxelValue = voxels[index];
        // we'll compare adjacent faces as we grow to these faces
        let faces = this.voxelsToTextures[voxelValue].textures;


        let adjacentIndexZ = z + (visitedFace == 2 ? -1 : 1);
        if (0 <= adjacentIndexZ && adjacentIndexZ < this.chunkWidth) {
            let adjacentIndex = x + (y * this.chunkWidth) + (adjacentIndexZ * this.chunkWidth2);
            if (voxels[adjacentIndex] > 0) {
                return [width, height];
            }
        }

        let expanded = true;
        let tryX = true;
        let tryY = true;
        while (expanded) {
            expanded = false;
            let success;
            /*
            // optimized test for whether face is blocked
            if (voxelsToTexturesFace == 3) {
                // calculate index for block adjacent to back
                let index = indexX + indexY + ((z-1) * this.chunkWidth2);

            } else if (voxelsToTexturesFace == 1) {

            }
            */


            // TODO: i don't think face obstruction checking is quite right
            // TODO: don't like the interplay between checking first face, adn subsequent faces

            if (tryX) {
                // make sure doesn't go beyond chunkWidth
                let column = x + width;
                if (column < this.chunkWidth) {
                    // test the entire adjacent right column, at the current height
                    let stopY = y + height;
                    if (stopY < this.chunkWidth) {
                        let success = true;
                        for (let y2 = y; y2 < stopY; y2++) {
                            console.log('Testing expansion at ' + [column,y2].join(','));
                            let index = column + (y2 * this.chunkWidth) + indexZ;
                            // check whether the face has been visited for this voxel
                            if (this.visited[index] & visitedFace) {
                                console.log('already visited face');
                                success = false;
                                tryX = false;
                                break;
                            }
                            // check whether face is blocked
                            let adjacentIndexZ = z + (visitedFace == 2 ? -1 : 1);
                            if (0 <= adjacentIndexZ && adjacentIndexZ < this.chunkWidth) {
                                console.log('Testing adjacent face');
                                let adjacentIndex = column + (y2 * this.chunkWidth) + (adjacentIndexZ * this.chunkWidth2);
                                if (voxels[adjacentIndex] > 0) {
                                    console.log('Face blocked');
                                    // blocked
                                    success = false;
                                    tryX = false;
                                    break;
                                }
                            }
                            // check for matching face
                            let voxelValue2 = voxels[index];
                            let faces2 = this.voxelsToTextures[voxelValue2].textures;
                            if (faces[voxelsToTexturesFace] != faces2[voxelsToTexturesFace]) {
                                console.log('Faces dont match');
                                success = false;
                                tryX = false;
                                break;
                            }
                        }
                        if (success) {
                            width++;
                            expanded = true;
                        }
                    } else {
                        tryX = false;
                    }
                } else {
                    tryX = false;
                }
            }
            /*
            success = true;
            let yy = y + 1;
            if (yy < this.chunkWidth) {
                for (let i = 0; i < w && (x+i) < this.chunkWidth; i++) {
                    let index = (x + i) + (yy * this.chunkWidth) + (z * this.chunkWidth2);
                    let voxelValue2 = voxels[index];
                    
                    let faces2 = this.voxelsToTextures[voxelValue2].textures;
                    if (faces[voxelsToTexturesFace] != faces2[voxelsToTexturesFace]) {
                        success = false;
                        break;
                    }
                }
                if (success && (y + h) < this.chunkWidth) {
                    h++;
                    expanded = true;
                }
            }
            */

        }

        return [width, height];
    }


    shouldSkipFace(currentVoxelValue, opposingVoxelValue) {
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
let faces = {
    'front': [],
    'back': [],
    'top': [],
    'bottom': [],
    'left': [],
    'right': []
};



/*
this just returns whether all blocks between P1 and P2 match current block
but it'd be tedious to call this repeatedly to figure out where we can expand to
*/
function sameAdjacentBlocks(blocks, x1, y1, z1, x2, y2, z2, currentBlock) {
    for (; x1 < x2; x1++) {
        for (; y1 < y2; y1++) {
            for (; z1 < z2; z1++) {
                let index = x1 + (y1 * this.chunkWidth) + (z1 * this.chunkWidth * this.chunkWidth);
                if (blocks[index] != currentBlock) {
                    return false;
                }
            }

        }
    }
    return true;
}

export { RectangleMesher };
