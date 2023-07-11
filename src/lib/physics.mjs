import { quat, vec3 } from 'gl-matrix';
import { Tickable } from './capabilities/tickable.mjs';
import raycast from 'voxel-raycast';
import scratch from './scratch.mjs';

let collidables = [];

var debug = false;

/*
// need to pass in start position
class Physics extends Tickable {
    constructor(game) {
        super();
        let self = this;
        this.game = game;
        this.running = false;
        this.currentVelocity = vec3.create();
        this.currentVelocityLength = 0;
        this.rotatedMovementVector = vec3.create();
        this.rotationQuat = quat.create();
        this.previousVelocity = vec3.create();

        this.controlState = game.userInterface.state;
        this.movable = game.player.movable;
        this.player = game.player;

        this.game.pubsub.subscribe('running', function() {
            self.running = true;
        });

    }
    init() {
        
        return Promise.resolve();
    }

    tick(ts) {
        // Skip tick if game is not running yet
        if (!this.running) {
            return;
        }
        this.movable.isMoving = this.controlState.forward || this.controlState.backward;

        // TODO: how can we handle jog and run/sprint speeds too?

        // don't tick based on delta milliseconds ... lets always assume our tick rate:
        // much less math, and if we have a pause, the character won't lurch forward

        // if Shift is pressed, switch into run mode
        let accel = this.controlState.shift ? accelerations.run : accelerations.walk;
        let velo = this.controlState.shift ? maxVelocities.run : maxVelocities.walk;

        // CALCULATE VELOCITY
        // TODO: refactor this somehow, while handling simultaneous keypresses gracefully
        if (this.controlState.forward == 1) {
            // keyboard, accelerate gradually
            this.currentVelocity[2] += -accel;
            this.currentVelocity[2] = Math.max(this.currentVelocity[2], -velo);
        } else if (this.controlState.forward > 0) {
            // gamepad, no acceleration, use stick percentage
            this.currentVelocity[2] = -velo * this.controlState.forward;
        } else if (this.controlState.backward == 1) {
            this.currentVelocity[2] += accel;
            this.currentVelocity[2] = Math.min(this.currentVelocity[2], velo);
        } else if (this.controlState.backward > 0) {
            this.currentVelocity[2] = velo * this.controlState.backward;
        } else {
            // Slowdown
            if (this.currentVelocity[2] > 0) {
                this.currentVelocity[2] -= accelerations.slowdown;
                if (this.currentVelocity[2] < 0) {
                    this.currentVelocity[2] = 0.00;
                }
            } else if (this.currentVelocity[2] < 0) {
                this.currentVelocity[2] += accelerations.slowdown;
                if (this.currentVelocity[2] > 0) {
                    this.currentVelocity[2] = 0.00;
                }
            }
        }
        if (this.controlState.left == 1) {
            this.currentVelocity[0] += -accel;
            this.currentVelocity[0] = Math.max(this.currentVelocity[0], -velo);
        } else if (this.controlState.left > 0) {
            this.currentVelocity[0] = -velo * this.controlState.left;
        } else if (this.controlState.right == 1) {
            this.currentVelocity[0] += accel;
            this.currentVelocity[0] = Math.min(this.currentVelocity[0], velo);
        } else if (this.controlState.right > 0) {
            this.currentVelocity[0] = velo * this.controlState.right;
        } else {
            // Slowdown
            if (this.currentVelocity[0] > 0) {
                this.currentVelocity[0] -= accelerations.slowdown;
                if (this.currentVelocity[0] < 0) {
                    this.currentVelocity[0] = 0.00;
                }
            } else if (this.currentVelocity[0] < 0) {
                this.currentVelocity[0] += accelerations.slowdown;
                if (this.currentVelocity[0] > 0) {
                    this.currentVelocity[0] = 0.00;
                }
            }
        }
        
        // flying and jumping should fall slowly
        if (this.controlState.jump && this.currentVelocity[1] == 0) {
            // only allow jumping if we're on the ground
            slowFall = true;
            this.currentVelocity[1] = velocities.jump;
        } else if (this.controlState.fly) {
            slowFall = true;
            // dont exceed maximum upward velocity
            this.currentVelocity[1] += accelerations.fly;
            if (this.currentVelocity[1] > 0) {
                this.currentVelocity[1] = Math.min(this.currentVelocity[1], velocities.maxFly);
            }
        } else {
            if (slowFall &&this.currentVelocity[1] < 0) {
                this.currentVelocity[1] += accelerations.partialGravity;
            } else {
                this.currentVelocity[1] += accelerations.gravity;
            }
        }
        scratch.vec3[0] = this.currentVelocity[0];
        scratch.vec3[1] = 0; // jumping and flying are too fast
        scratch.vec3[2] = this.currentVelocity[2];
        this.movable.currentVelocityLength = vec3.length(scratch.vec3);

        // TODO: this should not update the player position
        this.handleCollision(this.currentVelocity);
    };

    handleCollision(movementVector) {
        var self = this;
        var currentPosition = this.player.getPosition();
        var testPosition = vec3.create();
        var hit = vec3.create();
        var normals = vec3.create();

        var boundsMap = {
            p0: 'front',
            n0: 'back',
            p1: 'top',
            n1: 'bottom',
            p2: 'right',
            n2: 'left'
        };

        
        vec3.transformQuat(scratch.vec3_0, movementVector, this.movable.rotationQuatY);


        // Try to step up, but only if we're on the ground
        if (this.controlState.forward && this.previousVelocity[1] == 0.00) {
            vec3.copy(testPosition, currentPosition);
            testPosition[1] += 0.8;
            var collision = raycast(self.game.voxelCache, testPosition, scratch.vec3_0, 0.5, hit, normals);
            
            testPosition[1] += 0.2;

            if (
                collision
                &&
                self.game.voxelCache.getBlock(testPosition[0], testPosition[1], testPosition[2]) == 0
            ) {
                currentPosition[1] += 1.2;

                this.player.updateBounds(currentPosition);
                vec3.copy(scratch.vec3_1, scratch.vec3_0);

                // Did we have any significant collisions? If so, roll back the Y-axis change
                if (this.haggle(this.player.bounds.bounds.all, currentPosition, scratch.vec3_1)) {
                    currentPosition[1] -= 1.2;
                } else {
                    vec3.copy(this.previousVelocity, scratch.vec3_1);
                    self.player.translate(scratch.vec3_1);
                    return;
                }
            }
        }

        this.player.updateBounds(currentPosition);
        this.haggle(this.player.bounds.bounds.all, currentPosition, scratch.vec3_0);
        vec3.copy(this.previousVelocity, scratch.vec3_0);
        self.player.translate(scratch.vec3_0);
    };

    // Haggle for a stable, non-colliding position
    // Result of this is that direction vec3 gets adjusted in the process
    haggle(bounds, start, direction) {
        var self = this;
        var collided = false;
        var len = vec3.length(direction);
        var hit = vec3.create();
        var normals = vec3.create();

        for (var i = 0; i < bounds.length; i++) {
            var start = bounds[i];
            var adjusted = false;

            // If we've already adjusted the direction to 0 (like when we're up against a wall), skip further dection
            if (len == 0) {
                break;
            }
            var collision = raycast(self.game.voxelCache, start, direction, len, hit, normals);

            // Back off direction up to collision point along collision surface normals
            for (var axis = 0; axis < 3; axis++) {
                if (normals[axis] < 0.00 || 0.00 < normals[axis]) {
                    adjusted = true;
                    // Snap to voxel boundary upon collision
                    if (normals[axis] > 0) {
                        direction[axis] = Math.ceil(hit[axis] - start[axis]);
                    } else {
                        direction[axis] = Math.floor(hit[axis] - start[axis]);
                    }

                this.currentVelocity[axis] = 0.00;
                }
            }
            if (adjusted) {
                collided = true;
                len = vec3.length(direction);
            }
        }
        return collided;
    };
}
*/


