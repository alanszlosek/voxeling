import json
import math
import re
from PIL import Image

# pip3 install pillow
# python3 textures.py

# read json file
with open('../config.mjs', 'r') as f:
    j = f.read()

    # remove comments and ESM stuff
    j = j.replace('export default ', '')
    j = re.sub(r"(// [^\n]+)", '', j)
    config = json.loads(j)

# let's support triangles spanning up to 14 rows and columns
# include padding for mipmapping, we'll have 16x16 chunks
# thus we need 16x16 copies of a texture
# the max dimensions that a texture can be are 16384 x 16384

width = 128
height = width
numTextures = len(config['textures'])

repeatCount = 16
regionWidth = repeatCount * width
atlasWidth = 16384
atlasCols = atlasWidth / regionWidth
atlasRows = math.ceil(numTextures / atlasCols)
atlasHeight = atlasRows * regionWidth

print("Atlas cols/rows: %d %d" % (atlasCols, atlasRows))


textureValues = list(config['textures'].keys())
textureValues.sort()

# out becomes texture-offsets.json
out = {
     # dims of a single texture within the atlas, normalized to 0-1.0
    "textureDimensions": [width / atlasWidth, width / atlasHeight],
    # rename this
    "offsets": {
        # texture value
        #"1": 0.123 # percentageOffset within texture]

    },
    # offsets for material picker UI
    "pixelOffsets": {},
    "textureToTextureUnit": {},
    "numAtlases": 0
}
i = 0
pixelOffset = 0 # for the material picker UI
materialPickerAtlas = Image.new('RGBA', (width, width * numTextures), )

atlasIndex = 0
numAtlases = 1
while atlasIndex < numAtlases:
    atlasIndex += 1
    # create new atlas
    out['numAtlases'] += 1
    combined = Image.new('RGBA', (atlasWidth, atlasHeight), )


    # how many pixels are in a repeated texture region?
    chunkStep = width * repeatCount
    row = 0
    while row < atlasRows:
        offsetY = row * chunkStep
        col = 0
        row += 1
        while col < atlasCols:
            if not textureValues:
                break
            textureValue = textureValues.pop()

            offsetX = col * chunkStep

            # for now, we reserve 0-2 for character textures, so don't use those
            out['textureToTextureUnit'][ textureValue ] = i + 3 # so we know which WebGL texture unit to use within the shader
            # if no more, bail and save image

            path = config['textures'][textureValue]
            print('Loading %s' % path)

            with Image.open('../www' + path) as image:
                if image.width != width:
                    print('resizing %d to %d' % (image.width, width))
                    image = image.resize( (width, width), resample=Image.NEAREST )
                
                # Copy to combined file that will be used for the material picker UI
                materialPickerAtlas.paste(image, (0, pixelOffset))

                # Now flip image and copy into the texture atlas file for GPU rendering
                image = image.transpose(Image.FLIP_TOP_BOTTOM)

                # 16 x 16
                x = 0
                while x < repeatCount:
                    y = 0
                    while y < repeatCount:
                        combined.paste(image, (offsetX + (x * width), offsetY + (y * width)))
                        y += 1
                    x += 1

                # we only log the offset of the second row of this block
                # because the first row is only there to ensure mipmapping doesn't
                # result in artifacts
                out['offsets'][textureValue] = [ (offsetX + width) / atlasWidth, (offsetY + width) / atlasHeight ]
                out['pixelOffsets'][textureValue] = pixelOffset

            col += 1
            pixelOffset += width
    
    # save
    # do we really need to flip, if we need to flip again on the webgl side?
    #flipped = combined.transpose(Image.FLIP_TOP_BOTTOM)
    # let's try not to flip ... but make sure coordinates map to bottom, since GPU draws bottom up
    combined.save('../www/textures%d.png' % i, quality=100.0)


materialPickerAtlas.save('../www/materials.png', quality=100.0)

with open('../texture-offsets.js', 'w') as f:
    a = 'module.exports=%s' % json.dumps(out)
    f.write(a)
    f.close()
