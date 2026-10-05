"""KineVault Track: an eleven-second, deterministic Skia motion ad.

Run: .venv/bin/python reel.py still | video | audio | poster
All visual and sound triggers are defined in the timeline below.
"""
from pathlib import Path
import argparse
import json
import math
import os
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'lib'))
os.environ.setdefault('FONTCONFIG_FILE', str(ROOT / 'assets/fonts/fonts.conf'))
os.environ.setdefault('FONTCONFIG_PATH', str(ROOT / 'assets/fonts'))
import skia
import numpy as np
from PIL import Image
import motionkit as mk
import audiokit as ak

# One palette and one timeline for picture and sound.
W, H, FPS, DURATION = 1920, 1080, 60, 11.0
INK, BLUE, ICE, SKY, AMBER, LILAC = [mk.hexc(h) for h in
    ('#121E30', '#367CF6', '#EEF4FB', '#79B7E8', '#E5B365', '#B69ADC')]
FOOD, WORKOUT, PROGRESS, CLOSE = 2.50, 4.00, 5.50, 7.30
WIPE = .62
HEADLINE_STAGGER = .065
PHONE_DELAY, CARD_DELAY = .12, .47
WINK = CLOSE + 1.37
FLOOR, ORB_R = 905, 160
BOUNCE = mk.Bounce(.04, 960, [(165, 1.0), (42, .55), (0, .22)])
STILLS = [0, .20, .53, .82, 1.30, FOOD + .13, FOOD + .55, FOOD + 1.10,
          WORKOUT - .30, WORKOUT + .15, WORKOUT + .60, WORKOUT + 1.15,
          PROGRESS - .25, PROGRESS + .25, PROGRESS + .65, PROGRESS + 1.20,
          CLOSE - .35, CLOSE + .20, CLOSE + .60, CLOSE + 1.10,
          WINK + .16, DURATION - .05]
FONT_SIZES = [18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 42, 44,
              48, 52, 56, 62, 68, 76, 84, 100, 120, 132, 142, 150,
              160, 170, 184, 200, 230, 250, 272]
FONTS = {(kind, size): mk.load_font(str(ROOT / 'assets/fonts' / file), size)
         for kind, file in [('display', 'display.ttf'), ('caption', 'caption.ttf'), ('brand', 'brand.ttf')]
         for size in FONT_SIZES}

def rgba_image(path):
    # Crop transparent padding once; original artwork is preserved.
    im = Image.open(path).convert('RGBA')
    im = im.crop(im.getbbox())
    return skia.Image.fromarray(np.asarray(im), colorType=skia.kRGBA_8888_ColorType,
                               alphaType=skia.kUnpremul_AlphaType)

MASCOTS = {pose: rgba_image(ROOT / 'assets/mascot' / f'{pose}.png')
           for pose in ('welcome', 'today', 'food', 'exercise', 'review')}
SAMPLING = skia.SamplingOptions(skia.FilterMode.kLinear)

def rr(c, x, y, w, h, r, color, alpha=1, stroke=None):
    c.drawRoundRect(mk.rect(x, y, x + w, y + h), r, r, mk.P(color, alpha, stroke))

def text(c, s, x, y, size, color=INK, kind='caption', alpha=1, align='left'):
    f = FONTS[kind, size]
    if align == 'center': x -= f.measureText(s) / 2
    if align == 'right': x -= f.measureText(s)
    c.drawString(s, x, y, f, mk.P(color, alpha))

def tracked(c, s, x, y, size, color, tracking=3, alpha=1):
    f = FONTS['caption', size]
    for ch in s:
        c.drawString(ch, x, y, f, mk.P(color, alpha))
        x += f.measureText(ch) + tracking

