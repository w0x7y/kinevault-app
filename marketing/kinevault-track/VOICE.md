# Continuous ElevenLabs narration

Voice: Jessica, Playful, Bright, Warm. Model: Eleven v4. Generated through the ElevenLabs MCP server as a single request, with stability 0.5, similarity 0.75, style 0.25, speaker boost off, and generation speed 1.04.

> You don't need a perfect day to feel good about it. Log your meals, get your reps in, and watch those little wins add up with Kine Vault Track. Come on, you've got this!

The request uses `[warmly]`, `[upbeat]`, and `[encouraging]` delivery tags. These are performance directions, with no explicit pause tags. ElevenLabs documents this control in its [speech best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices).

`elevenlabs/jessica-continuous.mp3` is the original take. It starts at 0.15 seconds in the ad. There are no inserted internal gaps, individual sentence clips, or post-generation tempo changes. Five-millisecond fades affect only the take's first and last samples. The original 9.76-second take fits inside the 11-second video.

`elevenlabs/alignment.json` records word timing returned by ElevenLabs forced alignment. The picture transitions at 2.50, 4.00, 5.50, and 7.30 seconds. The sound score stays ducked throughout the full take, including breaths, so it does not pump between words.

`elevenlabs/request.json` stores public generation settings. It contains no credentials. `voice-selection.json` selects the cached audio. Re-running `.venv/bin/python elevenlabs_voice.py` remixes that audio without calling a paid service. `reel.py video` also reapplies this take after rendering.

Timing, silence durations, mix levels, and the encoded file are checked. The agent has not listened to the audio. Earlier Microsoft auditions remain in `voice-samples/` for reference; they are not used in the current ad.
