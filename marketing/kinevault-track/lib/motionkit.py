"""
motionkit - a small toolkit for code-rendered motion graphics (Skia + ffmpeg).

Core idea: your scene is ONE pure function  draw(canvas, t)  that paints the whole
frame for time t (seconds). Nothing is stateful, so you can render any frame in
isolation (stills for review), average several sub-frames for real motion blur,
and re-render a single beat without touching the others.

    import motionkit as mk
    def draw(c, t):
        c.clear(mk.color4f(mk.hexc('#2A34FF')))
        ...
    r = mk.Renderer(draw, width=1920, height=1080, fps=60, duration=10)
    r.stills([0.5, 2.0, 9.9], 'stills')       # fast review loop
    r.video('silent.mp4', nsub=6, workers=4)  # final render
"""
import math, os, subprocess, sys, time
import numpy as np
import skia

# ------------------------------------------------------------------ numeric helpers
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def lerp(a, b, t): return a + (b - a) * t
def prog(t, a, b):
    """0..1 progress of t through the window [a, b], clamped."""
    return clamp((t - a) / (b - a))
def mix(c1, c2, t):
    t = clamp(t)
    return tuple(lerp(a, b, t) for a, b in zip(c1, c2))
def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# ------------------------------------------------------------------ easing
def ease_out_cubic(u): return 1 - (1 - u) ** 3
def ease_in_cubic(u): return u ** 3
def ease_in_out_cubic(u): return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2
def ease_out_expo(u): return 1.0 if u >= 1 else 1 - 2 ** (-10 * u)
def ease_in_out_expo(u):
    if u <= 0: return 0.0
    if u >= 1: return 1.0
    return 2 ** (20 * u - 10) / 2 if u < 0.5 else (2 - 2 ** (-20 * u + 10)) / 2
def ease_out_back(u, s=1.70158):
    c3 = s + 1
    return 1 + c3 * (u - 1) ** 3 + s * (u - 1) ** 2

def spring(t, zeta=0.5, omega=20.0):
    """Underdamped spring step response. t = SECONDS since the trigger (not 0..1).
    Returns 0 -> 1 with overshoot. zeta: damping (0.4 bouncy, 0.55 lively, 0.8 tight).
    omega: speed (12 slow, 19 snappy, 30 very fast)."""
    if t <= 0: return 0.0
    wd = omega * math.sqrt(1 - zeta * zeta)
    return 1 - math.exp(-zeta * omega * t) * (math.cos(wd * t) + zeta * omega / wd * math.sin(wd * t))

def gauss(x, width): return math.exp(-(x / width) ** 2)

def damped_wobble(tau, amp, decay=9.0, freq=28.0):
    """Decaying sine for follow-through jiggles. tau = seconds since impact."""
    return 0.0 if tau < 0 else amp * math.exp(-decay * tau) * math.sin(freq * tau)

# ------------------------------------------------------------------ skia helpers
def color4f(c, a=1.0):
    return skia.Color4f(c[0] / 255, c[1] / 255, c[2] / 255, a)

def P(c, a=1.0, stroke=None, cap=None):
    """Anti-aliased Paint. c is an (r,g,b) tuple 0-255 (floats OK)."""
    p = skia.Paint(AntiAlias=True)
    p.setColor4f(color4f(c, a))
    if stroke:
        p.setStyle(skia.Paint.kStroke_Style)
        p.setStrokeWidth(stroke)
    if cap == 'round':
        p.setStrokeCap(skia.Paint.kRound_Cap)
    return p

def load_font(path, size):
    tf = skia.Typeface.MakeFromFile(path)
    if tf is None: raise FileNotFoundError(path)
    f = skia.Font(tf, size)
    f.setSubpixel(True)
    f.setEdging(skia.Font.Edging.kSubpixelAntiAlias)
    return f

def rect(l, t, r, b): return skia.Rect.MakeLTRB(l, t, r, b)

def oval(c, cx, cy, rx, ry, paint):
    c.drawOval(rect(cx - rx, cy - ry, cx + rx, cy + ry), paint)

def circle_path(cx, cy, r):
    p = skia.Path(); p.addCircle(cx, cy, r); return p

def iris(c, cx, cy, radius, color):
    """Circular wipe: draw AFTER the layer it covers and BEFORE the layer revealed inside it."""
    if radius > 0.5: c.drawCircle(cx, cy, radius, P(color))