def headline(c, lines, x, y, size, color, t, trigger, leading=None):
    leading = leading or size * .94
    for row, s in enumerate(lines):
        baseline = y + row * leading
        font = FONTS['display', size]
        c.save()
        c.clipRect(mk.rect(x - 40, baseline - size * 1.12, 1910, baseline + 13))
        xpos = x
        for i, ch in enumerate(s):
            tau = t - trigger - row * .105 - i * HEADLINE_STAGGER * .45
            rise = (1 - mk.spring(tau, .55, 22)) * size * 1.3
            if tau > 0:
                c.drawString(ch, xpos, baseline + rise, font, mk.P(color))
            xpos += font.measureText(ch) - size * .035
        c.restore()

def mascot(c, pose, x, y, height, angle=0, alpha=1, squash=1):
    im = MASCOTS[pose]
    width = height * im.width() / im.height()
    c.save()
    c.translate(x, y)
    c.rotate(angle)
    c.scale(1 / squash, squash)
    c.drawImageRect(im, mk.rect(-width / 2, -height, width / 2, 0),
                    SAMPLING, mk.P(ICE, alpha))
    c.restore()

def orb(c, x, y, r, sx=1, sy=1, color=BLUE, alpha=1):
    if r < .1: return
    c.save()
    c.translate(x, y)
    c.scale(sx, sy)
    # Shading belongs to the recurring object, never to a background.
    p = mk.P(color, alpha)
    p.setShader(skia.GradientShader.MakeRadial(
        skia.Point(-r * .32, -r * .38), r * 1.6,
        [mk.color4f(mk.mix(color, ICE, .48)).toColor(),
         mk.color4f(color).toColor(), mk.color4f(mk.mix(color, INK, .42)).toColor()],
        [0, .52, 1]))
    c.drawCircle(0, 0, r, p)
    c.drawArc(mk.rect(-r * .77, -r * .77, r * .77, r * .77),
              207, 72, False, mk.P(ICE, .3 * alpha, max(1, r * .035), 'round'))
    c.restore()

def check(c, x, y, size, color=BLUE, alpha=1):
    p = skia.Path()
    p.moveTo(x - size * .45, y)
    p.lineTo(x - size * .10, y + size * .30)
    p.lineTo(x + size * .50, y - size * .40)
    c.drawPath(p, mk.P(color, alpha, max(2, size * .13), 'round'))

def footer(c, t, index, dark=False):
    col = ICE if dark else INK
    text(c, 'KineVault Track', 122, 1007, 24, col, 'brand', .7)
    for i in range(5):
        rr(c, 1585 + i * 39, 989, 26 if i == index else 10, 5, 2.5, col,
           .85 if i == index else .2)

def furniture(c, color, dark=False):
    col = ICE if dark else INK
    c.drawLine(120, 112, 1800, 112, mk.P(col, .13, 1))

def arc(c, x, y, r, start, sweep, color, width=10, alpha=1):
    if sweep > .01:
        c.drawArc(mk.rect(x - r, y - r, x + r, y + r), start, sweep,
                  False, mk.P(color, alpha, width, 'round'))

def pill(c, label, x, y, w, color=BLUE, text_color=ICE, size=22):
    rr(c, x, y, w, 48, 24, color)
    text(c, label, x + w / 2, y + 32, size, text_color, align='center')

def ui_bar(c, label, amount, x, y, color, fraction, u):
    text(c, label, x, y, 20)
    text(c, amount, x + 218, y, 18, color, align='right')
    rr(c, x, y + 12, 218, 9, 4.5, INK, .08)
    rr(c, x, y + 12, max(.1, 218 * fraction * u), 9, 4.5, color)

