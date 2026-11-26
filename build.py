#!/usr/bin/env python3
"""بیلیارد سه‌بعدی — ساخت یک فایل HTML مستقل از قطعات src/ + vendor/."""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'pool-3d.html')


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as f:
        return f.read()


def main():
    shell = read('src', 'shell.html')
    css = read('src', 'style.css')
    three = read('vendor', 'three.min.js')

    parts = []
    for name in ['sim.js', 'game.js', 'table.js', 'balls.js', 'audio.js', 'ui.js', 'main.js']:
        body = read('src', name).strip()
        parts.append('\n/* ===== %s ===== */\n' % name + body)
    game = '\n'.join(parts)

    # سه‌بعدی: مكتبات به‌صورت امن داخل بلاک اسکریپت جا می‌گیرند
    assert '</script' not in three.lower(), 'three.min.js contains </script>'
    assert '</script' not in game.lower(), 'game code contains </script>'

    html = shell.replace('/* ====__CSS__==== */', css)
    html = html.replace('/* ====__THREE__==== */', three)
    html = html.replace('/* ====__GAME__==== */', game)

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)

    size = os.path.getsize(OUT)
    lines = game.count('\n') + 1
    print('built %s  (%.1f KB, %d lines of game code)' % (OUT, size / 1024, lines))


if __name__ == '__main__':
    main()
