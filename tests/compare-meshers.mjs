import { default as config } from '../config.mjs';
import chunkGenerator from '../src/lib/generators/server-terraced.mjs';
import { Coordinates } from '../src/lib/coordinates.mjs';
import { RectangleMesher } from '../src/lib/meshers/rectangle.mjs';
import mesher from '../src/lib/meshers/horizontal-merge2.mjs';
import { MysqlChunkStore } from '../src/lib/chunk-stores/mysql.mjs';
import textureOffsets from '../texture-offsets.js';
import mysql from 'mysql';

// override some config values just for testing ease
config.chunkWidth = 32;
config.chunkWidth2 = 32 * 32;
config.chunkElements = 32*32*32;


let coordinates = new Coordinates(config);
var chunkCache = {};

let rectangle = new RectangleMesher(config, config.voxels, textureOffsets, coordinates);
mesher.config(config, config.voxels, textureOffsets, coordinates, chunkCache);


let mysqlPool = mysql.createPool(config.mysql);
var chunkStore = new MysqlChunkStore(
    config.mysql,
    new chunkGenerator(config.chunkSize)
);

chunkStore.get('0|-32|0', function(error, chunk) {
    if (error) {
        console.log(error);
        return;
    }
    console.log('got chunk');

    var mesh1 = mesher.mesh(chunk.position, chunk.voxels);
    let mesh2 = rectangle.run(chunk.position, chunk.voxels);

    /*
    let position = key.split('|'); //.map(parseInt);
    let out = mesher.run(position, voxels);
    */
    // sum up all points
    let points1 = 0;
    for (let voxelValue in mesh1) {
        console.log('mesh1: counting points for ' + voxelValue + ' (' + mesh1[voxelValue].position.offset + ')');
        points1 += mesh1[voxelValue].position.offset;
    }

    let points2 = 0;
    for (let voxelValue in mesh2) {
        console.log('mesh2: counting points for ' + voxelValue + ' (' + mesh2[voxelValue].position.offset + ')');
        points2 += mesh2[voxelValue].position.offset;
    }
    console.log((points1 / 3) + ' vs ' + (points2 / 3));


    chunkStore.end();
});

