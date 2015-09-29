/*
LineBuffer to hold all the lines we want to draw
*/
var vertexShaderCode =
	"uniform mat4 u_projection;" +
	"attribute vec4 a_position;" +
	"void main() { gl_Position = (u_projection * a_position); }";
var fragmentShaderCode = 
	"precision mediump float;" +
	"uniform vec4 u_color;" +
	"void main() { gl_FragColor = u_color; }";

var Lines = function(gl, color) {
    this.gl = gl;
    this.glBuffer;
    this.tuples = 0;
    this.shaders = {};
    this.shaderAttributes = {};
    this.shaderUniforms = {};
    this.points = [];
    this.pointOffsets = [];
    this.color = color || [ 255, 0, 0, 1 ];

    // Set up shaders
    var shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, fragmentShaderCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var errmsg = "fragment shader compile failed: " + gl.getShaderInfoLog(shader);
        alert(errmsg);
        throw new Error();
    }
    this.shaders.fragment = shader;

    shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(shader, vertexShaderCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var errmsg = "vertex shader compile failed : " + gl.getShaderInfoLog(vertShader);
        alert(errmsg);
        throw new Error(errmsg);
    }
    this.shaders.vertex = shader;

    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, this.shaders.vertex);
    gl.attachShader(shaderProgram, this.shaders.fragment);
    gl.linkProgram(shaderProgram);
    //gl.useProgram(shaderProgram);

    this.shaderAttributes.position = gl.getAttribLocation(shaderProgram, "a_position");
    this.shaderUniforms.projection = gl.getUniformLocation(shaderProgram, "u_projection");
    this.shaderUniforms.color = gl.getUniformLocation(shaderProgram, "u_color");

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        var errmsg = "failed to initialize shader with data matrices";
        alert(errmsg);
        throw new Error(errmsg);
    }

    this.shaderProgram = shaderProgram;

    this.glBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
};

/*
Buffer attributes will likely just be:
{
	thickness: 1,
	points: []
}
*/
// BAH, for now, all lines are the same
Lines.prototype.fill = function(points) {
    var gl = this.gl;

    this.skipDraw = false;
    this.tuples = points.length / 3;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
};

Lines.prototype.render = function(projection) {
    var gl = this.gl;
    if (this.skipDraw) {
        return;
    }
    gl.useProgram(this.shaderProgram);
    gl.lineWidth(3);

    // works!
    gl.uniformMatrix4fv(this.shaderUniforms.projection, false, projection);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
    gl.enableVertexAttribArray(this.shaderAttributes.position);
    gl.vertexAttribPointer(this.shaderAttributes.position, 3, gl.FLOAT, false, 0, 0);

    gl.uniform4fv(this.shaderUniforms.color, this.color);
    gl.drawArrays(gl.LINES, 0, this.tuples);
};

Lines.prototype.skip = function(yesno) {
    this.skipDraw = yesno;
};

module.exports = Lines;