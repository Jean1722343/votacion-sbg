"""Pone una versión nueva (?v=...) a todos los imports y recursos del sitio.

GitHub Pages guarda los archivos en caché ~10 minutos; sin esto, el navegador
puede mezclar archivos viejos y nuevos después de una actualización y romper la app.

Uso (desde la raíz del repo, antes de cada commit que cambie js/, css/ o data/):
    python tools/version.py
"""
import pathlib
import re
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = time.strftime("%Y%m%d%H%M%S")

# import ... from "./x.js" · import("./x.js") · href/src="css/x.css" / "js/x.js"
JS_SPEC = re.compile(r'''((?:from\s+|import\s*\(\s*)["'])(\.{1,2}/[^"'?]+\.js)(?:\?v=[\w-]*)?(["'])''')
HTML_REF = re.compile(r'''((?:href|src)=["'])((?:css|js)/[^"'?]+\.(?:css|js))(?:\?v=[\w-]*)?(["'])''')


def bump(path, pattern):
    text = path.read_text(encoding="utf-8")
    new = pattern.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={VERSION}{m.group(3)}", text)
    if new != text:
        path.write_text(new, encoding="utf-8")
        return True
    return False


changed = [p for p in [*ROOT.glob("js/**/*.js"), *ROOT.glob("data/*.js")] if bump(p, JS_SPEC)]
if bump(ROOT / "index.html", HTML_REF):
    changed.append(ROOT / "index.html")
print(f"versión {VERSION}: {len(changed)} archivos actualizados")
