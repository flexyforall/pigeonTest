# Stamps the pages' links to their own stylesheets and scripts with a short hash of each file
# (css/hero.css?v=1a2b3c4d), so a browser never runs a cached copy against a newer page.
# Run after changing any of them: python3 tools/stamp.py
import hashlib, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
pattern = re.compile(r'((?:src|href)=")((?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=\w+)?(")')

def stamp(match):
    path = match.group(2)
    digest = hashlib.md5((root / path).read_bytes()).hexdigest()[:8]
    return f'{match.group(1)}{path}?v={digest}{match.group(3)}'

for page in sorted(root.glob('*.html')):
    text = page.read_text()
    page.write_text(pattern.sub(stamp, text))
    print(page.name, len(pattern.findall(text)), 'links')