def chart(c, x, y, w, h, p, color=BLUE, dark=False, labels=True):
    foreground = ICE if dark else INK
    for j in range(4):
        yy = y + h * j / 3
        c.drawLine(x, yy, x + w, yy, mk.P(foreground, .10, 1.2))
    nodes = [(0, .92), (.17, .71), (.34, .79), (.50, .45), (.68, .50), (.84, .24), (1, .08)]
    # Piecewise cubic ease keeps the graph point at a reproducible position.
    total = mk.clamp(p) * (len(nodes) - 1)
    seg = min(int(total), len(nodes) - 2)
    frac = mk.ease_in_out_cubic(total - seg)
    px = mk.lerp(nodes[seg][0], nodes[seg + 1][0], frac)
    py = mk.lerp(nodes[seg][1], nodes[seg + 1][1], frac)
    coords = nodes[:seg + 1] + [(px, py)]
    path = skia.Path()
    path.moveTo(x + coords[0][0] * w, y + coords[0][1] * h)
    for a, b in coords[1:]: path.lineTo(x + a * w, y + b * h)
    area = skia.Path(path)
    area.lineTo(x + px * w, y + h)
    area.lineTo(x, y + h)
    area.close()
    c.drawPath(area, mk.P(color, .065))
    c.drawPath(path, mk.P(color, 1, 6, 'round'))
    for i, (a, b) in enumerate(nodes):
        if i <= total:
            c.drawCircle(x + a * w, y + b * h, 5, mk.P(color))
    c.drawCircle(x + px * w, y + py * h, 13, mk.P(color, .15))
    c.drawCircle(x + px * w, y + py * h, 6, mk.P(color))
    if labels:
        for a, label in [(0, 'week 1'), (.5, 'week 3'), (1, 'week 6')]:
            text(c, label, x + a * w, y + h + 27, 18, foreground, alpha=.55,
                 align='center' if a == .5 else 'right' if a == 1 else 'left')
    return x + px * w, y + py * h

def phone_home(c, t):
    rr(c, 20, 116, 430, 225, 22, ICE)
    text(c, 'today', 42, 153, 28, kind='brand')
    u = mk.ease_out_cubic(mk.prog(t, FOOD + .32, FOOD + 1.05))
    for idx, (label, amount, color, fraction) in enumerate([
        ('carbs', '186 / 275 g', AMBER, .68), ('protein', '98 / 138 g', BLUE, .71),
        ('fat', '61 / 61 g', LILAC, 1)]):
        ui_bar(c, label, amount, 42, 198 + idx * 54, color, fraction, u)
    mascot(c, 'today', 367, 321, 161)
    rr(c, 20, 354, 430, 126, 20, ICE)
    text(c, 'calories', 42, 393, 22)
    text(c, '1,680', 42, 439, 40, kind='display')
    text(c, '/ 2,200 kcal', 192, 438, 20, alpha=.65)
    rr(c, 42, 453, 386, 9, 4.5, INK, .08)
    rr(c, 42, 453, max(.1, 294 * u), 9, 4.5, BLUE)
    rr(c, 20, 493, 430, 139, 20, ICE)
    text(c, 'workout', 42, 532, 22)
    text(c, 'upper body', 42, 573, 28, kind='brand')
    text(c, '9 sets    30 min', 42, 612, 20, alpha=.65)
    for xx, title, value, detail in [(20, 'water', '1.5', 'litres'), (243, 'volume', '1,080', 'kg lifted')]:
        rr(c, xx, 645, 207, 141, 20, ICE)
        text(c, title, xx + 22, 682, 20)
        text(c, value, xx + 22, 730, 40, BLUE, 'display')
        text(c, detail, xx + 22, 762, 18, alpha=.6)

