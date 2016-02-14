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
    "uniform mat4 u_view;" + 
    "uniform int u_part;" + 

    "attribute vec4 a_position;" +
    "attribute vec3 a_normal;" +
    "attribute vec2 a_texcoord;" +

    "varying highp vec2 v_texcoord;" +
    "varying highp vec3 v_lighting;" +

    "void main() {" +
        "v_texcoord = a_texcoord;" +

        "highp vec3 ambientLight = vec3(0.6, 0.6, 0.6);" +
        "highp vec3 directionalLightColor = vec3(0.5, 0.5, 0.75);" +
        "highp vec3 directionalVector = vec3(0.85, 0.8, 0.75);" +
        "highp float directional = max(dot(a_normal, directionalVector), 0.0);" +
        "v_lighting = ambientLight + (directionalLightColor * directional);" +

        "gl_Position = u_projection * u_view * a_position;" +
    "}";

var fragmentShaderCode = 
    "precision mediump float;" +

    "uniform vec4 u_color;" + 
    "uniform sampler2D u_texture;" +

    "varying highp vec3 v_lighting;" +
    "varying highp vec2 v_texcoord;" +

    "void main() {" +
        //"gl_FragColor = vec4(u_color.rgb * v_lighting, u_color.a);" +
        "mediump vec4 texelColor = texture2D(u_texture, v_texcoord);" +
        "gl_FragColor = vec4(texelColor.rgb * v_lighting, texelColor.a);" +
    "}";

var Model = function(gl, meshes, texture, movable) {
    this.gl = gl;
    this.meshes = meshes;
    this.texture = texture;
    this.shaders = {};
    this.shaderAttributes = {};
    this.shaderUniforms = {};

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
    this.shaderAttributes.normal = gl.getAttribLocation(shaderProgram, "a_normal");
    this.shaderAttributes.texcoord = gl.getAttribLocation(shaderProgram, "a_texcoord");

    this.shaderUniforms.projection = gl.getUniformLocation(shaderProgram, "u_projection");
    //this.shaderUniforms.player = gl.getUniformLocation(shaderProgram, "u_player");
    this.shaderUniforms.view = gl.getUniformLocation(shaderProgram, "u_view");
    this.shaderUniforms.part = gl.getUniformLocation(shaderProgram, "u_part");
    this.shaderUniforms.texture = gl.getUniformLocation(shaderProgram, "u_texture");
    this.shaderUniforms.color = gl.getUniformLocation(shaderProgram, "u_color");
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        var errmsg = "failed to initialize shader with data matrices";
        alert(errmsg);
        throw new Error(errmsg);
    }
    this.shaderProgram = shaderProgram;

    // Set up movable and the mesh
    this.movable = movable;
    this.initMeshes();

};
Model.prototype.initMeshes = function() {
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
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.texcoord);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.texcoords, gl.STATIC_DRAW);

        mesh.tuples = 36;
    }
};

Model.prototype.setTexture = function(texture) {
    this.texture = texture;
}

/*
Buffer attributes will likely just be:
{
    thickness: 1,
    points: []
}
*/
var tempQuat = quat.create();
var model = mat4.create();
var view = mat4.create();

Model.prototype.render = function(matrix) {
    var gl = this.gl;
    //gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.shaderProgram);
    //gl.lineWidth(3);

    var meshes = this.meshes;

    // need to incorporate scale
    mat4.identity(model);
    //mat4.translate(model, model, [16, 1, 3]);
    mat4.translate(model, model, this.movable.getPosition());
    mat4.rotateY(model, model, this.movable.getYaw());

    gl.uniformMatrix4fv(this.shaderUniforms.projection, false, matrix);
    //gl.uniformMatrix4fv(this.shaderUniforms.player, false, model);
    //gl.uniform4fv(this.shaderUniforms.color, [ 0, 255, 255, 1 ]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture.glTexture);
    // bind the texture to this handle
    gl.uniform1i(this.shaderUniforms.texture, 0);

    for (var i = 0; i < meshes.length; i++) {
        var mesh = meshes[i];

        mat4.multiply(view, model, mesh.view);
        gl.uniformMatrix4fv(this.shaderUniforms.view, false, view);
        gl.uniform1i(this.shaderUniforms.part, false, mesh.part);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.vertices);
        gl.enableVertexAttribArray(this.shaderAttributes.position);
        gl.vertexAttribPointer(this.shaderAttributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.normal);
        gl.enableVertexAttribArray(this.shaderAttributes.normal);
        gl.vertexAttribPointer(this.shaderAttributes.normal, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.texcoord);
        gl.enableVertexAttribArray(this.shaderAttributes.texcoord);
        gl.vertexAttribPointer(this.shaderAttributes.texcoord, 2, gl.FLOAT, false, 0, 0);

        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
        //gl.drawElements(gl.TRIANGLES, mesh.tuples, gl.UNSIGNED_SHORT, 0);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.tuples);

    }
};

module.exports = Model;