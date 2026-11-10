"""Turn Inter Display letters into SVG outlines (font-independent), with manual kerning."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

FONTS = {w: f'/usr/share/fonts/opentype/inter/InterDisplay-{w}.otf' for w in ['Medium', 'SemiBold', 'Bold']}

def glyph_path(font, name):
    gs = font.getGlyphSet()
    pen = SVGPathPen(gs)
    gs[name].draw(pen)
    bp = BoundsPen(gs); gs[name].draw(bp)
    return pen.getCommands(), gs[name].width, bp.bounds

def wordmark(weight='SemiBold', text='KiTA', kern=None, dotless_i=True, track=0):
    """Returns (svg_group, width, metrics) in font units, y flipped (baseline at y=0, caps go negative)."""
    f = TTFont(FONTS[weight])
    cmap = f.getBestCmap()
    upm = f['head'].unitsPerEm
    cap = f['OS/2'].sCapHeight
    xh = f['OS/2'].sxHeight
    kern = kern or {}
    x = 0; parts = []; info = {}
    for i, ch in enumerate(text):
        name = cmap[0x131] if (ch == 'i' and dotless_i) else cmap[ord(ch)]
        d, adv, b = glyph_path(f, name)
        parts.append(f'<path transform="translate({x} 0) scale(1 -1)" d="{d}"/>')
        info[i] = {'ch': ch, 'x': x, 'adv': adv, 'bounds': b}
        pair = text[i:i+2]
        x += adv + track + kern.get(pair, 0)
    return ''.join(parts), x, {'upm': upm, 'cap': cap, 'xh': xh, 'letters': info}

if __name__ == '__main__':
    g, w, m = wordmark()
    print('width', w, 'cap', m['cap'], 'xh', m['xh'], 'upm', m['upm'])
    for k, v in m['letters'].items(): print(v['ch'], v['x'], v['adv'], v['bounds'])
