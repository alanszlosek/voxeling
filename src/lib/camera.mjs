import { mat4, quat, vec3 } from 'gl-matrix';

import { Movable } from './movable';
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
        this.direction = vec3.create();
        this.direction[0] = 1.0;
        
        this.view = 0;
        this.shoulderOffset = [ 0.4, 2, 2 ];
        this.thirdPersonOffset = [ 0, 2, 4 ];
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
                offset = this.shoulderOffset;
                //vec3.transformQuat(this.tempVector, offset, this.follow.getRotationQuat());
                // transform this offset, according to yaw
                //vec3.add(this.position, this.follow.getPosition(), this.tempVector);
                break;

            // Birds-eye
            case 2:
                offset = this.thirdPersonOffset;
                //vec3.transformQuat(this.tempVector, offset, this.follow.getRotationQuat());
                // transform this offset, according to yaw
                //vec3.add(this.position, this.follow.getPosition(), this.tempVector);
                break;

            // First-person
            default:
                offset = this.follow.getEyeOffset();
                break;
        }

        // Rotate eye offset into tempVector, which we'll then add to player position
        quat.rotateY(scratch.quat, scratch.identityQuat, this.follow.getYaw());
        vec3.transformQuat(scratch.vec3, offset, scratch.quat);
        vec3.add(this.position, this.follow.getPosition(), scratch.vec3);

        mat4.fromRotationTranslation(this.matrix, this.follow.getRotationQuat(), this.position);
        mat4.invert(this.inverse, this.matrix);
        mat4.multiply(this.inverse, this.projection, this.inverse);

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
