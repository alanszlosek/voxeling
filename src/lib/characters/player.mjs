import { mat4, quat, vec3 } from 'gl-matrix';
import scratch from '../scratch.mjs';
import Shapes from '../shapes.mjs';
import { Camera } from '../camera.mjs';
import { Movable } from '../capabilities/movable.mjs';
import { Tickable } from '../capabilities/tickable.mjs';
import { Bounds } from '../capabilities/bounds.mjs';
import { Player as PlayerModel } from '../models/player.mjs';

class Player extends Tickable {
    constructor(game) {
        super();
        let self = this;
        this.game = game;

        this.camera = new Camera(game);
        this.currentVelocityLength = 0;
        this.modelMatrix = mat4.create();
        this.movable = new Movable();
        this.bounds = new Bounds();
        this.model = new PlayerModel(this.game, this.movable);

        // camera stuff
        this.cameraMode = 2;
    
        // TODO: this really should respond like a head tilt
        this.eyeOffset = vec3.fromValues(0, 1.25, -0.5);
        this.eyePosition = vec3.create();
    
        this.translate(this.game.config.initialPosition);

        this.game.pubsub.subscribe('mousemove', function(x, y) {
            self.updateYawPitch(x, y);
        });
    }

    init() {
        this.game.pubsub.publish('player', this);
        return Promise.resolve();
    }

    updateBounds(position) {
        this.bounds.updateBounds(position);
    }


    updateYawPitch(x, y) {
        this.movable.setYawPitch(x,y);
    }

    // TODO: rework these movement methods
    translate(vector) {
        this.movable.translate(vector);
        // TODO: perhaps move this calculation to tick
        //vec3.add(this.eyePosition, this.position, this.eyeOffset);
    }

    setTranslation(x, y, z) {
        vec3.copy(this.position, arguments);
        //vec3.add(this.eyePosition, this.position, this.eyeOffset);
    }

    getEyeOffset() {
        return this.eyeOffset;
    }

    getEyePosition() {
        return this.eyePosition;
    }

    getPosition() {
        return this.movable.position;
    }

    setTexture(texture) {
        if (this.avatar != texture) {
            let textures = {
                'player': 0,
                'substack': 1,
                'viking': 2
            }
            this.model.setTextureUnit( textures[texture] );
            this.avatar = texture;
        }
    }

    updateCamera() {
        let delta = 0.25;

        let firstPersonOffset = vec3.fromValues(0, 1.25, -0.5);
        let shoulderOffset = vec3.fromValues(0.0, 0.0, 3.0);
        let thirdPersonOffset = vec3.fromValues(0.0, this.eyeOffset[1], 8.0);
        

        // SET CAMERA POSITION
        switch (this.cameraMode) {
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

        this.camera.updateProjection();
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
        this.movable.constrainPitch();
        this.movable.update();
        vec3.transformQuat(this.eyePosition, this.eyeOffset, this.movable.rotationQuatY);
        vec3.add(this.eyePosition, this.eyePosition, this.movable.position);

        // update our camera
        this.updateCamera();

        this.game.pubsub.publish('player.updatePosition', [this.movable.position]);
        this.game.pubsub.publish('player.updateRotation', [this.movable.yaw, this.movable.pitch]);
    }

    destroy() {
        this.model.destroy();
    }
}

export { Player };
