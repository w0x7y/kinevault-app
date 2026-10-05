# KineVault Track motion ad

The concept is "small steps, visible progress." A blue orb becomes a weight plate, then a workout-volume graph point. The final blue seal frames the original Kine mascot.

`kinevault-track-landscape.mp4` is the finished 1920 × 1080, 60 fps, 11-second H.264 video with AAC audio. Narration is ElevenLabs Jessica, generated as one continuous, expressive take. The voice talks to the viewer while the animation illustrates food logging, workouts, and progress. Scene timing follows the speech. No internal pauses are inserted and the take is not time-stretched.

The two top labels are removed. `kinevault-track-vertical.mp4` is the native 1080 × 1920, 9:16 version for short-form social video. It rearranges the headlines, phone panels, graph, and mascot to fit the portrait frame. Both versions have the same duration, 60 fps, and audio. The included player switches between formats.

`poster.png` is the closing composition. `BRIEF.md` records the design and timeline. `VOICE.md` contains the spoken script and performance settings. `reel.py` owns picture timing, physics, and sound triggers. `elevenlabs_voice.py` mixes the cached narration and score without making API calls.

The app panels are vector illustrations of implemented KineVault Track features, with sample records. Kine artwork and Comfortaa come from the existing Application assets. Bricolage Grotesque is from Google Fonts. Font licenses are included. The six ad colors do not replace the app's theme.

## Re-render

Requires Python 3.9 or newer, ffmpeg and ffprobe with libx264, and the packages in requirements.txt.

```bash
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python reel.py still
.venv/bin/python reel.py video --workers 6 --samples 6
.venv/bin/python reel.py poster
.venv/bin/python vertical.py still
.venv/bin/python vertical.py video
.venv/bin/python vertical.py poster
```

The render automatically mixes the saved ElevenLabs take selected in `voice-selection.json`. To revise only the synthesized score, run these commands. They do not regenerate speech or incur API charges.

```bash
.venv/bin/python reel.py audio
.venv/bin/python elevenlabs_voice.py
```

Narration is stored in `elevenlabs/jessica-continuous.mp3`, public generation settings in `elevenlabs/request.json`, and the mixed waveform in `elevenlabs/mix.wav`. Credentials are stored outside this project in the configured MCP server. The score is synthesized. Timing and levels were checked, but audio was not auditioned by the agent.

## Verify

```bash
.venv/bin/python lib/verify_video.py kinevault-track-landscape.mp4 \
  --duration 11 --fps 60 --size 1920x1080 \
  --times 0 .53 2.63 3.6 4.15 5.15 5.75 6.7 7.5 8.4 10.95 \
  --expect 40,500,18,30,48@0.5 \
  --expect 40,500,238,244,251@3.6 \
  --expect 40,500,54,124,246@5.15 \
  --expect 40,500,18,30,48@10.95 --outdir check
```

`verification.txt` records the encoded-file checks. Inspect `check/sheet.png` for sampled frames. `elevenlabs/mix-report.json` records the audio duration, placement, peak, and RMS. The source archive includes cached narration, fonts, artwork, and render helpers. It excludes credentials, the virtual environment, and intermediate videos.

For the vertical export, run the same verification command with `kinevault-track-vertical.mp4`, `--size 1080x1920`, `--outdir check-vertical`, and color sample coordinates `40,900`. `verification-vertical.txt` records that check. `vertical.py` owns the portrait composition and imports the shared assets and timeline from `reel.py`. For platform format references, see [TikTok's 9:16 guidance](https://ads.tiktok.com/resources/help/article/tiktok-auction-in-feed-ads?lang=en-GB), [Meta's Reels guidance](https://www.facebook.com/business/ads/facebook-instagram-reels-ads), and [YouTube's vertical Shorts guidance](https://support.google.com/youtube/answer/15424877?hl=en).

To preview, run `python3 preview.py` here, then open http://127.0.0.1:8765. Byte-range support allows video seeking. Previous Microsoft auditions and ad versions remain available for comparison, but the current render uses ElevenLabs only.
