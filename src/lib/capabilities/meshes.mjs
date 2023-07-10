import Shapes from '../shapes.mjs';
import { mat4, quat, vec3 } from 'gl-matrix';

class Meshes {
    meshesByTextureUnit = {};
    buffers;

    constructor(game) {
        this.game = game;
        this.gl = game.gl;
        this.shader = game.webgl.shaders.mvp2;
        this.matrix = mat4.create();

    }
    
    /*
    mesh is like this:
    TODO: link to mesh object which is just a JSON
    vertices
    normals:
    bla

    texture is a value from the textureAtlas ... numeric
    not texture value, but the textureUnit the texture is in
    textureUnit may have more than 1 texture, addressed by offsets
    */
    addMesh(textureUnit, mesh) {
        if (!(textureUnit in this.meshesByTextureUnit)) {
            this.meshesByTextureUnit[ textureUnit ] = [];
        }
        this.meshesByTextureUnit[ textureUnit ].push( mesh );

        return this;
    }
    addMeshes(textureUnit, meshes) {
        if (!(textureUnit in this.meshesByTextureUnit)) {
            this.meshesByTextureUnit[ textureUnit ] = [];
        }
        this.meshesByTextureUnit[ textureUnit ].push(...meshes);
    }

    // Call this to prepare WebGL buffers with mesh data
    // Call this to prepare the mesh data for rendering
    prepare() {
        let gl = this.gl;

        let buffers = {};
        console.log(this.meshesByTextureUnit);
        for (let textureUnit in this.meshesByTextureUnit) {
            buffers[textureUnit] = this._prepare( this.meshesByTextureUnit[textureUnit] );
        }
        this.buffers = buffers;
    }

    _prepare(meshes) {
        let gl = this.gl;
        let buffers = {
            vertices: gl.createBuffer(),
            //indices: gl.createBuffer(),
            normals: gl.createBuffer(),
            texcoords: gl.createBuffer(),
            tuples: 0
        };

        let sz1 = 0;
        let sz2 = 0;
        let sz3 = 0;

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
        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];
            vertices.set(mesh.vertices, sz1);
            normals.set(mesh.normals, sz2);
            texcoords.set(mesh.texcoords, sz3);
            sz1 += mesh.vertices.length;
            sz2 += mesh.normals.length;
            sz3 += mesh.texcoords.length;
        }

        // Fill with points that we'll translate per player
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normals);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoords);
        gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);

        buffers.tuples = vertices.length / 3;

        return buffers;
    }

    render(parentMatrix, ts, delta) {
        let gl = this.game.gl;

        let shader = this.shader;
        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.view, false, parentMatrix);
        gl.uniformMatrix4fv(shader.uniforms.model, false, this.matrix);

        for (let textureUnit in this.buffers) {
            let bufferBundle = this.buffers[textureUnit];
            
            gl.uniform1i(shader.uniforms.texture, textureUnit);
            gl.uniform1f(shader.uniforms.textureOffset, 0.00);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.vertices);
            gl.enableVertexAttribArray(shader.attributes.position);
            gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 12, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoords);
            gl.enableVertexAttribArray(shader.attributes.texcoord);
            gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 8, 0);

            /*
            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.normals);
            gl.enableVertexAttribArray(shader.attributes.normal);
            gl.vertexAttribPointer(shader.attributes.normal, 3, gl.FLOAT, false, 12, 0);
            */

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
}

export { Meshes };
