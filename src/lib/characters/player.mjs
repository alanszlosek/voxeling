import { mat4, quat, vec3 } from 'gl-matrix';
import scratch from '../scratch.mjs';
import Shapes from '../shapes.mjs';
import { Camera } from '../camera.mjs';
import { Movable } from '../capabilities/movable.mjs';
import { Tickable } from '../capabilities/tickable.mjs';
import { Bounds } from '../capabilities/bounds.mjs';
import { Player as PlayerModel } from '../models/player.mjs';
import { collidables } from '../physics.mjs';

class Player extends Tickable {
    constructor(game) {
        super();
        let self = this;
        this.game = game;

        //this.camera = new Camera(game);
        this.cameraPosition = new Movable();
        this.cameraPosition.setTranslation(16, 16, 16);

        this.currentVelocityLength = 0;
        this.modelMatrix = mat4.create();
        this.movable = new Movable();
        this.bounds = new Bounds();
        this.model = new PlayerModel(this.game, this.movable);
        this.movement = new PlayerMovement(this.movable);

        // camera stuff
        this.cameraMode = 0;
        // TODO: this really should respond like a head tilt
        this.eyeOffset = vec3.fromValues(0, 1.25, -0.5);
        this.eyePosition = vec3.create();
        this.offsets = [
            // first person
            vec3.fromValues(0, 1.25, -0.5),
            // shoulder
            vec3.fromValues(0.0, 2.0, 3.0),
            // third person
            vec3.fromValues(0.0, this.eyeOffset[1], 8.0)
        ];
        this.desiredOffset = this.offsets[1];
    
    
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
        //console.log(this.cameraPosition);
        // Update camera position
        this.cameraPosition.yaw = this.movable.yaw;
        this.cameraPosition.pitch = this.movable.pitch;

        this.cameraPosition.position[0] = this.movable.position[0];
        this.cameraPosition.position[1] = this.movable.position[1] + 1;
        this.cameraPosition.position[2] = this.movable.position[2] - 2;

        switch (this.cameraMode) {
            case 0:
                // Rotate eye offset into tempVector, which we'll then add to player position
                // vec3.transformQuat(scratch.vec3, this.desiredOffset, this.movable.rotationQuatY);
                // vec3.add(this.position, this.follow.position, scratch.vec3);
                // vec3.transformQuat(this.direction, this.baseDirection, this.follow.rotationQuat);

                //this.game.voxels.discardDepth = 0.0;

                vec3.transformQuat(scratch.vec3, this.desiredOffset, this.movable.rotationQuatY);
                vec3.add(this.cameraPosition.position, this.movable.position, scratch.vec3);
                //vec3.transformQuat(this.direction, this.baseDirection, this.follow.rotationQuat);
                break;
        }


        //this.cameraPosition.constrainPitch();
        this.cameraPosition.update();
        return;

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

    inputChange(state) {
        this.movement.inputChange(state);
        this.updateCamera();
    }

    destroy() {
        this.model.destroy();
    }
}

class PlayerMovement extends Tickable {
    constructor(movable) {
        super();
        this.movable = movable;

        this.currentVelocity = vec3.create();

        this.currentPosition = this.movable.position;
        this.tentativeDelta = vec3.create();
        this.adjustedDelta = vec3.create();

        let ticksPerSecond = 30;
        this.accelerations = {
            gravity: -0.4 / ticksPerSecond,
            // To make jumping less disorienting, fall slower from height of jump
            partialGravity: -0.4 / ticksPerSecond,
            // 9.8 units/blocks per second, per tick
            walk: 0.8 / ticksPerSecond,
            jog: 0.8 / ticksPerSecond,
            run: 0.8 / ticksPerSecond,
            slowdown: 0.4 / ticksPerSecond,
            fly: 1 / ticksPerSecond
        };
        this.velocities = {
            jump: 6 / ticksPerSecond
        };
        this.maxVelocities = {
            jump: 10 / ticksPerSecond,
            fly: 6 / ticksPerSecond,
        
            // max velocities
            walk: 4 / ticksPerSecond,
            jog: 6 / ticksPerSecond,
            run: 8 / ticksPerSecond
        
        };

        this.state = {
            shift: false,
            alt: false,
            forward: 0,
            backward: 0,
            left: 0,
            right: 0,
            rotateX: 0,
            rotateY: 0,
            jump: false,
            fly: false,
            fire: false,
            firealt: false,
            action1: false, // default: destroy block
            action2: false, // default: create block,
            spin: false
        };

        collidables.push( this );
    }

