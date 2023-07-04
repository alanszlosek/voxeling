import { mat4, vec3, vec4, quat } from 'gl-matrix';
import { Renderable } from '../capabilities/renderable.mjs';
import scratch from '../scratch.mjs';
import Shapes from '../shapes.mjs';


import { getRandomInt, getRandomArbitrary } from '../util.mjs';

class Exploration extends Renderable {
    constructor(game) {
        super();
        this.game = game;
        this.enabled = false;
    }
    init() {

        this.textureValue = 6; // water
        let textureY = this.game.textureOffsets['offsets'][ this.textureValue ];
        let height = this.game.textureOffsets['textureRowHeight'];
        // lower left, upper right in texture map
        this.texcoords = [0, textureY, 1, textureY + height];
        this.textureUnit = this.game.textureOffsets['textureToTextureUnit'][ this.textureValue ]

        this.initMeshes();

        this.modelMatrix = mat4.create();

        this.cutoff = 0;
        this.stage = 0;

        return Promise.resolve();
    }

    initMeshes() {
        let d = 3.0;
        this.mesh = Shapes.three.rectangle3(d, d, d, this.texcoords);

        let gl = this.game.gl;
        let buffers = {
            vertices: gl.createBuffer(),
            normals: gl.createBuffer(),
            texcoords: gl.createBuffer(),
            //translations: gl.createBuffer(),
            tuples: 0
        };
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, this.mesh.vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
        gl.bufferData(gl.ARRAY_BUFFER, this.mesh.normals, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoords);
        gl.bufferData(gl.ARRAY_BUFFER, this.mesh.texcoords, gl.STATIC_DRAW);

        // allocate space
        // this is the main buffer that will drive instancing
        /*
        this.translationSize = 0;
        this.translations = new Float32Array( 4 * this.translationSize );
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.translations);
        gl.bufferData(gl.ARRAY_BUFFER, 4 * 4 * this.translationSize, gl.DYNAMIC_DRAW);
        */

        buffers.tuples = this.mesh.vertices.length / 3;

        this.buffers = buffers;
    }

    tick(ts) {
        if (ts < this.cutoff) {
            return;
        }
        let self = this;
        let stages = [
            // nothing
            function() {
                mat4.copy(self.modelMatrix, scratch.identityMat4);
            },

            // translate
            function() {
                mat4.translate(self.modelMatrix, scratch.identityMat4, [0, 5, 0]);
            },

            // scale
            function() {
                let mult = 2;
                mat4.scale(self.modelMatrix, scratch.identityMat4, [mult, mult, mult]);
            },

            // translate then scale
            function() {
                let mult = 1;
                mat4.translate(self.modelMatrix, scratch.identityMat4, [0, 5, 0]);
                mat4.scale(self.modelMatrix, self.modelMatrix, [mult, mult, mult]);
            },

            // scale then translate
            function() {
                let mult = 2;
                mat4.scale(self.modelMatrix, scratch.identityMat4, [mult, mult, mult]);
                mat4.translate(self.modelMatrix, self.modelMatrix, [0, 5, 0]);
                
            }
        ];

        stages[this.stage]();
        this.stage++;

        if (this.stage >= stages.length) {
            this.stage = 0;
        }

        this.cutoff = ts + 2000;
    }



    render(gl, ts, delta) {
        if (!this.enabled) {
            return;
        }

        let shader = this.game.userInterface.webgl.shaders.mvp;

        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.projection, false, this.game.camera.projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.view, false, this.game.camera.viewMatrix);
        gl.uniformMatrix4fv(shader.uniforms.model, false, this.modelMatrix);

        gl.uniform1i(shader.uniforms.texture, this.textureUnit);
        gl.uniform1f(shader.uniforms.textureOffset, 0.00);

        let bufferBundle = this.buffers;

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.vertices);
        gl.enableVertexAttribArray(shader.attributes.position);
        gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 12, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoords);
        gl.enableVertexAttribArray(shader.attributes.texcoord);
        gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 8, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.normals);
        gl.enableVertexAttribArray(shader.attributes.normal);
        gl.vertexAttribPointer(shader.attributes.normal, 3, gl.FLOAT, false, 12, 0);

        /*
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.translations);
        gl.enableVertexAttribArray(shader.attributes.translation);
        gl.vertexAttribPointer(shader.attributes.translation, 4, gl.FLOAT, false, 16, 0);
        gl.vertexAttribDivisor(shader.attributes.translation, 1);
        */

        //gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, bufferBundle.tuples);
        gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
    }
}

export { Exploration };
