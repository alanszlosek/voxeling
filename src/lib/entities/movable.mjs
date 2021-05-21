
import { quat, vec3 } from 'gl-matrix';
import { Tickable } from './tickable';

// TODO: optimize this ...
/*
Goal of this class:

* handle position, rotation, scale
* return a matrix
* hmm, why is this just not part of Model?

*/
class Movable extends Tickable {
    constructor() {
        super();
        this.isMoving = false;
        this.yaw = 0.00;
        this.pitch = 0.00;
        this.bank = 0.00;

        this.rotationQuat = quat.create();
        // this helps us rotate the movement vector
        // but we only want movement (walking) to rotate along the Y axis
        // if player is looking down, we dont want that X rotation to affect
        // the movement vector
        this.rotationQuatY = quat.create();

        this.baseDirection = vec3.create();
        this.baseDirection[2] = -1.0;
        this.direction = vec3.create();

        this.position = vec3.create();
    }

    translate(vector) {
        vec3.add(this.position, this.position, vector);
    }
    setTranslation(x, y, z) {
        vec3.copy(this.position, arguments);
    }

    /*
    rotateY(radians) {
        this.yaw += radians;
        this.updateQuat();
        
        return;

        if (this.yaw > Math.PI * 2) {
            this.yaw -= (Math.PI * 2);

        } else if (this.yaw < 0) {
            this.yaw += (Math.PI * 2);
        }
        this.rotationQuatNeedsUpdate = true;
    }

    rotateX(radians) {
        // clamp absolute camera pitch, after applying pitch delta
        this.pitch += radians;
        
        if (this.pitch > 1.5) {
            this.pitch = 1.5;

        } else if (this.pitch < -1.5) {
            this.pitch = -1.5;
        }
        this.updateQuat();
    }
    */

    setRotation(x, y, z) {
        console.log('set rotationg');
        this.yaw = y;
        this.pitch = x;
        this.bank = z;

        if (this.pitch > 1.5) {
            this.pitch = 1.5;

        } else if (this.pitch < -1.5) {
            this.pitch = -1.5;
        }
        
        this.rotationQuatNeedsUpdate = true;
    }

    getPosition() {
        return this.position;
    }

    getX() {
        return this.position[0];
    }

    getY() {
        return this.position[1];
    }

    getZ() {
        return this.position[2];
    }

    getPitch() {
        return this.pitch;
    }

    getYaw() {
        return this.yaw;
    }

    updateQuat() {
        quat.fromEuler(this.rotationQuat, this.pitch, this.yaw, this.bank);
        quat.fromEuler(this.rotationQuatY, 0, this.yaw, 0);
        vec3.transformQuat(this.direction, this.baseDirection, this.rotationQuat);
    }

    getRotationQuat() {
        console.log('SHOULDNT BE HERE');
        if (this.rotationQuatNeedsUpdate) {
            quat.identity(this.rotationQuat);
            quat.rotateY(this.rotationQuat, this.rotationQuat, this.yaw);
            quat.rotateX(this.rotationQuat, this.rotationQuat, this.pitch);
            this.rotationQuatNeedsUpdate = false;

            vec3.transformQuat(this.direction, this.baseDirection, this.rotationQuat);
        }
        return this.rotationQuat;
    }

    getBank() {
        return this.bank;
    }

}

export { Movable };
