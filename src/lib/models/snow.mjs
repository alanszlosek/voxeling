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

let speeds = [
    vec3.fromValues(1.0, 1.0, 1.0),
    vec3.fromValues(0.3, 0.6, 0.3),
    vec3.fromValues(0.6, 1.0, 0.6)
];

let snowLayer = {};

let newSnowpack = {};
class Helper {
    constructor(maxLength) {
        this.items = {};
        this.lru = [];
        this.maxLength = maxLength;
    }

    set(key, value) {
        if (key in this.items) {
            this.items[key] = value;
            // move to recent
            let offset = this.lru.indexOf(key);
            this.lru.splice(offset, 1);
            this.lru.push( key );
            return;
        }

        this.items[ key ] = value;
        this.lru.push( key );

        while (this.lru.length > this.maxLength) {
            let key = this.lru.shift();
            delete this.items[ key ];
        }
    }
}

/*
converting layers to instancing
*/


class Snowflake extends Tickable {
    constructor(game, velocity) {
        super();
        this.game = game;
        this.enabled = true;
        this.position = vec3.create();
        this.velocity = vec3.create(); // current velocity
        this.desiredVelocity = vec3.create(); // direction we'll lerp towards
        this.respawn();
    }

    getScale() {
        let scaleVector = scales[ scaleIndex ];
        scaleIndex++;
        if (scaleIndex >= scales.length) {
            scaleIndex = 0;
        }
        return scaleVector;
    }

    respawn() {
        let playerPosition = this.game.player.getPosition();
        this.scale = this.getScale();
        this.speed = speeds[ Math.floor(Math.random() * speeds.length)];
        let spread = 32;
        // add 0.5 to center within block
        this.position[0] = getRandomInt(playerPosition[0] - spread, playerPosition[0] + spread) + 0.5;
        this.position[1] = getRandomInt(playerPosition[1] + 10, playerPosition[1] + 30);
        this.position[2] = getRandomInt(playerPosition[2] - spread, playerPosition[2] + spread) + 0.5;

        this.collisionCheck = 0;
    }

    updateVelocity(velocity) {
        // scale snow-flake wide velocity based on this flake's relative speed to overall
        vec3.multiply(this.desiredVelocity, velocity, this.speed);
    }