def phone_workout(c, t):
    text(c, 'exercise', 25, 147, 30, kind='brand')
    mascot(c, 'exercise', 369, 286, 130)
    rr(c, 22, 174, 232, 62, 18, BLUE)
    text(c, 'upper body', 138, 213, 24, ICE, align='center')
    text(c, 'workout in progress', 24, 272, 18, alpha=.65)
    rr(c, 20, 304, 430, 440, 22, ICE)
    text(c, 'dumbbell curl', 42, 348, 28, kind='brand')
    text(c, 'sets', 46, 397, 18, alpha=.55)
    text(c, 'reps', 199, 397, 18, alpha=.55)
    text(c, 'kg', 325, 397, 18, alpha=.55)
    for i in range(3):
        u = mk.spring(t - WORKOUT - .52 - .12 * i, .55, 22)
        if u <= 0: continue
        c.save()
        c.translate(0, (1 - u) * 36)
        yy = 420 + i * 94
        rr(c, 39, yy, 393, 74, 16, BLUE, .055)
        text(c, str(i + 1).zfill(2), 59, yy + 47, 26, BLUE, 'display')
        text(c, '10', 211, yy + 47, 28, kind='display', align='center')
        text(c, '12', 334, yy + 47, 28, kind='display', align='center')
        check(c, 406, yy + 37, 16)
        c.restore()
    pill(c, 'end workout', 32, 770, 406)

def phone_progress(c, t):
    text(c, 'personal journal', 235, 148, 28, kind='brand', align='center')
    rr(c, 187, 171, 96, 96, 48, SKY, .20)
    mascot(c, 'welcome', 235, 262, 82)
    text(c, 'your progress', 235, 307, 26, kind='brand', align='center')
    text(c, 'overview     goals     photos', 235, 351, 20, alpha=.65, align='center')
    rr(c, 20, 377, 430, 130, 20, ICE)
    text(c, 'tracking streak', 42, 416, 22)
    for i, label in enumerate('SMTWTFS'):
        xx = 63 + i * 57
        c.drawCircle(xx, 456, 18, mk.P(BLUE, .12))
        check(c, xx, 456, 14)
        text(c, label, xx, 492, 18, alpha=.55, align='center')
    rr(c, 20, 522, 430, 296, 20, ICE)
    text(c, 'workout volume', 42, 562, 22)
    text(c, 'your last 6 weeks', 42, 596, 18, alpha=.55)
    chart(c, 46, 622, 380, 136, mk.prog(t, PROGRESS + .36, PROGRESS + 1.38))

def phone(c, kind, t, trigger, x=1420, y=546, rotation=-6, scale=.98):
    u = mk.spring(t - trigger - PHONE_DELAY, .65, 16)
    if u <= 0: return
    c.save()
    c.translate(x + (1 - u) * 340, y + (1 - u) * 170)
    c.rotate(rotation * u)
    c.scale(scale * (.87 + .13 * u), scale * (.87 + .13 * u))
    c.translate(-250, -455)
    # Discrete offset layers make the physical device depth legible.
    for dx, dy, alpha in [(22, 26, .07), (13, 16, .10), (5, 8, .17)]:
        rr(c, dx, dy, 500, 910, 69, INK, alpha)
    rr(c, 0, 0, 500, 910, 68, INK)
    rr(c, 4, 4, 492, 902, 66, SKY, .32, 2)
    rr(c, 14, 14, 472, 882, 55, mk.mix(ICE, INK, .05))
    c.save()
    c.clipRRect(skia.RRect.MakeRectXY(mk.rect(14, 14, 486, 896), 55, 55), True)
    c.translate(15, 7)
    text(c, '9:41', 35, 57, 20, kind='brand')
    rr(c, 338, 37, 26, 13, 4, INK)
    rr(c, 374, 37, 36, 13, 4, INK, 1, 2)
    rr(c, 379, 41, 23, 5, 2, INK)
    rr(c, 165, 20, 140, 35, 17, INK)
    text(c, '‹', 26, 98, 34)
    text(c, 'today', 235, 93, 20, align='center')
    c.drawCircle(429, 85, 18, mk.P(SKY, .6))
    if kind == 'home': phone_home(c, t)
    elif kind == 'workout': phone_workout(c, t)
    else: phone_progress(c, t)
    if kind != 'progress':
        c.drawLine(20, 831, 450, 831, mk.P(INK, .10, 1))
        for i, label in enumerate(('home', 'food', 'exercise', 'settings')):
            text(c, label, 65 + 110 * i, 861, 18,
                 BLUE if i == (2 if kind == 'workout' else 0) else INK,
                 alpha=1 if i == (2 if kind == 'workout' else 0) else .5, align='center')
    rr(c, 169, 877, 132, 5, 2.5, INK, .75)
    c.restore()
    c.restore()

