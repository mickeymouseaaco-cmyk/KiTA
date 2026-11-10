# KiTA logo: two friends leaning in, with a heart. Generates every SVG variant.
PLUM_A, PLUM_B = '#8E6BD0', '#5E3F94'

def faces(fill_l='#FFD7C4', fill_r='#C9EBD5', ink='#4A2A5E', cheek='#FF9FB0', heart='#FF5F86', mono=None):
    if mono:
        fill_l = fill_r = heart = mono
        ink = 'none'; cheek = 'none'
    s = f'''
  <circle cx="420" cy="590" r="215" fill="{fill_l}"/>
  <circle cx="630" cy="600" r="200" fill="{fill_r}" {'stroke="#000" stroke-opacity="0"' if mono else ''}/>
  <path d="M630 400 a200 200 0 1 1 0 400" fill="none"/>'''
    if not mono:
        s += f'''
  <circle cx="365" cy="560" r="20" fill="{ink}"/><circle cx="460" cy="560" r="20" fill="{ink}"/>
  <path d="M372 625 Q412 662 452 625" stroke="{ink}" stroke-width="18" fill="none" stroke-linecap="round"/>
  <circle cx="330" cy="618" r="26" fill="{cheek}" opacity="0.75"/>
  <circle cx="590" cy="572" r="20" fill="{ink}"/><circle cx="680" cy="572" r="20" fill="{ink}"/>
  <path d="M597 635 Q636 670 675 635" stroke="{ink}" stroke-width="18" fill="none" stroke-linecap="round"/>
  <circle cx="720" cy="628" r="26" fill="{cheek}" opacity="0.75"/>'''
    s += f'''
  <path d="M520 300 C492 248 404 252 410 330 C416 392 520 450 520 450 C520 450 624 392 630 330 C636 252 548 248 520 300 Z" fill="{heart}"/>'''
    if not mono:
        s += '''
  <circle cx="770" cy="270" r="16" fill="#FFE29A"/><circle cx="250" cy="330" r="12" fill="#BFE0FF"/>
  <path d="M760 380 l26 -26 M786 380 l-26 -26" stroke="#FFE29A" stroke-width="12" stroke-linecap="round"/>'''
    return s

def bg(rounded=True):
    r = 'rx="230"' if rounded else ''
    return f'''<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{PLUM_A}"/><stop offset="1" stop-color="{PLUM_B}"/></linearGradient>
  <radialGradient id="glow" cx="0.3" cy="0.2" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="1024" height="1024" {r} fill="url(#g)"/><rect width="1024" height="1024" {r} fill="url(#glow)"/>'''

def svg(body, size=1024):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024">{body}</svg>'

def scaled(body, k):
    o = (1024 - 1024 * k) / 2
    return f'<g transform="translate({o},{o}) scale({k})">{body}</g>'

files = {
  'icon.svg': svg(bg(False) + scaled(faces(), 0.92)),                 # app icon (stores round the corners)
  'icon-rounded.svg': svg(bg(True) + scaled(faces(), 0.92)),          # for previews
  'maskable.svg': svg(bg(False) + scaled(faces(), 0.72)),             # PWA maskable: inside the safe zone
  'android-fg.svg': svg(scaled(faces(), 0.62)),                       # Android adaptive foreground
  'android-bg.svg': svg(bg(False)),
  'android-mono.svg': svg(scaled(faces(mono='#FFFFFF'), 0.62)),
  'splash.svg': svg(faces()),                                         # splash: the mark on the app background
  'mark.svg': svg(faces()),
}
for n, s in files.items():
    open(n, 'w').write(s)
print('written', list(files))
