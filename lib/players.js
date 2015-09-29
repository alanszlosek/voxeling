// NOTE: THIS IS INCOMPLETE

var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4;

var playerMesh = require('./player-mesh.js');

/*
LineBuffer to hold all the lines we want to draw
*/
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
var vertexShaderCode = "uniform mat4 u_projection;" + "uniform mat4 u_model;" + "attribute vec4 a_position;" + "uniform vec3 u_offset;" + "void main() { gl_Position = u_projection * u_model * (a_position + vec4(u_offset, 0)); }";

var fragmentShaderCode = "precision mediump float;" + "uniform vec4 u_color;" + "void main() { gl_FragColor = u_color; }";

var Players = function(gl) {
    this.gl = gl;
    this.glBuffer;
    this.glBuffer2;
    this.tuples = 0;
    this.shaders = {};
    this.shaderAttributes = {};
    this.shaderUniforms = {};
    // Use a cube to represent players, for now
    this.players = {};
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
    this.shaderUniforms.offset = gl.getUniformLocation(shaderProgram, "u_offset");
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        var errmsg = "failed to initialize shader with data matrices";
        alert(errmsg);
        throw new Error(errmsg);
    }
    this.shaderProgram = shaderProgram;
    // Fill with points that we'll translate per player
    this.glBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(playerMesh.vertices), gl.STATIC_DRAW);
    this.glBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glBuffer2);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(playerMesh.faces), gl.STATIC_DRAW);
    this.tuples = playerMesh.vertices.length / 3;
};

/*
Buffer attributes will likely just be:
{
	thickness: 1,
	points: []
}
*/
Players.prototype.set = function(players) {
    this.players = players;
};

var rot = mat4.create();

mat4.multiply(rot, playerMesh.translate, playerMesh.scale);

mat4.multiply(rot, rot, playerMesh.rotate);

//mat4.multiply(rot, playerMesh.rotate, playerMesh.scale)
//mat4.multiply(rot, rot, playerMesh.translate)
Players.prototype.draw = function(matrix) {
    var gl = this.gl;
    gl.useProgram(this.shaderProgram);
    gl.lineWidth(3);
    // works!
    gl.uniformMatrix4fv(this.shaderUniforms.projection, false, matrix);
    gl.uniformMatrix4fv(this.shaderUniforms.model, false, rot);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glBuffer2);
    gl.enableVertexAttribArray(this.shaderAttributes.position);
    gl.vertexAttribPointer(this.shaderAttributes.position, 3, gl.FLOAT, false, 0, 0);
    for (var id in this.players) {
        var player = this.players[id];
        if (!Array.isArray(player.position)) {
            continue;
        }
        // Set translation patrix
        // Choose color
        var offset = player.position.slice(0, 3);
        // Player position is camera, so back off half a unit
        offset[0] -= .3;
        offset[1] -= 1.5;
        offset[2] -= .3;
        gl.uniform4fv(this.shaderUniforms.color, [ 0, 255, 255, 1 ]);
        gl.uniform3fv(this.shaderUniforms.offset, offset);
        gl.drawElements(gl.TRIANGLES, this.tuples, gl.UNSIGNED_SHORT, 0);
    }
};

module.exports = Players;