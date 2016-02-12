/*
WebGL stuff that pertains only to voxels
*/
var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4;

var vertexShaderCode =
    "uniform mat4 u_projection;" +

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
        // diffusion belongs here, i think
        "v_lighting = ambientLight + (directionalLightColor * directional);" +

        "gl_Position = (u_projection * a_position);" +
    "}";

var fragmentShaderCode =
    "precision mediump float;" +
    "uniform sampler2D u_texture;" +
    "uniform float u_textureOffset;" +

    "varying highp vec2 v_texcoord;" +
    "varying highp vec3 v_lighting;" +

    // Fog stuff
    // maybe with distance of 2 or 3
    "const float fogDensity = 0.005;" +
    // this works well with distance of 3 or 4
    //"const float fogDensity = 0.007;" +
    "vec4 fogColor = vec4(1, 1, 1, 0);" +

    "void main() {" +
        "mediump vec4 texelColor = texture2D(u_texture, v_texcoord + vec2(0, u_textureOffset));" +

        //"float fogDistance = (gl_FragCoord.z / gl_FragCoord.w);" +
        //OLD"float fogFactor = (90.0 - fogDistance) / (90.0 - 50.0);" +
        //"float fogFactor = 1.0 / exp2((-fogDistance * fogDensity) * (-fogDistance * fogDensity));" +
        //"fogFactor = clamp(fogFactor, 0.0, 1.0);" +
        //"gl_FragColor = mix(fogColor, vec4(texelColor.rgb * v_lighting, texelColor.a), fogFactor);" +

        "gl_FragColor = vec4(texelColor.rgb * v_lighting, texelColor.a);" +
        "if(gl_FragColor.a < 0.5) " +
            "discard;" +
    "}";

function Voxels(gl, textures) {
    this.gl = gl;
    this.textures = textures;
    // new buffers
    this.buffersByChunk = {};

    // Set up shaders
    this.shaders = {};
    this.shaderAttributes = {};
    this.shaderUniforms = {};

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

    this.shaderAttributes.position = gl.getAttribLocation(shaderProgram, "a_position");
    this.shaderAttributes.normal = gl.getAttribLocation(shaderProgram, "a_normal");
    this.shaderAttributes.texcoord = gl.getAttribLocation(shaderProgram, "a_texcoord");

    this.shaderUniforms.projection = gl.getUniformLocation(shaderProgram, "u_projection");
    this.shaderUniforms.texture = gl.getUniformLocation(shaderProgram, "u_texture");
    this.shaderUniforms.textureOffset = gl.getUniformLocation(shaderProgram, "u_textureOffset");

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        var errmsg = "failed to initialize shader with data matrices";
        alert(errmsg);
        throw new Error(errmsg);
    }

    this.shaderProgram = shaderProgram;
}

Voxels.prototype.addVoxelMesh = function(id, mesh) {
    var gl = this.gl;
    var obj = {
        position: gl.createBuffer(),
        texcoord: gl.createBuffer(),
        normal: gl.createBuffer(),
        textures: [],
        tuples: []
    };
    var lengths = {
        position: 0,
        texcoord: 0,
        normal: 0
    };
    var offsets = {
        position: 0,
        texcoord: 0,
        normal: 0
    };

    for (var textureValue in mesh) {
        var attributes = mesh[textureValue];
        lengths.position += attributes.position.offset;
        lengths.texcoord += attributes.texcoord.offset;
        lengths.normal += attributes.normal.offset;
    }

    if (lengths.position == 0) {
        // Empty chunk
        return;
    }

    // allocate necessary space
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.position);
    gl.bufferData(gl.ARRAY_BUFFER, lengths.position * 4, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.texcoord);
    gl.bufferData(gl.ARRAY_BUFFER, lengths.texcoord * 4, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normal);
    gl.bufferData(gl.ARRAY_BUFFER, lengths.normal * 4, gl.STATIC_DRAW);

    for (var textureValue in mesh) {
        var attributes = mesh[textureValue];

        var positions = new Float32Array(attributes.position.buffer, 0, attributes.position.offset);
        var texcoords = new Float32Array(attributes.texcoord.buffer, 0, attributes.texcoord.offset);
        var normals = new Float32Array(attributes.normal.buffer, 0, attributes.normal.offset);

        // Fill buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.position);
        gl.bufferSubData(gl.ARRAY_BUFFER, offsets.position, positions);
        // yes, array will be larger than offset, but we don't care
        offsets.position += attributes.position.offset * 4;

        gl.bindBuffer(gl.ARRAY_BUFFER, obj.normal);
        gl.bufferSubData(gl.ARRAY_BUFFER, offsets.normal, normals);
        offsets.normal += attributes.normal.offset * 4;

        gl.bindBuffer(gl.ARRAY_BUFFER, obj.texcoord);
        gl.bufferSubData(gl.ARRAY_BUFFER, offsets.texcoord, texcoords);
        offsets.texcoord += attributes.texcoord.offset * 4;

        obj.textures.push(textureValue);
        obj.tuples.push(attributes.position.offset / 3);
    }
    this.buffersByChunk[id] = obj;
};

Voxels.prototype.removeChunkMesh = function(chunkID) {
    var obj;
    if (chunkID in this.buffersByChunk) {
        obj = this.buffersByChunk[chunkID];
        this.gl.deleteBuffer(obj.position);
        this.gl.deleteBuffer(obj.texcoord);
        this.gl.deleteBuffer(obj.normal);
        delete this.buffersByChunk[chunkID];
    }
};


Voxels.prototype.render = function(projection, ts) {
    var gl = this.gl;

    gl.useProgram(this.shaderProgram);
    gl.uniformMatrix4fv(this.shaderUniforms.projection, false, projection);

    for (var chunkID in this.buffersByChunk) {
        var bufferBundle = this.buffersByChunk[chunkID];

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
        gl.enableVertexAttribArray(this.shaderAttributes.position);
        gl.vertexAttribPointer(this.shaderAttributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
        gl.enableVertexAttribArray(this.shaderAttributes.texcoord);
        gl.vertexAttribPointer(this.shaderAttributes.texcoord, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.normal);
        gl.enableVertexAttribArray(this.shaderAttributes.normal);
        gl.vertexAttribPointer(this.shaderAttributes.normal, 3, gl.FLOAT, false, 0, 0);

        var offset = 0;
        for (var i = 0; i < bufferBundle.textures.length; i++) {
            var textureValue = bufferBundle.textures[i];
            var tuples = bufferBundle.tuples[i];

            if (textureValue == 6) {
                // poor man's water animation
                gl.uniform1f(this.shaderUniforms.textureOffset, ts / 10000);

            } else if (textureValue < 100) {
                // Don't do face culling when drawing textures with opacity
                gl.enable(gl.CULL_FACE);
                gl.uniform1f(this.shaderUniforms.textureOffset, 0.00);
                
            } else {
                gl.disable(gl.CULL_FACE);
                gl.uniform1f(this.shaderUniforms.textureOffset, 0.00);
                //gl.uniform1f(this.shaderUniforms.textureOffset, ts / 10000);
            }
            // do the texture stuff ourselves ... too convoluted otherwise
            gl.activeTexture(gl.TEXTURE0);

            // set which of the 32 handles we want this bound to
            gl.bindTexture(gl.TEXTURE_2D, this.textures.byValue[textureValue].glTexture);

            // bind the texture to this handle
            gl.uniform1i(this.shaderUniforms.texture, 0);
            gl.drawArrays(gl.TRIANGLES, offset, tuples);
            offset += tuples;
        }
    }
};

module.exports = Voxels;