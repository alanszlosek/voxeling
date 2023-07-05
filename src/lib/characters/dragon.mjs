import { mat4, quat, vec3 } from 'gl-matrix';
import { Dragon as DragonModel } from '../models/dragon.mjs';
import { Movable } from '../capabilities/movable.mjs';
import { Tickable } from '../capabilities/tickable.mjs';
import scratch from '../scratch.mjs';

class Dragon extends Tickable {
    constructor(game) {
        super();
        this.game = game;
        this.enabled = true;
    }
    
    init() {
        // This should probably be moved into Movable
        // with a getMatrix() function that updates when needed.
        // But until I see what we need for NPCs that move on their own,
        // going to leave it here.
        this.modelMatrix = mat4.create();

        this.movable = new Movable();
        this.model = new DragonModel(this.game, this.modelMatrix);

        return Promise.resolve();
    }

    tick(ts) {
        // Update dragon position
        let speed = 6000;
        let orbit = 20;

        vec3.rotateY(scratch.vec3, [orbit, 0, 0], [0,0,0], ts / speed);
        scratch.vec3[1] = 15

        mat4.copy(scratch.mat4_0, scratch.zeroMat4);
        mat4.translate(scratch.mat4_1, scratch.mat4_0, scratch.vec3);
        mat4.rotateY(this.modelMatrix, scratch.mat4_1, ts / speed);
    }



}

export { Dragon };
