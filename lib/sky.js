var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var scratch = require('./scratch');
var Shapes = require('./shapes');


var Weather = function(gl, shader, textures) {
    this.gl = gl;
    this.shader = shader;
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
        dawn: vec3.fromValues(0.2, 0.1, 0.1),
        full: vec3.fromValues(0.4, 0.4, 0.4),
        dusk: vec3.fromValues(0.2, 0.1, 0.1)
    };
    this.ambientLightTypes = {
        dark: vec3.fromValues(0.5, 0.5, 0.5),
        dawn: vec3.fromValues(0.55, 0.55, 0.55),
        full: vec3.fromValues(0.6, 0.6, 0.6),
        dusk: vec3.fromValues(0.55, 0.55, 0.55)
    };
    this.rotationPerSecond = (2 * Math.PI) / 86400;
    this._sunLightVector = vec3.fromValues(0.0, -1, 0.2);

    // Seconds from 12 noon
    this.time = 12 * 3600;
    this.light = this.lightTypes.full;
    this.lightAdjustment = vec3.fromValues(0, 0, 0);
    this.ambientLight = this.ambientLightTypes.full;
    this.ambientLightAdjustment = vec3.fromValues(0, 0, 0);

    this.directionalLight = {
        color: vec3.create(),
        vector: vec3.create()
    };
    this.ambientLightColor = vec3.create();
    // Initial setup
    vec3.copy(this.directionalLight.color, this.light);
    vec3.copy(this.ambientLightColor, this.ambientLight);
    
	
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

    this.initMeshes();
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
    var light, ambientLight;
    // Darkness
    if (this.time >= 20 * 3600) {
        // Directional
        this.light = light = this.lightTypes.dark;
        vec3.copy(this.directionalLight.color, light);
        this.lightAdjustment[0] = 0.0;
        this.lightAdjustment[1] = 0.0;
        this.lightAdjustment[2] = 0.0;
        // Ambient
        this.ambientLight = ambientLight = this.ambientLightTypes.dark;
        vec3.copy(this.ambientLightColor, ambientLight);
        this.ambientLightAdjustment[0] = 0.0;
        this.ambientLightAdjustment[1] = 0.0;
        this.ambientLightAdjustment[2] = 0.0;
    } else
    // Transition to dark
    if (this.time >= 19 * 3600) {
        light = this.lightTypes.dark;
        ambientLight = this.ambientLightTypes.dark;
    } else
    // Transition to dusk
    if (this.time >= 18 * 3600) {
        light = this.lightTypes.dusk;
        ambientLight = this.ambientLightTypes.dusk;
    } else
    // Full sunlight
    if (this.time >= 8 * 3600) {
        this.light = light = this.lightTypes.full;
        vec3.copy(this.directionalLight.color, light);
        this.lightAdjustment[0] = 0.0;
        this.lightAdjustment[1] = 0.0;
        this.lightAdjustment[2] = 0.0;
        // Ambient
        this.ambientLight = ambientLight = this.ambientLightTypes.full;
        vec3.copy(this.ambientLightColor, ambientLight);
        this.ambientLightAdjustment[0] = 0.0;
        this.ambientLightAdjustment[1] = 0.0;
        this.ambientLightAdjustment[2] = 0.0;
    } else
    // Transition to full
    if (this.time >= 7 * 3600) {
        light = this.lightTypes.full;
        ambientLight = this.ambientLightTypes.full;
    } else
    // Transition to dawn
    if (this.time >= 6 * 3600) {
        light = this.lightTypes.dawn;
        ambientLight = this.ambientLightTypes.dawn;
    } else {
        light = this.lightTypes.dark;
        ambientLight = this.ambientLightTypes.dark;
    }

    if (light != this.light) {
        // Calculate the adjustment
        vec3.sub(this.lightAdjustment, light, this.directionalLight.color);
        vec3.divide(this.lightAdjustment, this.lightAdjustment, [3600, 3600, 3600]);
        vec3.multiply(this.lightAdjustment, this.lightAdjustment, [seconds, seconds, seconds]);
        //vec3.copy(this.directionalLight.color, light);
        this.light = light;
    }
    if (ambientLight != this.ambientLight) {
        // Ambient
        vec3.sub(this.ambientLightAdjustment, ambientLight, this.ambientLightColor);
        vec3.divide(this.ambientLightAdjustment, this.ambientLightAdjustment, [3600, 3600, 3600]);
        vec3.multiply(this.ambientLightAdjustment, this.ambientLightAdjustment, [seconds, seconds, seconds]);
        //vec3.copy(this.directionalLight.color, light);
        this.ambientLight = ambientLight;
    }
    // Do the adjustment
    vec3.add(this.directionalLight.color, this.directionalLight.color, this.lightAdjustment);
    vec3.add(this.ambientLightColor, this.ambientLightColor, this.ambientLightAdjustment);
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

var full = vec3.fromValues(1.1, 1.1, 1.1);
Weather.prototype.render = function(projection, ts) {
    var gl = this.gl;
    
    gl.useProgram(this.shader.program);

    gl.uniform1f(this.shader.uniforms.textureOffset, 0);
    // To simulate brightness, make the sun washed out for now
    gl.uniform3fv(this.shader.uniforms.ambientLightColor, full);
    gl.uniformMatrix4fv(this.shader.uniforms.projection, false, projection);
    //gl.uniformMatrix4fv(this.shaderUniforms.player, false, model);
    //gl.uniform4fv(this.shaderUniforms.color, [ 0, 255, 255, 1 ]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.byName.sandstone.glTexture);
    // bind the texture to this handle
    gl.uniform1i(this.shader.uniforms.texture, 0);

    var meshes = this.meshes;
    for (var i = 0; i < meshes.length; i++) {
        var mesh = meshes[i];

        gl.uniformMatrix4fv(this.shader.uniforms.view, false, mesh.view);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.vertices);
        gl.enableVertexAttribArray(this.shader.attributes.position);
        gl.vertexAttribPointer(this.shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.normal);
        gl.enableVertexAttribArray(this.shader.attributes.normal);
        gl.vertexAttribPointer(this.shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.texcoord);
        gl.enableVertexAttribArray(this.shader.attributes.texcoord);
        gl.vertexAttribPointer(this.shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
        //gl.drawElements(gl.TRIANGLES, mesh.tuples, gl.UNSIGNED_SHORT, 0);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.tuples);

    }
};


module.exports = Weather;
