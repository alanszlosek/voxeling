// Helper
var createShader = function(gl, vertexShaderCode, fragmentShaderCode, attributes, uniforms) {
    var out = {
        program: null,
        attributes: {},
        uniforms: {}
    };

    // Set up shaders
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderCode);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        var errmsg = "fragment shader compile failed: " + gl.getShaderInfoLog(fragmentShader);
        alert(errmsg);
        throw new Error();
    }

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderCode);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        var errmsg = "vertex shader compile failed : " + gl.getShaderInfoLog(vertexShader);
        alert(errmsg);
        throw new Error(errmsg);
    }

    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    for (var i = 0; i < attributes.length; i++) {
        var name = attributes[i];
        // this hungarian notation seems unnecessary since our shaders are so simple
        out.attributes[name] = gl.getAttribLocation(shaderProgram, "a_" + name);
    }

    for (var i = 0; i < uniforms.length; i++) {
        var name = uniforms[i];
        // this hungarian notation seems unnecessary since our shaders are so simple
        out.uniforms[name] = gl.getUniformLocation(shaderProgram, "u_" + name);
    }

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        var errmsg = "failed to initialize shader with data matrices";
        alert(errmsg);
        throw new Error(errmsg);
    }
    out.program = shaderProgram;
    return out;
};



function WebGL(canvas) {
    var gl;
    gl = canvas.getContext("experimental-webgl");
    // If we don't have a GL context, give up now
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
        return;
    }
    this.canvas = canvas;
    this.gl = gl;
    this.renderCallback = function() {};
    this.shaders = {};

    gl.enable(gl.DEPTH_TEST);
    // if our fragment has a depth value that is less than the one that is currently there, use our new one
    gl.depthFunc(gl.LESS);
    
    // TODO: resize events might need to call this again
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.createShaders();
};

WebGL.prototype.createShaders = function() {
    // Common
    var fragmentShaderCode = 
        "precision mediump float;" +

        "uniform sampler2D u_texture;" +
        "uniform float u_textureOffset;" +

        "varying highp vec3 v_lighting;" +
        "varying highp vec2 v_texcoord;" +

        "void main() {" +
            "mediump vec4 texelColor = texture2D(u_texture, v_texcoord + vec2(0, u_textureOffset));" +
            //"mediump vec4 texelColor = texture2D(u_texture, v_texcoord);" +
            "gl_FragColor = vec4(texelColor.rgb * v_lighting, texelColor.a);" +
            "if(gl_FragColor.a < 0.5) " +
                "discard;" +
        "}";


    // projection * view * position vertex shader
    var vertexShaderCode = 
        "uniform mat4 u_projection;" + 
        "uniform mat4 u_view;" + 
        "uniform vec3 u_ambientLightColor;" +
        "uniform vec3 u_directionalLightColor;" +
        "uniform vec3 u_directionalLightVector;" + 

        "attribute vec4 a_position;" +
        "attribute vec3 a_normal;" +
        "attribute vec2 a_texcoord;" +

        "varying highp vec2 v_texcoord;" +
        "varying highp vec3 v_lighting;" +

        "void main() {" +
            "v_texcoord = a_texcoord;" +

            "highp float directional = max(dot(a_normal, u_directionalLightVector), 0.0);" +
            "v_lighting = u_ambientLightColor + (u_directionalLightColor * directional);" +

            "gl_Position = u_projection * u_view * a_position;" +
        "}";

    this.shaders.projectionViewPosition = createShader(
        this.gl,
        vertexShaderCode,
        fragmentShaderCode,
        // attributes
        ['position', 'normal', 'texcoord'],
        // uniforms
        ['projection', 'view', 'texture', 'textureOffset', 'ambientLightColor', 'directionalLightColor', 'directionalLightVector']
    );


    vertexShaderCode = 
        "uniform mat4 u_projection;" + 
        "uniform vec3 u_ambientLightColor;" +
        "uniform vec3 u_directionalLightColor;" +
        "uniform vec3 u_directionalLightVector;" + 

        "attribute vec4 a_position;" +
        "attribute vec3 a_normal;" +
        "attribute vec2 a_texcoord;" +

        "varying highp vec2 v_texcoord;" +
        "varying highp vec3 v_lighting;" +

        "void main() {" +
            "v_texcoord = a_texcoord;" +

            "highp float directional = max(dot(a_normal, u_directionalLightVector), 0.0);" +
            "v_lighting = u_ambientLightColor + (u_directionalLightColor * directional);" +

            "gl_Position = u_projection * a_position;" +
        "}";
    this.shaders.projectionPosition = createShader(
        this.gl,
        vertexShaderCode,
        fragmentShaderCode,
        // attributes
        ['position', 'normal', 'texcoord'],
        // uniforms
        ['projection', 'texture', 'textureOffset', 'ambientLightColor', 'directionalLightColor', 'directionalLightVector']
    );

};

WebGL.prototype.start = function() {
    this.render(0);
};

WebGL.prototype.render = function(ts) {
    var self = this;
    var gl = this.gl;

    //this.gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.renderCallback(ts);

    requestAnimationFrame(this.render.bind(this));
};

WebGL.prototype.onRender = function(callback) {
    this.renderCallback = callback;
};

WebGL.prototype.addRenderable = function(obj) {
    this.renderables.push(obj);
};

module.exports = WebGL;
