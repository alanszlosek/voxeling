// TODO: fix
var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

import { Coordinates } from './coordinates.mjs';
import { Log } from '../log';
import { VoxelCache } from './voxel-cache.mjs';
var log = Log('lib/game', false);

// miscellaneous state
var previousTimeStamp = 0;

class Game {
    constructor(config, coordinates, player, regionChangeCallback) {
        this.voxelCache = new VoxelCache(coordinates);

        this.currentVoxel = new Array(3);
        // if this is vec3.create(), floating point messes things up
        this.lastRegion = [ 0, 0, 0 ];
        this.player = player;
        this.regionChangeCallback = regionChangeCallback;

        // Extract relevant values from config
        this.config = config;
        this.coordinates = coordinates;
    }

    init() {
        
    }

    positionChange(position) {
        var thisRegion = this.coordinates.positionToChunk(position);
        var lastRegion = this.lastRegion;
        if (thisRegion[0] !== lastRegion[0] || thisRegion[1] !== lastRegion[1] || thisRegion[2] !== lastRegion[2]) {
            this.regionChangeCallback(position);
        }
        this.lastRegion = thisRegion;
    }
    tick(ts) {
        this.positionChange(this.player.getPosition());
    }

}

export { Game }