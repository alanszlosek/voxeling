import { default as config } from '../config.mjs';
import { Coordinates } from '../src/lib/coordinates.mjs';
import { RectangleMesher } from '../src/lib/meshers/rectangle.mjs';
import textureOffsets from '../texture-offsets.js';

// override some config values just for testing ease
config.chunkWidth = 2;
config.chunkWidth2 = 
config.chunkElements = 2*2*2;


let coordinates = new Coordinates(config);

let mesher = new RectangleMesher(config, config.voxels, textureOffsets, coordinates);

let tests = {
    // same voxel on all sides of 2x2x2 blocks
    //'0|0|0': [3,3,3,3,3,3,3,3], // should be 24 points

    // not all same
    //'32|32|32': [3,3,3,0,3,3,0,0], // should be 24 points

    //'64|64|64': [3,0,3,0,0,3,0,3], // should be 24 points
    '128|128|128': [3,0,3,0,3,0,3,0], // should be 12 points
};



for (let key in tests) {
    let voxels = tests[key];
    let position = key.split('|'); //.map(parseInt);
    let out = mesher.run(position, voxels);
    console.log(out[3].position.offset / 3);
}


/*
6 faces
4 tris per face
3 points per tri
3 numbers per point

TOTAL number of integers
*/