import { mat4, quat, vec3 } from 'gl-matrix';
//import { WebGL } from './webgl.mjs';
// Used by Cursor to draw block outlines for building

/*
LineBuffer to hold all the lines we want to draw
*/

class Lines {
    constructor(game, color) {
        let gl = this.gl = game.webgl.gl;
        this.game = game;
        this.glBuffer;
        this.tuples = 0;
        this.shader = game.webgl.shaders.line;
        this.view = mat4.create();

        this.points = [];
        this.pointOffsets = [];
        this.color = color || [ 255, 0, 0, 1 ];

        this.glBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
    }

    /*
    Buffer attributes will likely just be:
    {
        thickness: 1,
        points: []
    }
    */
    // BAH, for now, all lines are the same
    fill(points) {
        var gl = this.gl;

        this.skipDraw = false;
        this.tuples = points.length / 3;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    }

    render(parentMatrix, ts, delta) {
        if (this.skipDraw || this.tuples == 0) {
            return;
        }
        let gl = this.game.gl;
        gl.useProgram(this.shader.program);
        gl.lineWidth(3);

        gl.uniformMatrix4fv(this.shader.uniforms.view, false, parentMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        gl.enableVertexAttribArray(this.shader.attributes.position);
        gl.vertexAttribPointer(this.shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.uniform4fv(this.shader.uniforms.color, this.color);
        //console.log('lines.mjs drawing tuples: ' + this.tuples);
        gl.drawArrays(gl.LINES, 0, this.tuples);
    }

    skip(yesno) {
        this.skipDraw = yesno;
    }
}

export { Lines };
