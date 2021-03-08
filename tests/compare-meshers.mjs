import { default as config } from '../config.mjs';
import configServer from '../config-server.mjs';
import chunkGenerator from '../src/lib/generators/server-terraced.mjs';
import { Coordinates } from '../src/lib/coordinates.mjs';
import { RectangleMesher } from '../src/lib/meshers/rectangle6.mjs';
import mesher from '../src/lib/meshers/horizontal-merge2.mjs';
import { MysqlChunkStore } from '../src/lib/chunk-stores/mysql.mjs';
import textureOffsets from '../texture-offsets.js';
import mysql from 'mysql';
import { performance } from 'perf_hooks';
import fs from 'fs';

// override some config values just for testing ease
config.chunkWidth = 32;
config.chunkWidth2 = 32 * 32;
config.chunkElements = 32*32*32;


let coordinates = new Coordinates(config);
var chunkCache = {};

let rectangle = new RectangleMesher(config, config.voxels, textureOffsets, coordinates);
mesher.config(config, config.voxels, textureOffsets, coordinates, chunkCache);


let mysqlPool = mysql.createPool(configServer.mysql);
var chunkStore = new MysqlChunkStore(
    configServer.mysql,
    new chunkGenerator(config.chunkSize)
);

let meshers = [
    {
        'name': 'horizontal-merge',
        'func': function(position, voxels) {
            return mesher.mesh(position, voxels);
        }
    },
    {
        'name': 'rectangle6',
        'func': function(position, voxels) {
            return rectangle.run(position, voxels);
        }
    }
];
let times = {
};
let results = {};

function* chunks() {
    let high = config.worldRadius * config.chunkWidth;
    let low = -high;
    for (let x = low; x <= high; x += config.chunkWidth) {
        for (let y = low; y <= high; y += config.chunkWidth) {
            for (let z = low; z <= high; z += config.chunkWidth) {
                let chunk = x + '|' + y + '|' + z;
                console.log(chunk);
                yield chunk;
            }
            console.log( JSON.stringify(results) );
        }
    }
}

let chunkIterator = chunks();
let iteratorResult = chunkIterator.next();

let cb = function(error, chunk) {
    if (error) {
        console.log(error);
        return;
    }

    for (let i in meshers) {
        let mesher = meshers[i];

        let t1 = performance.now();
        var mesh = mesher.func(chunk.position, chunk.voxels);
        let t2 = performance.now();

        // TODO: what about freeing the growables?

        let points = 0;
        for (let voxelValue in mesh) {
            points += mesh[voxelValue].position.offset;

            mesh[voxelValue].position.free();
            mesh[voxelValue].texcoord.free();
            mesh[voxelValue].normal.free();
        }

        if (!(mesher.name in results)) {
            results[ mesher.name ] = {
                count: 0,
                points: 0,
                time: 0,
                minTime: Number.MAX_VALUE,
                maxTime: 0.0
            };
        }

        let t = t2 - t1;
        results[ mesher.name ].count++;
        results[ mesher.name ].points += points / 3;
        results[ mesher.name ].time += t;
        results[ mesher.name ].minTime = Math.min(results[ mesher.name ].minTime, t);
        results[ mesher.name ].maxTime = Math.max(results[ mesher.name ].maxTime, t);
        //results[ mesher.name ].points++;
        //results[ mesher.name ].time += 1;
    }


    // accumulate
    iteratorResult = chunkIterator.next();
    if (!iteratorResult.done) {
        chunkStore.get(iteratorResult.value, cb);
    } else {
        console.log( JSON.stringify(results) );
        chunkStore.end();

        let nl = "\n";
        let fields = ['Mesher','Points','Total Time','Min Time','Max Time','Mesh Operations'];
        let out = '"' + fields.join('","') + '"' + nl;

        for (let mesherName in results) {
            let mesherResults = results[mesherName];
            let row = [mesherName, mesherResults.points, mesherResults.time, mesherResults.minTime, mesherResults.maxTime, mesherResults.count];
            out += '"' + row.join('","') + '"' + nl;
        }
        fs.writeFileSync('compare-meshers.csv', out);
    }
};

if (!iteratorResult.done) {
    chunkStore.get(iteratorResult.value, cb);
}

