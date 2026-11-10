from brand import sym_overlap, icon, svg, lockup, kita, NAVY, ROSE, WINE, WHITE
LIGHT = sym_overlap()                         # navy + rose, for light backgrounds
DARK = sym_overlap(WHITE, ROSE, '#C76A86')    # white + rose, for navy backgrounds
def place(sym, k):  # a 1000-box symbol centred in a 1024 square at scale k
    return f'<g transform="translate({512-500*k:.1f} {512-500*k:.1f}) scale({k})">{sym}</g>'
mono = '<circle cx="365" cy="500" r="300" fill="#FFFFFF"/><circle cx="635" cy="500" r="300" fill="#FFFFFF"/>'
files = {
  'x-icon.svg': svg(1024, 1024, icon(DARK, rounded=False)),                # stores round the corners
  'x-icon-rounded.svg': svg(1024, 1024, icon(DARK)),                       # web "any" icons, favicon
  'x-maskable.svg': svg(1024, 1024, icon(DARK, rounded=False, k=0.52)),    # inside the safe zone
  'x-android-fg.svg': svg(1024, 1024, place(DARK, 0.5)),
  'x-android-bg.svg': svg(1024, 1024, f'<rect width="1024" height="1024" fill="{NAVY}"/>'),
  'x-android-mono.svg': svg(1024, 1024, place(mono, 0.5)),
  'x-splash.svg': svg(1024, 1024, place(LIGHT, 1.0)),
}
for n, s in files.items(): open(n, 'w').write(s)
# Lockups for documents / the web
b, w, h = lockup(LIGHT); open('x-lockup.svg', 'w').write(svg(int(w) + 2, int(h) + 2, b))
b, w, h = lockup(DARK, WHITE); open('x-lockup-white.svg', 'w').write(svg(int(w) + 2, int(h) + 2, b))
open('x-symbol.svg', 'w').write(svg(1000, 1000, LIGHT))
print('ok')
