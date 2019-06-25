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

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        var errmsg = "Error in program linking: " + gl.getProgramInfoLog(shaderProgram);
        alert(errmsg);
        throw new Error(errmsg);
    }

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
        "uniform vec3 u_ambientLightColor;" +
        "uniform vec3 u_directionalLightColor;" +
        "uniform vec3 u_directionalLightPosition;" +
        "uniform float u_hazeDistance;" +

        "varying vec4 v_position;" +
        "varying vec3 v_normal;" +
        "varying vec2 v_texcoord;" +

        "vec3 fogColor;" +

        "void main() {" +
            "vec4 texelColor = texture2D(u_texture, v_texcoord + vec2(0, u_textureOffset));" +
            //"vec3 temp;" +

            "if(texelColor.a < 0.5) " +
                "discard;" +

            //"float distance = length(v_position.xyz);" +
            "vec3 lightDirection = normalize(u_directionalLightPosition - v_position.xyz);" +
            "highp float directionalLightWeight = max(dot(v_normal, lightDirection), 0.0);" +
            "vec3 lightWeight = u_ambientLightColor + (u_directionalLightColor * directionalLightWeight);" +

            // Apply light before we apply the haze?
            "gl_FragColor.rgb = texelColor.rgb * lightWeight;" +

            "float depth = gl_FragCoord.z / gl_FragCoord.w;" +
            // Start haze 1 chunk away, complete haze beyond 2.8 chunks away
            "float fogFactor = smoothstep( 32.0, u_hazeDistance, depth );" +

            "gl_FragColor.a = texelColor.a - fogFactor;" +
        "}";


    // projection * view * position vertex shader
    var vertexShaderCode =
        "uniform mat4 u_projection;" +
        "uniform mat4 u_view;" +

        "attribute vec4 a_position;" +
        "attribute vec3 a_normal;" +
        "attribute vec2 a_texcoord;" +

        "varying vec4 v_position;" +
        "varying vec3 v_normal;" +
        "varying vec2 v_texcoord;" +

        "void main() {" +
            "v_position = u_projection * u_view * a_position;" +
            "v_normal = a_normal;" +
            "v_texcoord = a_texcoord;" +

            "gl_Position = u_projection * u_view * a_position;" +
        "}";

    this.shaders.projectionViewPosition = createShader(
        this.gl,
        vertexShaderCode,
        fragmentShaderCode,
        // attributes
        ['position', 'normal', 'texcoord'],
        // uniforms
        ['projection', 'view', 'texture', 'textureOffset', 'ambientLightColor', 'directionalLightColor', 'directionalLightPosition', 'hazeDistance']
    );


    var fragmentShaderCode2 =
        "precision mediump float;" +

        "uniform sampler2D u_texture;" +

        "varying vec4 v_position;" +
        "varying vec3 v_normal;" +
        "varying vec2 v_texcoord;" +

        "vec3 fogColor;" +

        "void main() {" +
            "vec4 texelColor = texture2D(u_texture, v_texcoord);" +

            // Apply light before we apply the haze?
            "gl_FragColor.rgb = texelColor.rgb;" +
            "gl_FragColor.a = texelColor.a;" +
        "}";
    this.shaders.projectionViewPosition2 = createShader(
        this.gl,
        vertexShaderCode,
        fragmentShaderCode2,
        // attributes
        ['position', 'normal', 'texcoord'],
        // uniforms
        ['projection', 'view', 'texture']
    );


    var vertexShaderCode2 =
        "uniform mat4 u_projection;" +

        "attribute vec4 a_position;" +
        "attribute vec3 a_normal;" +
        "attribute vec2 a_texcoord;" +

        "varying vec4 v_position;" +
        "varying vec3 v_normal;" +
        "varying vec2 v_texcoord;" +

        "void main() {" +
            "v_position = u_projection * a_position;" +
            "v_normal = a_normal;" +
            "v_texcoord = a_texcoord;" +

            "gl_Position = u_projection * a_position;" +
        "}";
    this.shaders.projectionPosition = createShader(
        this.gl,
        vertexShaderCode2,
        fragmentShaderCode,
        // attributes
        ['position', 'normal', 'texcoord'],
        // uniforms
        ['projection', 'texture', 'textureOffset', 'ambientLightColor', 'directionalLightColor', 'directionalLightPosition', 'hazeDistance']
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
