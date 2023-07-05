// imports

import { default as config } from '../config-client.mjs';
import textureOffsets from '../texture-offsets.js'

import { Camera } from './lib/camera.mjs'
//import { Physics } from './lib/physics.mjs'


import { Coordinates } from './lib/coordinates.mjs';
import { ClientWorkerHandle } from './lib/client-worker-handle.mjs';
import { Cursor } from './lib/cursor.mjs';
import { Multiplayer } from './lib/multiplayer.mjs'
import { Physics } from './lib/physics.mjs';
import { Player } from './lib/characters/player.mjs';
import { PubSub } from './lib/pubsub.mjs';
import { Sky } from './lib/models/sky.mjs';
import { Snow } from './lib/models/snow.mjs';
import Stats from './lib/stats.mjs';
import { TextureAtlas } from './lib/texture-atlas.mjs';
import { UserInterface } from './lib/user-interface.mjs';
import { VoxelCache } from './lib/voxel-cache.mjs';
import { Voxels } from './lib/voxels.mjs';
import { World } from './lib/world.mjs';
import { Exploration } from './lib/models/exploration.mjs';
import { Dragon } from './lib/models/dragon.mjs';


//import randomName from 'sillyname';

//import { tickables } from './lib/ecs/tickable.mjs'

// let camera = new Camera(config);
// let physics = new Physics(config);
// let player = new Player(config);


let game = {
    config: config,
    textureOffsets: textureOffsets,
    coordinates: new Coordinates(config),
    players: {},
    pubsub: new PubSub(),
    settings: {}
};
// Passing game into constructor to give components access to each other
game.clientWorkerHandle = new ClientWorkerHandle(game);
game.exploration = new Exploration(game);
game.stats = new Stats(game);
game.textureAtlas = new TextureAtlas(game, textureOffsets);
game.userInterface = new UserInterface(game);
game.voxelCache = new VoxelCache(game);
game.voxels = new Voxels(game, textureOffsets);
game.world = new World(game);


// Game startup
game.userInterface.init()

.then(function() {
    return game.textureAtlas.init();

}).then(function() {
    // Create worker and get a handle to it
    return game.clientWorkerHandle.init();

}).then(function() {
    // Send UI settings change events to the clientWorker
    game.userInterface.on('drawDistance', function(newDistance) {
        // TODO: where do we save this?
        // currently config.drawDistance and a few others
        // then trigger regionChange ... hmm
    });
    game.userInterface.on('avatar', function(newAvatar) {
        // TODO: where do we save this?
        // currently client.avatar
        // Then we change player texture
    });
    game.userInterface.on('currentMaterial', function(newMaterial) {
        // currently we use a currentMaterial global ... need to change that
        // should likely live with Cursor
        cursor.material = newMaterial;
    });
    game.userInterface.on('chat', function(message) {
        var out = {
            user: localStorage.getItem('name'),
            text: message
        };
        // TODO: maybe the client worker should be in charge of assembling the message with our username
        clientWorker.postMessage(['chat', out]);
    });


}).then(function() {
    // Voxels
    return game.voxels.init();

}).then(function() {
    return game.exploration.init();
    return Promise.resolve();

}).then(function() {
    return game.userInterface.webgl.init();

    /*
}).then(function() {
    return game.sky.init();
    */

}).then(function() {
    // things that need gl handle to init
    game.cursor = new Cursor(game);
    game.multiplayer = new Multiplayer(game);
    game.player = new Player(game);
    //game.dragon = new Dragon(game);
    game.sky = new Sky(game);
    game.snow = new Snow(game);

    // TODO: call init() on the above?

    return Promise.resolve();

}).then(function() {
    // Set active camera
    game.camera = game.player.camera;
    return Promise.resolve();

}).then(function() {
    return game.cursor.init();

}).then(function() {
    game.physics = new Physics(game);

    return Promise.resolve();

}).then(function() {
    // Also: currentMaterial, chat
    console.log(game);
    console.log('done');

}).catch(function(error) {
    console.log('Received error', error);
});
