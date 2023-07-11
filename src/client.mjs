import { default as config } from '../config-client.mjs';
import textureOffsets from '../texture-offsets.js'

import { Camera } from './lib/camera.mjs'
import { Coordinates } from './lib/coordinates.mjs';
import { ClientWorkerHandle } from './lib/client-worker-handle.mjs';
//import { Cursor } from './lib/cursor.mjs';
//import { Multiplayer } from './lib/multiplayer.mjs'
import { Node } from './lib/scene-graph.mjs'
import { CollisionDetection } from './lib/physics.mjs';
import { Player } from './lib/characters/player.mjs';
import { PubSub } from './lib/pubsub.mjs';
//import { Sky } from './lib/models/sky.mjs';
//import { Snow } from './lib/models/snow.mjs';
import Stats from './lib/stats.mjs';
import { TextureAtlas } from './lib/texture-atlas.mjs';
import { UserInterface } from './lib/user-interface.mjs';
import { VoxelCache } from './lib/voxel-cache.mjs';
import { Voxels } from './lib/voxels.mjs';
//import { World } from './lib/world.mjs';
//import { Exploration } from './lib/models/exploration.mjs';
import { Dragon } from './lib/characters/dragon.mjs';
import { WebGL } from './lib/webgl.mjs';
import scratch from './lib/scratch.mjs';

let canvas = document.getElementById('herewego');
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
let webgl = new WebGL(canvas);

let game = {
    canvas: canvas,
    webgl: webgl,
    gl: webgl.gl,
    config: config,
    textureOffsets: textureOffsets,
    coordinates: new Coordinates(config),
    players: {},
    pubsub: new PubSub(),
    settings: {}
};

game.clientWorkerHandle = new ClientWorkerHandle(game);
game.stats = new Stats(game);
// Need textureAtlas before models like player and dragon
game.textureAtlas = new TextureAtlas(game, textureOffsets);
game.userInterface = new UserInterface(game);
game.voxelCache = new VoxelCache(game);
game.voxels = new Voxels(game);

game.player = new Player(game);
game.camera = new Camera(game, game.player.cameraPosition);

game.collisionDetection = new CollisionDetection(game);

game.dragon = new Dragon(game);


// Configure rendering hierarchy .. camera is at the top
game.scene = new Node(game.camera, game.camera.matrix);
game.scene.addChild(new Stats());

game.scene.addChild(
    game.dragon.model.node
);

game.scene.addChild(
    new Node(
        game.voxels,
        // no model matrix for voxels, stub this one in
        scratch.identityMat4
    )
);

game.scene.addChild(
    game.player.model.node
);


game.textureAtlas.init().then(function() {
    return game.clientWorkerHandle.init();

}).then(function() {
    game.userInterface.activePlayer = game.player; //dragon; // game.player;

    // TODO: trigger world loading, but need to decouple player and position
    game.clientWorkerHandle.regionChange([0,0,0]);
    // render function
    let start = 0;
    webgl.start(function(ts) {
        game.scene.render(scratch.identityMat4, ts, ts - start);
        start = ts;
    });
});
