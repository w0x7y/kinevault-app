"""Mix the saved, continuous ElevenLabs take without making another API call.

Speech is never split, time-stretched, or silenced internally. Generation
credentials stay outside this directory. request.json has public settings only.
"""
import json
from pathlib import Path
import shutil
import subprocess
import wave

import numpy as np
from reel import DURATION

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'elevenlabs'
SR = 44100


def decode(path):
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path),
                             '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'],
                            check=True, capture_output=True)
    return np.frombuffer(result.stdout, dtype=np.float32).astype(np.float64)


def save_wav(path, samples):
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes((np.clip(samples, -.99, .99) * 32767).astype(np.int16).tobytes())


def mix():
    selection = json.loads((ROOT / 'voice-selection.json').read_text())
    speech = decode(ROOT / selection['audio_file'])
    peak = float(np.max(np.abs(speech)))
    if peak < .01:
        raise ValueError('Narration is empty or silent')
    speech *= .70 / peak
    # Five-millisecond edge fades only; preserve every internal breath and pause.
    fade = min(round(.005 * SR), len(speech) // 4)
    speech[:fade] *= np.linspace(0, 1, fade)
    speech[-fade:] *= np.linspace(1, 0, fade)
    total = round(DURATION * SR)
    offset = round(selection['offset_seconds'] * SR)
    finish = offset + len(speech)
    if offset < 0 or finish > total:
        raise ValueError('Extend the video timeline to fit the complete take')
    narration = np.zeros(total)
    narration[offset:finish] = speech
    score = decode(ROOT / 'audio.wav')
    if len(score) != total:
        raise ValueError('Regenerate the sound score for the current timeline')
    # One duck across the full take; no pumping between short word gaps.
    duck = np.ones(total)
    low = max(0, offset - round(.10 * SR))
    high = min(total, finish + round(.28 * SR))
    duck[offset:finish] = .25
    duck[low:offset] = np.linspace(1, .25, offset - low)
    duck[finish:high] = np.linspace(.25, 1, high - finish)
    mixed = narration + score * duck * .43
    mixed_peak = float(np.max(np.abs(mixed)))
    if mixed_peak >= .95:
        raise ValueError(f'Mix needs more headroom: {mixed_peak}')
    save_wav(OUT / 'narration.wav', narration)
    save_wav(OUT / 'mix.wav', mixed)
    destination = ROOT / 'kinevault-track-ad.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(ROOT / 'silent.mp4'),
                    '-i', str(OUT / 'mix.wav'), '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'copy', '-bsf:v',
                    'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
                    '-c:a', 'aac', '-b:a', '192k', '-t', str(DURATION),
                    '-movflags', '+faststart', str(destination)], check=True)
    shutil.copyfile(destination, ROOT / 'kinevault-track-elevenlabs-ad.mp4')
    shutil.copyfile(destination, ROOT / 'kinevault-track-landscape.mp4')
    report = dict(provider='elevenlabs', voice=selection['voice'],
                  continuous_take=True, inserted_internal_gaps=0,
                  post_generation_tempo=1.0, start=offset / SR, end=finish / SR,
                  take_duration=len(speech) / SR, video_duration=DURATION,
                  peak=mixed_peak, rms=float(np.sqrt(np.mean(mixed ** 2))),
                  audio_auditioned=False)
    (OUT / 'mix-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    mix()