    tick(ts, delta) {
        if (!this.enabled) {
            return;
        }
        vec3.lerp(this.velocity, this.velocity, this.desiredVelocity, 0.01);
        vec3.add(this.position, this.position, this.velocity);

        // check for collision
        // If so, respawn flake and add another

        // Don't check for collision on every frame. Snowflakes fall slowly enough that we don't have to
        if (this.collisionCheck == 3) {
            if (this.game.voxelCache.getBlock(this.position[0], this.position[1], this.position[2]) > 0) {
                // ignore collision if happened on side of cube ... how?

                // log where snowflake collided as snowpack position
                let pos = this.position.map(Math.floor);
                let key = pos.join(',');
                // tweak position to be top center of block
                pos[0] += 0.5;
                pos[1] += 1.001;
                pos[2] += 0.5;
                newSnowpack[ key ] = pos;

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
        this.velocity = vec3.create();
        this.velocityChangeCutoff = 0; // we update velocity after N seconds
        this.enabled = true;
    }
    init() {
        for (let i = 0; i < this.numSnowflakes; i++) {
            let sf = new Snowflake(this.game, this.velocity);
            sf.enabled = this.enabled;
            this.snowflakes[ sf._tickableId ] = sf;
        }

        // Prepare shared mesh and buffers
        // which texture unit / atlas is the white wool in?
        this.snowTextureValue = 5; // white wool        
        let textureY = this.game.textureOffsets['offsets'][ this.snowTextureValue ];
        let height = this.game.textureOffsets['textureRowHeight'];
        // lower left, upper right in texture map
        this.snowTexcoords = [0, textureY, 1, textureY + height];
        this.snowTextureUnit = this.game.textureOffsets['textureToTextureUnit'][ this.snowTextureValue ]

        this.initSnowflakeMeshes();
        this.initSnowpack();

        return Promise.resolve();
    }

    initSnowflakeMeshes() {
        let meshes = [
            // main body of snowflake
            Shapes.two.rectangleDimensionsTexcoordsPosition(1.0, 1.0, this.snowTexcoords, [0,0,0]),
            // smaller pieces to left
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, this.snowTexcoords, [-0.75, 0.75, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, this.snowTexcoords, [-1, 0, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, this.snowTexcoords, [-0.75, -0.75, 0]),
            // smaller pieces to right
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, this.snowTexcoords, [0.75, 0.75, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, this.snowTexcoords, [1, 0, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, this.snowTexcoords, [0.75, -0.75, 0]),
            // smaller pieces above and below
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, this.snowTexcoords, [0, 1.0, 0]),
            Shapes.two.rectangleDimensionsTexcoordsPosition(0.5, 0.5, this.snowTexcoords, [0, -1.0, 0]),

        ];

        // Would love to specify offsets and have that show up in mesh coords that are returned
        // Also would love to be able to get a tuple of 4 coord bounds of texture, by name
        // gives us: vertices, texcoords, normals

        this.snowflakeBuffers = this.meshesToBuffers(this.game.gl, meshes);
    }

    initSnowpack() {
        this.snowpackMemory = 2400; // how many squares of snowpack to remember
        this.snowpackHelper = new Helper(this.snowpackMemory);
        // TODO: change this back to vec3, and update instanced shader. can really save 3K+ of ram
        this.snowpackTranslations = new Float32Array( 4 * this.snowpackMemory );

        // position at 0,0,0
        this.snowpackMesh = Shapes.two.rectangleBoundsWithTexcoords(
            [-0.5, 0, 0.5],
            [0.5, 0, 0.5],
            [0.5, 0, -0.5],
            [-0.5, 0, -0.5],
            this.snowTexcoords
        );

        let gl = this.game.gl;
        let buffers = {
            vertices: gl.createBuffer(),
            //indices: gl.createBuffer(),
            normals: gl.createBuffer(),
            texcoords: gl.createBuffer(),
            translations: gl.createBuffer(),
            tuples: 0
        };
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, this.snowpackMesh.vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
        gl.bufferData(gl.ARRAY_BUFFER, this.snowpackMesh.normals, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoords);
        gl.bufferData(gl.ARRAY_BUFFER, this.snowpackMesh.texcoords, gl.STATIC_DRAW);

        // allocate space
        // this is the main buffer that will drive instancing
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.translations);
        // snowpackMemory is places, but we need 4 floats for each position, and 4 bytes for each float
        gl.bufferData(gl.ARRAY_BUFFER, 4 * 4 * this.snowpackMemory, gl.DYNAMIC_DRAW);

        this.snowpackBuffers = buffers;


    }

    toggle() {
        this.enabled = this.enabled ? false : true;
        for (let id in this.snowflakes) {
            let sf = this.snowflakes[id];
            sf.enabled = this.enabled;
        }
    }

    createSnowBuffers() {
        
    }

    tick(ts) {
        // update snowflake velocity
        let vel = function() {
            return (Math.random() - 0.5) / 10;
        };
        if (ts > this.velocityChangeCutoff) {
            let fallSpeeds = [
                -0.02,
                -0.04,
                -0.08
            ];
            this.velocity[0] = vel();
            this.velocity[1] = fallSpeeds[ Math.floor(Math.random() * fallSpeeds.length) ];
            this.velocity[2] = vel();

            for (let _tickableId in this.snowflakes) {
                let sf = this.snowflakes[ _tickableId ];
                sf.updateVelocity(this.velocity);
            }

            this.velocityChangeCutoff = ts + getRandomInt(5000, 15000);
        }

        // bail if we don't have any snowpack to render
        let newMeshes = Object.keys(newSnowpack);
        if (newMeshes.length == 0) {
            return;
        }

        // make list of all meshes
        // merge new snow layer into existing
        // clear new layer
        for (let key in newSnowpack) {
            this.snowpackHelper.set(key, newSnowpack[key]);
        }
        newSnowpack = {};

        this.updateSnowpackTranslations();
    }

    updateSnowpackTranslations() {
        let gl = this.game.gl;
        let sz = 0;
        for (let key in this.snowpackHelper.items) {
            let position = this.snowpackHelper.items[key];
            this.snowpackTranslations.set(position, sz);
            sz += 4;
        }

        let buffers = this.snowpackBuffers;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.translations);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.snowpackTranslations, 0, sz);

        this.snowpackBuffers.tuples = sz / 4;
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

            mat4.fromRotationTranslationScale(
                scratch.mat4,
                [0,0,0,0],
                [0,0,0],
                sf.scale
            );
            gl.uniformMatrix4fv(shader.uniforms.model, false, scratch.mat4);

            gl.uniform3fv(shader.uniforms.baseposition, sf.position);

            let buffers = this.snowflakeBuffers;

            // bind the texture to this handle
            gl.uniform1i(shader.uniforms.texture, this.snowTextureUnit);

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


        // draw snow layer
        if (this.snowpackBuffers.tuples == 0) {
            return;
        }

        shader = this.game.userInterface.webgl.shaders.translationInstanced;

        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.projection, false, this.game.camera.projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.view, false, this.game.camera.viewMatrix);

        gl.uniform1i(shader.uniforms.texture, this.snowTextureUnit);
        gl.uniform1f(shader.uniforms.textureOffset, 0.00);

        let bufferBundle = this.snowpackBuffers;

        // TODO: fix the voxels shader
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.vertices);
        gl.enableVertexAttribArray(shader.attributes.position);
        gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 12, 0);
        //gl.vertexAttribDivisor(shader.attributes.position, 1);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoords);
        gl.enableVertexAttribArray(shader.attributes.texcoord);
        gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 8, 0);
        //gl.vertexAttribDivisor(shader.attributes.texcoords, 1);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.normals);
        gl.enableVertexAttribArray(shader.attributes.normal);
        gl.vertexAttribPointer(shader.attributes.normal, 3, gl.FLOAT, false, 12, 0);
        //gl.vertexAttribDivisor(shader.attributes.normals, 1);


        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.translations);
        gl.enableVertexAttribArray(shader.attributes.translation);
        gl.vertexAttribPointer(shader.attributes.translation, 4, gl.FLOAT, false, 16, 0);
        gl.vertexAttribDivisor(shader.attributes.translation, 1);


        //console.log('voxels.mjs drawing tuples1: ' + bufferBundle.tuples);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, bufferBundle.tuples);
        //gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

export { Snow };
