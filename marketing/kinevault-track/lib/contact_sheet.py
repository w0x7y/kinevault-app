#!/usr/bin/env python3
"""Tile images into one contact sheet so you can review many moments in a single look.

  python contact_sheet.py sheet.png stills/*.png [--cols 3] [--thumb 640]
"""
import argparse
from PIL import Image
ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('files', nargs='+')
ap.add_argument('--cols', type=int, default=3); ap.add_argument('--thumb', type=int, default=640)
a = ap.parse_args()
ims = [Image.open(f).convert('RGB') for f in a.files]
tw = a.thumb; th = int(tw * ims[0].height / ims[0].width)
cols = min(a.cols, len(ims)); rows = (len(ims) + cols - 1) // cols
g = 8
sheet = Image.new('RGB', (cols * tw + (cols + 1) * g, rows * th + (rows + 1) * g), (30, 30, 30))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (g + (i % cols) * (tw + g), g + (i // cols) * (th + g)))
sheet.save(a.out); print('wrote', a.out, sheet.size)
