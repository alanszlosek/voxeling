
import pool from './object-pool.mjs';
import Shapes from './shapes.mjs';
import { Tickable } from './ecs/tickable';

import { vec3 } from 'gl-matrix';
import raycast from 'voxel-raycast';
import { Lines } from './lines.mjs';


// This needs cleanup, and encapsulation, but it works
var voxelHit = pool.malloc('array', 3);
var voxelNormal = pool.malloc('array', 3);
var distance = 10;
var direction = vec3.create();

class Cursor extends Tickable {
    constructor(game) {
        super();
        this.game = game;
        // shortcuts
    
        this.material = 1; // ?
        this.currentVoxel = vec3.create();
        this.currentNormalVoxel = vec3.create();
        this.voxelHit = vec3.create();
        this.voxelNormal = vec3.create();
        this.low = vec3.create();
        this.high = vec3.create();
    }

    init() {
        let game = this.game;
        this.camera = game.camera;
        // TODO: fix this ... might end up being controls, or userInterface.state
        this.inputHandler = game.inputHandler;
        this.voxelCache = game.voxelCache;

        this.lines = new Lines(this.game.userInterface.webgl.gl);
        return Promise.resolve();
    }

    tick(ts) {
        return;
        let lines = this.lines;
        let distance = 10.0;
        let voxelHit = this.voxelHit;
        let voxelNormal = this.voxelNormal;
        let currentVoxel = this.currentVoxel;
        let currentNormalVoxel = this.currentNormalVoxel;
        let low = this.low;
        let high = this.high;
        let inputHandler = this.inputHandler;

        // TODO: Camera and player should probably update this value automatically whenever they move, so we don't have to
        //vec3.transformQuat(direction, direction, player.getRotationQuat());

        // First param is expected to have getBlock()
        let hit = raycast(this.voxelCache, this.camera.position, this.camera.direction, distance, voxelHit, voxelNormal);
        if (hit > 0) {
            voxelHit[0] = Math.floor(voxelHit[0]);
            voxelHit[1] = Math.floor(voxelHit[1]);
            voxelHit[2] = Math.floor(voxelHit[2]);

            // Give us access to the current voxel and the voxel at it's normal
            currentVoxel[0] = voxelHit[0];
            currentVoxel[1] = voxelHit[1];
            currentVoxel[2] = voxelHit[2];
            currentNormalVoxel[0] = voxelHit[0] + voxelNormal[0];
            currentNormalVoxel[1] = voxelHit[1] + voxelNormal[1];
            currentNormalVoxel[2] = voxelHit[2] + voxelNormal[2];

            if (selecting) {
                if (inputHandler.state.alt || inputHandler.state.firealt) {
                    low[0] = Math.min(selectStart[0], currentNormalVoxel[0]);
                    low[1] = Math.min(selectStart[1], currentNormalVoxel[1]);
                    low[2] = Math.min(selectStart[2], currentNormalVoxel[2]);
                    high[0] = Math.max(selectStart[0] + 1, currentNormalVoxel[0] + 1);
                    high[1] = Math.max(selectStart[1] + 1, currentNormalVoxel[1] + 1);
                    high[2] = Math.max(selectStart[2] + 1, currentNormalVoxel[2] + 1);
                } else {
                    low[0] = Math.min(selectStart[0], currentVoxel[0]);
                    low[1] = Math.min(selectStart[1], currentVoxel[1]);
                    low[2] = Math.min(selectStart[2], currentVoxel[2]);
                    high[0] = Math.max(selectStart[0] + 1, currentVoxel[0] + 1);
                    high[1] = Math.max(selectStart[1] + 1, currentVoxel[1] + 1);
                    high[2] = Math.max(selectStart[2] + 1, currentVoxel[2] + 1);
                }
                lines.fill(Shapes.wire.cube(low, high));
            } else {
                if (inputHandler.state.alt || inputHandler.state.firealt) {
                    high[0] = currentNormalVoxel[0] + 1;
                    high[1] = currentNormalVoxel[1] + 1;
                    high[2] = currentNormalVoxel[2] + 1;
                    lines.fill(Shapes.wire.cube(currentNormalVoxel, high));
                } else {
                    high[0] = currentVoxel[0] + 1;
                    high[1] = currentVoxel[1] + 1;
                    high[2] = currentVoxel[2] + 1;
                    lines.fill(Shapes.wire.cube(currentVoxel, high));
                }
            }
            lines.skip(false);
        } else {
            // clear
            //lines.skip(true);
            
            // Only need to clear the first element
            currentVoxel[0] = null;
        }
    }

    render() {
        // Now render the lines
        // Looks like Lines class handles lots of this
    }
}

export { Cursor }
