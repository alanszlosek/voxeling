var fs = require('fs');
var config = require('../config');
var PNG = require('pngjs').PNG;

var numTextures = Object.keys(config.textures).length;
var width = 256.0;
var desiredHeight = 256.0 * numTextures;
var height = 256;
var p;

while (height < desiredHeight) {
    height = height<<1;
}

p = new PNG({width: width, height: height});

var yOffset = 0;
var out = {};
for (var value in config.textures) {
	var path = config.textures[value];
    var data = fs.readFileSync('../www' + path);
    var input = PNG.sync.read(data);
    console.log(path);

    //for (var i = 0; i < 32; i++) {
        var i = 0;
        PNG.bitblt(input, p, 0, 0, input.width, input.height, i * input.width, yOffset);
    //}

    var texcoordHeight = input.height / height;
    var texcoordWidth = input.width / width;
    var texcoordTop = 1.0 - (yOffset / height);
    var texcoordBottom = texcoordTop - texcoordHeight;

    out[value] = [texcoordBottom, texcoordTop, texcoordWidth];
    yOffset += input.height;
}

var options = { colorType: 6 };
var buffer = PNG.sync.write(p, options);
fs.writeFileSync('../www/textures.png', buffer);

fs.writeFileSync('../texture-offsets.js', 'module.exports=' + JSON.stringify(out));