import { renderables } from './capabilities/renderable.mjs';
import { tickables } from './capabilities/tickable.mjs';

// Helper
function createShader(gl, vertexShaderCode, fragmentShaderCode, attributes, uniforms) {
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
        out.attributes[name] = gl.getAttribLocation(shaderProgram, "a_" + name);
        if (out.attributes[name] == -1) {
            console.log('Attribute error in GL shader: ' + name + '. Is the attribute being used in the shader?');
        }
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
}



class WebGL {
    constructor(canvas) {
        let gl = canvas.getContext("webgl2");
        // If we don't have a GL context, give up now
        if (!gl) {
            // TODO: fix exceptions
            throw "Unable to initialize WebGL. Your browser may not support it.";
        }
        this.canvas = canvas;
        this.gl = gl;
        this.renderCallback = function() {};
        this.shaders = {};
        this.ts = 0;

        gl.enable(gl.DEPTH_TEST);
        // if our fragment has a depth value that is less than the one that is currently there, use our new one
        gl.depthFunc(gl.LESS);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // TODO: resize events might need to call this again
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.createShaders();
    }

    createShaders() {
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
            //"varying vec3 v_normal;" +
            "varying vec2 v_texcoord;" +

            "vec3 fogColor;" +

            "void main() {" +
                "vec4 texelColor = texture2D(u_texture, v_texcoord + vec2(0, u_textureOffset));" +
                //"vec3 temp;" +

                "if(texelColor.a < 0.5) " +
                    "discard;" +

                //"float distance = length(v_position.xyz);" +
                //"vec3 lightDirection = normalize(u_directionalLightPosition - v_position.xyz);" +
                //"highp float directionalLightWeight = max(dot(v_normal, lightDirection), 0.0);" +
                //"vec3 lightWeight = u_ambientLightColor + (u_directionalLightColor * directionalLightWeight);" +

                // Apply light before we apply the haze?
                "gl_FragColor.rgb = texelColor.rgb;" + // * lightWeight;" +

                "float depth = gl_FragCoord.z / gl_FragCoord.w;" +
                // Start haze 1 chunk away, complete haze beyond 2.8 chunks away
                // TODO: adjusting these doesn't seem to do anything
                //"float fogFactor = smoothstep( 32.0, u_hazeDistance, depth );" +

                "gl_FragColor.a = texelColor.a;" + // - fogFactor;" +
            "}";


        // projection * view * position vertex shader
        var vertexShaderCode =
            "uniform mat4 u_projection;" +
            "uniform mat4 u_view;" +
            "uniform mat4 u_model;" +

            "attribute vec4 a_position;" +
            //"attribute vec3 a_normal;" +
            "attribute vec2 a_texcoord;" +

            "varying vec4 v_position;" +
            //"varying vec3 v_normal;" +
            "varying vec2 v_texcoord;" +

            "void main() {" +
                "v_position = u_projection * u_view * u_model * a_position;" +
                //"v_normal = a_normal;" +
                "v_texcoord = a_texcoord;" +

                "gl_Position = v_position;" +
            "}";

        this.shaders.mvp = createShader(
            this.gl,
            vertexShaderCode,
            fragmentShaderCode,
            // attributes
            ['position', 'texcoord'], // 'normal'
            // uniforms
            ['projection', 'view', 'model', 'texture', 'textureOffset', 'ambientLightColor', 'directionalLightColor', 'directionalLightPosition', 'hazeDistance']
        );


        // projection * view * position vertex shader
        var vertexShaderCode2 =
            "uniform mat4 u_view;" +
            "uniform mat4 u_model;" +

            "attribute vec4 a_position;" +
            //"attribute vec3 a_normal;" +
            "attribute vec2 a_texcoord;" +

            "varying vec4 v_position;" +
            //"varying vec3 v_normal;" +
            "varying vec2 v_texcoord;" +

            "void main() {" +
                "v_position = u_view * u_model * a_position;" +
                //"v_normal = a_normal;" +
                "v_texcoord = a_texcoord;" +

                "gl_Position = v_position;" +
            "}";

        this.shaders.mvp2 = createShader(
            this.gl,
            vertexShaderCode2,
            fragmentShaderCode,
            // attributes
            ['position', 'texcoord'], // 'normal'
            // uniforms
            ['view', 'model', 'texture', 'textureOffset', 'ambientLightColor', 'directionalLightColor', 'directionalLightPosition', 'hazeDistance']
        );


        var vertexShaderCodeBillboard =
            "uniform mat4 u_projection;" +
            "uniform mat4 u_view;" +
            "uniform mat4 u_model;" +
            "uniform vec3 u_baseposition;" +

            "attribute vec4 a_position;" +
            "attribute vec3 a_normal;" +
            "attribute vec2 a_texcoord;" +

            "varying vec4 v_position;" +
            "varying vec3 v_normal;" +
            "varying vec2 v_texcoord;" +

            "void main() {" +
                //"v_position = u_projection * u_view * u_model * (a_position + u_cameraposition);" +
                "v_normal = a_normal;" +
                "v_texcoord = a_texcoord;" +

                "vec3 camX = vec3(u_view[0].x, u_view[1].x, u_view[2].x);" +
                "vec3 camY = vec3(u_view[0].y, u_view[1].y, u_view[2].y);" +
                // // think rpoblem is right here
                "vec4 pos = vec4((camX * a_position[0]) + (camY * a_position[1]), 0);" +
                // "v_position = (u_projection * u_view * u_model * pos) + (u_projection * u_view * vec4(u_baseposition, 1));" +

                //"v_position = u_projection * u_view * ((u_model * pos) + vec4(u_baseposition, 1));" +
                "v_position = u_projection * u_view * ((u_model * pos) + vec4(u_baseposition, 1));" +


                //"gl_Position = u_projection * (view_position + vec4(a_position.xyz * dist, 0));" +
                //"v_position = u_projection * (view_position + vec4(a_position.xyz * dist, 0));" +
                "gl_Position = v_position;" +
            "}";
        this.shaders.mvpBillboard = createShader(
            this.gl,
            vertexShaderCodeBillboard,
            fragmentShaderCode,
            // attributes
            ['position', 'normal', 'texcoord'],
            // uniforms
            ['projection', 'view', 'model', 'baseposition', 'texture', 'textureOffset', 'ambientLightColor', 'directionalLightColor', 'directionalLightPosition', 'hazeDistance']
        );


        var voxelVertexShader =
            "uniform mat4 u_view;" +
            "uniform sampler2D u_sampler;" +

            "attribute vec4 a_position;" +
            "attribute vec2 a_texcoord;" +

            "varying vec4 v_position;" +
            "varying vec2 v_texcoord;" +

            "void main() {" +
                "v_position = u_view * a_position;" +
                "v_texcoord = a_texcoord;" +

                "gl_Position = v_position;" +
            "}";
        var voxelFragmentShader =
            "precision mediump float;" +

            "uniform sampler2D u_sampler;" +
            //"uniform vec3 u_ambientLightColor;" +

            "varying vec4 v_position;" +
            "varying vec2 v_texcoord;" +

            "vec3 fogColor;" +

            "void main() {" +
                "vec4 texelColor = texture2D(u_sampler, v_texcoord);" +
                "gl_FragColor.rgb = texelColor.rgb;" +
                "gl_FragColor.a = texelColor.a;" +

                //"vec3 temp;" +

                "if(texelColor.a < 0.5) " +
                    "discard;" +

                //"float distance = length(v_position.xyz);" +
                //"vec3 lightDirection = normalize(u_directionalLightPosition - v_position.xyz);" +
                //"highp float directionalLightWeight = max(dot(u_normal, lightDirection), 0.0);" +
                //"vec3 lightWeight = u_ambientLightColor + (u_directionalLightColor * directionalLightWeight);" +

                // Apply light before we apply the haze?
                //"gl_FragColor.rgb = texelColor.rgb;" + // * lightWeight;" +

                //"float depth = gl_FragCoord.z / gl_FragCoord.w;" +
                // Start haze 1 chunk away, complete haze beyond 2.8 chunks away
                // TODO: adjusting these doesn't seem to do anything
                //"float fogFactor = smoothstep( 32.0, u_hazeDistance, depth );" +
                //"gl_FragColor.a = texelColor.a - fogFactor;" +
                
            
                //"gl_FragColor = texelColor;" +
                //"gl_FragColor.a = texelColor.a;" +
            "}";
        this.shaders.voxel = createShader(
            this.gl,
            voxelVertexShader,
            voxelFragmentShader,
            // attributes
            ['position', 'texcoord'],
            // uniforms
            //['projection', 'view', 'texture', 'normal', 'ambientLightColor', 'directionalLightColor', 'directionalLightPosition', 'hazeDistance']
            ['view', 'sampler']
        );

        var instancedVertexShader =
        "uniform mat4 u_projection;" +
        "uniform mat4 u_view;" +

        "attribute vec4 a_position;" +
        "attribute vec3 a_normal;" +
        "attribute vec2 a_texcoord;" +
        "attribute vec4 a_translation;" +

        "varying vec4 v_position;" +
        "varying vec3 v_normal;" +
        "varying vec2 v_texcoord;" +

        "void main() {" +
            "v_position = u_projection * u_view * (a_position + a_translation);" +
            "v_normal = a_normal;" +
            "v_texcoord = a_texcoord;" +

            "gl_Position = v_position;" +
        "}";
        this.shaders.translationInstanced = createShader(
            this.gl,
            instancedVertexShader,
            fragmentShaderCode,
            // attributes
            ['position', 'normal', 'texcoord', 'translation'],
            // uniforms
            ['projection', 'view', 'texture', 'textureOffset', 'ambientLightColor', 'directionalLightColor', 'directionalLightPosition', 'hazeDistance']
        );
    }

    start(callback) {
        this.render2(callback);
    }

    render(ts) {
        let self = this;
        let gl = this.gl;
        let r = function(ts) {
            //this.gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            for (let id in renderables) {
                renderables[id].render(gl, ts);
            }
            self.ts = ts;
            requestAnimationFrame(r);
        };
        requestAnimationFrame(r);
    }

    render2(callback) {
        let self = this;
        let gl = this.gl;
        let r = function(ts) {
            //this.gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            //self.scene.render(ts, self.camera.matrix);
            callback(ts);
            self.ts = ts;
            requestAnimationFrame(r);
        };
        requestAnimationFrame(r);
    }
}

export { WebGL }