def food_card(c, t):
    u = mk.spring(t - FOOD - CARD_DELAY, .55, 19)
    if u <= 0: return
    c.save()
    c.translate(925 + (1 - u) * 120, 752 + (1 - u) * 130)
    c.rotate(-5 * u)
    c.scale(u, u)
    rr(c, 9, 13, 470, 160, 24, INK, .13)
    rr(c, 0, 0, 470, 160, 24, ICE)
    rr(c, 0, 0, 470, 160, 24, INK, .12, 1)
    c.drawCircle(70, 78, 44, mk.P(SKY, .2))
    mascot(c, 'food', 70, 121, 91)
    text(c, 'lunch · saved', 132, 45, 20, BLUE)
    text(c, 'avocado toast', 132, 88, 28, kind='display')
    text(c, '384 kcal', 132, 123, 22, alpha=.65)
    check(c, 427, 42, 21)
    c.restore()

def scene_open(c, t):
    c.clear(mk.color4f(INK))
    furniture(c, INK, True)
    headline(c, ['small', 'steps.'], 117, 476, 272, ICE, t, -.12, 247)
    text(c, 'food. workouts. progress.', 128, 826, 32, SKY,
         alpha=mk.ease_out_cubic(mk.prog(t, .65, 1.10)))
    length = 590 * mk.ease_out_expo(mk.prog(t, 0, .4))
    c.drawLine(1100, FLOOR, 1100 + length, FLOOR, mk.P(SKY, .4, 3, 'round'))
    for ti, strength, *_ in BOUNCE.imp:
        tau = t - ti
        if 0 < tau < .45:
            r = 170 + tau * 420
            arc(c, 1410, FLOOR, r, 180, 180, SKY, 2, (1 - tau / .45) * strength * .5)
    sx, sy = BOUNCE.scale(t)
    yy = min(FLOOR - ORB_R - BOUNCE.height(t), FLOOR - ORB_R * sy)
    xx = 1380 + 65 * mk.ease_out_cubic(mk.prog(t, 0, 1.50))
    if t < FOOD: orb(c, xx, yy, ORB_R, sx, sy)
    # An orbital outline becomes the nutrition ring in the next scene.
    if t > 1.15:
        tau = mk.prog(t, 1.15, 1.65)
        arc(c, xx, yy, ORB_R + 40, -90, 310 * mk.ease_out_expo(tau), SKY, 2, .45)
    footer(c, t, 0, True)

def scene_food(c, t):
    c.clear(mk.color4f(ICE))
    furniture(c, ICE)
    headline(c, ['fuel', 'your day.'], 117, 398, 170, INK, t, FOOD + .15, 164)
    text(c, 'log food & meals', 126, 657, 34, INK,
         alpha=mk.ease_out_cubic(mk.prog(t, FOOD + .6, FOOD + .95)))
    text(c, 'keep your nutrition in view.', 126, 711, 26, INK,
         alpha=.62 * mk.ease_out_cubic(mk.prog(t, FOOD + .68, FOOD + 1)))
    u = mk.spring(t - FOOD - .18, .65, 16)
    if u > 0:
        arc(c, 1432, 526, 389 * u, -132, 284, BLUE, 3, .19)
        arc(c, 1432, 526, 423 * u, -140, 180, SKY, 2, .27)
    phone(c, 'home', t, FOOD)
    food_card(c, t)
    # The same orb arrives at the visible ring endpoint.
    p = mk.ease_out_cubic(mk.prog(t, FOOD, FOOD + .72))
    if FOOD + WIPE <= t < WORKOUT:
        orb(c, mk.lerp(1445, 1032, p), mk.lerp(745, 392, p), mk.lerp(160, 72, p))
    footer(c, t, 1)

