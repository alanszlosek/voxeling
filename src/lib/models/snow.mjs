import { mat4, vec3 } from 'gl-matrix';
import { Lines } from '../lines.mjs';
//import { Model } from '../model.mjs';
//import { Movable } from '../entities/movable.mjs';
//import { Node } from '../scene-graph';
import { Renderable } from '../entities/renderable';
import scratch from '../scratch';
import Shapes from '../shapes.mjs';
import { Tickable } from '../entities/tickable';


import { getRandomInt } from '../util.mjs';

/*
High level

Snow creates a random number of snowflakes around the player's position

Properties of each snowflake
- random starting position
- random rotation property
    - percentage of render delta
- float down motion (sine wave or something)
- transform matrix
- snowflake structure made of differently sized cubes arranged away from mid-point
- same snow/white texture for each

Actions to perform for each snowflake
- test center of snowflake for collision with blocks in the world every N seconds (start every 5 seconds?)
- rotate/spin every tick by some amount

*/

class Snowflake extends Tickable {
    constructor(game) {
        super();
        this.game = game;
       
        this.respawn();
    }

    respawn() {
        let position = this.game.player.getPosition();
        
        this.fallSpeed = 0.06; // some range up to 0.1
        let spread = 32;
        this.position = vec3.fromValues(
            getRandomInt(position[0] - spread, position[0] + spread),
            getRandomInt(position[1] + 10, position[1] + 30),
            getRandomInt(position[2] - spread, position[2] + spread)
        );
        this.collisionCheck = 0;
    }

    tick(ts, delta) {
        this.position[1] -= this.fallSpeed;

        // check for collision
        // If so, respawn flake and add another

        // Don't check for collision on every frame. Snowflakes fall slowly enough that we don't have to
        if (this.collisionCheck == 3) {
            if (this.game.voxelCache.getBlock(this.position[0], this.position[1], this.position[2]) > 0) {
                this.respawn();
            }
            this.collisionCheck = 0;
        } else {
            this.collisionCheck++;
        }
    }
}

class Snow extends Renderable {
    constructor(game) {
        super();
        this.game = game;
    }
    init() {
        this.numSnowflakes = 80;
        this.snowflakes = {};
        for (let i = 0; i < this.numSnowflakes; i++) {
            let sf = new Snowflake(this.game);
            this.snowflakes[ sf._tickableId ] = sf;
        }

        // Prepare shared mesh and buffers
        // which texture unit / atlas is the white wool in?
        let textureValue = 5;
        this.textureUnit = this.game.textureOffsets['textureToTextureUnit'][ textureValue ]
        let textureV = this.game.textureOffsets['offsets'][ textureValue ];
        let height = this.game.textureOffsets['textureRowHeight'];
        // lower left, upper right in texture map
        let uv = [0, textureV, 1, textureV + height];

        let d = 0.1; //Math.random();
        this.mesh = Shapes.three.rectangle3(d, d, d, uv);
        // Would love to specify offsets and have that show up in mesh coords that are returned
        // Also would love to be able to get a tuple of 4 coord bounds of texture, by name
        // gives us: vertices, texcoords, normals
        // TODO: could have rectangle3 append into existing arrays
        this.buffersPerTextureUnit = {};

        this.buffersPerTextureUnit[ this.textureUnit ] = this.meshesToBuffers(this.game.gl, this.mesh);
        console.log(this.buffersPerTextureUnit);

        return Promise.resolve();
    }



    render(gl, ts, delta) {
        let projectionMatrix = this.game.camera.inverse;
        let shader = this.game.userInterface.webgl.shaders.projectionViewPosition;

        // for each one
        for (let _tickableId in this.snowflakes) {
            let sf = this.snowflakes[ _tickableId ];
            // update rotation
            // update matrix to use for rendering
            //mat4.fromRotation(scratch.mat4, scratch.identityMat4, 0.5, [0, 1, 0]);
            mat4.translate(scratch.mat4, scratch.identityMat4, sf.position);
            mat4.rotateY(scratch.mat4_0, scratch.mat4, ts / 1000);

            // renderBuffers(ts, gl, shader, projectionMatrix, viewMatrix, atlasToBuffers) {
            this.renderBuffers(ts, gl, shader, projectionMatrix, scratch.mat4_0, this.buffersPerTextureUnit);
        }
    }
}

export { Snow };
