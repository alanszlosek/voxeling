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

width = 64
height = width
numTextures = len(config['textures'])

# let's try thin strip above and below repeat region
# however, if the gutter is too small, there are mipmapping artifacts
# change to 32 and see what i mean
gutter = 64
repeatCount = 32
regionWidth = width
# 4116
regionHeight = (repeatCount * height) + (gutter * 2)
atlasWidth = width
atlasHeight = 16384
atlasCols = 1
atlasRows = math.floor(atlasHeight / regionHeight)

numAtlases = math.ceil(numTextures / atlasRows)

def split_list(arr, size):
     arrs = []
     while len(arr) > size:
         pice = arr[:size]
         arrs.append(pice)
         arr   = arr[size:]
     arrs.append(arr)
     return arrs
atlases = []

allTextureValues = list(config['textures'].keys())
allTextureValues.sort()
opaque = []
transparent = []
# textures with transparency should be in their own atlas
for v in allTextureValues:
    if v in config['texturesWithTransparency']:
        transparent.append(v)
    else:
        opaque.append(v)

atlases = split_list(opaque, atlasRows)
atlases.append( transparent )

print( len(atlases) )


# out becomes texture-offsets.json
out = {
    # dims of a single texture within the atlas, normalized to 0-1.0
    # i dont' need this anymore
    #"normalizedTextureDimensions": [width / atlasWidth, height / atlasHeight],
    'textureRowHeight': width / atlasHeight,
    # rename this
    "offsets": {
        # texture value
        #"1": 0.123 # percentageOffset within texture]

    },
    # offsets for material picker UI
    "pixelOffsets": {},
    "textureRowPixels": width,
    "textureToTextureUnit": {},
    "numAtlases": len(atlases)
}
i = 0
pixelOffset = 0 # for the material picker UI
materialPickerAtlas = Image.new('RGBA', (width, width * numTextures), )


for atlasIndex,textureValues in enumerate(atlases):
    # create new atlas
    combined = Image.new('RGBA', (atlasWidth, atlasHeight), )

    # how many pixels are in a repeated texture region?
    chunkStep = (width * repeatCount) + (2 * gutter)

    textures = atlases[atlasIndex]
    for row,textureValue in enumerate(textureValues):
        offsetY = row * chunkStep
        col = 0
        while col < atlasCols:
            offsetX = col * chunkStep

            # for now, we reserve 0-2 for character textures, so don't use those
            out['textureToTextureUnit'][ textureValue ] = atlasIndex + 3 # so we know which WebGL texture unit to use within the shader
            # if no more, bail and save image

            path = config['textures'][textureValue]
            print('Loading %s' % path)

            with Image.open('../www' + path) as image:
                if image.width != width:
                    print('resizing %d to %d' % (image.width, width))
                    image = image.resize( (width, width), resample=Image.NEAREST )
                
                # Copy to combined file that will be used for the material picker UI
                materialPickerAtlas.paste(image, (0, pixelOffset))
                out['pixelOffsets'][textureValue] = pixelOffset
                pixelOffset += width

                # Now flip image and copy into the texture atlas file for GPU rendering
                image = image.transpose(Image.FLIP_TOP_BOTTOM)

                # we only log the offset of the second row of this block
                # because the first row is only there to ensure mipmapping doesn't
                # result in artifacts
                #out['offsets'][textureValue] = [ (offsetX + width) / atlasWidth, (offsetY + width) / atlasHeight ]
                out['offsets'][textureValue] = (offsetY + gutter) / atlasHeight

                offsetY2 = offsetY
                
                #thin strip above for mip-mapping
                bottomStrip = image.crop( (0, width - gutter, width, width))
                combined.paste(bottomStrip, (offsetX, offsetY))
                offsetY2 += gutter

                x = 0
                while x < 1: # only 1 texture wide
                    y = 0
                    while y < repeatCount:
                        combined.paste(image, (offsetX + (x * width), offsetY2 + (y * width)))
                        y += 1
                    x += 1

                # helps us draw the next strip correctly                
                offsetY3 = offsetY + chunkStep - gutter
                topStrip = image.crop( (0, 0, width, gutter))
                combined.paste(topStrip, (offsetX, offsetY3))



            col += 1
    
            
    
    # save
    # do we really need to flip, if we need to flip again on the webgl side?
    #flipped = combined.transpose(Image.FLIP_TOP_BOTTOM)
    # let's try not to flip ... but make sure coordinates map to bottom, since GPU draws bottom up
    combined.save('../www/textures%d.png' % atlasIndex, quality=100.0)
    atlasIndex += 1


materialPickerAtlas.save('../www/materials.png', quality=100.0)

with open('../texture-offsets.js', 'w') as f:
    a = 'module.exports=%s' % json.dumps(out)
    f.write(a)
    f.close()