    inputChange(state) {

        // Adjust accelerations based on impulses
        for (let key in state) {
            if (key == 'rotateX') {
                this.movable.yaw = state.rotateX;
            } else if (key == 'rotateY') {
                this.movable.pitch = state.rotateY;
            } else {
                this.state[key] = state[key];
            }
            
        }
    }

    tick() {
        let state = this.state;

        let acceleration = state.shift ? this.accelerations.run : this.accelerations.walk;
        let maxVelocity = state.shift ? this.maxVelocities.run : this.maxVelocities.walk;

        // CALCULATE VELOCITY
        // TODO: refactor this somehow, while handling simultaneous keypresses gracefully
        if (state.forward == 1) {
            // keyboard, accelerate gradually
            this.currentVelocity[2] += -acceleration;
            this.currentVelocity[2] = Math.max(this.currentVelocity[2], -maxVelocity);
        } else if (state.forward > 0) {
            // gamepad, no acceleration, use stick percentage
            this.currentVelocity[2] = -maxVelocity * state.forward;
        } else if (state.backward == 1) {
            this.currentVelocity[2] += acceleration;
            this.currentVelocity[2] = Math.min(this.currentVelocity[2], maxVelocity);
        } else if (state.backward > 0) {
            this.currentVelocity[2] = maxVelocity * state.backward;
        } else {
            // Slowdown
            if (this.currentVelocity[2] > 0) {
                console.log('slowdown');
                this.currentVelocity[2] -= this.accelerations.slowdown;
                if (this.currentVelocity[2] < 0) {
                    this.currentVelocity[2] = 0.00;
                }
            } else if (this.currentVelocity[2] < 0) {
                this.currentVelocity[2] += this.accelerations.slowdown;
                if (this.currentVelocity[2] > 0) {
                    this.currentVelocity[2] = 0.00;
                }
            }
        }

        if (this.state.left == 1) {
            this.currentVelocity[0] += -acceleration;
            this.currentVelocity[0] = Math.max(this.currentVelocity[0], -maxVelocity);
        } else if (this.state.left > 0) {
            this.currentVelocity[0] = -maxVelocity * this.state.left;
        } else if (this.state.right == 1) {
            this.currentVelocity[0] += acceleration;
            this.currentVelocity[0] = Math.min(this.currentVelocity[0], maxVelocity);
        } else if (this.state.right > 0) {
            this.currentVelocity[0] = maxVelocity * this.state.right;
        } else {
            // Slowdown
            if (this.currentVelocity[0] > 0) {
                this.currentVelocity[0] -= this.accelerations.slowdown;
                if (this.currentVelocity[0] < 0) {
                    this.currentVelocity[0] = 0.00;
                }
            } else if (this.currentVelocity[0] < 0) {
                this.currentVelocity[0] += this.accelerations.slowdown;
                if (this.currentVelocity[0] > 0) {
                    this.currentVelocity[0] = 0.00;
                }
            }
        }

        let slowFall = false;
        // flying and jumping should fall slowly
        if (this.state.jump && this.currentVelocity[1] == 0) {
            // only allow jumping if we're on the ground
            slowFall = true;
            this.currentVelocity[1] = this.velocities.jump;
        } else if (this.state.fly) {
            slowFall = true;
            // dont exceed maximum upward velocity
            this.currentVelocity[1] += this.accelerations.fly;
            if (this.currentVelocity[1] > 0) {
                this.currentVelocity[1] = Math.min(this.currentVelocity[1], this.maxVelocities.fly);
            }
        } else {
            if (slowFall && this.currentVelocity[1] < 0) {
                this.currentVelocity[1] += this.accelerations.partialGravity;
            } else {
                this.currentVelocity[1] += this.accelerations.gravity;
            }
        }

        vec3.transformQuat(this.tentativeDelta, this.currentVelocity, this.movable.rotationQuatY);
        vec3.copy(this.adjustedDelta, this.tentativeDelta);

        // TODO: temp translation for collision detection

        //this.movable.translate(this.tentativeDelta);
    }
}

export { Player };
