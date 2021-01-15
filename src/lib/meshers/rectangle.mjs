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
        let sh = "  ";

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
                        console.log(sh + 'Empty voxel, moving on');
                        continue;
                    }

                    // PROCESS FRONT AND BACK FACES/PLANES

                    let faces = [
                        [this.bitwiseFaces.back, x, y],
                        [this.bitwiseFaces.front, x, y],
                        [this.bitwiseFaces.top, x, z],
                        [this.bitwiseFaces.bottom, x, z],
                        [this.bitwiseFaces.left, z, y],
                        [this.bitwiseFaces.right, z, y]

                    ];
                    for (let i in faces) {
                        let item = faces[i];
                        console.log(item);
                        let bitwiseFace = item[0];
                        let startColumn = item[1];
                        let startRow = item[2];
                        let skip = (
                            this.visited[index] & bitwiseFace
                            ||
                            this.skipFace(voxels, x, y, z, bitwiseFace)
                        );

                        let endColumn = startColumn;
                        let endRow = startRow;
                        let tryColumn = !skip;
                        let tryRow = !skip;

                        if (this.visited[index] & bitwiseFace) {
                            console.log(sh + 'Face is visited, skipping');
                            continue;
                        } else if (this.skipFace(voxels, x, y, z, bitwiseFace)) {
                            console.log(sh + 'Face is blocked. Marking as visited at index: ' + index);
                            this.visited[index] |= bitwiseFace;
                            continue;
                        }
                        console.log(sh + 'Marking face visited at index: ' + index);
                        this.visited[index] |= bitwiseFace;

                        while (tryColumn || tryRow) {
                            while (tryColumn) {
                                if (endColumn >= this.lastVoxel) {
                                    //console.log(sh + 'Done with column');
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
                                if (voxelValue2 in this.config.voxelRemap) {
                                    voxelValue2 = this.config.voxelRemap[voxelValue2];
                                }

                                console.log(sh + 'Testing expansion to new column: ' + newEndColumn);

                                let shouldSkipFace;
                                switch (bitwiseFace) {
                                    case this.bitwiseFaces.back:
                                    case this.bitwiseFaces.front:
                                    case this.bitwiseFaces.top:
                                    case this.bitwiseFaces.bottom:
                                        shouldSkipFace = this.skipFace(voxels, newEndColumn, y, z, bitwiseFace);
                                        break;
                                    case this.bitwiseFaces.left:
                                    case this.bitwiseFaces.right:
                                        shouldSkipFace = this.skipFace(voxels, x, y, newEndColumn, bitwiseFace);
                                        break;
                                }
        
                                if (
                                    this.visited[index2] & bitwiseFace
                                    ||
                                    voxelValue != voxelValue2
                                    ||
                                    shouldSkipFace
                                ) {
                                    tryColumn = false;
                                    console.log(sh + 'Expanding to new column not possible');
                                    break;
                                }
                                console.log(sh + 'Expanded to new column at ' + [newEndColumn, endRow].join(','));
        
                                // Mark relevant faces as visited
                                console.log(sh + 'Marking face visited at index: ' + index2);
                                this.visited[index2] |= bitwiseFace;
        
                                endColumn = newEndColumn;
                            }
                            
                            // this does redundant row processing
                            while (tryRow) {
                                if (endRow >= this.lastVoxel) {
                                    //console.log(sh + 'Done processing row');
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
                                    if (voxelValue2 in this.config.voxelRemap) {
                                        voxelValue2 = this.config.voxelRemap[voxelValue2];
                                    }

                                    console.log(sh + 'Testing expansion on new row at: ' + [col, newEndRow].join(','));
            
                                    let shouldSkipFace;
                                    switch (bitwiseFace) {
                                        case this.bitwiseFaces.back:
                                        case this.bitwiseFaces.front:
                                            shouldSkipFace = this.skipFace(voxels, col, newEndRow, z, bitwiseFace);
                                            break;
                                        case this.bitwiseFaces.top:
                                        case this.bitwiseFaces.bottom:
                                            shouldSkipFace = this.skipFace(voxels, col, y, newEndRow, bitwiseFace);
                                            break;
                                        case this.bitwiseFaces.left:
                                        case this.bitwiseFaces.right:
                                            shouldSkipFace = this.skipFace(voxels, x, newEndRow, col, bitwiseFace);
                                            break;
                                    }
                                    
                                    if (
                                        this.visited[index2] & bitwiseFace
                                        ||
                                        voxelValue != voxelValue2
                                        ||
                                        shouldSkipFace
                                    ) {
                                        tryRow = false;
                                        //console.log(sh + 'Expanding to new row not possible');
                                        break;
                                    }
                                }
                                if (!tryRow) {
                                    break;
                                }
                                console.log(sh + 'Expanded to new row at ' + [endColumn, newEndRow].join(','));

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
                                            console.log(sh + 'Marking right face visited at index: ' + (indexWithoutZ + indexZ));
                                            this.visited[indexWithoutZ + indexZ] |= bitwiseFace;
                                        }
                                        break;
                                }

                                endRow = newEndRow;
                                if (newEndRow >= this.lastVoxel) {
                                    tryRow = false;
                                    //console.log(sh + 'Done for face along row');
                                    break;
                                }
                            }

                            // insert points for triangles
                            switch (bitwiseFace) {
                                case this.bitwiseFaces.back:
                                case this.bitwiseFaces.front:
                                    this.addPoints(out, x, y, z, endColumn, endRow, z, voxelValue, bitwiseFace);
                                    break;
                                case this.bitwiseFaces.top:
                                case this.bitwiseFaces.bottom:
                                    this.addPoints(out, x, y, z, endColumn, y, endRow, voxelValue, bitwiseFace);
                                    break;
                                case this.bitwiseFaces.left:
                                case this.bitwiseFaces.right:
                                    this.addPoints(out, x, y, z, x, endRow, endColumn, voxelValue, bitwiseFace);
                                    break;
                            }


                            console.log(sh + 'Added face points for texture: ' + voxelValue);
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
                    console.log('  Back at outside edge, dont skip');
                    return false;
                }
                z--;
                console.log('Checking Z: ' + z);
                break;
            case this.bitwiseFaces.front:
                if (z == this.lastVoxel) {
                    console.log('  Front at outer edge, dont skip');
                    return false;
                }
                z++;
                break;

            case this.bitwiseFaces.left:
                if (x == 0) {
                    console.log('  Left at outside edge, dont skip');
                    return false;
                }
                x--;
                break;
            case this.bitwiseFaces.right:
                if (x == this.lastVoxel) {
                    console.log('  Right at outer edge, dont skip');
                    return false;
                }
                x++;
                break;
        
            case this.bitwiseFaces.top:
                if (y == this.lastVoxel) {
                    console.log('  Top at outside edge, dont skip');
                    return false;
                }
                y++;
                break;
            case this.bitwiseFaces.bottom:
                if (y == 0) {
                    console.log('  Bottom at outer edge, dont skip');
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

            case this.bitwiseFaces.left:
                n[0] = -1.0;
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
                break;

            case this.bitwiseFaces.right:
                x++;
                n[0] = 1.0;
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
                break;

            case this.bitwiseFaces.top:
                y++;
                n[1] = 1.0;
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
                break;

            case this.bitwiseFaces.bottom:
                n[1] = -1.0;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;

                points.data[ points.offset++ ] = x;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z;
                points.data[ points.offset++ ] = x2 + 1;
                points.data[ points.offset++ ] = y;
                points.data[ points.offset++ ] = z2 + 1;
                points.data[ points.offset++ ] = x2 + 1;
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
