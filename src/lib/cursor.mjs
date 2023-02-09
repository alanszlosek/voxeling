import { quat, vec3 } from 'gl-matrix';
import { Lines } from './lines.mjs';
import raycast from 'voxel-raycast';
import scratch from './scratch.mjs';
import Shapes from './shapes.mjs';
import { Tickable } from './entities/tickable.mjs';


class Cursor extends Tickable {
    constructor(game) {
        super();
        this.game = game;
        this.enabled = true;
        this.cutoff = 0.00; // don't fire raycasting on every frame
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
        return Promise.resolve();
    }

    // we don't need this to fire on every frame
    tick(ts) {
        // cursor can be toggled with "c"
        if (!this.enabled) {
            this.lines.skip(true);
            return;
        }
        if (ts < this.cutoff) {
            return;
        }
        // ten times a second
        this.cutoff = ts + 100;
        let distance = 5.0;
        let f64VoxelHit = scratch.f64vec3_0;
        let i32VoxelHit = scratch.i32vec3_0;
        let linesLow = scratch.i32vec3_1;
        let linesHigh = scratch.i32vec3_2;
        let creating = false;
        let destroying = false;

        let f64VoxelNormal = scratch.f64vec3_1;

        let currentVoxel = this.currentVoxel;
        let selectStart = this.selectStart;
        let userInterface = this.userInterface;
        let baseDirection = [0,0,-5.0];

        // DAMN I CAN'T FIURE OUT WHY THIS DRIFTS WITH HEAD TILT

        // start with player eye position
        // add distance to default rotation vec
        // rotate direction by player rotation quat
        // add rotated direction to player eye position
        // draw cursor at that position

        // TODO: now that we have the cursor actually living in the 3d world, we can show and hide it whenever we want
        // Logic for in-game cursor ... small green wire cube
        // NOTE: thing working from quat here and working from direction on 95 is giving us mismatch
        vec3.transformQuat(scratch.vec3, baseDirection, this.player.rotationQuat);
        
        // First param is expected to have getBlock()
        let hit = raycast(this.voxelCache, this.player.eyePosition, scratch.vec3, distance, f64VoxelHit, f64VoxelNormal);
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
                    destroying = true;
                }
                this.previousAction1 = userInterface.state.action1;
            } else if (this.previousAction2 != userInterface.state.action2) {
                if (userInterface.state.action2) {
                    vec3.copy(this.selectStart, i32VoxelHit);
                } else {
                    // create
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
            // TODO: optimize this
            this.lines.fill(Shapes.wire.cube(linesLow, linesHigh));
            this.lines.skip(false);

            // TODO: might have race conditions with cursor and block modification ...
            // Create seems to be selecting block next to normal
            if (destroying) {
                this.game.world.changeBlocks(linesLow, linesHigh, 0);

            } else if (creating) {
                this.game.world.changeBlocks(linesLow, linesHigh, this.currentMaterial);
            }

        } else { // no voxel within cursor range, don't draw lines
            // clear
            this.lines.skip(true);
            
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

