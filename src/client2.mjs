// imports

import { default as config } from '../config.mjs';
import textureOffsets from '../texture-offsets.js'

import { Camera } from './lib/camera'
//import { Physics } from './lib/physics.mjs'


import { Coordinates } from './lib/coordinates';
import { ClientWorkerHandle } from './lib/client-worker-handle';
import { Cursor } from './lib/cursor';
import { Player } from './lib/models/player'
import { Sky } from './lib/models/sky';
//import { Snow } from './lib/models/snow.mjs';
import Stats from './lib/stats.mjs';
import { TextureAtlas } from './lib/texture-atlas';
import { UserInterface } from './lib/user-interface';
import { VoxelCache } from './lib/voxel-cache';
import { Voxels } from './lib/voxels';
import { Physics } from './lib/physics.mjs';
import { World } from './lib/world.mjs';


//import randomName from 'sillyname';

//import { tickables } from './lib/ecs/tickable.mjs'

// let camera = new Camera(config);
// let physics = new Physics(config);
// let player = new Player(config);


let game = {
    config: config,
    coordinates: new Coordinates(config),
    players: {},
    settings: {}
};
// Passing game into constructor to give components access to each other
game.camera = new Camera(game);
game.clientWorkerHandle = new ClientWorkerHandle(game);
game.cursor = new Cursor(game);
game.physics = new Physics(game);
game.player = new Player(game);
game.sky = new Sky(game);
//game.snow = new Snow(game);
game.stats = new Stats(game);
game.textureAtlas = new TextureAtlas(game, textureOffsets);
game.userInterface = new UserInterface(game);
game.voxelCache = new VoxelCache(game);
game.voxels = new Voxels(game, textureOffsets);
game.world = new World(game);


// Game startup
game.userInterface.init()
.then(function() {
    return game.cursor.init();

}).then(function() {
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
    return game.player.init();
    // TODO: finish multipler player setup too

}).then(function() {
    // Sky
    return Promise.resolve();

}).then(function() {
    // Voxels
    return game.voxels.init();

}).then(function() {
    return game.camera.init();

}).then(function() {
    //return game.snow.init();
    return Promise.resolve();


}).then(function() {
    return game.userInterface.webgl.init();

}).then(function() {
    // Physics
    return game.physics.init();

    /*
}).then(function() {
    return game.sky.init();
    */


/*
}).then(function() {
    var st = new Stats();
    st.domElement.style.position = 'absolute';
    st.domElement.style.bottom = '0px';
    document.body.appendChild(st.domElement);
    return Promise.resolve();
*/

}).then(function() {
    // render handlers

}).then(function() {
    // Also: currentMaterial, chat
    console.log(game);
    console.log('done');

}).catch(function(error) {
    console.log('Received error', error);
});

/*
.then(function() {
    return textureAtlas.init();

}).then(function() {
    // Ask UserInterface to use fetched textures?

}).then(function() {
    return camera.init();

}).then(function() {
    return player.init();

}).then(function() {
    return physics.init();

}).then(function() {
    // this should start fetching world chunks immediately
    return clientWorker.init();

}).then(function() {
    return cursor.init();

}).then(function() {
    // init the lighting, sky, sun
    return atmosphere.init();


}).catch(function(error) {
    console.log(error);
});
*/

/*
game.onRender(function() {
    for (let tickable in tickables) {
        tickable.tick();
    }
});
*/
