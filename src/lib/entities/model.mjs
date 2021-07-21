import { mat4, quat, vec3 } from 'gl-matrix';
import { Renderable, renderables, tickables } from './renderable.mjs';
import scratch from '../scratch.mjs';

// TODO: fix these
var tempQuat = scratch.quat;
var model = scratch.mat4;

var directionalLightVector = vec3.fromValues(0.85, 0.8, 0.75);
var tempVector = scratch.vec3;
var rotation1 = scratch.mat4_0;
var rotation2 = scratch.mat4_1;

class Model extends Renderable {
    constructor(game, gl, shader, meshes, texture, movable) {
        super();
        this.game = game;
        this.gl = gl;
        this.shader = shader;
        this.meshes = meshes;
        this.texture = texture;
        this.textureUnit = 0;
        this.shaders = {};
        this.shaderAttributes = {};
        this.shaderUniforms = {};

        // Set up movable and the mesh
        this.movable = movable;
        this.initMeshes();

    }
    initMeshes() {
        var gl = this.gl;
        var meshes = this.meshes;

        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];
            mesh.buffers = {
                vertices: gl.createBuffer(),
                //indices: gl.createBuffer(),
                normal: gl.createBuffer(),
                texcoord: gl.createBuffer()
            };

            // Fill with points that we'll translate per player
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.vertices);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

            //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
            //gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.normal);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.texcoord);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.texcoords, gl.STATIC_DRAW);

            mesh.tuples = 36;
        }
    }

    setTexture(texture) {
        this.texture = texture;
    }
    setTextureUnit(textureUnit) {
        this.textureUnit = textureUnit;
    }

    /*
    Buffer attributes will likely just be:
    {
        thickness: 1,
        points: []
    }
    */

    render(gl, ts) {

        // TODO: model seems to enable the wrong shader ... the world is dark
        // and for some reason voxels doesn't override it
        
        //gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.shader.program);
        //gl.lineWidth(3);

        var meshes = this.meshes;

        // TODO: probably lots of room for optimization here

        //mat4.translate(model, model, [16, 1, 3]);
        //mat4.translate(model, scratch.identityMat4, this.movable.getPosition());
        //mat4.rotateY(model, model, this.movable.getYaw());

        // TODO: test whether this really does translate first, then rotate at that translation position
        mat4.fromRotationTranslation(model, this.movable.rotationQuatY, this.movable.getPosition());

        // rotate light source
        quat.rotateY(tempQuat, scratch.identityQuat, this.movable.getYaw());
        //vec3.transformQuat(tempVector, directionalLightVector, tempQuat);
        //gl.uniform3fv(this.shader.uniforms.directionalLightVector, tempVector);

        gl.uniformMatrix4fv(this.shader.uniforms.projection, false, this.game.camera.projectionMatrix);
        gl.uniformMatrix4fv(this.shader.uniforms.view, false, this.game.camera.viewMatrix);
        //gl.uniformMatrix4fv(this.shaderUniforms.player, false, model);
        //gl.uniform4fv(this.shaderUniforms.color, [ 0, 255, 255, 1 ]);

        //gl.activeTexture(gl.TEXTURE0);
        //gl.bindTexture(gl.TEXTURE_2D, this.texture);
        // bind the texture to this handle
        gl.uniform1i(this.shader.uniforms.texture, this.textureUnit);
        gl.uniform1f(this.shader.uniforms.textureOffset, 0.00);

        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];

            mesh.render(gl, ts);
            // Walk animation: http://math.stackexchange.com/questions/652102/rotate-a-point-around-another-point-by-an-angle
            // positiveTranslatedMatrix * rotationMatrix * negativeTranslatedMatrix

            var view = scratch.mat4_0;
            mat4.translate(rotation1, scratch.identityMat4, mesh.rotateAround);
            mat4.translate(rotation2, scratch.identityMat4, [-mesh.rotateAround[0], -mesh.rotateAround[1], -mesh.rotateAround[2]]);
            mat4.multiply(view, rotation1, mesh.view);
            mat4.rotateX(view, view, mesh.rotation[0]);
            mat4.multiply(view, view, rotation2);
            mat4.multiply(view, model, view);

            gl.uniformMatrix4fv(this.shader.uniforms.model, false, view);
            //gl.uniform1i(this.shaderUniforms.part, false, mesh.part);

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.vertices);
            gl.enableVertexAttribArray(this.shader.attributes.position);
            gl.vertexAttribPointer(this.shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.normal);
            gl.enableVertexAttribArray(this.shader.attributes.normal);
            gl.vertexAttribPointer(this.shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.texcoord);
            gl.enableVertexAttribArray(this.shader.attributes.texcoord);
            gl.vertexAttribPointer(this.shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

            //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
            //gl.drawElements(gl.TRIANGLES, mesh.tuples, gl.UNSIGNED_SHORT, 0);
            //console.log('model.js drawing tuples: ' + mesh.tuples);
            gl.drawArrays(gl.TRIANGLES, 0, mesh.tuples);

        }
    }

    destroy() {
        for (var i = 0; i < this.meshes.length; i++) {
            var mesh = this.meshes[i];
            this.gl.deleteBuffer(mesh.buffers.vertices);
            this.gl.deleteBuffer(mesh.buffers.normal);
            this.gl.deleteBuffer(mesh.buffers.texcoord);
        }
        delete renderables[ this._tickableId ];
        delete tickables[ this._tickableId ];


    }
}

export { Model };
