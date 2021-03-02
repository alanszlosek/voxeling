import { mat4, quat, vec3 } from 'gl-matrix';

import { Movable } from './entities/movable';
import scratch from './scratch';

class Camera extends Movable {
    constructor(game) {
        super();

        this.game = game;
        
        this.matrix = mat4.create();
        this.inverse = mat4.create();

        this.verticalFieldOfView = Math.PI / 4;
        this.ratio;
        // 32 * 20 = 640 ... 20 chunks away
        this.farDistance = 640;
        this.projection = mat4.create();
    }

    init() {
        let game = this.game;
        this.canvas = game.userInterface.webgl.canvas;
        this.follow = game.player;

        this.firstPersonOffset = vec3.fromValues(game.player.eyeOffset[0], 1.0, game.player.eyeOffset[2]);
        this.shoulderOffset = vec3.fromValues(0.7, 2.0, 3.0);
        this.thirdPersonOffset = vec3.fromValues(0.0, this.game.player.eyeOffset[1], 8.0);
        this.view = -1;

        this.nextView();
        this.canvasResized();
        this.updateProjection();
    }


    canvasResized() {
        this.ratio = this.canvas.clientWidth / this.canvas.clientHeight;
        
        // Adjusts coordinates for the screen's aspect ration
        // Not sure to set near and far to ... seems arbitrary. Surely those values should match the frustum
        mat4.perspective(this.projection, this.verticalFieldOfView, this.ratio, 0.1, this.farDistance);
    }

    updateProjection() {
        let delta = 0.25;

        // Rotate eye offset into tempVector, which we'll then add to player position
        vec3.transformQuat(scratch.vec3, this.currentOffset, this.follow.getRotationQuat());
        scratch.vec3[1] += this.desiredOffset[1];
        //console.log(this.desiredOffset, this.currentOffset, scratch.vec3);

        vec3.add(this.position, this.follow.getPosition(), scratch.vec3);


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


        mat4.fromRotationTranslation(this.matrix, this.follow.getRotationQuat(), this.position);
        mat4.invert(this.inverse, this.matrix);
        mat4.multiply(this.inverse, this.projection, this.inverse);

        vec3.transformQuat(this.direction, this.baseDirection, this.follow.rotationQuat);

        return this.inverse;
    }

    nextView() {
        this.view++;
        if (this.view > 2) {
            this.view = 0;
        }
        switch (this.view) {
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
        this.currentOffset = vec3.clone(this.desiredOffset);
        // clear y offset, since we'll do that later after rotation
        //this.currentOffset[1] = 0.0
    }

    tick() {
        this.updateProjection();
    }
}

export { Camera };
