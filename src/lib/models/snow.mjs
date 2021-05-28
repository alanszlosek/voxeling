import { mat4, vec3, quat } from 'gl-matrix';
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

class Snowflake extends Tickable {
    constructor(game) {
        super();
        this.game = game;
        this.enabled = false;
       
        this.respawn();
    }

    respawn() {
        let position = this.game.player.getPosition();
        
        let scaleValue = getRandomInt(1, 20) / 100;
        this.scale = vec3.fromValues(scaleValue, scaleValue, scaleValue);
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
        console.log(this.buffersPerTextureUnit);

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
        let shader = this.game.userInterface.webgl.shaders.projectionViewPosition;
        let cameraPosition = scratch.vec4;

        cameraPosition[0] = this.game.camera.position[0];
        cameraPosition[1] = this.game.camera.position[1];
        cameraPosition[2] = this.game.camera.position[2];
        cameraPosition[0] = 0;
        cameraPosition[1] = 0;
        cameraPosition[2] = 0;
        cameraPosition[3] = 0;

        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.projection, false, this.game.camera.projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.view, false, this.game.camera.viewMatrix);
        gl.uniform4fv(shader.uniforms.cameraposition, cameraPosition);



        // Render the same snowflake mesh for each snowflake, using a different view matrix
        for (let _tickableId in this.snowflakes) {
            let sf = this.snowflakes[ _tickableId ];
            // update rotation
            // update matrix to use for rendering
            //mat4.fromRotation(scratch.mat4, scratch.identityMat4, 0.5, [0, 1, 0]);
            
            // mat4.translate(scratch.mat4, scratch.identityMat4, sf.position);
            // mat4.translate(scratch.mat4, scratch.identityMat4, sf.position);
            // mat4.rotateZ(scratch.mat4_0, scratch.mat4, ts / 1000);

            quat.rotateZ(scratch.quat, scratch.identityQuat, ts / 1000);

            mat4.fromRotationTranslationScale(scratch.mat4_0, scratch.quat, sf.position, sf.scale);

            // renderBuffers(ts, gl, shader, projectionMatrix, viewMatrix, atlasToBuffers) {
            //this.renderBuffers(ts, gl, shader, projectionMatrix, scratch.mat4_0, this.buffersPerTextureUnit);


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

                //console.log('model.js drawing tuples: ' + mesh.tuples);
                gl.drawArrays(gl.TRIANGLES, 0, buffers.tuples);
            }
        }
    }
}

export { Snow };