def masked_text(c, text, x, baseline, font, paint, t, t_in, dur=0.5, rise=64, clip=None):
    """Text that slides up out of a mask. clip = (l,t,r,b) region the text may be visible in."""
    off = lerp(rise, 0, ease_out_cubic(prog(t, t_in, t_in + dur)))
    c.save()
    if clip: c.clipRect(rect(*clip))
    c.drawString(text, x, baseline + off, font, paint)
    c.restore()

# ------------------------------------------------------------------ bounce physics
class Bounce:
    """
    Gravity bounce with contact dwell (for squash) and velocity-based stretch.

        b = Bounce(drop_start=0.35, drop_dist=856, hops=[(330, 1.0), (130, .6), (40, .35), (0, .18)])
        h = b.height(t)          # px above rest position (>=0)
        sx, sy = b.scale(t)      # area-preserving squash/stretch multipliers
        b.imp                    # [(t_impact, strength, v_in, v_out, dwell)]  <- use for pulses, sound, dust

    hops = [(apex_height_px, impact_strength_0_to_1), ...]; impact k happens, then a hop of
    apex k. Use apex 0 for the final settle. Squash window == dwell exactly, which keeps
    scale continuous at both edges (no pops).
    Render the body with center_y = min(rest_y - h, surface_y - ry)  so it never sinks into the floor.
    """
    G = 9000.0  # px/s^2 at 1080p. Lower (6000) = floaty/moonlike, higher (12000) = heavy.

    def __init__(self, drop_start, drop_dist, hops, gravity=None):
        G = gravity or self.G
        self.G = G
        self.t0, self.dist = drop_start, drop_dist
        self.tf = math.sqrt(2 * drop_dist / G) if drop_dist > 0 else 0.0
        self.imp, self.air = [], []
        t = self.t0 + self.tf
        v_in = G * self.tf
        for (h, A) in hops:
            dwell = 0.05 + 0.05 * A
            v_out = math.sqrt(2 * G * h) if h > 0 else 0.0
            flight = 2 * math.sqrt(2 * h / G) if h > 0 else 0.0
            self.imp.append((t, A, v_in, v_out, dwell))
            self.air.append((t + dwell, h, flight))
            t = t + dwell + flight
            v_in = v_out
        self.t_end = t

    def height(self, t):
        G = self.G
        if t < self.t0: return self.dist
        if t < self.imp[0][0]: return self.dist - 0.5 * G * (t - self.t0) ** 2
        for (ti, A, vi, vo, dw), (ta, h, fl) in zip(self.imp, self.air):
            if ti <= t < ta: return 0.0
            if h > 0 and ta <= t < ta + fl:
                tau = t - ta
                return h - 0.5 * G * (tau - fl / 2) ** 2
        return 0.0

    def speed(self, t):
        e = 1 / 1200
        return abs(self.height(t + e) - self.height(t - e)) / (2 * e)

    @staticmethod
    def stretch(v, k=0.45): return 1 + k * clamp(v / 3900)

    def scale(self, t, squash=0.38):
        for (ti, A, vi, vo, dw) in self.imp:
            if ti <= t < ti + dw:
                u = (t - ti) / dw
                w = math.sin(math.pi * u) ** 0.8
                edge = self.stretch(vi) if u < 0.5 else self.stretch(vo)
                sy = lerp(edge, 1 - squash * A, w)
                return 1 / sy, sy
        s = self.stretch(self.speed(t))
        return 1 / s, s

# ------------------------------------------------------------------ polar shape morphing
# Any star-shaped outline is a radius-per-angle function r(theta). Morphing = lerp the radii.
# 360 samples on a 3600-sample lookup table gives crisp corners and cheap rotation.
_TH = np.linspace(0, 2 * np.pi, 360, endpoint=False)
_GRID = np.linspace(0, 2 * np.pi, 3600, endpoint=False)

def _smooth(a, sigma):
    if sigma <= 0: return a
    k = np.arange(-4 * sigma, 4 * sigma + 1)
    g = np.exp(-0.5 * (k / sigma) ** 2); g /= g.sum()
    ext = np.concatenate([a[-len(k):], a, a[:len(k)]])
    return np.convolve(ext, g, mode='same')[len(k):len(k) + len(a)]

def rad_circle(th): return np.ones_like(th)
def rad_square(th, n=10, a=0.886):          # superellipse; n large = crisper corners; a = area-matched to unit circle
    cc, ss = np.abs(np.cos(th)), np.abs(np.sin(th))
    return a / ((cc ** n + ss ** n) ** (1 / n))
def rad_polygon(th, sides=3, circumradius=1.555, up=True):  # regular polygon (3 -> area-matched triangle)
    apothem = circumradius * math.cos(math.pi / sides)
    off = -np.pi / 2 if up else 0.0
    d = np.mod(th - off, 2 * np.pi / sides) - np.pi / sides
    return apothem / np.cos(d)

