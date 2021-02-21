import { quat, vec3 } from 'gl-matrix';
import { Lines } from './lines.mjs';
import pool from './object-pool.mjs';
import raycast from 'voxel-raycast';
import scratch from './scratch.mjs';
import Shapes from './shapes.mjs';
import { Tickable } from './entities/tickable';



// This needs cleanup, and encapsulation, but it works
var voxelHit = pool.malloc('array', 3);
var voxelNormal = pool.malloc('array', 3);
var distance = 10;
var direction = vec3.create();

class Cursor extends Tickable {
    constructor(game) {
        super();
        this.game = game;
        this.visible = true;
        // shortcuts

        // helpers to track input state changes (button presses)
        this.previousAction1 = false;
        this.previousAction2 = false;
        // Keep track of voxel we're focused on at the start of an "action" event (ie. mouse down, and mouse up)
        this.startVoxel = vec3.create();
    
        this.currentMaterial = this.game.config.texturePicker[0];
        this.currentVoxel = vec3.create();
        this.currentNormalVoxel = vec3.create();
        this.selectStart = new Int32Array(3);

        // If these two are Float32Arrays, it leads to casting, loses precision, and results in incorrect hit coords
        this.f64VoxelHit = new Float64Array(3);
        this.f64VoxelNormal = new Float64Array(3);
        this.low = vec3.create();
        this.high = vec3.create();
    }

    init() {
        let game = this.game;
        this.camera = game.camera;
        this.player = game.player;
        // TODO: fix this ... might end up being controls, or userInterface.state
        this.userInterface = game.userInterface;
        this.voxelCache = game.voxelCache;

        this.lines = new Lines(this.game);
        this.pointer = new Lines(this.game, [0, 255, 0, 1]);
        return Promise.resolve();
    }

    tick(ts) {
        let lines = this.lines;
        let distance = 10.0;
        let f64VoxelHit = this.f64VoxelHit;
        let i32VoxelHit = new Int32Array(3);
        let linesLow = new Int32Array(3);
        let linesHigh = new Int32Array(3);
        let creating = false;
        let destroying = false;

        let f64VoxelNormal = this.f64VoxelNormal;

        let currentVoxel = this.currentVoxel;
        let selectStart = this.selectStart;
        let low = this.low;
        let high = this.high;
        let userInterface = this.userInterface;
        let baseDirection = vec3.create();
        baseDirection[2] = -1.0;

        // start with player eye position
        // add distance to default rotation vec
        // rotate direction by player rotation quat
        // add rotated direction to player eye position
        // draw cursor at that position

        // TODO: now that we have the cursor actually living in the 3d world, we can show and hide it whenever we want
        // Logic for in-game cursor ... small green wire cube
        vec3.transformQuat(scratch.vec3, baseDirection, this.player.rotationQuat);
        vec3.add(low, scratch.vec3, this.player.eyePosition);
        vec3.add(low, low, scratch.vec3);
        vec3.sub(low, low, [0.005, 0.005, 0.005]);
        vec3.add(high, low, [0.005, 0.005, 0.005]);
        this.pointer.fill(Shapes.wire.cube(low, high));

        // First param is expected to have getBlock()
        let hit = raycast(this.voxelCache, this.player.eyePosition, this.player.direction, distance, f64VoxelHit, f64VoxelNormal);
        if (hit > 0) {
            // If pressing shift, convert to normal of the hit

            // preserve precision of voxelHit, so copy out

            if (userInterface.state.shift || userInterface.state.action2 || this.previousAction2) {
                // We use normals during creation
                // If Shift, right mouse is down, OR action2 (create) is active, shift the hit to the normal.
                // Without the previousAction2 check, it falls back to the else too soon, once right button is released,
                // which prevents an entire row of blocks from being created
                i32VoxelHit[0] = Math.floor(f64VoxelHit[0] + f64VoxelNormal[0]);
                i32VoxelHit[1] = Math.floor(f64VoxelHit[1] + f64VoxelNormal[1]);
                i32VoxelHit[2] = Math.floor(f64VoxelHit[2] + f64VoxelNormal[2]);
            } else {
                i32VoxelHit[0] = Math.floor(f64VoxelHit[0]);
                i32VoxelHit[1] = Math.floor(f64VoxelHit[1]);
                i32VoxelHit[2] = Math.floor(f64VoxelHit[2]);
            }

            // Shift is tricky
            if (this.previousAction1 != userInterface.state.action1) {
                if (userInterface.state.action1) {
                    vec3.copy(this.selectStart, i32VoxelHit);
                } else {
                    // destroy to current voxelHit
                    console.log('destroy');
                    destroying = true;
                }
                this.previousAction1 = userInterface.state.action1;
            } else if (this.previousAction2 != userInterface.state.action2) {
                if (userInterface.state.action2) {
                    vec3.copy(this.selectStart, i32VoxelHit);
                } else {
                    // create
                    console.log('create');
                    creating = true;
                }
                this.previousAction2 = userInterface.state.action2;
            } else if (!this.previousAction1 && !this.previousAction2) {
                vec3.copy(this.selectStart, i32VoxelHit);
            }

            
            linesLow[0] = Math.min(selectStart[0], i32VoxelHit[0]);
            linesLow[1] = Math.min(selectStart[1], i32VoxelHit[1]);
            linesLow[2] = Math.min(selectStart[2], i32VoxelHit[2]);
            linesHigh[0] = Math.max(selectStart[0] + 1, i32VoxelHit[0] + 1);
            linesHigh[1] = Math.max(selectStart[1] + 1, i32VoxelHit[1] + 1);
            linesHigh[2] = Math.max(selectStart[2] + 1, i32VoxelHit[2] + 1);
            lines.fill(Shapes.wire.cube(linesLow, linesHigh));
            lines.skip(false);

            // TODO: might have race conditions with cursor and block modification ...
            // Create seems to be selecting block next to normal
            if (destroying) {
                this.game.world.changeBlocks(linesLow, linesHigh, 0);

            } else if (creating) {
                this.game.world.changeBlocks(linesLow, linesHigh, this.currentMaterial);
            }

        } else { // no voxel within cursor range, don't draw lines
            // clear
            lines.skip(true);
            
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