class CollisionDetection extends Tickable {
    constructor(game) {
        super();
        this.game = game;

        this.hit = vec3.create();
        this.normals = vec3.create();
    }

    tick() {
        let self = this;
        collidables.forEach(function(item) {
            self._haggle(item);
        });

        collidables.forEach(function(item) {
            item.movable.translate( item.adjustedDelta );
        });
    }
    _resolve(item) {
        var self = this;

        let currentPosition = item.currentPosition;
        let tentativeDelta = item.tentativeDelta;
        let adjustedDelta = item.adjustedDelta;

        let len = vec3.length(tentativeDelta);
        let adjusted = this._haggle(currentPosition, tentativeDelta, adjustedDelta);

        var testPosition = vec3.create();
        var hit = vec3.create();
        var normals = vec3.create();

        var boundsMap = {
            p0: 'front',
            n0: 'back',
            p1: 'top',
            n1: 'bottom',
            p2: 'right',
            n2: 'left'
        };

        this.player.updateBounds(currentPosition);
        this.haggle(this.player.bounds.bounds.all, currentPosition, scratch.vec3_0);
        vec3.copy(this.previousVelocity, scratch.vec3_0);
        self.player.translate(scratch.vec3_0);
    };

    // Haggle for a stable, non-colliding position
    // Result of this is that direction vec3 gets adjusted in the process
    haggle(bounds, start, direction) {
        var self = this;
        var collided = false;
        var len = vec3.length(direction);
        var hit = vec3.create();
        var normals = vec3.create();

        for (var i = 0; i < bounds.length; i++) {
            var start = bounds[i];
            var adjusted = false;

            // If we've already adjusted the direction to 0 (like when we're up against a wall), skip further dection
            if (len == 0) {
                break;
            }
            var collision = raycast(self.game.voxelCache, start, direction, len, hit, normals);

            // Back off direction up to collision point along collision surface normals
            for (var axis = 0; axis < 3; axis++) {
                if (normals[axis] < 0.00 || 0.00 < normals[axis]) {
                    adjusted = true;
                    // Snap to voxel boundary upon collision
                    if (normals[axis] > 0) {
                        direction[axis] = Math.ceil(hit[axis] - start[axis]);
                    } else {
                        direction[axis] = Math.floor(hit[axis] - start[axis]);
                    }

                this.currentVelocity[axis] = 0.00;
                }
            }
            if (adjusted) {
                collided = true;
                len = vec3.length(direction);
            }
        }
        return collided;
    }

