import { mat4, vec3 } from 'gl-matrix';
import scratch from '../scratch';
import shapes from '../shapes.mjs';
import { Model } from '../model2';
import { Node } from '../scene-graph';

class Snow {
    constructor(game) {
        this.game = game;
    }
    init() {
        let self = this;
        let game = this.game;
        let gl = this.game.userInterface.webgl.gl;
        let shader = this.game.userInterface.webgl.shaders.projectionViewPosition; //2;

        let shape = shapes.two.unitTriangle();
        mat4.translate(shape.view, shape.view, [0, 16, 0]);
        shape.render = function() {
            var position = self.game.player.getPosition();
            mat4.translate(this.localMatrix, scratch.identityMat4, position);
            mat4.translate(this.localMatrix, this.localMatrix, [2, 2, 2]);
            console.log('here');
        };
    
        let m = new Model(
            gl,
            shader,
            [shape],
            game.textureAtlas.byValue[1],
            game.camera.inverse,
            game.player)
            ;

        return Promise.resolve();
    }
}

export { Snow };
