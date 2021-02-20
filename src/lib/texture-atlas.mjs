/*
TODO

- load and bind to subsequent GL texture units
- main textures.png would be bound to 0
- player skins would be 1, 2, 3
- render code would simply set the uniform texture value to 0 - 3 as appropriate
- can look up this value in the textureAtlas
*/

class TextureAtlas {
    // load voxel textures and player/model textures
    constructor(game, textureMeta, players) {
        this.game = game;
        this.textureOffsets = textureMeta;
        this.players = {
            'player': {
                src: '/textures/player.png'
            },
            'substack': {
                src: '/textures/substack.png'
            },
            'viking': {
                src: '/textures/viking.png'
            }
        };
        //game.players;

        this.byName = {};
        this.byValue = {};

        /*
        // Prepare name and value mapping
        for (var i = 0; i < textureArray.length; i++) {
            var texture = textureArray[i];
            this.byValue[texture.value] = texture;
            this.byName[texture.name] = texture;
        }
        */
    }

    // TODO: modify this to annotate the original data structure with buffer and image object
    // Pass in handle to WebGL, callback is fired when textures are finished
    // TODO: add more error handling here ... if texture fails, we should tell the callback
    init() {
        let gl = this.game.userInterface.webgl.gl;
        let self = this;

        console.log('Max texture units: ' + gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
        return new Promise(function(resolve, reject) {
            var toLoad = 0;
            // skip null (empty block) texture
            var done = function() {
                toLoad--;
                if (toLoad == 0) {
                    resolve();
                }
            };
            var textureClosure = function(textureUnits, glTexture,  image) {
                let textureUnit = textureUnits.shift();
                return function() {
                    gl.activeTexture(textureUnit);
                    gl.bindTexture(gl.TEXTURE_2D, glTexture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                    // mipmap when scaling down
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                    // linear when scaling up
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                    gl.generateMipmap(gl.TEXTURE_2D);

                    done();
                };
            };
            // Bind textures to subsequent texture units
            let textureUnits = [
                gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2, gl.TEXTURE3, gl.TEXTURE4, gl.TEXTURE5, gl.TEXTURE6, gl.TEXTURE7,
                gl.TEXTURE8, gl.TEXTURE9, gl.TEXTURE10, gl.TEXTURE11, gl.TEXTURE12, gl.TEXTURE13, gl.TEXTURE14, gl.TEXTURE15,
                gl.TEXTURE16, gl.TEXTURE17, gl.TEXTURE18, gl.TEXTURE19, gl.TEXTURE20, gl.TEXTURE21, gl.TEXTURE22, gl.TEXTURE23
            ];

            // Pre-multiply so opacity works correctly
            // http://www.realtimerendering.com/blog/gpus-prefer-premultiplication/
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            // PNGs require this, right?
            //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            // Load texture atlas files
            for (let i = 0; i < self.textureOffsets.numAtlases; i++) {
                toLoad++;
                var glTexture = gl.createTexture();
                var image = new Image();
                // Need closure here, to wrap texture
                image.onload = textureClosure(textureUnits, glTexture, image);
                image.onerror = function(err) {
                    reject('Failed to load texture image: ' + image.src);
                };
                image.crossOrigin = 'Anonymous';
                image.src = '/textures' + i + '.png';
            }

            // Load player textures
            for (var value in self.players) {
                toLoad++;
                var texture = self.players[value];
                var glTexture = gl.createTexture();
                var image = new Image();
                // Need closure here, to wrap texture
                image.onload = textureClosure(textureUnits, glTexture, image);
                image.onerror = function(err) {
                    console.log('Failed to load texture image: ' + err);
                };
                image.crossOrigin = 'Anonymous';
                image.src = texture.src;
                // just store gl texture unit here i think
                self.byValue[value] = glTexture;
                self.byName[ texture.name ] = glTexture;
            }
        });
    }
}

export { TextureAtlas }
