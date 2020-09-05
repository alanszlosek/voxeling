class TextureAtlas {
    // load voxel textures and player/model textures
    constructor(game, textureMeta, players) {
        this.game = game;
        this.textureOffsets = textureMeta;
        this.players = game.players;

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
        return new Promise(function(resolve, reject) {
            var toLoad = 0;
            // skip null (empty block) texture
            var done = function() {
                toLoad--;
                if (toLoad == 0) {
                    resolve();
                }
            };
            var textureClosure = function(glTexture,  image) {
                return function() {
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

            // Pre-multiply so opacity works correctly
            // http://www.realtimerendering.com/blog/gpus-prefer-premultiplication/
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            // PNGs require this, right?
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            // Load combined texture file
            toLoad++;
            var glTexture = gl.createTexture();
            var image = new Image();
            // Need closure here, to wrap texture
            image.onload = textureClosure(glTexture, image);
            image.onerror = function(err) {
                reject('Failed to load texture image: ' + image.src);
            };
            image.crossOrigin = 'Anonymous';
            image.src = '/textures.png';
            self.byValue[0] = glTexture;

            // Load player textures
            for (var value in self.players) {
                var texture = self.players[value];
                var glTexture = gl.createTexture();
                var image = new Image();
                // Need closure here, to wrap texture
                image.onload = textureClosure(glTexture, image);
                image.onerror = function(err) {
                    console.log('Failed to load texture image: ' + err);
                };
                image.crossOrigin = 'Anonymous';
                image.src = texture.src;
                self.byValue[value] = glTexture;
                self.byName[ texture.name ] = glTexture;
                toLoad++;
            }
        });
    }
}

export { TextureAtlas }
