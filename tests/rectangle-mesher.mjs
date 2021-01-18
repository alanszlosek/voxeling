import { default as config } from '../config.mjs';
import { Coordinates } from '../src/lib/coordinates.mjs';
import { RectangleMesher } from '../src/lib/meshers/rectangle.mjs';
import textureOffsets from '../texture-offsets.js';

// override some config values just for testing ease
config.chunkWidth = 2;


let coordinates = new Coordinates(config);

let mesher = new RectangleMesher(config, config.voxels, textureOffsets, coordinates);

let tests = {
    '-32|32|0': [3,0,0,0,0,0,0,0], // should be 24 points, x should start at 32

    // same voxel on all sides of 2x2x2 blocks
    //'0|0|0': [3,3,3,3,3,3,3,3], // should be 24 points

    // not all same
    //'32|32|32': [3,2,0,2, 0,0,0,0], // should be 66 points

    //'64|64|64': [3,0,3,0,0,3,0,3], // should be 24 points
    //'128|128|128': [3,0,3,0,3,0,3,0], // should be 12 points
};



for (let key in tests) {
    let voxels = tests[key];
    let position = key.split('|');
    for (let i = 0; i < position.length; i++) {
        position[i] = parseInt(position[i]);
    }
    let out = mesher.run(position, voxels);

    // sum up all points
    let points = 0;
    for (let voxelValue in out) {
        points += out[voxelValue].position.offset;
        console.log(out[voxelValue].position);
    }
    console.log(points / 3);

}


/*
6 faces
4 tris per face
3 points per tri
3 numbers per point

TOTAL number of integers
*/