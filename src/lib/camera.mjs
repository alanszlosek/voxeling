import { mat4, quat, vec3 } from 'gl-matrix';

import { Movable } from './entities/movable.mjs';
import scratch from './scratch.mjs';

class Camera extends Movable {
    constructor(game) {
        super();

        this.game = game;

        // the camera manages some matrices used to render our scene
        // more info: https://jsantell.com/model-view-projection/
        // projection is used to transform points to clip/screen space, in perspective fashion
        this.projectionMatrix = mat4.create();
        // this contains the camera's position in coordinate space
        // you can think of it as the camera's model matrix
        this.modelMatrix = mat4.create();
        // this is an inverse of the model matrix
        // it transforms vertices from world space to camera/view space
        this.viewMatrix = mat4.create();
        // just a helper handle to make it clear view is the inverse
        this.inverseMatrix = this.viewMatrix;

        this.verticalFieldOfView = Math.PI / 4;
        this.ratio;
        // 32 * 20 = 640 ... 20 chunks away
        this.farDistance = 640; //2000; // three.JS uses 2000, not 640

        // values from three.js
        /*
        constructor( fov = 50, aspect = 1, near = 0.1, far = 2000 ) {
        this.fov = fov;
		this.zoom = 1;

		this.near = near;
		this.far = far;
		this.focus = 10;

		this.aspect = aspect;
        */
    }

    init() {
        let game = this.game;
        this.canvas = game.userInterface.webgl.canvas;
        this.follow = game.player;

        this.firstPersonOffset = game.player.eyeOffset; //vec3.fromValues(game.player.eyeOffset[0], 1.0, game.player.eyeOffset[2]);
        this.shoulderOffset = vec3.fromValues(0.0, 0.0, 3.0);
        this.thirdPersonOffset = vec3.fromValues(0.0, this.game.player.eyeOffset[1], 8.0);
        this.mode = -1;

        this.nextView();
        this.canvasResized();
        this.updateProjection();
    }


    // TODO: this doesn't work yet
    canvasResized() {
        this.ratio = this.canvas.clientWidth / this.canvas.clientHeight;
        
        // Adjusts coordinates for the screen's aspect ration
        // Not sure to set near and far to ... seems arbitrary. Surely those values should match the frustum

        // I used to use Math.PI / 4 for vertical FOV
        // Three.JS defaults to 50 degrees = 0.87 radians
        // A demo defaulted to 30
        // for some reason everything feels abnormal today
        this.verticalFieldOfView = Math.PI / 5;
        mat4.perspective(this.projectionMatrix, this.verticalFieldOfView, this.ratio, 0.1, this.farDistance);
    }

    // TODO: rename this method?
    updateProjection() {
        let delta = 0.25;

        // SET CAMERA POSITION
        switch (this.mode) {
            case 0:
                // Rotate eye offset into tempVector, which we'll then add to player position
                this.desiredOffset = this.firstPersonOffset;
                vec3.transformQuat(scratch.vec3, this.desiredOffset, this.follow.rotationQuatY);
                vec3.add(this.position, this.follow.position, scratch.vec3);
                vec3.transformQuat(this.direction, this.baseDirection, this.follow.rotationQuat);

                this.game.voxels.discardDepth = 0.0;
                break;
            case 1:
                this.desiredOffset = this.shoulderOffset;

                vec3.transformQuat(scratch.vec3, this.desiredOffset, this.follow.rotationQuat);
                vec3.add(this.position, this.follow.eyePosition, scratch.vec3);
                vec3.transformQuat(this.direction, this.baseDirection, this.follow.rotationQuat);

                // discard pixels between player and screen 
                this.game.voxels.discardDepth = 2.0;
                break;
            case 2:
                this.desiredOffset = this.thirdPersonOffset;
                break;
        }


        /*
        // TODO: let's disable smart camera for now ... causing issues
        // TODO: test for collision with block
        let block = this.game.voxelCache.getBlock(this.position[0], this.position[1], this.position[2]);
        if (block > 0) {
            this.currentOffset[2] -= delta;
            if (this.currentOffset[2] <= 0.00) {
                this.currentOffset[2] = 0.0;
            }

        } else {
            if (this.currentOffset[2] < this.desiredOffset[2]) {
                this.currentOffset[2] += delta;
            }
            if (this.currentOffset[2] > this.desiredOffset[2]) {
                this.currentOffset[2] = this.desiredOffset[2];
            }
        }
        */

        // CREATE INVERSE MATRIX FOR RENDERING THE WORLD AROUND THE CAMERA
        mat4.fromRotationTranslation(this.modelMatrix, this.follow.rotationQuat, this.position); //getRotationQuat(), this.position);
        mat4.invert(this.viewMatrix, this.modelMatrix);
        // nope, let's do this in the shader ... gives us more shader flexibility
        //mat4.multiply(this.inverse, this.projection, this.inverse);
    }

    nextView() {
        this.mode++;
        // just 2 views for now
        if (this.mode > 1) {
            this.mode = 0;
        }
        switch (this.mode) {
            case 0:
                this.desiredOffset = this.firstPersonOffset;
                break;
            case 1:
                this.desiredOffset = this.shoulderOffset;
                break;
            case 2:
                this.desiredOffset = this.thirdPersonOffset;
                break;
        }
        //this.currentOffset = vec3.clone(this.desiredOffset);
        // clear y offset, since we'll do that later after rotation
        //this.currentOffset[1] = 0.0
    }

    tick() {
        this.updateProjection();
    }
}

export { Camera };