    _haggle(item) {
        let self = this;
        let len = vec3.length(item.tentativeDelta);

        // If we've already adjusted the direction to 0 (like when we're up against a wall), skip further dection
        if (len == 0) {
            return false;
        }
        let collision = raycast(this.game.voxelCache, item.currentPosition, item.tentativeDelta, len, this.hit, this.normals);

        if (!collision) {
            vec3.copy(item.adjustedDelta, item.tentativeDelta);
            return;
        } else {
            // Back off direction up to collision point along collision surface normals
            let adjusted = false;
            for (var axis = 0; axis < 3; axis++) {
                if (this.normals[axis] < 0.00 || 0.00 < this.normals[axis]) {
                    adjusted = true;
                    // Snap to voxel boundary upon collision
                    if (this.normals[axis] > 0) {
                        item.adjustedDelta[axis] = Math.ceil(this.hit[axis] - item.currentPosition[axis]);
                    } else {
                        item.adjustedDelta[axis] = Math.floor(this.hit[axis] - item.currentPosition[axis]);
                    }
                    item.currentVelocity[axis] = 0.00;
                }
            }
            if (adjusted) {
                //collided = true;
                len = vec3.length(item.tentativeDelta);
            }

            /*
            console.log('collidate');
            item.currentVelocity[0] = 0;
            item.currentVelocity[1] = 0;
            item.currentVelocity[2] = 0;
            
            item.adjustedDelta[0] = 0;
            item.adjustedDelta[1] = 0;
            item.adjustedDelta[2] = 0;
            */
            
        }
        return;

    }
    resolve() {

    }
}

export { CollisionDetection, collidables };
