"""Explicit technical normalization of the generated original (never overwrites it)."""
from pathlib import Path
from PIL import Image
im=Image.open('content/art/source/hair-test-original.png').convert('RGBA')
# Generated 4×4 grid, views N/E/S/W. Preserve authored asymmetry, nearest-neighbour only.
out=im.resize((128,128),Image.Resampling.NEAREST)
levels=[32,80,128,184,240]
pixels=[]
for r,g,b,a in out.getdata():
    if a<128:pixels.append((0,0,0,0));continue
    l=.2126*r+.7152*g+.0722*b
    v=min(levels,key=lambda v:abs(v-l))
    pixels.append((v,v,v,255))
out.putdata(pixels)
# Remove spill from the long braid in the previous row, not part of this hairstyle view.
for row in range(4):
    for col in (2,3):
        for y in range(4):
            for x in range(32):out.putpixel((col*32+x,row*32+y),(0,0,0,0))
out.save('content/avatars/modular/hair-indexed.png',optimize=True)
print('Normalized 16 static views to 128×128 indexed RGBA; original preserved.')
