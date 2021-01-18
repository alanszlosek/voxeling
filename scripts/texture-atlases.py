import json
import math
import re
from PIL import Image

# pip3install pillow
# python3 textures.py

# read json file
with open('../config.mjs', 'r') as f:
    j = f.read()

    # remove comments and ESM stuff
    j = j.replace('export default ', '')
    j = re.sub(r"(// [^\n]+)", '', j)
    config = json.loads(j)

# let's support triangles spanning 4 rows,
# thus we need 4 copies of a texture, with a row above and below for mipmapping,
# so 6 copies total of each block.
# this means we need to compute how many texture atlases we'll need, given
# the max dimensions of 16384 x 16384

width = 128
height = width
numTextures = len(config['textures'])
trianglesCanSpanRows = config['meshedTriangleMaxRowSpan']
pixelsPerTexture = width * (trianglesCanSpanRows + 2)
texturesPerAtlas = math.floor(16384 / pixelsPerTexture) - 1 # just to keep us away from the max
numAtlases = math.ceil(40 / texturesPerAtlas)

print('Need %d atlases' % numAtlases)

# just use max as height, makes things easier
atlasHeight = 16384 # texturesPerAtlas * pixelsPerTexture
print('height %d' % atlasHeight)



# TODO: think this is the way to key keys
textureValues = list(config['textures'].keys())
textureValues.sort()

# out becomes texture-offsets.json
out = {
     # height of a single texture within the atlas. we mult this by the number of rows a triangle spans
    "textureRowHeight": 128 /  atlasHeight,
    "offsets": {
        # texture value
        #"1": 0.123 # percentageOffset within texture]

    },
    "textureToTextureUnit": {},
    "numAtlases": 0
}
i = 0
while i < numAtlases:
    # create new atlas
    out['numAtlases'] += 1
    # height of 16384 since we know that's a power of two
    # power of two in both dimensions means higher quality mipmapping
    combined = Image.new('RGBA', (width, 16384), )

    yOffset = 0

    j = 0
    while j < texturesPerAtlas:
        # add textures
        if len(textureValues) == 0:
            break;
        textureValue = textureValues.pop()
        out['textureToTextureUnit'][ textureValue ] = i # so we know which WebGL texture unit to use within the shader
        # if no more, bail and save image

        path = config['textures'][textureValue]
        print('Loading %s' % path)

        with Image.open('../www' + path) as image:
            if image.width != width:
                print('resizing %d to %d' % (image.width, width))
                image = image.resize( (width, width), resample=Image.NEAREST )
        
            k = 0
            while k < trianglesCanSpanRows + 2:
                combined.paste(image, (0, yOffset))

                # we only log the offset of the second row of this block
                # because the first row is only there to ensure mipmapping doesn't
                # result in artifacts
                if k == 1:
                    out['offsets'][textureValue] = yOffset / atlasHeight
                yOffset += width
                k += 1
            #yOffset += 2
        
        j += 1
    
    # save
    # do we really need to flip, if we need to flip again on the webgl side?
    flipped = combined.transpose(Image.FLIP_TOP_BOTTOM)
    flipped.save('../www/textures%d.png' % i, quality=100.0)

    i += 1



with open('../texture-offsets.js', 'w') as f:
    a = 'module.exports=%s' % json.dumps(out)
    f.write(a)
    f.close()
