import { quat, vec3 } from 'gl-matrix';
import { Lines } from './lines.mjs';
import raycast from 'voxel-raycast';
import scratch from './scratch.mjs';
import Shapes from './shapes.mjs';
import { Tickable } from './capabilities/tickable.mjs';


// WARNING: NEEDS REFACTOR, UNUSED CURRENTLY

class Cursor extends Tickable {
    constructor(game) {
        super();
        let self = this;
        this.logger = game.log("Cursor");
        this.game = game;
        this.enabled = false;
        this.cutoff = 0.00; // don't fire raycasting on every frame
        // shortcuts

        // helpers to track input state changes (button presses)
        this.previousAction1 = false;
        this.previousAction2 = false;
        // Keep track of voxel we're focused on at the start of an "action" event (ie. mouse down, and mouse up)
        this.startVoxel = vec3.create();
    
        this.currentMaterial = this.game.config.texturePicker[0];
        this.currentVoxel = new Int32Array(3);
        this.currentNormalVoxel = vec3.create();
        this.previousVoxel = new Int32Array(3);
        this.selectStart = new Int32Array(3);

        this.lineMesh = new Float32Array(72);

        /*
        this.game.pubsub.subscribe('player', function(player) {
            self.playerCache = {
                rotationQuat: player.movable.rotationQuat,
                eyePosition: player.eyePosition
            };
            self.enabled = true;
        });
        */

        self.playerCache = {
            rotationQuat: game.player.movable.rotationQuat,
            eyePosition: game.player.eyePosition
        };
        this.lines = new Lines(this.game);
    }

    init() {
        let game = this.game;
        this.camera = game.camera;

        // TODO: fix this ... might end up being controls, or userInterface.state
        this.userInterface = game.userInterface;
        this.voxelCache = game.voxelCache;

        return Promise.resolve();
    }

    _updateMesh(fromPoint, toPoint) {
        let self = this;
        this.logger("_updateMesh");
        let dim0 = toPoint[0] - fromPoint[0];
        let dim1 = toPoint[1] - fromPoint[1];
        // odd that this one isn't used
        let dim2 = toPoint[2] - fromPoint[2];

        // low face outline (bottom of cube?)
        let i = 0;
        self.lineMesh[i++] = fromPoint[0];
        self.lineMesh[i++] = fromPoint[1];
        self.lineMesh[i++] = fromPoint[2];
        self.lineMesh[i++] = fromPoint[0] + dim0;
        self.lineMesh[i++] = fromPoint[1];
        self.lineMesh[i++] = fromPoint[2];

        self.lineMesh[i++] = fromPoint[0] + dim0;
        self.lineMesh[i++] = fromPoint[1];
        self.lineMesh[i++] = fromPoint[2];
        self.lineMesh[i++] = fromPoint[0] + dim0;
        self.lineMesh[i++] = fromPoint[1] + dim1;
        self.lineMesh[i++] = fromPoint[2];

        self.lineMesh[i++] = fromPoint[0] + dim0;
        self.lineMesh[i++] = fromPoint[1] + dim1;
        self.lineMesh[i++] = fromPoint[2];
        self.lineMesh[i++] = fromPoint[0];
        self.lineMesh[i++] = fromPoint[1] + dim1;
        self.lineMesh[i++] = fromPoint[2];

        self.lineMesh[i++] = fromPoint[0];
        self.lineMesh[i++] = fromPoint[1] + dim1;
        self.lineMesh[i++] = fromPoint[2];
        self.lineMesh[i++] = fromPoint[0];
        self.lineMesh[i++] = fromPoint[1];
        self.lineMesh[i++] = fromPoint[2];

        // higher face's outine
        self.lineMesh[i++] = toPoint[0];
        self.lineMesh[i++] = toPoint[1];
        self.lineMesh[i++] = toPoint[2];
        self.lineMesh[i++] = toPoint[0] - dim0;
        self.lineMesh[i++] = toPoint[1];
        self.lineMesh[i++] = toPoint[2];

        self.lineMesh[i++] = toPoint[0] - dim0;
        self.lineMesh[i++] = toPoint[1];
        self.lineMesh[i++] = toPoint[2];
        self.lineMesh[i++] = toPoint[0] - dim0;
        self.lineMesh[i++] = toPoint[1] - dim1;
        self.lineMesh[i++] = toPoint[2];

        self.lineMesh[i++] = toPoint[0] - dim0;
        self.lineMesh[i++] = toPoint[1] - dim1;
        self.lineMesh[i++] = toPoint[2];
        self.lineMesh[i++] = toPoint[0];
        self.lineMesh[i++] = toPoint[1] - dim1;
        self.lineMesh[i++] = toPoint[2];

        self.lineMesh[i++] = toPoint[0];
        self.lineMesh[i++] = toPoint[1] - dim1;
        self.lineMesh[i++] = toPoint[2];
        self.lineMesh[i++] = toPoint[0];
        self.lineMesh[i++] = toPoint[1];
        self.lineMesh[i++] = toPoint[2];

        // connectors
        self.lineMesh[i++] = fromPoint[0];
        self.lineMesh[i++] = fromPoint[1];
        self.lineMesh[i++] = fromPoint[2];
        self.lineMesh[i++] = toPoint[0] - dim0;
        self.lineMesh[i++] = toPoint[1] - dim1;
        self.lineMesh[i++] = toPoint[2];

        self.lineMesh[i++] = fromPoint[0] + dim0;
        self.lineMesh[i++] = fromPoint[1];
        self.lineMesh[i++] = fromPoint[2];

        self.lineMesh[i++] = toPoint[0];
        self.lineMesh[i++] = toPoint[1] - dim1;
        self.lineMesh[i++] = toPoint[2];

        self.lineMesh[i++] = fromPoint[0] + dim0;
        self.lineMesh[i++] = fromPoint[1] + dim1;
        self.lineMesh[i++] = fromPoint[2];
        self.lineMesh[i++] = toPoint[0];
        self.lineMesh[i++] = toPoint[1];
        self.lineMesh[i++] = toPoint[2];

        self.lineMesh[i++] = fromPoint[0];
        self.lineMesh[i++] = fromPoint[1] + dim1;
        self.lineMesh[i++] = fromPoint[2];
        self.lineMesh[i++] = toPoint[0] - dim0;
        self.lineMesh[i++] = toPoint[1];
        self.lineMesh[i++] = toPoint[2];

        self.lines.fill(self.lineMesh);
    }

