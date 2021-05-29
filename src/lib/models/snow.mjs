import { mat4, vec3, vec4, quat } from 'gl-matrix';
import { Renderable } from '../entities/renderable';
import scratch from '../scratch';
import Shapes from '../shapes.mjs';
import { Tickable } from '../entities/tickable';


import { getRandomInt, getRandomArbitrary } from '../util.mjs';

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

let scales = [
    vec3.fromValues(0.04, 0.04, 0.04),
    vec3.fromValues(0.05, 0.05, 0.05),
    vec3.fromValues(0.06, 0.06, 0.06),
    vec3.fromValues(0.07, 0.07, 0.07),
    vec3.fromValues(0.08, 0.08, 0.08)
];
let scaleIndex = 0;

class Snowflake extends Tickable {
    constructor(game) {
        super();
        this.game = game;
        this.enabled = false;
       
        this.respawn();
    }

    // TODO: this should return a vec3 already made
    getScale() {
        let scaleVector = scales[ scaleIndex ];
        scaleIndex++;
        if (scaleIndex >= scales.length) {
            scaleIndex = 0;
        }
        return scaleVector;
    }

    respawn() {
        let position = this.game.player.getPosition();
        this.scale = this.getScale();
        this.fallSpeed = 0.06; // some range up to 0.1
        let spread = 32;
        this.position = vec4.fromValues(
            getRandomInt(position[0] - spread, position[0] + spread),
            getRandomInt(position[1] + 10, position[1] + 30),
            getRandomInt(position[2] - spread, position[2] + spread),
            1
        );
        this.collisionCheck = 0;
    }

    tick(ts, delta) {
        if (!this.enabled) {
            return;
        }
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
        // 1200 starts to stutter on GTX960
        this.numSnowflakes = 300;
        this.snowflakes = {};
        this.enabled = false;
    }
    init() {
        for (let i = 0; i < this.numSnowflakes; i++) {
            let sf = new Snowflake(this.game);
            this.snowflakes[ sf._tickableId ] = sf;
        }

        // Prepare shared mesh and buffers
        // which texture unit / atlas is the white wool in?
        let textureValue = 5; // white wool
        this.textureUnit = this.game.textureOffsets['textureToTextureUnit'][ textureValue ]
        let textureV = this.game.textureOffsets['offsets'][ textureValue ];
        let height = this.game.textureOffsets['textureRowHeight'];
        // lower left, upper right in texture map
        let uv = [0, textureV, 1, textureV + height];

        let d = 1;

        // main
        let meshes = [
            // main body of snowflake
            Shapes.two.rectangleDimensionsTexcoordsPosition(d, d, uv),
            // smaller pieces to left
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, uv, [-0.75, 0.75, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, uv, [-1, 0, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, uv, [-0.75, -0.75, 0]),
            // smaller pieces to right
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, uv, [0.75, 0.75, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, uv, [1, 0, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, uv, [0.75, -0.75, 0]),

            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, uv, [0, 1.0, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, uv, [0, -1.0, 0]),

        ];

        // Would love to specify offsets and have that show up in mesh coords that are returned
        // Also would love to be able to get a tuple of 4 coord bounds of texture, by name
        // gives us: vertices, texcoords, normals
        // TODO: could have rectangle3 append into existing arrays
        this.buffersPerTextureUnit = {};

        this.buffersPerTextureUnit[ this.textureUnit ] = this.meshesToBuffers(this.game.gl, meshes);

        return Promise.resolve();
    }

    toggle() {
        this.enabled = this.enabled ? false : true;
        for (let id in this.snowflakes) {
            let sf = this.snowflakes[id];
            sf.enabled = this.enabled;
        }
    }



    render(gl, ts, delta) {
        if (!this.enabled) {
            return;
        }
        let shader = this.game.userInterface.webgl.shaders.mvpBillboard;

        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.projection, false, this.game.camera.projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.view, false, this.game.camera.viewMatrix);
        
        // Render the same snowflake mesh for each snowflake, using a different view matrix
        for (let _tickableId in this.snowflakes) {
            let sf = this.snowflakes[ _tickableId ];

            //quat.rotateZ(scratch.quat, scratch.identityQuat, ts / 1000);

            mat4.fromRotationTranslationScale(
                scratch.mat4,
                [0,0,0,0],
                [0,0,0],
                sf.scale
            );
            gl.uniformMatrix4fv(shader.uniforms.model, false, scratch.mat4);

            gl.uniform4fv(shader.uniforms.cameraposition, sf.position);

            for (let textureUnit in this.buffersPerTextureUnit) {
                let buffers = this.buffersPerTextureUnit[textureUnit];

                // bind the texture to this handle
                gl.uniform1i(shader.uniforms.texture, textureUnit);

                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
                gl.enableVertexAttribArray(shader.attributes.position);
                gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
                gl.enableVertexAttribArray(shader.attributes.normal);
                gl.vertexAttribPointer(shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoords);
                gl.enableVertexAttribArray(shader.attributes.texcoord);
                gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

                gl.drawArrays(gl.TRIANGLES, 0, buffers.tuples);
            }
        }
    }
}

export { Snow };
