var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var scratch = require('./scratch');
var Sun = require('./models/sun');


var Weather = function(gl, shader, textures, player) {
    this.gl = gl;
    this.shader = shader;
    this.textures = textures;

    // HELPERS
    // be mindful of the ambient light value and it's affect with full sun
    this.lightTypes = {
        dark: vec3.fromValues(0, 0, 0),
        dawn: vec3.fromValues(0.2, 0.1, 0.1),
        full: vec3.fromValues(0.4, 0.4, 0.4),
        dusk: vec3.fromValues(0.2, 0.1, 0.1)
    };
    this.ambientLightTypes = {
        dark: vec3.fromValues(0.4, 0.4, 0.4),
        dawn: vec3.fromValues(0.5, 0.5, 0.5),
        full: vec3.fromValues(0.6, 0.6, 0.6),
        dusk: vec3.fromValues(0.5, 0.5, 0.5)
    };
    

    // Seconds from 12 noon
    this.time = 12 * 3600;
    this.light = this.lightTypes.full;
    this.lightAdjustment = vec3.fromValues(0, 0, 0);
    this.ambientLight = this.ambientLightTypes.full;
    this.ambientLightAdjustment = vec3.fromValues(0, 0, 0);
    this.ambientLightColor = vec3.create();

    this.directionalLight = {
        color: vec3.create(),
        start: vec3.fromValues(0, -1000, 0),
        position: vec3.create()
    };


    // Initial setup
    vec3.copy(this.directionalLight.color, this.light);
    vec3.copy(this.ambientLightColor, this.ambientLight);
    
    this.sun = new Sun(gl, shader, textures, player);
};


Weather.prototype.setLight = function(seconds) {
    var light, ambientLight;
    // Darkness
    if (this.time >= 22 * 3600) {
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
    if (this.time >= 20 * 3600) {
        light = this.lightTypes.dark;
        ambientLight = this.ambientLightTypes.dark;
    } else
    // Transition to dusk
    if (this.time >= 18 * 3600) {
        light = this.lightTypes.dusk;
        ambientLight = this.ambientLightTypes.dusk;
    } else
    // Full sunlight
    if (this.time >= 6 * 3600) {
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
    if (this.time >= 4 * 3600) {
        light = this.lightTypes.full;
        ambientLight = this.ambientLightTypes.full;
    } else
    // Transition to dawn
    if (this.time >= 2 * 3600) {
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

    var rotationPerSecond = (2 * Math.PI) / 86400;
    this.sunRotation = rotationPerSecond * this.time;

    // Rotate light source
    quat.rotateZ(scratch.quat, scratch.identityQuat, this.sunRotation);
    vec3.transformQuat(this.directionalLight.position, this.directionalLight.start, scratch.quat);

    this.sun.tick(this.time, this.sunRotation);
};

var full = vec3.fromValues(1.1, 1.1, 1.1);
Weather.prototype.render = function(projection, ts) {
    var gl = this.gl;

    gl.useProgram(this.shader.program);
    gl.uniformMatrix4fv(this.shader.uniforms.projection, false, projection);
    gl.uniform3fv(this.shader.uniforms.ambientLightColor, full);
    this.sun.render(scratch.identityMat4, ts);
};


module.exports = Weather;