def plate(c, x, y, r, t):
    c.save()
    c.translate(x, y)
    c.rotate(22 * math.exp(-max(0, t) * 6))
    rr(c, -360, -14, 720, 28, 14, ICE, .7)
    c.drawCircle(15, 8, r, mk.P(INK, .28))
    c.drawCircle(0, 0, r, mk.P(INK))
    c.drawCircle(0, 0, r * .82, mk.P(SKY, .35, 3))
    c.drawCircle(0, 0, r * .54, mk.P(SKY, .13, r * .18))
    c.drawCircle(0, 0, r * .15, mk.P(ICE))
    text(c, '12', 0, -r * .26, 52, ICE, 'display', align='center')
    text(c, 'KG', 0, r * .48, 22, SKY, align='center')
    c.restore()

def scene_workout(c, t):
    c.clear(mk.color4f(BLUE))
    furniture(c, BLUE, True)
    headline(c, ['make every', 'rep count.'], 117, 382, 142, ICE, t, WORKOUT + .12, 150)
    text(c, 'save sets, reps & weight', 126, 630, 32, ICE,
         alpha=mk.ease_out_cubic(mk.prog(t, WORKOUT + .55, WORKOUT + .9)))
    u = mk.spring(t - WORKOUT - .08, .55, 16)
    if u > 0 and WORKOUT + WIPE <= t < PROGRESS:
        c.save()
        c.translate(574, 795 + 80 * (1 - u))
        c.scale(.81 * u, .81 * u)
        plate(c, 0, 0, 136, t - WORKOUT)
        c.restore()
    phone(c, 'workout', t, WORKOUT, rotation=5, x=1440)
    if t > WORKOUT + .75:
        p = mk.spring(t - WORKOUT - .75, .55, 22)
        c.save()
        c.translate(1120, 789 + (1 - p) * 95)
        c.scale(p, p)
        rr(c, -156, -51, 365, 102, 20, INK)
        check(c, -114, 0, 23, SKY)
        text(c, 'set saved', -73, 10, 28, ICE, 'display')
        c.restore()
    footer(c, t, 2, True)

def scene_progress(c, t):
    c.clear(mk.color4f(ICE))
    furniture(c, ICE)
    headline(c, ['see it', 'add up.'], 117, 354, 170, INK, t, PROGRESS + .12, 157)
    text(c, 'follow your workout history', 126, 581, 28, INK,
         alpha=mk.ease_out_cubic(mk.prog(t, PROGRESS + .5, PROGRESS + .85)))
    p = mk.ease_in_out_cubic(mk.prog(t, PROGRESS + .50, PROGRESS + 1.50))
    x, y = chart(c, 141, 667, 770, 213, p, BLUE)
    if t >= PROGRESS + WIPE: orb(c, x, y, 34)
    if p > .85:
        s = mk.spring(t - PROGRESS - 1.02, .55, 22)
        if s > 0:
            pill(c, 'keep showing up', 624, 585 + (1 - s) * 40, 285, INK, ICE)
    phone(c, 'progress', t, PROGRESS, rotation=-4, x=1447)
    footer(c, t, 3)

