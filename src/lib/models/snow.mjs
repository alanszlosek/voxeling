import { mat4, vec3 } from 'gl-matrix';
import { Lines } from '../lines.mjs';
import { Model } from '../model2';
import { Node } from '../scene-graph';
import scratch from '../scratch';
import Shapes from '../shapes.mjs';

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

class Snow {
    constructor(game) {
        this.game = game;
    }
    init() {
        let self = this;
        let game = this.game;
        let gl = this.game.userInterface.webgl.gl;
        /*
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
            */

        this.particles = [];
        let position = game.player.getPosition();
        for (let i = 0; i < 10; i++) {
            // TODO: keep offset for each particle
            // update each on tick
            // do matrix math in render for each, somehow
            let low = vec3.fromValues( getRandomInt(position[0]-20, position[0]+20), position[1] + 5, getRandomInt(position[2]-20, position[2]+20));
            let high = vec3.create();
            let particle = new Lines(this.game, [0, 0, 255, 1]);
            vec3.copy(high, low);
            high[0] += 0.5;
            high[1] += 0.5;
            high[2] += 0.5;
            particle.fill(Shapes.wire.cube(low, high));
            particle.skip(false);
            this.particles.push(particle);
        }
        

        return Promise.resolve();
    }

    tick(ts) {

    }
}

export { Snow };
