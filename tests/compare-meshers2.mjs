import { default as config } from '../config.mjs';
import chunkGenerator from '../src/lib/generators/server-terraced.mjs';
import { Coordinates } from '../src/lib/coordinates.mjs';
import { RectangleMesher } from '../src/lib/meshers/rectangle.mjs';
import { RectangleMesher as RectangleMesher2 } from '../src/lib/meshers/rectangle5.mjs';
import mesher from '../src/lib/meshers/horizontal-merge2.mjs';
import { MysqlChunkStore } from '../src/lib/chunk-stores/mysql.mjs';
import textureOffsets from '../texture-offsets.js';
import mysql from 'mysql';
import { performance } from 'perf_hooks';

// override some config values just for testing ease
config.chunkWidth = 32;
config.chunkWidth2 = 32 * 32;
config.chunkElements = 32*32*32;


let coordinates = new Coordinates(config);
var chunkCache = {};

let rectangle1 = new RectangleMesher(config, config.voxels, textureOffsets, coordinates);
let rectangle2 = new RectangleMesher2(config, config.voxels, textureOffsets, coordinates);


let mysqlPool = mysql.createPool(config.mysql);
var chunkStore = new MysqlChunkStore(
    config.mysql,
    new chunkGenerator(config.chunkSize)
);

let tests = [
    '0|-32|0',
    '32|-32|0',
    '32|-32|32'
];
let cb = function(error, chunk) {
    if (error) {
        console.log(error);
        return;
    }

    let t1 = performance.now();
    var mesh1 = rectangle1.run(chunk.position, chunk.voxels);
    let t2 = performance.now();
    let mesh2 = rectangle2.run(chunk.position, chunk.voxels);
    let t3 = performance.now();

    /*
    let position = key.split('|'); //.map(parseInt);
    let out = mesher.run(position, voxels);
    */
    // sum up all points
    let points1 = 0;
    for (let voxelValue in mesh1) {
        //console.log('mesh1: counting points for ' + voxelValue + ' (' + mesh1[voxelValue].position.offset + ')');
        points1 += mesh1[voxelValue].position.offset;
    }

    let points2 = 0;
    for (let voxelValue in mesh2) {
        //console.log('mesh2: counting points for ' + voxelValue + ' (' + mesh2[voxelValue].position.offset + ')');
        points2 += mesh2[voxelValue].position.offset;
    }
    console.log(chunk.position);
    console.log((points1 / 3) + ' vs ' + (points2 / 3));

    console.log((t2 - t1) + ' ms vs ' + (t3 - t2) + ' ms');
    console.log('');
};

for (let i in tests) {
    let id = tests[i];
    chunkStore.get(id, cb);
}

setTimeout(function() {
    chunkStore.end();
}, 5000);