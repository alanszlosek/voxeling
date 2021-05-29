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

let snowLayer = {};
let newSnowLayer = {};


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
        this.position = vec3.fromValues(
            getRandomInt(position[0] - spread, position[0] + spread),
            getRandomInt(position[1] + 10, position[1] + 30),
            getRandomInt(position[2] - spread, position[2] + spread)
        );
        this.collisionCheck = 0;
    }

    addLayer(position) {
        let positionInts = position.map(Math.floor);
        let pos = positionInts.join(',');

        let textureValue = 5; // white wool
        this.textureUnit = this.game.textureOffsets['textureToTextureUnit'][ textureValue ]
        let textureV = this.game.textureOffsets['offsets'][ textureValue ];
        let height = this.game.textureOffsets['textureRowHeight'];
        // lower left, upper right in texture map
        let uv = [0, textureV, 1, textureV + height];

        if (pos in snowLayer || pos in newSnowLayer) {
            
        } else {
            newSnowLayer[ pos ] = Shapes.two.rectangleBoundsWithTexcoords(
                [
                    positionInts[0],
                    positionInts[1] + 1.01,
                    positionInts[2]
                ],
                [
                    positionInts[0] + 1,
                    positionInts[1] + 1.01,
                    positionInts[2]
                ],
                [
                    positionInts[0] + 1,
                    positionInts[1] + 1.01,
                    positionInts[2] + 1
                ],
                [
                    positionInts[0],
                    positionInts[1] + 1.01,
                    positionInts[2] + 1
                ],
                uv
            );
        }
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
                // TODO: add layer of snow on top of block here
                this.addLayer(this.position);
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

    createSnowBuffers() {
        let gl = this.game.gl;
        let buffers = {
            vertices: gl.createBuffer(),
            //indices: gl.createBuffer(),
            normals: gl.createBuffer(),
            texcoords: gl.createBuffer(),
            tuples: 0
        };
        let sz = 65536 * 4; // bytes!

        // set sizes
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, sz, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
        gl.bufferData(gl.ARRAY_BUFFER, sz, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoords);
        gl.bufferData(gl.ARRAY_BUFFER, sz, gl.STATIC_DRAW);

        this.snowBuffers = buffers;
    }
    fillSnowBuffer(meshes) {
        let sz1 = 0;
        let sz2 = 0;
        let sz3 = 0;
        let gl = this.game.gl;

        /*

        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];
            sz1 += mesh.vertices.length;
            sz2 += mesh.normals.length;
            sz3 += mesh.texcoords.length;
        }

        let vertices = new Float32Array(sz1);
        let normals = new Float32Array(sz2);
        let texcoords = new Float32Array(sz3);

        sz1 = sz2 = sz3 = 0;
        */

        console.log('meshes: ' + meshes.length);

        let buffers = this.snowBuffers;
        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
            gl.bufferSubData(gl.ARRAY_BUFFER, sz1, mesh.vertices, 0, mesh.vertices.length * 4);
            sz1 += mesh.vertices.length * 4;

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
            gl.bufferSubData(gl.ARRAY_BUFFER, sz2, mesh.normals, 0, mesh.normals.length * 4);
            sz2 += mesh.normals.length * 4;

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoords);
            gl.bufferSubData(gl.ARRAY_BUFFER, sz3, mesh.texcoords, 0, mesh.texcoords.length * 4);
            sz3 += mesh.texcoords.length * 4;
        }

        buffers.tuples = sz1 / 3;
    }

    tick() {
        let newMeshes = Object.keys(newSnowLayer);
        if (newMeshes.length == 0) {
            return;
        }
        // make list of all meshes
        // merge new snow layer into existing
        // clear new layer
        let meshes = [];
        for (let i in snowLayer) {
            meshes.push( snowLayer[i] );
        }
        for (let i in newSnowLayer) {
            meshes.push( newSnowLayer[i] );
            snowLayer[i] = newSnowLayer[i];
        }
        newSnowLayer = {};

        // TODO: do more thinking about how to purge old snow layers as we move through the world
        // maybe sort by chunks in the layer object

        // TODO: create really large buffer for now

        if (!this.snowBuffers) {
            this.createSnowBuffers();
        }
        // fill buffers
        this.fillSnowBuffer(meshes);
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

            gl.uniform3fv(shader.uniforms.cameraposition, sf.position);

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


        // draw snow layer
        if (!this.snowBuffers) {
            return;
        }

        shader = this.game.userInterface.webgl.shaders.projectionPosition;

        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.projection, false, this.game.camera.projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.view, false, this.game.camera.viewMatrix);
        gl.uniform3fv(shader.uniforms.ambientLightColor, this.game.sky.ambientLightColor);
        gl.uniform3fv(shader.uniforms.directionalLightColor, this.game.sky.directionalLight.color);
        gl.uniform3fv(shader.uniforms.directionalLightPosition, this.game.sky.directionalLight.position);
        gl.uniform1f(shader.uniforms.hazeDistance, 90.0);

        gl.disable(gl.CULL_FACE);
        gl.uniform1f(shader.uniforms.textureOffset, 0.00);

        gl.uniform1i(shader.uniforms.texture, this.textureUnit);

        let bufferBundle = this.snowBuffers;

        // TODO: fix the voxels shader
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.vertices);
        gl.enableVertexAttribArray(shader.attributes.position);
        gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoords);
        gl.enableVertexAttribArray(shader.attributes.texcoord);
        gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.normals);
        gl.enableVertexAttribArray(shader.attributes.normal);
        gl.vertexAttribPointer(shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);

        //console.log('voxels.mjs drawing tuples1: ' + bufferBundle.tuples);
        gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
    }
}

export { Snow };
