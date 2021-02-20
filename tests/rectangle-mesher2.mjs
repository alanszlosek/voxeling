import { default as config } from '../config.mjs';
import { Coordinates } from '../src/lib/coordinates.mjs';
import { RectangleMesher } from '../src/lib/meshers/rectangle6.mjs';
import textureOffsets from '../texture-offsets.js';

// override some config values just for testing ease
config.chunkWidth = 2;


let coordinates = new Coordinates(config);

let mesher = new RectangleMesher(config, config.voxels, textureOffsets, coordinates);

let tests = {
    //'-32|32|0': [1,0,0,0,0,0,0,0], // should be 24 points, x should start at 32

    // TODO: add expected points and compare
    '0|0|0': [1,1,1,1,0,0,0,0], // should be 36 points, 2 wide, 2 high

    // same voxel on all sides of 2x2x2 blocks
    //'0|0|0': [3,3,3,3,3,3,3,3], // should be 24 points

    // not all same
    //'32|32|32': [3,2,0,2, 0,0,0,0], // should be 66 points

    //'64|64|64': [3,0,3,0,0,3,0,3], // should be 24 points
    //'128|128|128': [3,0,3,0,3,0,3,0], // should be 12 points
};



function test(position, voxels, expected) {
    let out = mesher.run(position, voxels);
    for (let textureValue in expected) {
        let expectedPoints = new Float32Array(expected[textureValue]);
        let points;
        
        if (!(textureValue in out)) {
            console.log('Texture not found in output points: ' + textureValue);
            continue;
        }
        points = out[textureValue].position.data.slice(0, expectedPoints.length);

        if (JSON.stringify(expectedPoints) != JSON.stringify(points)) {
            console.log('Expected points dont match for texture: ' + textureValue + '. Expected versus actual:');
            console.log(expectedPoints, points);
        }
        
    }
}

let position, voxels, expectedPoints;

/*
// 2x2x1 check
// Should we fabricate a voxel with different texture on all faces?
position = [0,0,0];
voxels = [1,1,1,1,0,0,0,0];
expectedPoints = {
    // Top
    14: [
        0, 2, 1,
        2, 2, 1,
        2, 2, 0,
        0, 2, 1,
        2, 2, 0,
        0, 2, 0
    ],
    // back, front, left, right
    302: [
        // back
        2, 0, 0,
        0, 0, 0,
        0, 2, 0,
        2, 0, 0,
        0, 2, 0,
        2, 2, 0,
        // front
        0,0,1,
        2,0,1,
        2,2,1,
        0,0,1,
        2,2,1,
        0,2,1,
        // left
        0,0,0,
        0,0,1,
        0,2,1,
        0,0,0,
        0,2,1,
        0,2,0,

        // right
        2,0,1,
        2,0,0,
        2,2,0,
        2,0,1,
        2,2,0,
        2,2,1,
    ],
    // bottom
    3: [
        0, 0, 0,
        2, 0, 0,
        2, 0, 1,
        0, 0, 0,
        2, 0, 1,
        0, 0, 1
    ]
};

test(position, voxels, expectedPoints);

*/






/*
// 2x2x1 check
// Should we fabricate a voxel with different texture on all faces?
position = [0,0,0];
voxels = [1,1,0,0,1,0,0,0];
expectedPoints = {
    // Top
    14: [],
    // back, front, left, right
    302: [],
    // bottom
    3: [
        0, 0, 0,
        2, 0, 0,
        2, 0, 2,
        0, 0, 0,
        2, 0, 2,
        0, 0, 2
    ]
};

test(position, voxels, expectedPoints);
*/


// For testing specific faces
position = [0,0,0];
voxels = [254,255,0,0, 254,254,0,0];
expectedPoints = {
    // Top
    2: [],
    // back
    3: [
        1, 0, 0,
        0, 0, 0,
        0, 1, 0,
        1, 0, 0,
        0, 1, 0,
        1, 1, 0
    ],
    33: [
        2, 0, 0,
        1, 0, 0,
        1, 1, 0,
        2, 0, 0,
        1, 1, 0,
        2, 1, 0
    ],
    // front
    4: [],
    // left
    5: [],
    // right
    6: [
        2, 0, 2,
        2, 0, 1,
        2, 1, 1,
        2, 0, 2,
        2, 1, 1,
        2, 1, 2
    ],
    36: [
        2, 0, 1,
        2, 0, 0,
        2, 1, 0,
        2, 0, 1,
        2, 1, 0,
        2, 1, 1
    ],
    // bottom
    7: [
        0, 0, 0,
        1, 0, 0,
        1, 0, 1,
        0, 0, 0,
        1, 0, 1,
        0, 0, 1,

        0, 0, 1,
        2, 0, 1,
        2, 0, 2,
        0, 0, 1,
        2, 0, 2,
        0, 0, 2
    ],
    37: [
        1, 0, 0,
        2, 0, 0,
        2, 0, 1,
        1, 0, 0,
        2, 0, 1,
        1, 0, 1
    ]
};

test(position, voxels, expectedPoints);


/*
6 faces
4 tris per face
3 points per tri
3 numbers per point

TOTAL number of integers
*/