
import { quat, vec3 } from 'gl-matrix';
import { Tickable } from './ecs/tickable';

class Movable extends Tickable {
    constructor() {
        super();
        this.isMoving = false;
        this.yaw = 0.00;
        this.pitch = 0.00;
        this.bank = 0.00;

        this.rotationQuat = quat.create();
        this.rotationQuatNeedsUpdate = false;

        this.position = vec3.create();
        this.bounds = {
            bottomFrontLeft: [ 0, 0, 0 ],
            bottomFrontRight: [ 0, 0, 0 ],
            bottomBackLeft: [ 0, 0, 0 ],
            bottomBackRight: [ 0, 0, 0 ],
            middleFrontLeft: [ 0, 0, 0 ],
            middleFrontRight: [ 0, 0, 0 ],
            middleBackLeft: [ 0, 0, 0 ],
            middleBackRight: [ 0, 0, 0 ],
            topFrontLeft: [ 0, 0, 0 ],
            topFrontRight: [ 0, 0, 0 ],
            topBackLeft: [ 0, 0, 0 ],
            topBackRight: [ 0, 0, 0 ],
            all: null,
            front: null,
            back: null,
            left: null,
            right: null,
            top: null,
            bottom: null
        };
        this.bounds.all = [ this.bounds.bottomFrontLeft, this.bounds.bottomFrontRight, this.bounds.bottomBackLeft, this.bounds.bottomBackRight, this.bounds.middleFrontLeft, this.bounds.middleFrontRight, this.bounds.middleBackLeft, this.bounds.middleBackRight, this.bounds.topFrontLeft, this.bounds.topFrontRight, this.bounds.topBackLeft, this.bounds.topBackRight ];
        this.bounds.front = [ this.bounds.bottomFrontLeft, this.bounds.bottomFrontRight, this.bounds.middleFrontLeft, this.bounds.middleFrontRight, this.bounds.topFrontLeft, this.bounds.topFrontRight ];
        this.bounds.back = [ this.bounds.bottomBackLeft, this.bounds.bottomBackRight, this.bounds.middleBackLeft, this.bounds.middleBackRight, this.bounds.topBackLeft, this.bounds.topBackRight ];
        this.bounds.left = [ this.bounds.bottomFrontLeft, this.bounds.bottomBackLeft, this.bounds.middleFrontLeft, this.bounds.middleBackLeft, this.bounds.topFrontLeft, this.bounds.topBackLeft ];
        this.bounds.right = [ this.bounds.bottomFrontRight, this.bounds.bottomBackRight, this.bounds.middleFrontRight, this.bounds.middleBackRight, this.bounds.topFrontRight, this.bounds.topBackRight ];
        this.bounds.top = [ this.bounds.topFrontLeft, this.bounds.topFrontRight, this.bounds.topBackLeft, this.bounds.topBackRight ];
        this.bounds.bottom = [ this.bounds.bottomFrontLeft, this.bounds.bottomFrontRight, this.bounds.bottomBackLeft, this.bounds.bottomBackRight ];
    }

    translate(vector) {
        vec3.add(this.position, this.position, vector);
    }
    setTranslation(x, y, z) {
        vec3.copy(this.position, arguments);
    }

    rotateY(radians) {
        this.yaw += radians;
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
        this.rotationQuatNeedsUpdate = true;
    }

    setRotation(x, y, z) {
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

    getRotationQuat() {
        if (this.rotationQuatNeedsUpdate) {
            quat.identity(this.rotationQuat);
            quat.rotateY(this.rotationQuat, this.rotationQuat, this.yaw);
            quat.rotateX(this.rotationQuat, this.rotationQuat, this.pitch);
            this.rotationQuatNeedsUpdate = false;
        }
        return this.rotationQuat;
    }

    getBank() {
        return this.bank;
    }

    updateBounds(position) {
        var x = position[0], y = position[1], z = position[2];
        var width = .6;
        var height = 1.6;
        var w = width / 2;
        var h = height / 2;
        var bounds;
        // x0/y0/z0 - forward + left
        bounds = this.bounds.bottomFrontLeft;
        bounds[0] = x - w;
        bounds[1] = y;
        bounds[2] = z - w;
        // x0/y0/z1 - backward + left
        bounds = this.bounds.bottomBackLeft;
        bounds[0] = x - w;
        bounds[1] = y;
        bounds[2] = z + w;
        // x1/y0/z1 - backward + right
        bounds = this.bounds.bottomBackRight;
        bounds[0] = x + w;
        bounds[1] = y;
        bounds[2] = z + w;
        // x1/y0/z0 - forward + right
        bounds = this.bounds.bottomFrontRight;
        bounds[0] = x + w;
        bounds[1] = y;
        bounds[2] = z - w;
        bounds = this.bounds.middleFrontLeft;
        bounds[0] = x - w;
        bounds[1] = y + h;
        bounds[2] = z - w;
        bounds = this.bounds.middleBackLeft;
        bounds[0] = x - w;
        bounds[1] = y + h;
        bounds[2] = z + w;
        bounds = this.bounds.middleBackRight;
        bounds[0] = x + w;
        bounds[1] = y + h;
        bounds[2] = z + w;
        bounds = this.bounds.middleFrontRight;
        bounds[0] = x + w;
        bounds[1] = y + h;
        bounds[2] = z - w;
        bounds = this.bounds.topFrontLeft;
        bounds[0] = x - w;
        bounds[1] = y + height;
        bounds[2] = z - w;
        bounds = this.bounds.topBackLeft;
        bounds[0] = x - w;
        bounds[1] = y + height;
        bounds[2] = z + w;
        bounds = this.bounds.topBackRight;
        bounds[0] = x + w;
        bounds[1] = y + height;
        bounds[2] = z + w;
        bounds = this.bounds.topFrontRight;
        bounds[0] = x + w;
        bounds[1] = y + height;
        bounds[2] = z - w;
    }
}

export { Movable };