class PolarMorph:
    """
        pm = PolarMorph([(rad_circle, 0), (rad_square, 10), (rad_polygon, 22), (rad_circle, 0)])
        path = pm.path(cx, cy, R, m, rot)   # m in [0, len-1]; 1.5 = halfway between shape 1 and 2
    Second tuple item = smoothing sigma (rounds corners; ~22 for a triangle looks right).
    """
    def __init__(self, shapes):
        self.tables = [_smooth(fn(_GRID), s) for fn, s in shapes]

    def radii(self, m, rot=0.0):
        n = len(self.tables) - 1
        m = clamp(m, 0, n)
        k = min(int(m), n - 1); f = m - k
        r = (1 - f) * self.tables[k] + f * self.tables[k + 1]
        idx = (((_TH - rot) % (2 * np.pi)) / (2 * np.pi) * 3600).astype(int) % 3600
        return r[idx]

    def path(self, cx, cy, R, m, rot=0.0):
        r = self.radii(m, rot) * R
        pts = [skia.Point(cx + a * math.cos(th), cy + a * math.sin(th)) for a, th in zip(r, _TH)]
        return skia.Path.Polygon(pts, True)

# ------------------------------------------------------------------ rendering
_ACTIVE = None  # set before forking workers so they inherit the draw function

def _worker(args):
    t, nsub, shutter = args
    return _ACTIVE.frame(t, nsub, shutter).tobytes()

class Renderer:
    def __init__(self, draw, width=1920, height=1080, fps=60, duration=10.0):
        self.draw, self.W, self.H, self.fps, self.dur = draw, width, height, fps, duration
        self._surf = None

    @property
    def surf(self):
        if self._surf is None: self._surf = skia.Surface(self.W, self.H)
        return self._surf

    def frame(self, t, nsub=6, shutter=0.5):
        """Render frame at time t as an HxWx3 uint8 array. Averages `nsub` sub-frames spread
        across a shutter of `shutter` frame-durations (0.5 == 180 degree shutter)."""
        c = self.surf.getCanvas()
        acc = None
        for i in range(nsub):
            ts = t + ((i + 0.5) / nsub - 0.5) * (shutter / self.fps) if nsub > 1 else t
            self.draw(c, clamp(ts, 0, self.dur))
            arr = self.surf.makeImageSnapshot().toarray(
                colorType=skia.kRGBA_8888_ColorType, alphaType=skia.kUnpremul_AlphaType)[:, :, :3]
            acc = arr.astype(np.uint16) if acc is None else acc + arr
        return (acc // nsub).astype(np.uint8)

    def stills(self, times, outdir='stills', nsub=6):
        from PIL import Image
        os.makedirs(outdir, exist_ok=True)
        paths = []
        for t in times:
            p = os.path.join(outdir, f't_{t:05.2f}.png')
            Image.fromarray(self.frame(t, nsub)).save(p)
            paths.append(p)
        return paths

    def video(self, out, nsub=6, shutter=0.5, crf=14, preset='medium', workers=1):
        """Encode silent H.264 (yuv420p, BT.709-tagged so colours match what you designed)."""
        global _ACTIVE
        n = int(round(self.dur * self.fps))
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
               '-s', f'{self.W}x{self.H}', '-r', str(self.fps), '-i', '-',
               '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
               '-c:v', 'libx264', '-preset', preset, '-crf', str(crf),
               '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
               '-movflags', '+faststart', out]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        t0 = time.time()
        jobs = [(f / self.fps, nsub, shutter) for f in range(n)]
        if workers > 1:
            import multiprocessing as mp
            _ACTIVE = self
            with mp.get_context('fork').Pool(workers) as pool:
                for f, data in enumerate(pool.imap(_worker, jobs, chunksize=4)):
                    proc.stdin.write(data)
                    if f % 30 == 0: print(f'frame {f}/{n}  {time.time() - t0:.0f}s', flush=True)
        else:
            for f, job in enumerate(jobs):
                proc.stdin.write(self.frame(*job).tobytes())
                if f % 30 == 0: print(f'frame {f}/{n}  {time.time() - t0:.0f}s', flush=True)
        proc.stdin.close(); proc.wait()
        print(f'done {time.time() - t0:.0f}s -> {out}', flush=True)

def mux(video, audio, out):
    """Attach audio without re-encoding video, so audio can be iterated cheaply."""
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', video, '-i', audio, '-c:v', 'copy',
                    '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
                    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], check=True)
