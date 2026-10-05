#!/usr/bin/env python3
"""Verify the ENCODED file, not just your stills.

  python verify_video.py final.mp4 --duration 10 --fps 60 --size 1920x1080 \
         --times 0.5 2 4 6 8 9.95 --expect 50,50,42,52,255@0.5 --outdir check

Checks: ffprobe stream facts, exact duration/frame count, audio presence, first/last frame
not blank, pixel colours at chosen points (BT.709 round-trip), and writes a contact sheet of
frames pulled from the real file. Exit code 1 if a hard check fails.
"""
import argparse, json, os, subprocess, sys
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('video')
ap.add_argument('--duration', type=float); ap.add_argument('--fps', type=float); ap.add_argument('--size')
ap.add_argument('--times', type=float, nargs='*', default=None, help='default: 2%%,25%%,50%%,75%%,98%% of duration')
ap.add_argument('--expect', action='append', default=[], help='x,y,r,g,b@time  (tolerance +-6)')
ap.add_argument('--outdir', default='check')
a = ap.parse_args()
os.makedirs(a.outdir, exist_ok=True)
fail = False
def bad(msg):
    global fail; fail = True; print('FAIL:', msg)

pr = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', a.video]))
v = next(s for s in pr['streams'] if s['codec_type'] == 'video')
aud = [s for s in pr['streams'] if s['codec_type'] == 'audio']
num, den = map(int, v['r_frame_rate'].split('/')); fps = num / den
dur = float(pr['format']['duration'])
print(f"video {v['codec_name']} {v['width']}x{v['height']} {fps:g}fps pix_fmt={v['pix_fmt']} frames={v.get('nb_frames')} duration={dur:.3f}s audio={'yes' if aud else 'NO'}")
if a.duration and abs(dur - a.duration) > 0.05: bad(f'duration {dur:.3f} != {a.duration}')
if a.fps and abs(fps - a.fps) > 0.01: bad(f'fps {fps} != {a.fps}')
if a.duration and a.fps and int(v.get('nb_frames', 0)) != round(a.duration * a.fps): bad('frame count mismatch')
if a.size and f"{v['width']}x{v['height']}" != a.size: bad('size mismatch')
if v['pix_fmt'] != 'yuv420p': bad('pix_fmt should be yuv420p for broad playback')
if not aud: bad('missing audio stream')
for field in ('color_space', 'color_transfer', 'color_primaries'):
    if v.get(field) != 'bt709': bad(f'{field} should be bt709')

times = a.times if a.times else [round(dur * f, 2) for f in (0.02, 0.25, 0.5, 0.75, 0.98)]
ok_times = [t for t in times if 0 <= t < dur]
if len(ok_times) < len(times): print(f'note: skipped sample times outside 0..{dur:.2f}s')
paths = []
for t in ok_times:
    p = os.path.join(a.outdir, f'f_{t:05.2f}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(t), '-i', a.video, '-frames:v', '1', p], check=True)
    paths.append(p)
def lum(p):
    import numpy as np
    px = np.asarray(Image.open(p).convert('L').resize((64, 36)), dtype=float)
    return float(px.mean()), float(px.std())
first = os.path.join(a.outdir, 'first.png'); last = os.path.join(a.outdir, 'last.png')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a.video, '-frames:v', '1', first], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-sseof', '-0.05', '-i', a.video, '-frames:v', '1', last], check=True)
for name, p in (('first', first), ('last', last)):
    m, sd = lum(p); print(f'{name} frame: mean luma {m:.0f}, contrast sd {sd:.1f}', '(flat colour only?)' if sd < 2 else '')
for e in a.expect:
    spec, t = e.split('@'); x, y, r, g, b = map(int, spec.split(','))
    p = os.path.join(a.outdir, f'exp_{t}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', t, '-i', a.video, '-frames:v', '1', p], check=True)
    got = Image.open(p).convert('RGB').getpixel((x, y))
    ok = all(abs(c1 - c2) <= 6 for c1, c2 in zip(got, (r, g, b)))
    print(f'pixel ({x},{y})@{t}s got {got} want {(r, g, b)}', 'ok' if ok else 'MISMATCH')
    if not ok: bad('colour drift (check bt709 tagging / scale filter)')
here = os.path.dirname(os.path.abspath(__file__))
subprocess.run([sys.executable, os.path.join(here, 'contact_sheet.py'), os.path.join(a.outdir, 'sheet.png'), *paths], check=True)
print('review', os.path.join(a.outdir, 'sheet.png'))
sys.exit(1 if fail else 0)
