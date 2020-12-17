import json
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


numTextures = len(config['textures'])

# lets try to include 3 of a texture vertically, so mipmapping is more accurate

width = 128
desiredHeight = width * numTextures * 3
height = width

# actual  height must be multiple of 2 for WebGL
while height < desiredHeight:
    height = height << 1
    
combined = Image.new('RGBA', (width, height), )

yOffset = 0
out = {}
for value in config['textures']:
    print(value)
    path = config['textures'][value]

    with Image.open('../www' + path) as image:
        if image.width != width:
            print('resizing %d to %d' % (image.width, width))
            image = image.resize( (width, width), resample=Image.NEAREST )
            
        i = 0
        while i < 3:
            combined.paste(image, (0, yOffset))

            if i == 1:
                texcoordTop = yOffset / height
                texcoordBottom = texcoordTop + ((width - 1) / height)
                out[value] = (texcoordBottom, texcoordTop, 1.0)

            yOffset += width
            i += 1
        yOffset += 2

with open('../texture-offsets.js', 'w') as f:
    a = 'module.exports=%s' % json.dumps(out)
    f.write(a)
    f.close()

flipped = combined.transpose(Image.FLIP_TOP_BOTTOM)
flipped.save('../www/textures.png', quality=100.0)
