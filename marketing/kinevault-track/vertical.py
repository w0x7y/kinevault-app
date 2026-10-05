"""Native 9:16 composition of the KineVault Track ad.

Uses the same assets, physics, beat timing, and saved ElevenLabs narration.
Run: .venv/bin/python vertical.py still | video | poster
"""
import argparse
import math
import subprocess

from PIL import Image
import reel as r

mk, skia, ROOT = r.mk, r.skia, r.ROOT
W, H = 1080, 1920
FLOOR = 1500
PHONE_X = 515
GRAPH = (110, 1450, 750, 160)
TRANSITIONS = [
    (r.FOOD, (500, 1340)),
    (r.WORKOUT, (155, 1070)),
    (r.PROGRESS, (480, 1440)),
    (r.CLOSE, (860, 1463)),
]


def footer(c, index, dark=False):
    color = r.ICE if dark else r.INK
    for i in range(5):
        r.rr(c, 433 + i * 39, 1660, 26 if i == index else 10, 5, 2.5,
             color, .85 if i == index else .20)


def open_scene(c, t):
    c.clear(mk.color4f(r.INK))
    r.headline(c, ['small', 'steps.'], 88, 370, 200, r.ICE, t, -.12, 192)
    r.text(c, 'food. workouts. progress.', 94, 660, 30, r.SKY,
           alpha=mk.ease_out_cubic(mk.prog(t, .65, 1.10)))
    c.save()
    # The ball enters its own stage, below the headline.
    c.clipRect(mk.rect(60, 760, 965, 1540))
    length = 660 * mk.ease_out_expo(mk.prog(t, 0, .4))
    c.drawLine(170, FLOOR, 170 + length, FLOOR, mk.P(r.SKY, .4, 3, 'round'))
    for ti, strength, *_ in r.BOUNCE.imp:
        tau = t - ti
        if 0 < tau < .45:
            r.arc(c, 500, FLOOR, 170 + tau * 420, 180, 180, r.SKY, 2,
                  (1 - tau / .45) * strength * .5)
    sx, sy = r.BOUNCE.scale(t)
    yy = min(FLOOR - r.ORB_R - r.BOUNCE.height(t), FLOOR - r.ORB_R * sy)
    if t < r.FOOD:
        r.orb(c, 500, yy, r.ORB_R, sx, sy)
    if t > 1.15:
        tau = mk.prog(t, 1.15, 1.65)
        r.arc(c, 500, yy, r.ORB_R + 40, -90, 310 * mk.ease_out_expo(tau), r.SKY, 2, .45)
    c.restore()
    footer(c, 0, True)


def food_scene(c, t):
    c.clear(mk.color4f(r.ICE))
    r.headline(c, ['fuel', 'your day.'], 88, 350, 150, r.INK, t, r.FOOD + .15, 145)
    r.text(c, 'log food & meals', 94, 590, 34, r.INK,
           alpha=mk.ease_out_cubic(mk.prog(t, r.FOOD + .6, r.FOOD + .95)))
    u = mk.spring(t - r.FOOD - .18, .65, 16)
    if u > 0:
        r.arc(c, PHONE_X, 1120, 375 * u, -132, 284, r.BLUE, 3, .19)
        r.arc(c, PHONE_X, 1120, 405 * u, -140, 180, r.SKY, 2, .27)
    r.phone(c, 'home', t, r.FOOD, x=PHONE_X, y=1120, rotation=-5, scale=.94)
    c.save()
    c.translate(-660, 700)
    c.scale(.82, .82)
    r.food_card(c, t)
    c.restore()
    if r.FOOD + r.WIPE <= t < r.WORKOUT:
        p = mk.ease_out_cubic(mk.prog(t, r.FOOD, r.FOOD + .72))
        r.orb(c, mk.lerp(500, 155, p), mk.lerp(1340, 1070, p), mk.lerp(160, 72, p))
    footer(c, 1)


def workout_scene(c, t):
    c.clear(mk.color4f(r.BLUE))
    r.headline(c, ['make every', 'rep count.'], 88, 342, 132, r.ICE, t, r.WORKOUT + .12, 135)
    r.text(c, 'save sets, reps & weight', 94, 579, 32, r.ICE,
           alpha=mk.ease_out_cubic(mk.prog(t, r.WORKOUT + .55, r.WORKOUT + .9)))
    r.phone(c, 'workout', t, r.WORKOUT, x=PHONE_X, y=1110, rotation=4, scale=.94)
    u = mk.spring(t - r.WORKOUT - .08, .55, 16)
    if u > 0 and r.WORKOUT + r.WIPE <= t < r.PROGRESS:
        c.save()
        c.translate(480, 1440 + 80 * (1 - u))
        c.scale(u, u)
        r.plate(c, 0, 0, 120, t - r.WORKOUT)
        c.restore()
    if t > r.WORKOUT + .75:
        p = mk.spring(t - r.WORKOUT - .75, .55, 22)
        if p > 0:
            c.save()
            c.translate(690, 1260 + (1 - p) * 95)
            c.scale(.8 * p, .8 * p)
            r.rr(c, -156, -51, 300, 102, 20, r.INK)
            r.check(c, -114, 0, 23, r.SKY)
            r.text(c, 'set saved', -73, 10, 28, r.ICE, 'display')
            c.restore()
    footer(c, 2, True)


