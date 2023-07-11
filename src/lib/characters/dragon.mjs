import { mat4, quat, vec3 } from 'gl-matrix';
import { Dragon as DragonModel } from '../models/dragon.mjs';
import { Movable } from '../capabilities/movable.mjs';
import { Tickable } from '../capabilities/tickable.mjs';
import { Node } from '../scene-graph.mjs';
import scratch from '../scratch.mjs';

class Dragon extends Tickable {
    enabled = true;
    orbitVec3 = vec3.fromValues(20, 0, 0);

    constructor(game) {
        super();
        this.game = game;

        this.cameraPosition = new Movable();
        this.movable = new Movable();
        this.model = new DragonModel(this.game, this.movable.matrix);
        //this.sceneNode = new Node(this.model);
    }

    tick(ts) {
        // Update dragon position
        let speed = 6000;

        // TODO: fix these operations

        vec3.rotateY(scratch.vec3, this.orbitVec3, scratch.zeroVec3, ts / speed);
        // Raise dragon up above the ground
        scratch.vec3[1] = 15

        //this.movable.rotateY( ts / speed );
        this.movable.copyTranslation(scratch.vec3);
        this.movable.update();

        // mat4.translate(scratch.mat4_1, scratch.zeroMat4, scratch.vec3);
        // mat4.rotateY(this.movable.matrix, scratch.mat4_1, ts / speed);

        //this.cameraPosition.copy( this.movable );

        // TODO: camera rotation should be relative to model
        vec3.copy(this.cameraPosition.position, this.movable.position);
        this.cameraPosition.update();
    }

    inputChange(state) {
        // Adjust accelerations based on impulses
        for (let key in state) {
            if (key == 'rotateX') {
                this.cameraPosition.yaw = state.rotateX;
            } else if (key == 'rotateY') {
                this.cameraPosition.pitch = state.rotateY;
            } else {
                //this.state[key] = state[key];
            }
            
        }
    }



}

export { Dragon };
