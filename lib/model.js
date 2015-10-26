var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

/*
for (var i = 0; i < playerMesh.vertices.length; i++) {
  playerMesh.vertices[i] *= 0.08
}
var flatFaces = new Uint16Array(playerMesh.faces.length * 3)
for (var i = 0, j = 0; i < playerMesh.faces.length; i++, j +=3) {
  flatFaces.set(playerMesh.faces[i], j)
}
playerMesh.faces = flatFaces
*/

var vertexShaderCode = 
	"uniform mat4 u_projection;" + 
	"uniform mat4 u_model;" + 
	"attribute vec4 a_position;" + 
	"void main() { gl_Position = u_projection * u_model * a_position; }";

var fragmentShaderCode = 
	"precision mediump float;" + 
	"uniform vec4 u_color;" + 
	"void main() { gl_FragColor = u_color; }";

var Model = function(gl, json, movable) {
    this.gl = gl;
    this.glBuffer = null;
    this.glBuffer2 = null;
    this.tuples = 0;
    this.shaders = {};
    this.shaderAttributes = {};
    this.shaderUniforms = {};

	this.json = json;
	this.movable = movable;

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
        var errmsg = "vertex shader compile failed : " + gl.getShaderInfoLog(shader);
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
    this.shaderUniforms.model = gl.getUniformLocation(shaderProgram, "u_model");
    this.shaderUniforms.color = gl.getUniformLocation(shaderProgram, "u_color");
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        var errmsg = "failed to initialize shader with data matrices";
        alert(errmsg);
        throw new Error(errmsg);
    }
    this.shaderProgram = shaderProgram;

    // Fill with points that we'll translate per player
    this.glBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.json.vertices), gl.STATIC_DRAW);

    this.glBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glBuffer2);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.json.faces), gl.STATIC_DRAW);

    this.tuples = this.json.faces.length;
};

/*
Buffer attributes will likely just be:
{
	thickness: 1,
	points: []
}
*/
var tempQuat = quat.create();
var model = mat4.create();

Model.prototype.draw = function(matrix) {
    var gl = this.gl;
    //gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.shaderProgram);
    gl.lineWidth(3);

    quat.multiply(tempQuat, this.movable.getYaw(), this.movable.getPitch());
    mat4.fromRotationTranslation(model, tempQuat, this.movable.getPosition());

    gl.uniformMatrix4fv(this.shaderUniforms.projection, false, matrix);
    gl.uniformMatrix4fv(this.shaderUniforms.model, false, model);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glBuffer2);

    gl.enableVertexAttribArray(this.shaderAttributes.position);
    gl.vertexAttribPointer(this.shaderAttributes.position, 3, gl.FLOAT, false, 0, 0);

	gl.uniform4fv(this.shaderUniforms.color, [ 0, 255, 255, 1 ]);

	gl.drawElements(gl.TRIANGLES, this.tuples, gl.UNSIGNED_SHORT, 0);
};

module.exports = Model;