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
        
        this.view = 0;
        this.firstPersonOffset = [0.0, 0.0, 0.0]; // this will be properly set in init()
        this.shoulderOffset = [ 0.7, 0.0, 3.0 ];
        this.thirdPersonOffset = [ 0.0, 0.0, 8.0 ];
    }

    init() {
        let game = this.game;
        this.canvas = game.userInterface.webgl.canvas;
        this.follow = game.player;
        this.firstPersonOffset[0] = game.player.eyeOffset[0];
        this.firstPersonOffset[2] = game.player.eyeOffset[2];

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
        var offset;


        switch (this.view) {
            // Over shoulder
            case 1:
                vec3.transformQuat(scratch.vec3, this.shoulderOffset, this.follow.getRotationQuat());
                // now raise up camera position to be shoulder height
                scratch.vec3[1] += 1.0;

                vec3.add(this.position, this.follow.getPosition(), scratch.vec3);
                break;

            // Farther up and back
            case 2:
                vec3.transformQuat(scratch.vec3, this.thirdPersonOffset, this.follow.getRotationQuat());
                // now raise up camera to be above player's head
                scratch.vec3[1] += 2.0;

                vec3.add(this.position, this.follow.getPosition(), scratch.vec3);
                break;

            // First-person
            default:
                // Rotate eye offset into tempVector, which we'll then add to player position
                vec3.transformQuat(scratch.vec3, this.firstPersonOffset, this.follow.getRotationQuat());
                // now raise camera to be eye-height
                scratch.vec3[1] += this.game.player.eyeOffset[1];

                vec3.transformQuat(scratch.vec3, this.follow.getEyeOffset(), scratch.quat);
                vec3.add(this.position, this.follow.getPosition(), scratch.vec3);
                break;
        }



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
    }

    tick() {
        this.updateProjection();
    }
}

export { Camera };
