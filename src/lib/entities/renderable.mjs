import { Tickable, tickables } from './tickable.mjs';

var renderables = {};

class Renderable extends Tickable {
    constructor() {
        super();
        // unique id so we only render() and item once
        // AND so when they come and go we can easily remove / add
        renderables[ this._tickableId ] = this;
    }

    /*
    meshes should look like this:
    {
        textureAtlas1: {
            vertices: float32array,
            normal: float32array,
            texcoors: float32array
        },
        textureAtlas2: {
            vertices: float32array,
            normal: float32array,
            texcoors: float32array
        },
        . . .
    }
    */
    meshesToBuffers(gl, meshes) {
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

    render(gl, ts) {
    }

    // TODO: should callee pass in the final matrix, or just it's position matrix?
    renderBuffers(ts, gl, shader, projectionMatrix, viewMatrix, atlasToBuffers) {
        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.projection, false, projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.view, false, viewMatrix);


        for (let textureUnit in atlasToBuffers) {
            let buffers = atlasToBuffers[textureUnit];

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

    destroy(gl) {
        super.destroy();
        delete renderables[ this._tickableId ];

        for (let textureUnit in this.buffersPerTextureUnit) {
            let buffers = this.buffersPerTextureUnit[textureUnit];

            gl.deleteBuffer(buffers.vertices);
            gl.deleteBuffer(buffers.normals);
            gl.deleteBuffer(buffers.texcoords);
        }
    }
}

export { Renderable, renderables, tickables }