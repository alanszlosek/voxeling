import { mat4, quat, vec3 } from 'gl-matrix';
import { Dragon as DragonModel } from '../models/dragon.mjs';
import { Movable } from '../capabilities/movable.mjs';
import { Tickable } from '../capabilities/tickable.mjs';
import { Node2 } from '../scene-graph.mjs';
import scratch from '../scratch.mjs';

class Dragon extends Tickable {
    enabled = true;
    orbitVec3 = vec3.fromValues(20, 0, 0);

    constructor(game) {
        super();
        this.game = game;

        this.movable = new Movable();
        this.model = new DragonModel(this.game, this.movable.matrix);
        this.sceneNode = new Node2(this.model);
    }

    tick(ts) {
        // Update dragon position
        let speed = 6000;

        vec3.rotateY(scratch.vec3, this.orbitVec3, scratch.zeroVec3, ts / speed);
        // Raise dragon up above the ground
        scratch.vec3[1] = 15

        mat4.translate(scratch.mat4_1, scratch.zeroMat4, scratch.vec3);
        mat4.rotateY(this.movable.matrix, scratch.mat4_1, ts / speed);
    }



}

export { Dragon };
