"""KiTA professional brand directions: navy + rose, Inter Display, geometric marks."""
from glyphs import wordmark

NAVY, NAVY_2, ROSE, WINE, WHITE, MIST = '#18213D', '#26335C', '#E5899B', '#8E3F64', '#FFFFFF', '#F3F4F8'

def kita(color=NAVY, dot=ROSE, weight='SemiBold'):
    """Horizontal wordmark in font units (height ~1490, baseline 0). Returns (svg, width)."""
    g, w, m = wordmark(weight, kern={'TA': -120, 'Ki': -18, 'iT': 6}, track=-12)
    i = m['letters'][1]
    stem_l, _, stem_r, _ = i['bounds']
    cx = i['x'] + (stem_l + stem_r) / 2
    r = (stem_r - stem_l) * 0.62
    cy = -(m['cap'] - r)
    return f'<g fill="{color}">{g}</g><circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="{dot}"/>', w, m['cap']

# ---- symbols, drawn in a 1000x1000 box -------------------------------------------------
def sym_overlap(a=NAVY, b=ROSE, mix=WINE):
    # Two equal circles; centres 0.9r apart; the shared lens in a deeper tone. "Two of us, one shared space."
    r = 300; c1 = 500 - 135; c2 = 500 + 135
    lens = f'M500 {500-264} A{r} {r} 0 0 1 500 {500+264} A{r} {r} 0 0 1 500 {500-264} Z'
    return f'<circle cx="{c1}" cy="500" r="{r}" fill="{a}"/><circle cx="{c2}" cy="500" r="{r}" fill="{b}"/><path d="{lens}" fill="{mix}"/>'

def sym_monogram(fg=WHITE, dot=ROSE):
    g, w, m = wordmark('Bold', text='K')
    k = m['letters'][0]; l, _, rr, _ = k['bounds']
    s = 540 / m['cap']                       # K cap height = 54% of the box
    gw = (rr - l) * s
    x0 = 500 - gw / 2 - l * s - 30           # optical nudge left, leaving room for the dot
    y0 = 500 + m['cap'] * s / 2
    return f'<g transform="translate({x0:.1f} {y0:.1f}) scale({s:.4f})" fill="{fg}">{g}</g><circle cx="{x0 + (rr + 120) * s:.1f}" cy="{y0 - m["cap"] * s + 58:.1f}" r="58" fill="{dot}"/>'

def sym_orbit(ring=NAVY, dot=ROSE):
    # A ring and a small moon resting on its inner edge: "always close". Golden-ratio sizes.
    return f'<circle cx="500" cy="500" r="300" fill="none" stroke="{ring}" stroke-width="92"/><circle cx="632" cy="368" r="96" fill="{dot}"/>'

def icon(sym_svg, bg=NAVY, bg2=NAVY_2, rounded=True, k=0.66):
    rx = 'rx="225"' if rounded else ''
    return f'''<defs><linearGradient id="bg{bg[1:]}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg2}"/><stop offset="1" stop-color="{bg}"/></linearGradient></defs>
<rect width="1024" height="1024" {rx} fill="url(#bg{bg[1:]})"/><g transform="translate({512-500*k:.1f} {512-500*k:.1f}) scale({k})">{sym_svg}</g>'''

def svg(w, h, body, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{b}{body}</svg>'

def lockup(sym, word_color=NAVY, height=200):
    """Symbol + wordmark side by side; returns (svg body, width) at the given cap height."""
    wsvg, ww, cap = kita(word_color)
    s = height / cap
    sym_size = height * 1.45
    gap = height * 0.38
    body = f'<g transform="scale({sym_size/1000:.4f})">{sym}</g>'
    body += f'<g transform="translate({sym_size + gap:.1f} {sym_size/2 + height/2:.1f}) scale({s:.5f})">{wsvg}</g>'
    return body, sym_size + gap + ww * s, sym_size

DIRECTIONS = {
    'overlap': ('1 · Overlap', 'Two of us, and the space we share.',
                sym_overlap(), sym_overlap(WHITE, ROSE, '#C76A86'), icon(sym_overlap(WHITE, ROSE, '#C76A86'))),
    'monogram': ('2 · Monogram', 'A confident K, with the rose dot from the i.',
                 sym_monogram(NAVY), sym_monogram(WHITE), icon(sym_monogram(WHITE))),
    'orbit': ('3 · Orbit', 'Always close: a ring and a small moon that stays near.',
              sym_orbit(), sym_orbit(WHITE), icon(sym_orbit(WHITE))),
}

if __name__ == '__main__':
    for key, (title, line, sym_light, sym_dark, ic) in DIRECTIONS.items():
        open(f'b-{key}-icon.svg', 'w').write(svg(1024, 1024, ic))
        body, w, sh = lockup(sym_light)
        open(f'b-{key}-lockup.svg', 'w').write(svg(int(w) + 80, int(sh) + 80, f'<g transform="translate(40 40)">{body}</g>', '#FFFFFF'))
        body, w, sh = lockup(sym_dark, WHITE)
        open(f'b-{key}-lockup-dark.svg', 'w').write(svg(int(w) + 80, int(sh) + 80, f'<g transform="translate(40 40)">{body}</g>', NAVY))
    wsvg, ww, cap = kita()
    open('b-wordmark.svg', 'w').write(svg(int(ww) + 200, cap + 300, f'<g transform="translate(100 {cap + 150})">{wsvg}</g>', '#FFFFFF'))
    print('ok')
