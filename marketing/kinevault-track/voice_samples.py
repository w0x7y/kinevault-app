"""Generate conversational female narration and place it on the ad timeline.

Each line is synthesized separately and placed on the existing beat. Rate
adjustments only shorten lines that would otherwise overlap the next scene.
"""
import argparse
import asyncio
import json
from pathlib import Path
import socket
import sys
import subprocess
import shutil
import wave

import aiohttp
import edge_tts
import numpy as np
from reel import FOOD, WORKOUT, PROGRESS, CLOSE, DURATION

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'voice-samples'
SR = 44100
LINES = [
    (.16, FOOD + .08, "Busy day? Let's make it yours."),
    (FOOD + .20, WORKOUT - .09, "That meal? Let's log it."),
    (WORKOUT + .20, PROGRESS - .10, "One more rep? You've got this!"),
    (PROGRESS + .20, CLOSE - .10, "Hey, look at you go! That's progress."),
    (CLOSE + .24, DURATION - .06, "Kine Vault Track. Let's make today yours!"),
]
VOICES = {
    'upbeat': dict(voice='en-US-JennyNeural', rate='+10%', pitch='+5Hz'),
    'natural': dict(voice='en-US-AvaMultilingualNeural', rate='+4%', pitch='+0Hz'),
}
# Curiosity -> easy warmth -> encouragement -> delight -> inviting finish.
# Punctuation supplies the question and exclamation contours; prosody varies
# by beat instead of keeping the same elevated pitch and rate throughout.
PERFORMANCE = [
    dict(direction='curious, then reassuring', rate='+8%', pitch='+3Hz'),
    dict(direction='relaxed and warm', rate='+4%', pitch='+2Hz'),
    dict(direction='playful encouragement', rate='+14%', pitch='+9Hz'),
    dict(direction='pleased surprise', rate='+6%', pitch='+8Hz'),
    dict(direction='confident, inviting finish', rate='+8%', pitch='+4Hz'),
]


def voice_settings(kind, i):
    settings = dict(VOICES[kind])
    if kind == 'upbeat':
        settings.update({k: v for k, v in PERFORMANCE[i].items() if k != 'direction'})
    return settings


def run(*args):
    return subprocess.run(list(args), check=True, capture_output=True)


def decode(path, speed=1):
    filters = ['silenceremove=start_periods=1:start_duration=0.015:start_threshold=-45dB',
               'areverse',
               'silenceremove=start_periods=1:start_duration=0.04:start_threshold=-45dB',
               'areverse']
    if speed > 1: filters.append(f'atempo={speed:.6f}')
    result = run('ffmpeg', '-v', 'error', '-i', str(path), '-af', ','.join(filters),
                 '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-')
    return np.frombuffer(result.stdout, dtype=np.float32).copy()


def save_wav(path, samples):
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes((np.clip(samples, -.99, .99) * 32767).astype(np.int16).tobytes())


async def generate(force=False, kinds=('upbeat',)):
    OUT.mkdir(exist_ok=True)
    semaphore = asyncio.Semaphore(3)
    async def one(kind, i, sentence):
        path = OUT / f'{kind}-{i:02}.mp3'
        request = dict(text=sentence, **voice_settings(kind, i))
        request_path = OUT / f'{kind}-{i:02}.request.json'
        cached = (path.exists() and path.stat().st_size > 1000 and request_path.exists()
                  and json.loads(request_path.read_text()) == request)
        if not force and cached: return
        async with semaphore:
            connector = aiohttp.TCPConnector(family=socket.AF_INET)
            communicate = edge_tts.Communicate(sentence, **voice_settings(kind, i),
                                              connector=connector,
                                              connect_timeout=10, receive_timeout=25)
            partial_path = path.with_suffix('.part.mp3')
            try:
                await asyncio.wait_for(communicate.save(str(partial_path)), 40)
                partial_path.replace(path)
                request_path.write_text(json.dumps(request, indent=2) + '\n')
            finally:
                await connector.close()
        print(f'generated {kind} line {i + 1}', flush=True)
    await asyncio.gather(*(one(kind, i, sentence)
                          for kind in kinds for i, (_, _, sentence) in enumerate(LINES)))


