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
        this.shoulderOffset = [ 0.4, 0, 3 ];
        this.thirdPersonOffset = [ 0, 0, 8 ];
    }

    init() {
        let game = this.game;
        this.canvas = game.userInterface.webgl.canvas;
        this.follow = game.player;

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

            // Birds-eye
            case 2:
                vec3.transformQuat(scratch.vec3, this.thirdPersonOffset, this.follow.getRotationQuat());
                scratch.vec3[1] += 2.0;

                vec3.add(this.position, this.follow.getPosition(), scratch.vec3);
                break;

            // First-person
            default:
                // Rotate eye offset into tempVector, which we'll then add to player position
                quat.rotateY(scratch.quat, scratch.identityQuat, this.follow.getYaw());

                vec3.transformQuat(scratch.vec3, this.follow.getEyeOffset(), scratch.quat);
                vec3.add(this.position, this.follow.getPosition(), scratch.vec3);
                break;
        }



        mat4.fromRotationTranslation(this.matrix, this.follow.getRotationQuat(), this.position);
        mat4.invert(this.inverse, this.matrix);
        mat4.multiply(this.inverse, this.projection, this.inverse);

        // TODO: fix this
        vec3.transformQuat(this.direction, this.baseDirection, this.follow.rotationQuat);

        // TODO: also update pointing ... meaning the center of the screen, where the cursor should be
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
