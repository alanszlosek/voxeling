var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var scratch = require('./scratch');
var Shapes = require('./shapes');


var vertexShaderCode = 
    "uniform mat4 u_projection;" + 
    "uniform mat4 u_view;" + 
    "uniform vec3 u_directionalLightVector;" + 

    "attribute vec4 a_position;" +
    "attribute vec3 a_normal;" +
    "attribute vec2 a_texcoord;" +

    "varying highp vec2 v_texcoord;" +
    "varying highp vec3 v_lighting;" +

    "void main() {" +
        "v_texcoord = a_texcoord;" +

        "highp vec3 ambientLight = vec3(1.1, 1.1, 1.1);" +
        "highp vec3 directionalLightColor = vec3(0.0, 0.0, 0.0);" +
        //"highp vec3 directionalVector = vec3(0.85, 0.8, 0.75);" +
        "highp float directional = max(dot(a_normal, u_directionalLightVector), 0.0);" +
        "v_lighting = ambientLight + (directionalLightColor * directional);" +

        "gl_Position = u_projection * u_view * a_position;" +
    "}";

var fragmentShaderCode = 
    "precision mediump float;" +

    "uniform sampler2D u_texture;" +

    "varying highp vec3 v_lighting;" +
    "varying highp vec2 v_texcoord;" +

    "void main() {" +
        "mediump vec4 texelColor = texture2D(u_texture, v_texcoord);" +
        "gl_FragColor = vec4(texelColor.rgb * v_lighting, texelColor.a);" +
    "}";


var Weather = function(gl, textures) {
    this.gl = gl;
    this.textures = textures;

    /*
    this.lightTypes = {
        dark: vec3.fromValues(0, 0, 0),
        dawn: vec3.fromValues(0.8, 0.5, 0.5),
        full: vec3.fromValues(0.8, 0.8, 0.75),
        dusk: vec3.fromValues(0.8, 0.5, 0.5)
    };
    */

    // HELPERS
    // be mindful of the ambient light value and it's affect with full sun
    this.lightTypes = {
        dark: vec3.fromValues(0, 0, 0),
        dawn: vec3.fromValues(0.3, 0.1, 0.1),
        full: vec3.fromValues(0.7, 0.7, 0.7),
        dusk: vec3.fromValues(0.3, 0.1, 0.1)
    };
    this.rotationPerSecond = (2 * Math.PI) / 86400;
    this._sunLightVector = vec3.fromValues(0.0, -1, 0.2);

    // Seconds from 12 noon
    this.time = 12 * 3600;
    this.light = this.lightTypes.full;
    this.lightAdjustment = vec3.fromValues(0, 0, 0);

    this.directionalLight = {
        color: vec3.create(),
        vector: vec3.create()
    };
    // Initial setup
    vec3.copy(this.directionalLight.color, this.light);
    
	
    var d = 6;
    var uv = [
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d,
        0, 0, d, d
    ];
    this.sun = Shapes.three.rectangle(d, d, d, uv, 1);
    //mat4.translate(this.sun.view, this.sun.view, [0, 100, 0]);
    this.meshes = [this.sun];

    this.init();
    this.initMeshes();
};
Weather.prototype.init = function() {
    var gl = this.gl;
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
    this.shaderUniforms.texture = gl.getUniformLocation(shaderProgram, "u_texture");
    this.shaderUniforms.directionalLightVector = gl.getUniformLocation(shaderProgram, "u_directionalLightVector");

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        var errmsg = "failed to initialize shader with data matrices";
        alert(errmsg);
        throw new Error(errmsg);
    }
    this.shaderProgram = shaderProgram;
};


Weather.prototype.initMeshes = function() {
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

Weather.prototype.setLight = function(seconds) {
    var light;
    // Darkness
    if (this.time >= 20 * 3600) {
        this.light = light = this.lightTypes.dark;
        vec3.copy(this.directionalLight.color, light);
        this.lightAdjustment[0] = 0.0;
        this.lightAdjustment[1] = 0.0;
        this.lightAdjustment[2] = 0.0;
    } else
    // Transition to dark
    if (this.time >= 19 * 3600) {
        light = this.lightTypes.dark;
    } else
    // Transition to dusk
    if (this.time >= 18 * 3600) {
        light = this.lightTypes.dusk;
    } else
    // Full sunlight
    if (this.time >= 6 * 3600) {
        this.light = light = this.lightTypes.full;
        vec3.copy(this.directionalLight.color, light);
        this.lightAdjustment[0] = 0.0;
        this.lightAdjustment[1] = 0.0;
        this.lightAdjustment[2] = 0.0;
    } else
    // Transition to Dawn
    if (this.time >= 5 * 3600) {
        light = this.lightTypes.full;
    } else
    // Transition to Full
    if (this.time >= 4 * 3600) {
        light = this.lightTypes.dawn;
    } else {
        light = this.lightTypes.dark;
    }

    if (light != this.light) {
        // Calculate the adjustment
        vec3.sub(this.lightAdjustment, light, this.directionalLight.color);
        vec3.divide(this.lightAdjustment, this.lightAdjustment, [3600, 3600, 3600]);
        vec3.multiply(this.lightAdjustment, this.lightAdjustment, [seconds, seconds, seconds]);
        //vec3.copy(this.directionalLight.color, light);
        this.light = light;
    }
    // Do the adjustment
    vec3.add(this.directionalLight.color, this.directionalLight.color, this.lightAdjustment);
};

// Currently runs every second
Weather.prototype.tick = function(seconds) {
    // Need to accompany this with a large cube sun travelling overhead
    this.time += seconds;
    if (this.time >= 86400) {
        this.time -= 86400;
    }
    this.setLight(seconds);

    var sunRotation = this.rotationPerSecond * this.time;

    // Rotate light source
    quat.rotateZ(scratch.quat, scratch.identityQuat, sunRotation);
    vec3.transformQuat(this.directionalLight.vector, this._sunLightVector, scratch.quat);

    // Move sun's position
    mat4.rotateZ(this.sun.view, scratch.identityMat4, sunRotation);
    mat4.translate(this.sun.view, this.sun.view, [0, -200, 0]);
};

Weather.prototype.render = function(projection, ts) {
    var gl = this.gl;
    
    gl.useProgram(this.shaderProgram);

    gl.uniformMatrix4fv(this.shaderUniforms.projection, false, projection);
    //gl.uniformMatrix4fv(this.shaderUniforms.player, false, model);
    //gl.uniform4fv(this.shaderUniforms.color, [ 0, 255, 255, 1 ]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.byName.sandstone.glTexture);
    // bind the texture to this handle
    gl.uniform1i(this.shaderUniforms.texture, 0);

    var meshes = this.meshes;
    for (var i = 0; i < meshes.length; i++) {
        var mesh = meshes[i];

        gl.uniformMatrix4fv(this.shaderUniforms.view, false, mesh.view);

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


module.exports = Weather;