def scene_close(c, t):
    c.clear(mk.color4f(INK))
    # Only the final scene gets the gentle camera push.
    p = mk.ease_out_cubic(mk.prog(t, CLOSE, DURATION))
    c.save()
    c.translate(W / 2, H / 2)
    c.scale(1 + .035 * p, 1 + .035 * p)
    c.translate(-W / 2, -H / 2)
    furniture(c, INK, True)
    headline(c, ['a little better.', 'every day.'], 117, 406, 132, ICE, t, CLOSE + .16, 145)
    u = mk.spring(t - CLOSE - .28, .65, 16)
    if u > 0:
        # Large recurring orb resolves into Kine's brand seal.
        cx, cy, radius = 1460, 534, 285 * u
        c.drawCircle(cx, cy, radius, mk.P(BLUE))
        arc(c, cx, cy, radius + 29, -90, 310, SKY, 2, .4)
        tau = t - WINK
        nod = mk.damped_wobble(tau, 2.8, 7, 18)
        jump = 48 * math.sin(math.pi * mk.prog(t, WINK, WINK + .40)) if WINK < t < WINK + .40 else 0
        sy = 1 - .07 * math.exp(-((tau - .4) / .065) ** 2)
        mascot(c, 'welcome', cx, 867 - jump + (1 - u) * 120, 671 * u, -nod, squash=sy)
    alpha = mk.ease_out_cubic(mk.prog(t, CLOSE + .64, CLOSE + 1.0))
    c.drawCircle(147, 684, 26, mk.P(BLUE, alpha))
    check(c, 147, 684, 25, ICE, alpha)
    text(c, 'KineVault', 194, 706, 62, ICE, 'brand', alpha)
    pill(c, 'Track', 596, 662, 136, SKY, INK, 28)
    text(c, 'food · workouts · progress', 128, 794, 30, SKY, alpha=alpha)
    text(c, 'make today count.', 129, 850, 24, ICE, alpha=.65 * alpha)
    c.restore()
    footer(c, t, 4, True)

SCENES = [scene_open, scene_food, scene_workout, scene_progress, scene_close]
TRANSITIONS = [
    (FOOD, (1445, 745), ICE),
    (WORKOUT, (1032, 392), BLUE),
    (PROGRESS, (574, 795), ICE),
    (CLOSE, (911, 684), INK),
]

def transition_hero(c, current, t, start):
    p = mk.ease_out_cubic(mk.prog(t, start, start + WIPE))
    if current == 0:
        orb(c, mk.lerp(1445, 1032, p), mk.lerp(745, 392, p), mk.lerp(160, 72, p))
    elif current == 1:
        x, y, r = mk.lerp(1032, 574, p), mk.lerp(392, 795, p), mk.lerp(72, 110, p)
        # The nutrition orb becomes the actual weight plate during its travel.
        for k in range(3, 0, -1):
            tau = t - .045 * k
            if tau > start:
                ep = mk.ease_out_cubic(mk.prog(tau, start, start + WIPE))
                c.drawCircle(mk.lerp(1032, 574, ep), mk.lerp(392, 795, ep),
                             mk.lerp(72, 110, ep), mk.P(ICE, .15 * (1 - p), 2))
        orb(c, x, y, r, color=mk.mix(BLUE, INK, p))
        arc(c, x, y, r * .82, -90, 360 * p, SKY, 3, .35)
        c.drawCircle(x, y, r * .15 * p, mk.P(ICE))
        text(c, '12', x, y - r * .26, 42, ICE, 'display', p, align='center')
        rr(c, x - 291 * p, y - 11 * p, 582 * p, max(.1, 22 * p), 11,
           ICE, .7 * p)
        # Keep the plate in front of the growing bar.
        if p > .85:
            c.save()
            c.translate(x, y)
            c.scale(.81, .81)
            plate(c, 0, 0, 136, t - WORKOUT)
            c.restore()
    elif current == 2:
        # The weight plate contracts to the beginning of the volume graph.
        # The graph's first segment begins only as the plate arrives.
        total = mk.ease_in_out_cubic(mk.prog(t, PROGRESS + .50, PROGRESS + 1.50)) * 6
        frac = mk.ease_in_out_cubic(total)
        gx = 141 + 770 * .17 * frac
        gy = 667 + 213 * mk.lerp(.92, .71, frac)
        x, y, r = mk.lerp(574, gx, p), mk.lerp(795, gy, p), mk.lerp(110, 34, p)
        orb(c, x, y, r, color=mk.mix(INK, BLUE, p))
        if p < .7:
            arc(c, x, y, r * .82, -90, 360, SKY, 3, .35 * (1 - p))
            c.drawCircle(x, y, r * .15, mk.P(ICE, 1 - p))