def assemble(kinds=('upbeat',)):
    score_result = run('ffmpeg', '-v', 'error', '-i', str(ROOT / 'audio.wav'),
                       '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-')
    score = np.frombuffer(score_result.stdout, dtype=np.float32)
    report_path = OUT / 'timing-report.json'
    reports = json.loads(report_path.read_text()) if report_path.exists() else {}
    for kind in kinds:
        narration = np.zeros(round(DURATION * SR), dtype=np.float64)
        duck = np.ones_like(narration)
        report = []
        for i, (start, end, sentence) in enumerate(LINES):
            path = OUT / f'{kind}-{i:02}.mp3'
            samples = decode(path)
            raw_duration = len(samples) / SR
            available = end - start
            speed = max(1, raw_duration / available * 1.015)
            if speed > 1.45: raise ValueError(f'{kind} line {i} needs too much compression: {speed}')
            if speed > 1: samples = decode(path, speed)
            peak = float(np.max(np.abs(samples)))
            if peak < .01: raise ValueError('Empty narration')
            samples *= .67 / peak
            fade = min(220, len(samples) // 4)
            samples[:fade] *= np.linspace(0, 1, fade)
            samples[-fade:] *= np.linspace(1, 0, fade)
            offset = round(start * SR)
            finish = offset + len(samples)
            assert finish <= round(end * SR)
            narration[offset:finish] += samples
            # Give speech a 100ms lead-in and 180ms release in the score duck.
            low, high = max(0, offset - round(.10 * SR)), min(len(duck), finish + round(.18 * SR))
            attack, release = offset - low, high - finish
            envelope = np.full(high - low, .31)
            if attack: envelope[:attack] = np.linspace(1, .31, attack)
            if release: envelope[-release:] = np.linspace(.31, 1, release)
            duck[low:high] = np.minimum(duck[low:high], envelope)
            report.append(dict(text=sentence, start=start, end=finish / SR,
                               raw_duration=round(raw_duration, 3), tempo=round(speed, 3),
                               settings=voice_settings(kind, i),
                               direction=PERFORMANCE[i]['direction']))
        save_wav(OUT / f'{kind}-narration.wav', narration)
        run('ffmpeg', '-y', '-v', 'error', '-i', str(OUT / f'{kind}-narration.wav'),
            '-c:a', 'libmp3lame', '-b:a', '192k', str(OUT / f'{kind}-voice.mp3'))
        mixed = narration + score * duck * .48
        peak = float(np.max(np.abs(mixed)))
        if peak > .89: mixed *= .89 / peak
        save_wav(OUT / f'{kind}-mix.wav', mixed)
        run('ffmpeg', '-y', '-v', 'error', '-i', str(ROOT / 'silent.mp4'),
            '-i', str(OUT / f'{kind}-mix.wav'), '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'copy', '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
            '-c:a', 'aac', '-b:a', '192k', '-t', str(DURATION), '-movflags', '+faststart',
            str(OUT / f'{kind}-ad.mp4'))
        reports[kind] = dict(settings=VOICES[kind], lines=report,
                             peak=float(np.max(np.abs(mixed))),
                             rms=float(np.sqrt(np.mean(mixed ** 2))))
        print(f'ready {kind}: peak {reports[kind]["peak"]:.3f}', flush=True)
    (OUT / 'timing-report.json').write_text(json.dumps(reports, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--mix-only', action='store_true')
    parser.add_argument('--regenerate', action='store_true')
    parser.add_argument('--style', choices=list(VOICES))
    parser.add_argument('--generate-only', action='store_true')
    parser.add_argument('--select', choices=list(VOICES))
    args = parser.parse_args()
    kinds = (args.style or args.select or 'upbeat',)
    if not args.mix_only: asyncio.run(generate(force=args.regenerate, kinds=kinds))
    if args.generate_only:
        sys.exit(0)
    assemble(kinds=kinds)
    if args.select:
        music_only = ROOT / 'kinevault-track-music-only.mp4'
        if not music_only.exists():
            shutil.copy2(ROOT / 'kinevault-track-ad.mp4', music_only)
        shutil.copy2(OUT / f'{args.select}-ad.mp4', ROOT / 'kinevault-track-ad.mp4')
        (ROOT / 'voice-selection.json').write_text(json.dumps(dict(style=args.select,
            settings=VOICES[args.select]), indent=2) + '\n')
        print(f'selected {args.select} for the final ad', flush=True)