def progress_scene(c, t):
    c.clear(mk.color4f(r.ICE))
    r.headline(c, ['see it', 'add up.'], 88, 350, 150, r.INK, t, r.PROGRESS + .12, 145)
    r.text(c, 'follow your workout history', 94, 590, 28, r.INK,
           alpha=mk.ease_out_cubic(mk.prog(t, r.PROGRESS + .5, r.PROGRESS + .85)))
    r.phone(c, 'progress', t, r.PROGRESS, x=PHONE_X, y=1040, rotation=-3, scale=.82)
    p = mk.ease_in_out_cubic(mk.prog(t, r.PROGRESS + .50, r.PROGRESS + 1.50))
    x, y = r.chart(c, *GRAPH, p, r.BLUE, labels=False)
    if t >= r.PROGRESS + r.WIPE:
        r.orb(c, x, y, 30)
    footer(c, 3)


def close_scene(c, t):
    c.clear(mk.color4f(r.INK))
    p = mk.ease_out_cubic(mk.prog(t, r.CLOSE, r.DURATION))
    c.save()
    c.translate(510, 940)
    c.scale(1 + .035 * p, 1 + .035 * p)
    c.translate(-510, -940)
    r.headline(c, ['a little better.', 'every day.'], 88, 352, 120, r.ICE, t, r.CLOSE + .16, 132)
    u = mk.spring(t - r.CLOSE - .28, .65, 16)
    if u > 0:
        c.drawCircle(510, 1110, 260 * u, mk.P(r.BLUE))
        r.arc(c, 510, 1110, 288 * u, -90, 310, r.SKY, 2, .4)
        tau = t - r.WINK
        nod = mk.damped_wobble(tau, 2.8, 7, 18)
        jump = 48 * math.sin(math.pi * mk.prog(t, r.WINK, r.WINK + .40)) if r.WINK < t < r.WINK + .40 else 0
        sy = 1 - .07 * math.exp(-((tau - .4) / .065) ** 2)
        r.mascot(c, 'welcome', 510, 1440 - jump + (1 - u) * 120, 640 * u, -nod, squash=sy)
    alpha = mk.ease_out_cubic(mk.prog(t, r.CLOSE + .64, r.CLOSE + 1.0))
    r.text(c, 'KineVault', 242, 688, 62, r.ICE, 'brand', alpha)
    if alpha > 0:
        c.save()
        c.translate(651, 644)
        c.scale(alpha, alpha)
        r.pill(c, 'Track', 0, 0, 136, r.SKY, r.INK, 28)
        c.restore()
    r.text(c, 'food · workouts · progress', 510, 1540, 28, r.SKY, alpha=alpha, align='center')
    c.restore()
    footer(c, 4, True)


SCENES = [open_scene, food_scene, workout_scene, progress_scene, close_scene]


def transition_hero(c, index, t, start):
    p = mk.ease_out_cubic(mk.prog(t, start, start + r.WIPE))
    if index == 0:
        r.orb(c, mk.lerp(500, 155, p), mk.lerp(1340, 1070, p), mk.lerp(160, 72, p))
    elif index == 1:
        x, y, radius = mk.lerp(155, 480, p), mk.lerp(1070, 1440, p), mk.lerp(72, 120, p)
        r.orb(c, x, y, radius, color=mk.mix(r.BLUE, r.INK, p))
        r.arc(c, x, y, radius * .82, -90, 360 * p, r.SKY, 3, .35)
        c.drawCircle(x, y, radius * .15 * p, mk.P(r.ICE))
        r.text(c, '12', x, y - radius * .26, 42, r.ICE, 'display', p, align='center')
        if p > .85:
            c.save()
            c.translate(x, y)
            r.plate(c, 0, 0, 120, t - r.WORKOUT)
            c.restore()
    elif index == 2:
        x, y, radius = mk.lerp(480, GRAPH[0], p), mk.lerp(1440, GRAPH[1] + GRAPH[3] * .92, p), mk.lerp(120, 30, p)
        r.orb(c, x, y, radius, color=mk.mix(r.INK, r.BLUE, p))


def draw(c, t):
    current = 0
    for i, (start, _) in enumerate(TRANSITIONS):
        if t >= start + r.WIPE:
            current = i + 1
    SCENES[current](c, t)
    if current < len(TRANSITIONS):
        start, (x, y) = TRANSITIONS[current]
        if start <= t < start + r.WIPE:
            p = mk.ease_in_out_cubic(mk.prog(t, start, start + r.WIPE))
            radius = math.hypot(max(x, W - x), max(y, H - y)) * 1.05 * p
            c.save()
            c.clipPath(mk.circle_path(x, y, radius), True)
            SCENES[current + 1](c, t)
            c.restore()
            transition_hero(c, current, t, start)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['still', 'video', 'poster'])
    args = parser.parse_args()
    renderer = mk.Renderer(draw, W, H, r.FPS, r.DURATION)
    if args.mode == 'still':
        paths = renderer.stills(r.STILLS, str(ROOT / 'stills-vertical'), nsub=6)
        subprocess.run([r.sys.executable, str(ROOT / 'lib/contact_sheet.py'),
                        str(ROOT / 'storyboard-vertical.png'), *paths,
                        '--cols', '5', '--thumb', '270'], check=True)
    elif args.mode == 'poster':
        Image.fromarray(renderer.frame(r.CLOSE + 1.20, 6)).save(ROOT / 'poster-vertical.png')
    else:
        renderer.video(str(ROOT / 'silent-vertical.mp4'), nsub=6, workers=6, crf=14, preset='medium')
        mk.mux(str(ROOT / 'silent-vertical.mp4'), str(ROOT / 'elevenlabs/mix.wav'),
               str(ROOT / 'kinevault-track-vertical.mp4'))
        print('vertical final ready', flush=True)
