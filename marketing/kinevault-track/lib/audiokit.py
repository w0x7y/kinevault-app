"""
audiokit - numpy-only sound design synced to animation event times.

Pattern: the animation module exposes event times (impact times, transition starts,
letter-reveal times). The audio script IMPORTS those so sound can never drift from picture.

    import audiokit as ak
    m = ak.Mix(duration=10.0)
    m.add(0.786, ak.thump(0.9), 0.55)            # bounce impact
    m.add(2.55, ak.whoosh(0.7, 300, 7000), 0.22) # launch
    m.add(6.65, ak.pluck(440, 0.8, 0.22), 1.0)   # letter
    m.save('audio.wav')                          # reverb + fades + soft-clip + normalise
Then:  motionkit.mux('silent.mp4', 'audio.wav', 'final.mp4')

You cannot listen to the result, so ALWAYS print m.report() and sanity check it
(peak ~0.8, rms 0.05-0.12, no clipping) - see SKILL.md.
"""
import wave
import numpy as np
from scipy.signal import fftconvolve

SR = 44100
rng = np.random.default_rng(7)

def tt(d): return np.arange(int(d * SR)) / SR

def env_exp(d, tau, attack=0.003):
    t = tt(d)
    return np.exp(-t / tau) * np.minimum(1, t / attack)

# --------------------------------------------------------------- sources
def thump(strength=1.0, d=0.35):
    """Soft low impact: pitch-dropping sine + 4 ms click. Scale strength with impact strength."""
    t = tt(d)
    f = 55 + 120 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.085)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.004) * 0.25
    return (s + click) * strength

def _lowpass_sweep(x, f0, f1):
    y = np.zeros_like(x); z = 0.0; n = len(x)
    for i in range(n):
        f = f0 * (f1 / f0) ** (i / n)
        a = 1 - np.exp(-2 * np.pi * f / SR)
        z += a * (x[i] - z)
        y[i] = z
    return y

def whoosh(d, f0, f1, peak=0.5):
    """Filtered-noise swell. f0 < f1 rises (launch/reveal); f0 > f1 falls (drop/close).
    peak<1 puts the swell early, >1 late (use ~1.6 for an approaching build)."""
    y = _lowpass_sweep(rng.standard_normal(int(d * SR)), f0, f1)
    u = np.linspace(0, 1, len(y))
    y = y * np.sin(np.pi * u ** peak) ** 2
    return y / (np.max(np.abs(y)) + 1e-9)

def glide(d, f0, f1, amp=0.1, shape='tri'):
    """Sine pitch glide with triangle or ramp-up amplitude. Great for anticipation & wave sweeps."""
    t = tt(d); u = t / d
    f = f0 * (f1 / f0) ** u
    ph = 2 * np.pi * np.cumsum(f) / SR
    e = np.sin(np.pi * u) if shape == 'tri' else u ** 2
    return np.sin(ph) * e * amp

def pluck(freq, d=0.7, tau=0.2, amp=0.12):
    t = tt(d)
    s = (np.sin(2 * np.pi * freq * t)
         + 0.35 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.08)
         + 0.12 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t / 0.04))
    return s * env_exp(d, tau, 0.002) * amp

def blip(freq, amp=0.14):
    """Short UI-style tick. Use for morph steps, dots appearing, small confirmations."""
    t = tt(0.3)
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.07) + 0.3 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.03)
    return s * np.minimum(1, t / 0.002) * amp

PENTATONIC_A = [440.00, 523.25, 587.33, 659.25, 783.99, 880.00]   # A C D E G A - always consonant
CHORD_A_ADD9 = [(220.0, .11), (329.63, .09), (440.0, .09), (554.37, .07), (659.25, .06), (880.0, .04)]

# --------------------------------------------------------------- mixer
class Mix:
    def __init__(self, duration):
        self.n = int(SR * duration)
        self.buf = np.zeros(self.n, np.float64)
        self.out = None

    def add(self, t0, sig, gain=1.0):
        i = int(t0 * SR)
        if i >= self.n or i < 0: return
        j = min(self.n, i + len(sig))
        self.buf[i:j] += sig[:j - i] * gain

    def finalize(self, reverb=0.22, room=0.16, fade_out=0.5, ceiling=0.8):
        n = self.n
        ir_t = np.arange(int(0.7 * SR)) / SR
        ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / room)
        ir[:int(0.004 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        out = self.buf + reverb * fftconvolve(self.buf, ir)[:n]
        fade = np.ones(n)
        fi, fo = int(0.005 * SR), int(fade_out * SR)
        fade[:fi] = np.linspace(0, 1, fi)
        fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
        out = np.tanh(out * fade * 1.1)
        self.out = out * (ceiling / (np.max(np.abs(out)) + 1e-12))
        return self.out

    def report(self):
        o = self.out if self.out is not None else self.finalize()
        # loudness by half-second so you can see the shape of the mix without listening
        bars = [float(np.sqrt(np.mean(o[i:i + SR // 2] ** 2))) for i in range(0, self.n, SR // 2)]
        return {'peak': float(np.max(np.abs(o))), 'rms': float(np.sqrt(np.mean(o ** 2))),
                'rms_per_half_second': [round(b, 3) for b in bars]}

    def save(self, path, **kw):
        o = self.finalize(**kw)
        with wave.open(path, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((o * 32767).astype(np.int16).tobytes())
        return self.report()