    // we don't need this to fire on every frame
    tick(ts) {
        let self = this;
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
        let linesLow = scratch.i32vec3_1;
        let linesHigh = scratch.i32vec3_2;
        let creating = false;
        let destroying = false;

        let f64VoxelNormal = scratch.f64vec3_1;

        let selectStart = this.selectStart;
        let userInterface = this.game.userInterface;
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
        vec3.transformQuat(scratch.vec3, baseDirection, this.playerCache.rotationQuat);
        
        // First param is expected to have getBlock()
        let hit = raycast(this.game.voxelCache, this.playerCache.eyePosition, scratch.vec3, distance, f64VoxelHit, f64VoxelNormal);
        if (hit > 0) {
            // If pressing shift, convert to normal of the hit
            // preserve precision of voxelHit, so copy out
            if (userInterface.state.shift || userInterface.state.action2 || this.previousAction2) {
                // We use normals during creation
                // If Shift, right mouse is down, OR action2 (create) is active, shift the hit to the normal.
                // Without the previousAction2 check, it falls back to the else too soon, once right button is released,
                // which prevents an entire row of blocks from being created
                self.currentVoxel[0] = Math.floor(f64VoxelHit[0] + f64VoxelNormal[0]);
                self.currentVoxel[1] = Math.floor(f64VoxelHit[1] + f64VoxelNormal[1]);
                self.currentVoxel[2] = Math.floor(f64VoxelHit[2] + f64VoxelNormal[2]);
            } else {
                self.currentVoxel[0] = Math.floor(f64VoxelHit[0]);
                self.currentVoxel[1] = Math.floor(f64VoxelHit[1]);
                self.currentVoxel[2] = Math.floor(f64VoxelHit[2]);
            }




            // Shift is tricky
            if (this.previousAction1 != userInterface.state.action1) {
                if (userInterface.state.action1) {
                    vec3.copy(this.selectStart, self.currentVoxel);
                } else {
                    // destroy to current voxelHit
                    destroying = true;
                }
                this.previousAction1 = userInterface.state.action1;
            } else if (this.previousAction2 != userInterface.state.action2) {
                if (userInterface.state.action2) {
                    vec3.copy(this.selectStart, self.currentVoxel);
                } else {
                    // create
                    creating = true;
                }
                this.previousAction2 = userInterface.state.action2;
            } else if (!this.previousAction1 && !this.previousAction2) {
                vec3.copy(this.selectStart, self.currentVoxel);
            }

            // TODO: compare current and previously targeted voxels ... only update lines if different
            if (
                self.currentVoxel[0] != self.previousVoxel[0]
                ||
                self.currentVoxel[1] != self.previousVoxel[1]
                ||
                self.currentVoxel[2] != self.previousVoxel[2]
            )
            {
                // Update line locations
                linesLow[0] = Math.min(selectStart[0], self.currentVoxel[0]);
                linesLow[1] = Math.min(selectStart[1], self.currentVoxel[1]);
                linesLow[2] = Math.min(selectStart[2], self.currentVoxel[2]);
                linesHigh[0] = Math.max(selectStart[0] + 1, self.currentVoxel[0] + 1);
                linesHigh[1] = Math.max(selectStart[1] + 1, self.currentVoxel[1] + 1);
                linesHigh[2] = Math.max(selectStart[2] + 1, self.currentVoxel[2] + 1);

                this._updateMesh(linesLow, linesHigh);

            }
            
            
            // TODO: optimize this
            //this.lines.fill(Shapes.wire.cube(linesLow, linesHigh));
            //this.lines.skip(false);

            self.previousVoxel[0] = self.currentVoxel[0];
            self.previousVoxel[1] = self.currentVoxel[1];
            self.previousVoxel[2] = self.currentVoxel[2];


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
            this.currentVoxel[0] = Number.MAX_SAFE_INTEGER;
        }
    }

    render() {
        // Now render the lines
        // Looks like Lines class handles lots of this
    }
}

export { Cursor }

