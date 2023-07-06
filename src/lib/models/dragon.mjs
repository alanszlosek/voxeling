import { Renderable } from '../capabilities/renderable.mjs';
import Shapes from '../shapes.mjs';


class Dragon extends Renderable {
    constructor(game, modelMatrix) {
        super();
        this.game = game;
        this.gl = game.gl;
        this.modelMatrix = modelMatrix;
        this.enabled = true;

        // nested, indexed by textureUnit / textureAtlas
        this.buffers = {};
        this.initMeshes();
    }

    initMeshes() {
        // what if textures span multiple atlases? need to separate those buffer bundles
        let body = 0.5;
        let neck = 0.4;
        let head = 0.3;
        let tail = 0.3;
        let horns = 0.1;


        let textureValue;
        let textureY;
        let height;
        let texcoords;
        let textureUnit;
        let meshes;

        // TODO: what if pink and red shift texture atlases? this needs to be more durable
        textureValue = 38;
        // TODO: these should be pre-computed in texture-atlas.py
        textureY = this.game.textureOffsets['offsets'][ textureValue ];
        height = this.game.textureOffsets['textureRowHeight'];
        // lower left, upper right in texture map
        let texcoords1 = [0, textureY, 1, textureY + height];
        textureUnit = this.game.textureOffsets['textureToTextureUnit'][ textureValue ];

        meshes = [
            // center
            Shapes.three.rectangle3(0.6, body, 1.2, texcoords1, [0, 0.5, 0]),

            // legs
            Shapes.three.rectangle3(0.2, 0.4, 0.2, texcoords1, [-0.4, 0.1, -0.5]),
            Shapes.three.rectangle3(0.2, 0.4, 0.2, texcoords1, [0.4, 0.1, -0.5]),
            Shapes.three.rectangle3(0.2, 0.4, 0.2, texcoords1, [-0.4, 0.1, 0.5]),
            Shapes.three.rectangle3(0.2, 0.4, 0.2, texcoords1, [0.4, 0.1, 0.5]),

            // neck
            Shapes.three.rectangle3(0.3, 0.6, 0.3, texcoords1, [0, 0.75, -0.75]),

            // horns
            Shapes.three.rectangle3(horns, 0.4, horns, texcoords1, [-0.1, 1.45, -1.2]),
            Shapes.three.rectangle3(horns, 0.4, horns, texcoords1, [0.1, 1.45, -1.2]),

            // tail
            Shapes.three.rectangle3(0.4, 0.3, 0.6, texcoords1, [0, 0.4, 0.9]),
            Shapes.three.rectangle3(0.25, 0.2, 0.6, texcoords1, [0, 0.6, 1.5]),
        ];

        // pink
        textureValue = 37;
        textureY = this.game.textureOffsets['offsets'][ textureValue ]; 
        // lower left, upper right in texture map
        let texcoords2 = [0, textureY, 1, textureY + height];
        meshes.push(
            // wings
            Shapes.three.rectangle3(0.8, 0.1, 0.6, texcoords2, [-0.5, 0.8, 0]),
            Shapes.three.rectangle3(0.8, 0.1, 0.6, texcoords2, [0.5, 0.8, 0]),

            // head
            Shapes.three.rectangle3(head, head, 0.5, texcoords2, [0, 1.1, -1.15])
        );
        this.buffers[ textureUnit ] = this.meshesToBuffers(this.game.gl, meshes);

        //mat4.translate(this.modelMatrix, scratch.identityMat4, [16, 2, 5]);
        
    }



    render(parentMatrix, ts, delta) {
        if (!this.enabled) {
            return;
        }
        let gl = this.game.gl;

        //console.log(parentMatrix);

        let shader = this.game.webgl.shaders.mvp2;

        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.view, false, parentMatrix);
        gl.uniformMatrix4fv(shader.uniforms.model, false, this.modelMatrix);


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

export { Dragon };