def draw(c, t):
    # Incoming scene is clipped to the object-led iris. Once covered, the old
    # scene is not evaluated. Every frame depends on time alone.
    current = 0
    for i, (start, _, _) in enumerate(TRANSITIONS):
        if t >= start + WIPE: current = i + 1
    SCENES[current](c, t)
    if current < len(TRANSITIONS):
        start, (x, y), color = TRANSITIONS[current]
        if start <= t < start + WIPE:
            p = mk.ease_in_out_cubic(mk.prog(t, start, start + WIPE))
            radius = math.hypot(max(x, W - x), max(y, H - y)) * 1.05 * p
            c.save()
            c.clipPath(mk.circle_path(x, y, radius), True)
            SCENES[current + 1](c, t)
            c.restore()
            transition_hero(c, current, t, start)

def audio(path):
    # Reset only sound's PRNG, not the render state. Same waveform on every run.
    ak.rng = np.random.default_rng(7)
    mix = ak.Mix(DURATION)
    for ti, strength, *_ in BOUNCE.imp:
        mix.add(ti - .004, ak.thump(.3 + .7 * strength), .34)
    for start, *_ in TRANSITIONS:
        mix.add(start - .03, ak.whoosh(WIPE + .06, 350, 5800), .12)
    # Warm arpeggio follows the four product beats, with air between events.
    for start in (0.04, FOOD + .20, WORKOUT + .20, PROGRESS + .20):
        for i, freq in enumerate(ak.PENTATONIC_A[:4]):
            mix.add(start + i * .15, ak.pluck(freq, d=.75, tau=.19, amp=.055), .80)
    for i in range(3):
        mix.add(WORKOUT + .52 + i * .12, ak.blip(ak.PENTATONIC_A[i], amp=.06), .75)
    mix.add(WORKOUT + .08, ak.thump(.7), .24)
    mix.add(PROGRESS + .18, ak.glide(1.20, 220, 880, amp=.035), .8)
    for freq, amp in ak.CHORD_A_ADD9:
        mix.add(CLOSE + .35, ak.pluck(freq, d=2.1, tau=.58, amp=amp * .48), 1)
    mix.add(WINK, ak.pluck(880, d=.45, tau=.09, amp=.028), 1)
    report = mix.save(str(path), reverb=.14, room=.14, fade_out=.55, ceiling=.8)
    (ROOT / 'audio-report.json').write_text(json.dumps(report, indent=2) + '\n')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['still', 'video', 'audio', 'poster'])
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--samples', type=int, default=6)
    args = parser.parse_args()
    renderer = mk.Renderer(draw, W, H, FPS, DURATION)
    if args.mode == 'still':
        print(renderer.stills(STILLS, str(ROOT / 'stills'), nsub=args.samples))
    elif args.mode == 'poster':
        Image.fromarray(renderer.frame(CLOSE + 1.20, args.samples)).save(ROOT / 'poster.png')
    elif args.mode == 'audio':
        print(audio(ROOT / 'audio.wav'))
    else:
        renderer.video(str(ROOT / 'silent.mp4'), nsub=args.samples,
                       workers=args.workers, crf=14, preset='medium')
        print(audio(ROOT / 'audio.wav'))
        mk.mux(str(ROOT / 'silent.mp4'), str(ROOT / 'audio.wav'), str(ROOT / 'kinevault-track-ad.mp4'))
        selection = ROOT / 'voice-selection.json'
        if selection.exists():
            import subprocess
            selected = json.loads(selection.read_text())
            if selected.get('provider') == 'elevenlabs':
                subprocess.run([sys.executable, str(ROOT / 'elevenlabs_voice.py')], check=True)
            else:
                subprocess.run([sys.executable, str(ROOT / 'voice_samples.py'),
                                '--mix-only', '--select', selected['style']], check=True)
        print('final ready', flush=True)
