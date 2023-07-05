import { mat4, quat, vec3 } from 'gl-matrix';
import scratch from '../scratch.mjs';
import Shapes from '../shapes.mjs';
import { Movable } from '../capabilities/movable.mjs';
import { Tickable } from '../capabilities/tickable.mjs';
import { Bounds } from '../capabilities/bounds.mjs';
import { Player as PlayerModel } from '../models/player.mjs';

class Player extends Tickable {
    constructor(game) {
        super();
        this.game = game;
        this.currentVelocityLength = 0;
    }

    init() {
        this.modelMatrix = mat4.create();
        this.movable = new Movable();
        this.bounds = new Bounds();
        this.model = new PlayerModel(this.game, this.movable);

        // TODO: this really should respond like a head tilt
        this.eyeOffset = vec3.fromValues(0, 1.25, -0.5);
        this.eyePosition = vec3.create();

        this.translate(this.game.config.initialPosition);

        return Promise.resolve();
    }

    updateBounds(position) {
        this.bounds.updateBounds(position);
    }


    updateYawPitch(x, y) {
        this.movable.yaw -= x / 6;
        this.movable.pitch -= y / 6;
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

    tick() {
        this.movable.constrainPitch();
        this.movable.updateQuat();
        this.movable.updateMatrix();
        vec3.transformQuat(this.eyePosition, this.eyeOffset, this.movable.rotationQuatY);
        vec3.add(this.eyePosition, this.eyePosition, this.movable.position);
    }

    destroy() {
        this.model.destroy();
    }
}

export { Player };
