#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — Latent-Space Observatory static-site generator.

A tiny, dependency-free generator (Python standard library only).
Reads content from data/*.json, renders static HTML into dist/, and copies
the CSS/JS and referenced images. Deploy dist/ to GitHub Pages.

    python build.py            # build into ./dist
    python -m http.server -d dist 8000   # preview locally

Edit content in  data/*.json   |  Edit styling in  src/css/site.css
Edit visuals in  src/js/cosmos.js
"""

import json
import re
import html
import shutil
from pathlib import Path
from datetime import date, datetime

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
SRC = ROOT / "src"
IMG_SRC = ROOT / "assets" / "img"
CV_PDF_SRC = ROOT / "assets" / "pdf" / "Curriculum_Vitae.pdf"
OUT = ROOT / "dist"


# --------------------------------------------------------------------------- #
#  Data
# --------------------------------------------------------------------------- #
def load(name):
    with open(DATA / f"{name}.json", "r", encoding="utf-8") as f:
        return json.load(f)

SITE = load("site")
ABOUT = load("about")
RESEARCH = load("research")
PROJECTS = load("projects")
PUBS = load("publications")
TEACHING = load("teaching")
NEWS = load("news")
CV = load("cv")

BASE_URL = SITE["url"].rstrip("/")
OG_IMAGE = BASE_URL + "/assets/img/prof_pic.jpg"


# --------------------------------------------------------------------------- #
#  Text helpers
# --------------------------------------------------------------------------- #
def esc(s):
    return html.escape(str(s), quote=False)

def esc_attr(s):
    return html.escape(str(s), quote=True)

_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_CODE = re.compile(r"`([^`]+)`")
_BOLD = re.compile(r"\*\*(.+?)\*\*")
_ITAL = re.compile(r"\*(.+?)\*")

def md(s):
    """Minimal inline markdown for trusted content. Leaves $math$ untouched."""
    s = esc(s)
    s = _CODE.sub(r"<code>\1</code>", s)
    s = _LINK.sub(r'<a href="\2">\1</a>', s)
    s = _BOLD.sub(r"<strong>\1</strong>", s)
    s = _ITAL.sub(r"<em>\1</em>", s)
    return s

_IMG = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")

def _inline_prose(s):
    """Inline markdown for blog prose. Leaves $math$ for MathJax."""
    s = esc(s)
    s = _IMG.sub(r'<img src="\2" alt="\1" loading="lazy" decoding="async">', s)
    s = _CODE.sub(r"<code>\1</code>", s)
    s = _LINK.sub(r'<a href="\2">\1</a>', s)
    s = _BOLD.sub(r"<strong>\1</strong>", s)
    s = _ITAL.sub(r"<em>\1</em>", s)
    return s

def md_to_html(text):
    """A small block-level Markdown -> HTML converter (headings, lists, quotes,
    code fences, hr, display math $$..$$). Inline $math$ is left for MathJax."""
    lines = text.split("\n")
    n = len(lines)
    out, para, i = [], [], 0

    def flush():
        if para:
            out.append("<p>" + _inline_prose(" ".join(para).strip()) + "</p>")
            para.clear()

    while i < n:
        s = lines[i].strip()
        if s.startswith("```"):
            flush(); i += 1; buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i]); i += 1
            i += 1
            out.append("<pre><code>" + esc("\n".join(buf)) + "</code></pre>"); continue
        if s.startswith("$$"):
            flush()
            if s.count("$$") >= 2 and len(s) > 4:
                content = s; i += 1
            else:
                blk = [s]; i += 1
                while i < n and "$$" not in lines[i]:
                    blk.append(lines[i]); i += 1
                if i < n: blk.append(lines[i].strip()); i += 1
                content = "\n".join(blk)
            out.append('<div class="equation">' + esc(content) + "</div>"); continue
        if s == "":
            flush(); i += 1; continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            flush(); tag = {1: "h2", 2: "h3", 3: "h4", 4: "h4"}[len(m.group(1))]
            out.append(f"<{tag}>" + _inline_prose(m.group(2)) + f"</{tag}>"); i += 1; continue
        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", s):
            flush(); out.append("<hr>"); i += 1; continue
        if s.startswith(">"):
            flush(); q = []
            while i < n and lines[i].strip().startswith(">"):
                q.append(lines[i].strip()[1:].strip()); i += 1
            out.append("<blockquote>" + _inline_prose(" ".join(q)) + "</blockquote>"); continue
        if re.match(r"^[-*]\s+", s):
            flush(); items = []
            while i < n and re.match(r"^[-*]\s+", lines[i].strip()):
                items.append("<li>" + _inline_prose(re.sub(r"^[-*]\s+", "", lines[i].strip())) + "</li>"); i += 1
            out.append("<ul>" + "".join(items) + "</ul>"); continue
        if re.match(r"^\d+\.\s+", s):
            flush(); items = []
            while i < n and re.match(r"^\d+\.\s+", lines[i].strip()):
                items.append("<li>" + _inline_prose(re.sub(r"^\d+\.\s+", "", lines[i].strip())) + "</li>"); i += 1
            out.append("<ol>" + "".join(items) + "</ol>"); continue
        para.append(s); i += 1
    flush()
    return "\n".join(out)

def fmt_date(s):
    s = (s or "").strip()
    try:
        d = datetime.strptime(s, "%Y-%m-%d")
        return d.strftime("%b") + f" {d.day}, {d.year}"
    except ValueError:
        pass
    try:
        return datetime.strptime(s, "%Y-%m").strftime("%b %Y")
    except ValueError:
        return s

def load_blog():
    posts = []
    bdir = DATA / "blog"
    if not bdir.exists():
        return posts
    for fp in sorted(bdir.glob("*.md")):
        raw = fp.read_text(encoding="utf-8")
        meta, body = {}, raw
        if raw.startswith("---"):
            parts = raw.split("---", 2)
            if len(parts) >= 3:
                _, fm, body = parts
                for line in fm.strip().splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        meta[k.strip()] = v.strip()
        tags = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
        posts.append({
            "slug": fp.stem,
            "title": meta.get("title", fp.stem),
            "date": meta.get("date", ""),
            "description": meta.get("description", ""),
            "tags": tags,
            "math": meta.get("math", "").lower() == "true" or "$" in body,
            "body": body.strip(),
        })
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts

BLOG = load_blog()


# --------------------------------------------------------------------------- #
#  SVG assets
# --------------------------------------------------------------------------- #
# A minimal two-arm cyclone (logarithmic spiral) — the site mark.
_CYC0 = ("M 17.05 16.00 L 17.08 16.17 L 17.09 16.35 L 17.07 16.53 L 17.02 16.72 L 16.94 16.91 "
         "L 16.82 17.09 L 16.67 17.26 L 16.49 17.41 L 16.28 17.53 L 16.05 17.63 L 15.79 17.69 "
         "L 15.51 17.71 L 15.22 17.69 L 14.92 17.62 L 14.63 17.50 L 14.34 17.32 L 14.08 17.10 "
         "L 13.84 16.83 L 13.63 16.51 L 13.48 16.14 L 13.37 15.74 L 13.33 15.31 L 13.35 14.86 "
         "L 13.44 14.40 L 13.62 13.94 L 13.87 13.49 L 14.21 13.06 L 14.62 12.68 L 15.11 12.35 "
         "L 15.66 12.09 L 16.28 11.91 L 16.95 11.82 L 17.65 11.84 L 18.37 11.97 L 19.10 12.21 "
         "L 19.80 12.59 L 20.48 13.09 L 21.09 13.71 L 21.62 14.45 L 22.05 15.31 L 22.36 16.25 "
         "L 22.53 17.28 L 22.53 18.37 L 22.36 19.50")
_CYC1 = ("M 14.95 16.00 L 14.92 15.83 L 14.91 15.65 L 14.93 15.47 L 14.98 15.28 L 15.06 15.09 "
         "L 15.18 14.91 L 15.33 14.74 L 15.51 14.59 L 15.72 14.47 L 15.95 14.37 L 16.21 14.31 "
         "L 16.49 14.29 L 16.78 14.31 L 17.08 14.38 L 17.37 14.50 L 17.66 14.68 L 17.92 14.90 "
         "L 18.16 15.17 L 18.37 15.49 L 18.52 15.86 L 18.63 16.26 L 18.67 16.69 L 18.65 17.14 "
         "L 18.56 17.60 L 18.38 18.06 L 18.13 18.51 L 17.79 18.94 L 17.38 19.32 L 16.89 19.65 "
         "L 16.34 19.91 L 15.72 20.09 L 15.05 20.18 L 14.35 20.16 L 13.63 20.03 L 12.90 19.79 "
         "L 12.20 19.41 L 11.52 18.91 L 10.91 18.29 L 10.38 17.55 L 9.95 16.69 L 9.64 15.75 "
         "L 9.47 14.72 L 9.47 13.63 L 9.64 12.50")

GLYPH = (
    '<svg class="glyph" viewBox="0 0 32 32" fill="none" aria-hidden="true">'
    f'<path d="{_CYC0}" stroke="url(#cyc)" stroke-width="1.5" stroke-linecap="round"/>'
    f'<path d="{_CYC1}" stroke="url(#cyc)" stroke-width="1.5" stroke-linecap="round"/>'
    '<circle cx="16" cy="16" r="1.7" fill="#38e1d6"/>'
    '<defs><linearGradient id="cyc" x1="9" y1="12" x2="23" y2="20">'
    '<stop stop-color="#38e1d6"/><stop offset="1" stop-color="#a689fb"/></linearGradient></defs></svg>'
)

def _svg(body, vb="0 0 48 48", cls="motif"):
    return (f'<svg class="{cls}" viewBox="{vb}" fill="none" stroke="currentColor" '
            f'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>')

MOTIFS = {
    "diffusion": _svg(
        '<circle cx="6" cy="8" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="8" cy="14" r="1"/>'
        '<circle cx="15" cy="11" r="1"/><circle cx="5" cy="20" r="1"/><circle cx="13" cy="19" r="1"/>'
        '<path d="M6 8 L24 24 M12 5 L24 24 M8 14 L24 24 M15 11 L24 24 M5 20 L24 24 M13 19 L24 24" opacity="0.4"/>'
        '<circle cx="24" cy="24" r="3.4" fill="currentColor" stroke="none"/>'
        '<path d="M30 24 h12 M33 19 h9 M33 29 h9" opacity="0.7"/>'),
    "flow": _svg(
        '<path d="M4 12 C 12 4, 20 20, 28 12 S 40 4, 44 12"/>'
        '<path d="M4 24 C 12 16, 20 32, 28 24 S 40 16, 44 24" opacity="0.75"/>'
        '<path d="M4 36 C 12 28, 20 44, 28 36 S 40 28, 44 36" opacity="0.5"/>'),
    "manifold": _svg(
        '<path d="M6 30 C 16 14, 32 14, 42 30" />'
        '<path d="M6 30 C 16 46, 32 46, 42 30" opacity="0.5"/>'
        '<path d="M6 30 C 12 24, 20 24, 24 30 S 36 36, 42 30" opacity="0.8"/>'
        '<path d="M24 8 v 14" opacity="0.5"/><circle cx="24" cy="8" r="2" fill="currentColor" stroke="none"/>'),
    "topology": _svg(
        '<ellipse cx="24" cy="24" rx="18" ry="11"/>'
        '<path d="M15 22 c 4 6, 14 6, 18 0" />'
        '<path d="M16 24 c 3 -5, 13 -5, 16 0" opacity="0.7"/>'
        '<circle cx="24" cy="24" r="3" opacity="0.6"/>'),
    "graph": _svg(
        '<circle cx="10" cy="12" r="2.6"/><circle cx="38" cy="10" r="2.6"/><circle cx="24" cy="26" r="2.6"/>'
        '<circle cx="12" cy="38" r="2.6"/><circle cx="38" cy="36" r="2.6"/>'
        '<path d="M10 12 L24 26 M38 10 L24 26 M12 38 L24 26 M38 36 L24 26 M10 12 L38 10" opacity="0.55"/>'),
    "sde": _svg(
        '<path d="M5 24 L9 18 L12 27 L16 14 L19 25 L23 12 L26 22 L30 15 L33 24 L37 13 L41 21" opacity="0.85"/>'
        '<path d="M5 24 C 14 22, 28 20, 41 16" opacity="0.4" stroke-dasharray="2 3"/>'
        '<path d="M41 21 l3 -1 m-3 1 l1 3" opacity="0.85"/>'
        '<circle cx="5" cy="24" r="1.8" fill="currentColor" stroke="none"/>'),
    "constellation": _svg(
        '<path d="M6 30 L16 12 L27 22 L38 8 L42 26 L30 38 L16 30 Z" opacity="0.4"/>'
        '<circle cx="6" cy="30" r="1.6" fill="currentColor" stroke="none"/>'
        '<circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/>'
        '<circle cx="27" cy="22" r="1.6" fill="currentColor" stroke="none"/>'
        '<circle cx="38" cy="8" r="2.2" fill="currentColor" stroke="none"/>'
        '<circle cx="42" cy="26" r="1.6" fill="currentColor" stroke="none"/>'
        '<circle cx="30" cy="38" r="1.8" fill="currentColor" stroke="none"/>'
        '<circle cx="16" cy="30" r="1.6" fill="currentColor" stroke="none"/>'),
}

def icon(name):
    p = {
        "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
        "arrow-ur": '<path d="M7 17L17 7M8 7h9v9"/>',
        "arrow-l": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
        "download": '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
        "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        "external": '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    }
    return (f'<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{p[name]}</svg>')

SOCIAL_ICONS = {
    "email": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    "github": '<path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 22 12.2C22 6.6 17.5 2 12 2z"/>',
    "twitter": '<path d="M17.5 3h3l-7.2 8.2L22 21h-6.4l-4.4-5.7L6 21H3l7.7-8.8L2.5 3H9l4 5.3L17.5 3zm-2.2 16h1.7L8.8 4.8H7L15.3 19z"/>',
    "scholar": '<path d="M12 3L1 9l11 6 9-4.9V17h2V9L12 3z"/><path d="M6 12.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.5l-6 3.3-6-3.3z"/>',
    "linkedin": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="7.5" cy="8" r="1.4" fill="currentColor" stroke="none"/><path d="M7.5 11v6M12 17v-3.2c0-1.6 2.4-1.7 2.4 0V17M12 11v6" />',
    "orcid": '<circle cx="12" cy="12" r="10"/><path d="M9 8v8M9 6.2v.1" /><path d="M13 8h2.2c2 0 3.3 1.4 3.3 4s-1.6 4-3.6 4H13V8z"/>',
}
SOCIAL_LABELS = {
    "email": "Email", "github": "GitHub", "twitter": "X / Twitter",
    "scholar": "Scholar", "linkedin": "LinkedIn", "orcid": "ORCID",
}

def social_icon(name):
    return (f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{SOCIAL_ICONS[name]}</svg>')


# --------------------------------------------------------------------------- #
#  Shared chrome
# --------------------------------------------------------------------------- #
NAV_ITEMS = [
    ("Home", "/", "home"),
    ("Research", "/research/", "research"),
    ("Projects", "/projects/", "projects"),
    ("Publications", "/publications/", "publications"),
    ("Teaching", "/teaching/", "teaching"),
    ("Blog", "/blog/", "blog"),
    ("CV", "/cv/", "cv"),
]

MATHJAX = r"""<script>
window.MathJax = { tex: { inlineMath: [['$','$'],['\\(','\\)']], displayMath: [['$$','$$'],['\\[','\\]']] },
  options: { skipHtmlTags: ['script','noscript','style','textarea','pre','code'] } };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>"""

def head(title, desc, canonical, math=False):
    kw = ", ".join(SITE["keywords"])
    m = MATHJAX if math else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc_attr(desc)}">
<meta name="keywords" content="{esc_attr(kw)}">
<meta name="author" content="{esc_attr(SITE['full_name'])}">
<link rel="canonical" href="{esc_attr(canonical)}">
<meta name="theme-color" content="#05070f">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc_attr(title)}">
<meta property="og:description" content="{esc_attr(desc)}">
<meta property="og:url" content="{esc_attr(canonical)}">
<meta property="og:image" content="{esc_attr(OG_IMAGE)}">
<meta property="og:site_name" content="{esc_attr(SITE['name'])}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc_attr(title)}">
<meta name="twitter:description" content="{esc_attr(desc)}">
<meta name="twitter:image" content="{esc_attr(OG_IMAGE)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/prof_pic.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css">
<script type="application/ld+json">{ld_person()}</script>
</head>
<body>
<div class="scroll-progress" aria-hidden="true"></div>
<canvas id="cosmos" class="cosmos" aria-hidden="true"></canvas>
<div class="cosmos-veil" aria-hidden="true"></div>
{navbar(_active_from_canonical(canonical))}
<main id="top">
"""

def _active_from_canonical(canonical):
    path = canonical.replace(BASE_URL, "") or "/"
    for _, href, key in NAV_ITEMS:
        if href == path:
            return key
    if path.startswith("/projects/"):
        return "projects"
    if path.startswith("/blog/"):
        return "blog"
    return "home"

def ld_person():
    same = [u for u in [SITE["socials"].get("github"), SITE["socials"].get("twitter"),
                        SITE["socials"].get("scholar"), SITE["socials"].get("linkedin")] if u]
    data = {
        "@context": "https://schema.org", "@type": "Person",
        "name": SITE["full_name"], "alternateName": SITE["name"],
        "url": BASE_URL + "/", "email": SITE["email"],
        "image": OG_IMAGE, "jobTitle": SITE["role"],
        "affiliation": {"@type": "Organization", "name": SITE["affiliation"]},
        "knowsAbout": SITE["keywords"], "sameAs": same,
    }
    return json.dumps(data, ensure_ascii=False)

def navbar(active):
    items = ""
    for label, href, key in NAV_ITEMS:
        cls = ' class="active"' if key == active else ""
        items += f'<li><a href="{href}"{cls}>{label}</a></li>'
    return f"""<nav class="nav" aria-label="Primary">
  <div class="nav-inner">
    <a class="brand" href="/" aria-label="{esc_attr(SITE['name'])} — home">{GLYPH}<span>{esc(SITE['name'])}</span></a>
    <ul class="nav-links">
      {items}
      <li><a class="nav-cta" href="/#contact">Contact</a></li>
    </ul>
    <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="nav-links">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</nav>"""

def footer(math=False, scripts=""):
    s = SITE["socials"]
    fl = []
    if s.get("email"):  fl.append(f'<a href="mailto:{esc_attr(s["email"])}">Email</a>')
    if s.get("github"): fl.append(f'<a href="{esc_attr(s["github"])}" rel="me noopener" target="_blank">GitHub</a>')
    if s.get("scholar"): fl.append(f'<a href="{esc_attr(s["scholar"])}" rel="noopener" target="_blank">Scholar</a>')
    links = " · ".join(fl)
    m = MATHJAX if math else ""
    return f"""</main>
<footer class="site">
  <div class="wrap foot-inner">
    <div class="foot-brand">{esc(SITE['name'])}</div>
    <div class="foot-meta">
      © <span data-year>{date.today().year}</span> · Built from scratch — a latent-space observatory. {links}
    </div>
  </div>
</footer>
<script src="/assets/js/cosmos.js" defer></script>
<script src="/assets/js/app.js" defer></script>
{scripts}
{m}
</body>
</html>"""


# --------------------------------------------------------------------------- #
#  Components
# --------------------------------------------------------------------------- #
def research_card(area, idx, with_links=True):
    links = ""
    if with_links and area.get("projects"):
        pl = []
        for pid in area["projects"]:
            proj = PROJECT_BY_ID.get(pid)
            if proj:
                pl.append(f'<a href="/projects/{pid}/">{esc(proj["title"])}</a>')
        if pl:
            links = '<div class="r-links">' + "".join(pl) + "</div>"
    return f"""<article class="rcard reveal" data-accent="{esc_attr(area['accent'])}" tabindex="0">
  <span class="r-index">{idx:02d}</span>
  {MOTIFS.get(area['motif'], '')}
  <h3>{esc(area['title'])}</h3>
  <p class="r-summary">{esc(area['summary'])}</p>
  <div class="r-detail"><p>{esc(area['detail'])}</p>{links}</div>
</article>"""

def project_card(p):
    tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in p.get("tags", [])[:2])
    search = " ".join([p["title"], p["tagline"], p["category"]] + p.get("tags", []))
    return f"""<article class="pcard reveal" data-category="{esc_attr(p['category'])}" data-search="{esc_attr(search)}">
  <a class="pcard-link" href="/projects/{p['id']}/" aria-label="{esc_attr(p['title'])}"></a>
  <div class="pcard-media">
    <span class="pcard-cat">{esc(p['category'])}</span>
    <img src="/assets/img/{esc_attr(p['image'])}" alt="{esc_attr(p['title'])} diagram" loading="lazy" decoding="async">
  </div>
  <div class="pcard-body">
    <h3>{esc(p['title'])}</h3>
    <p class="pcard-tagline">{esc(p['tagline'])}</p>
    <div class="pcard-foot">
      <div class="pcard-tags">{tags}</div>
      <span class="pcard-arrow">{icon('arrow-ur')}</span>
    </div>
  </div>
</article>"""

def pub_item(p):
    authors = ", ".join(
        (f'<span class="me">{esc(a["name"])}</span>' if a.get("me") else esc(a["name"]))
        for a in p["authors"])
    star = '<span class="selected-star">★ selected</span>' if p.get("selected") else ""
    tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in p.get("tags", []))
    foot = f'<span class="pub-status">{esc(p["status"])}</span>' if p.get("status") else ""
    for k, label in [("pdf", "PDF"), ("arxiv", "arXiv"), ("code", "Code"), ("blog", "Blog")]:
        u = p["links"].get(k)
        if u:
            foot += f'<a class="pub-link" href="{esc_attr(u)}" target="_blank" rel="noopener">{label}</a>'
    foot += tags
    ab = ""
    if p.get("abstract"):
        ab = f'<p class="pub-abstract">{esc(p["abstract"])}</p>'
    return f"""<article class="pub-item reveal">
  <div class="pub-year">{esc(p['year'])}{star}</div>
  <div>
    <h3 class="pub-title">{esc(p['title'])}</h3>
    <div class="pub-authors">{authors}</div>
    <div class="pub-venue">{esc(p['venue'])}</div>
    {ab}
    <div class="pub-foot">{foot}</div>
  </div>
</article>"""


# --------------------------------------------------------------------------- #
#  Pages
# --------------------------------------------------------------------------- #
PROJECT_BY_ID = {p["id"]: p for p in PROJECTS["projects"]}

def page_home():
    # hero
    parts = SITE["name"]
    ticker = "".join(f'<span class="chip">{esc(x)}</span>' for x in SITE["interests_ticker"])
    hero = f"""<section class="hero wrap" id="home">
  <div class="hero-grid">
    <div class="hero-copy">
      <span class="hero-status"><span class="dot"></span> M.Sc. Computer Science · University of Padova</span>
      <h1>S.&nbsp;Mohammad&nbsp;H.<br><span class="accent">Hosseini D.</span></h1>
      <p class="hero-identity"><span class="hl">Pure Mathematics</span> · Generative Models · Stochastic Processes · <span class="hl">Geometry &amp; Analysis</span></p>
      <p class="hero-lede">{esc(ABOUT['lede'])}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="/research/">Explore research {icon('arrow')}</a>
        <a class="btn" href="/projects/">View projects</a>
        <a class="btn" href="/{esc_attr(SITE['cv_pdf'])}" target="_blank" rel="noopener">{icon('download')} CV</a>
      </div>
      <div class="hero-ticker">{ticker}</div>
    </div>
    <div class="hero-media">
      <div class="portrait-wrap">
        <div class="portrait-orbit" aria-hidden="true">
          <svg viewBox="0 0 400 400">
            <g class="portrait-spin">
              <circle class="ring" cx="200" cy="200" r="196"/>
              <circle class="node" cx="200" cy="4" r="3.5"/>
              <circle class="node" cx="396" cy="200" r="2.5"/>
            </g>
            <g class="portrait-spin rev">
              <circle class="ring" cx="200" cy="200" r="168" opacity="0.35"/>
              <circle class="node" cx="32" cy="200" r="2.5"/>
              <circle class="node" cx="200" cy="368" r="3"/>
            </g>
          </svg>
        </div>
        <div class="portrait">
          <img src="/assets/img/prof_pic.jpg" alt="Portrait of {esc_attr(SITE['name'])}" width="380" height="380">
        </div>
      </div>
    </div>
  </div>
</section>"""

    trailer = f"""<section class="trailer" id="trailer">
  <canvas id="dynamics" aria-label="Interactive phase flow of ODEs and SDEs — choose a system from the controls"></canvas>
  <div class="trailer-veil" aria-hidden="true"></div>
  <div class="trailer-inner">
    <div class="trailer-top">
      <span class="eyebrow">Dynamical systems · a trailer</span>
      <p class="trailer-title">Everything is <span class="accent">motion</span>.</p>
      <p class="trailer-sub">Ordinary and stochastic differential equations, integrated live over their own vector-field geometry. Pick a flow and watch an ensemble propagate.</p>
    </div>
    <div class="trailer-bottom">
      <div class="dyn-readout" aria-live="polite">
        <span class="dyn-name"></span>
        <span class="dyn-eq mono"></span>
        <span class="dyn-note"></span>
      </div>
      <div class="trailer-legend" aria-hidden="true">
        <span class="sink"><i></i> sink</span>
        <span class="source"><i></i> source</span>
        <span class="saddle"><i></i> saddle</span>
      </div>
      <div class="dyn-controls" role="group" aria-label="Choose a dynamical system to propagate"></div>
    </div>
  </div>
  <a class="trailer-scroll" href="#home" aria-label="Enter the site"><span>enter</span><span class="bar"></span></a>
</section>"""

    # about
    facts = "".join(
        f'<div class="fact"><div class="k">{esc(f["label"])}</div><div class="v">{esc(f["value"])}</div></div>'
        for f in ABOUT["quick_facts"])
    about_paras = "".join(f"<p>{p}</p>" for p in ABOUT["paragraphs"])  # trusted HTML
    about = f"""<section class="wrap" id="about">
  <div class="about-grid">
    <div class="reveal">
      <span class="eyebrow">About</span>
      <p class="about-lede">{esc(ABOUT['lede'])}</p>
      <div class="about-body">{about_paras}</div>
      <p class="status-strip">{esc(ABOUT['status_line'])}</p>
    </div>
    <div class="facts reveal d1">{facts}</div>
  </div>
</section>"""

    # research universe
    cards = "".join(research_card(a, i + 1) for i, a in enumerate(RESEARCH["areas"]))
    research = f"""<section class="wrap" id="research">
  <div class="section-head reveal">
    <span class="eyebrow">Research Universe</span>
    <h2>Where pure mathematics meets learning</h2>
    <p>{esc(RESEARCH['intro'])}</p>
  </div>
  <div class="research-grid">{cards}</div>
</section>"""

    # selected projects
    featured = [p for p in PROJECTS["projects"] if p.get("featured")]
    fcards = "".join(project_card(p) for p in featured)
    projects = f"""<section class="wrap" id="work">
  <div class="home-sub-head">
    <div class="section-head reveal"><span class="eyebrow">Selected Work</span><h2>Projects at the frontier</h2></div>
    <a class="view-all reveal" href="/projects/">All projects {icon('arrow')}</a>
  </div>
  <div class="proj-grid">{fcards}</div>
</section>"""

    # selected publications
    sel = [p for p in PUBS["publications"] if p.get("selected")]
    pitems = "".join(pub_item(p) for p in sel)
    pubs = f"""<section class="wrap" id="pubs">
  <div class="home-sub-head">
    <div class="section-head reveal"><span class="eyebrow">Publications</span><h2>Selected writing</h2></div>
    <a class="view-all reveal" href="/publications/">All publications {icon('arrow')}</a>
  </div>
  <div class="pub-list">{pitems}</div>
</section>"""

    # writing (blog teaser)
    writing = ""
    if BLOG:
        wcards = "".join(blog_card(p) for p in BLOG[:2])
        writing = f"""<section class="wrap" id="writing">
  <div class="home-sub-head">
    <div class="section-head reveal"><span class="eyebrow">Writing</span><h2>From the blog</h2></div>
    <a class="view-all reveal" href="/blog/">All posts {icon('arrow')}</a>
  </div>
  <div class="blog-list">{wcards}</div>
</section>"""

    # news
    news_items = "".join(
        f'<li class="news-item reveal"><span class="news-date">{esc(n["date"])}</span><span class="news-body">{n["html"]}</span></li>'
        for n in NEWS["news"])
    news = f"""<section class="wrap" id="news">
  <div class="section-head reveal"><span class="eyebrow">News</span><h2>Recent</h2></div>
  <ul class="news-list">{news_items}</ul>
</section>"""

    contact = contact_section()

    body = (trailer + hero + '<div class="wrap"><hr class="divider"></div>'
            + about + research + projects + pubs + writing + news + contact)
    return (head(f"{SITE['name']} — {SITE['role']}", SITE["description"], BASE_URL + "/")
            + body + footer(scripts='<script src="/assets/js/dynamics.js" defer></script>'))


def contact_section():
    s = SITE["socials"]
    order = ["email", "github", "scholar", "linkedin", "twitter", "orcid"]
    tiles = ""
    for k in order:
        v = s.get(k)
        if not v:
            continue
        href = f"mailto:{v}" if k == "email" else v
        ext = "" if k == "email" else ' target="_blank" rel="noopener"'
        tiles += f'<a class="social" href="{esc_attr(href)}"{ext}>{social_icon(k)}<span>{SOCIAL_LABELS[k]}</span></a>'
    return f"""<section class="wrap contact" id="contact">
  <div class="reveal">
    <span class="eyebrow" style="justify-content:center">Contact</span>
    <h2>Let's talk mathematics &amp; models</h2>
    <p class="lead">The best way to reach me is by email. I'm always glad to discuss generative models, stochastic processes, or potential collaborations and graduate opportunities.</p>
    <div class="btn-row" style="justify-content:center">
      <a class="btn btn-primary" href="mailto:{esc_attr(SITE['email'])}">{icon('mail')} {esc(SITE['email'])}</a>
    </div>
    <div class="socials" style="margin-top:1.6rem">{tiles}</div>
  </div>
</section>"""


def page_research():
    cards = "".join(research_card(a, i + 1) for i, a in enumerate(RESEARCH["areas"]))
    body = f"""<section class="wrap" style="padding-top:calc(var(--nav-h) + 4rem)">
  <div class="section-head reveal">
    <span class="eyebrow">Research Universe</span>
    <h2>What I study, and why</h2>
    <p>{esc(RESEARCH['intro'])}</p>
  </div>
  <div class="research-grid">{cards}</div>
  <div style="margin-top:3rem" class="reveal">
    <a class="btn" href="/projects/">See the projects behind these ideas {icon('arrow')}</a>
  </div>
</section>"""
    return (head(f"Research — {SITE['name']}",
                 "Research directions: generative models, stochastic processes & SDEs, density estimation & inference, topological and geometric ML, graph neural networks, and the mathematical foundations of deep learning.",
                 BASE_URL + "/research/")
            + body + footer())


def page_projects():
    cats = PROJECTS["categories"]
    fbtns = '<button class="filter-btn active" data-filter="all">All</button>'
    for c in cats:
        fbtns += f'<button class="filter-btn" data-filter="{esc_attr(c)}">{esc(c)}</button>'
    filt = f"""<div class="filter-bar">
    {fbtns}
    <div class="filter-search"><input type="search" placeholder="Search projects…" aria-label="Search projects"></div>
  </div>"""

    blocks = ""
    for c in cats:
        ps = sorted([p for p in PROJECTS["projects"] if p["category"] == c],
                    key=lambda x: x.get("importance", 99))
        if not ps:
            continue
        cards = "".join(project_card(p) for p in ps)
        blocks += f'<h2 class="cat-heading" data-category="{esc_attr(c)}">{esc(c)}</h2><div class="proj-grid">{cards}</div>'

    body = f"""<section class="wrap" style="padding-top:calc(var(--nav-h) + 4rem)">
  <div class="section-head reveal">
    <span class="eyebrow">Projects</span>
    <h2>A working atlas of ideas</h2>
    <p>Implementations and studies across generative modeling, inference, vision, language, and graphs — each a small experiment in reading machine learning through mathematics. Filter by cluster or search.</p>
  </div>
  {filt}
  <p class="no-results">No projects match that filter. Try clearing the search.</p>
  {blocks}
</section>"""
    return (head(f"Projects — {SITE['name']}",
                 "A collection of machine-learning projects across generative models, inference, computer vision, NLP, and graph neural networks.",
                 BASE_URL + "/projects/")
            + body + footer())


def page_project_detail(p, prev_p, next_p):
    secs = ""
    for s in p["sections"]:
        body = "".join(f"<p>{md(par)}</p>" for par in s["body"])
        eq = ""
        if s.get("equation"):
            eq = f'<div class="equation">\\[ {esc(s["equation"])} \\]</div>'
        secs += f'<div class="detail-section"><h2>{esc(s["heading"])}</h2>{body}{eq}</div>'

    # links
    dl = ""
    L = p["links"]
    if L.get("code"):
        dl += f'<a class="btn btn-primary" href="{esc_attr(L["code"])}" target="_blank" rel="noopener">{icon("external")} Code</a>'
    if L.get("paper"):
        dl += f'<a class="btn" href="{esc_attr(L["paper"])}" target="_blank" rel="noopener">{icon("external")} Paper</a>'
    if L.get("report"):
        dl += f'<a class="btn" href="{esc_attr(L["report"])}" target="_blank" rel="noopener">{icon("external")} Report</a>'
    if L.get("reference"):
        lbl = L.get("reference_label", "Reference")
        dl += f'<a class="btn" href="{esc_attr(L["reference"])}" target="_blank" rel="noopener">{icon("external")} {esc(lbl)}</a>'
    links_block = f'<div class="detail-links">{dl}</div>' if dl else ""

    tags = "".join(f'<span class="meta-pill">{esc(t)}</span>' for t in p.get("tags", []))

    nav = '<div class="detail-nav">'
    if prev_p:
        nav += f'<a href="/projects/{prev_p["id"]}/"><span class="lbl">← Previous</span>{esc(prev_p["title"])}</a>'
    else:
        nav += "<span></span>"
    if next_p:
        nav += f'<a href="/projects/{next_p["id"]}/" style="text-align:right"><span class="lbl">Next →</span>{esc(next_p["title"])}</a>'
    nav += "</div>"

    body = f"""<section class="wrap detail-hero">
  <a class="back-link" href="/projects/">{icon('arrow-l')} All projects</a>
  <span class="eyebrow">{esc(p['category'])}</span>
  <h1>{esc(p['title'])}</h1>
  <p class="detail-tagline">{esc(p['tagline'])}</p>
  <div class="detail-meta">
    <span class="meta-pill status">{esc(p['status'])}</span>
    <span class="meta-pill">{esc(p['year'])}</span>
    {tags}
  </div>
</section>
<section class="wrap" style="padding-top:0">
  <figure class="detail-figure reveal">
    <img src="/assets/img/{esc_attr(p['image'])}" alt="{esc_attr(p['title'])} diagram" loading="lazy" decoding="async">
  </figure>
  <div class="detail-body">
    {secs}
    {links_block}
    {nav}
  </div>
</section>"""
    return (head(f"{p['title']} — {SITE['name']}", p["tagline"],
                 BASE_URL + f"/projects/{p['id']}/", math=True)
            + body + footer(math=True))


def page_publications():
    pubs = sorted(PUBS["publications"], key=lambda x: x["year"], reverse=True)
    items = "".join(pub_item(p) for p in pubs)
    body = f"""<section class="wrap" style="padding-top:calc(var(--nav-h) + 4rem)">
  <div class="section-head reveal">
    <span class="eyebrow">Publications</span>
    <h2>Papers &amp; manuscripts</h2>
    <p>{esc(PUBS['note'])}</p>
  </div>
  <div class="pub-list">{items}</div>
</section>"""
    return (head(f"Publications — {SITE['name']}",
                 "Publications and manuscripts on diffusion models, SDEs, and generative modeling for time-series data.",
                 BASE_URL + "/publications/")
            + body + footer())


def page_teaching():
    cards = ""
    for t in sorted(TEACHING["teaching"], key=lambda x: x.get("importance", 99)):
        topics = "".join(f"<li>{esc(x)}</li>" for x in t.get("topics", []))
        img = f'<div class="tcard-media"><span class="tcard-role">{esc(t["role"])}</span><img src="/assets/img/{esc_attr(t["image"])}" alt="{esc_attr(t["title"])}" loading="lazy" decoding="async"></div>' if t.get("image") else ""
        cards += f"""<article class="tcard reveal">
  {img}
  <div class="tcard-body">
    <h3>{esc(t['title'])}</h3>
    <p class="tcard-inst">{esc(t['institution'])} <span class="fmt">· {esc(t['format'])}</span></p>
    <p class="tcard-summary">{esc(t['summary'])}</p>
    <ul class="tcard-topics">{topics}</ul>
  </div>
</article>"""
    body = f"""<section class="wrap" style="padding-top:calc(var(--nav-h) + 4rem)">
  <div class="section-head reveal">
    <span class="eyebrow">Teaching</span>
    <h2>Courses I've helped build</h2>
    <p>Teaching keeps ideas honest. Here are the courses I've instructed or assisted — from deep learning in PyTorch to advanced programming in Java.</p>
  </div>
  <div class="teach-grid">{cards}</div>
</section>"""
    return (head(f"Teaching — {SITE['name']}",
                 "Teaching: Deep Learning with PyTorch (instructor) and Advanced Programming Concepts in Java (teaching assistant) at the University of Isfahan.",
                 BASE_URL + "/teaching/")
            + body + footer())


def page_cv():
    sections = ""
    idx = 0
    for sec in CV["sections"]:
        idx += 1
        inner = ""
        stype = sec["type"]
        if stype == "timeline":
            for it in sec["items"]:
                todo = " todo" if it.get("todo") else ""
                badge = '<span class="todo-badge">to add</span>' if it.get("todo") else ""
                details = "".join(f"<li>{esc(d)}</li>" for d in it.get("details", []))
                org = ""
                if it.get("org") or it.get("location"):
                    loc = f' <span class="loc">· {esc(it["location"])}</span>' if it.get("location") else ""
                    org = f'<div class="tl-org">{esc(it.get("org",""))}{loc}</div>'
                period = f'<div class="tl-period">{esc(it["period"])}</div>' if it.get("period") else ""
                inner += f"""<div class="tl-item{todo}">
  {period}
  <div class="tl-title">{esc(it['title'])}{badge}</div>
  {org}
  <ul class="tl-details">{details}</ul>
</div>"""
            inner = f'<div class="timeline">{inner}</div>'
        elif stype == "skills":
            groups = ""
            for g in sec["groups"]:
                tags = "".join(f"<span>{esc(x)}</span>" for x in g["items"])
                groups += f'<div class="skill-group"><h3>{esc(g["label"])}</h3><div class="skill-tags">{tags}</div></div>'
            inner = f'<div class="skill-groups">{groups}</div>'
        elif stype == "list":
            lis = "".join(f"<li>{esc(x)}</li>" for x in sec["items"])
            inner = f'<ul class="cv-list">{lis}</ul>'
        sections += f'<div class="cv-section reveal"><h2><span class="idx">{idx:02d}</span> {esc(sec["title"])}</h2>{inner}</div>'

    prof = CV["profile"]
    body = f"""<section class="wrap" style="padding-top:calc(var(--nav-h) + 4rem)">
  <div class="cv-head reveal">
    <div>
      <span class="eyebrow">Curriculum Vitae</span>
      <h2 style="margin-top:0.6rem">{esc(prof['name'])}</h2>
      <p class="muted" style="margin-top:0.4rem">{esc(prof['label'])}</p>
    </div>
    <div class="cv-actions btn-row">
      <a class="btn btn-primary" href="/{esc_attr(CV['pdf'])}" target="_blank" rel="noopener">{icon('download')} Download PDF</a>
    </div>
  </div>
  <p class="muted reveal" style="max-width:44rem">{esc(prof['summary'])}</p>
  <div class="cv-note reveal">⚑ {esc(CV['note'])}</div>
  {sections}
</section>"""
    return (head(f"CV — {SITE['name']}",
                 "Curriculum vitae of " + SITE["full_name"] + " — education, research, teaching, and skills.",
                 BASE_URL + "/cv/")
            + body + footer())


def blog_card(p):
    tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in p["tags"][:3])
    return f"""<article class="blog-card reveal">
  <a class="card-link" href="/blog/{p['slug']}/" aria-label="{esc_attr(p['title'])}"></a>
  <div class="post-meta">{esc(fmt_date(p['date']))}</div>
  <h3>{esc(p['title'])}</h3>
  <p>{esc(p['description'])}</p>
  <div class="post-tags">{tags}</div>
  <span class="read">Read {icon('arrow')}</span>
</article>"""

def page_blog_index():
    cards = "".join(blog_card(p) for p in BLOG) or '<p class="muted">No posts yet.</p>'
    body = f"""<section class="wrap" style="padding-top:calc(var(--nav-h) + 4rem)">
  <div class="section-head reveal">
    <span class="eyebrow">Blog</span>
    <h2>Notes &amp; derivations</h2>
    <p>Thinking out loud about pure mathematics, generative models, optimal transport, and the geometry of stochastic dynamics.</p>
  </div>
  <div class="blog-list">{cards}</div>
</section>"""
    return (head(f"Blog — {SITE['name']}",
                 "Essays and notes on pure mathematics, optimal transport, generative models, and stochastic dynamics.",
                 BASE_URL + "/blog/")
            + body + footer())

def page_blog_post(p, newer, older):
    content = md_to_html(p["body"])
    tags = "".join(f'<span class="meta-pill">{esc(t)}</span>' for t in p["tags"])
    dot = '<span class="dot">·</span>' if p["tags"] else ""
    nav = '<div class="detail-nav">'
    if newer:
        nav += f'<a href="/blog/{newer["slug"]}/"><span class="lbl">← Newer</span>{esc(newer["title"])}</a>'
    else:
        nav += "<span></span>"
    if older:
        nav += f'<a href="/blog/{older["slug"]}/" style="text-align:right"><span class="lbl">Older →</span>{esc(older["title"])}</a>'
    nav += "</div>"
    body = f"""<section class="wrap post-hero">
  <a class="back-link" href="/blog/">{icon('arrow-l')} All posts</a>
  <span class="eyebrow">Blog</span>
  <h1>{esc(p['title'])}</h1>
  <div class="post-meta-row"><span>{esc(fmt_date(p['date']))}</span>{dot}{tags}</div>
</section>
<section class="wrap" style="padding-top:1rem">
  <article class="prose">{content}</article>
  <div style="max-width:var(--maxw-narrow)">{nav}</div>
</section>"""
    return (head(f"{p['title']} — {SITE['name']}", p["description"] or p["title"],
                 BASE_URL + f"/blog/{p['slug']}/", math=p["math"])
            + body + footer(math=p["math"]))


def page_404():
    body = f"""<section class="wrap" style="min-height:70svh;display:grid;place-items:center;text-align:center">
  <div class="reveal">
    <span class="eyebrow" style="justify-content:center">Error 404</span>
    <h1 style="font-size:clamp(3rem,10vw,6rem);margin:1rem 0">Off the manifold</h1>
    <p class="muted" style="max-width:32rem;margin:0 auto 2rem">This page drifted out of the latent space. Let's get you back to a known coordinate.</p>
    <a class="btn btn-primary" href="/">{icon('arrow-l')} Return home</a>
  </div>
</section>"""
    return head("404 — " + SITE["name"], "Page not found.", BASE_URL + "/404.html") + body + footer()


# --------------------------------------------------------------------------- #
#  Static assets
# --------------------------------------------------------------------------- #
FAVICON = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="7" fill="#05070f"/>
<path d="{_CYC0}" fill="none" stroke="url(#f)" stroke-width="1.7" stroke-linecap="round"/>
<path d="{_CYC1}" fill="none" stroke="url(#f)" stroke-width="1.7" stroke-linecap="round"/>
<circle cx="16" cy="16" r="1.9" fill="#38e1d6"/>
<defs><linearGradient id="f" x1="9" y1="12" x2="23" y2="20">
<stop stop-color="#38e1d6"/><stop offset="1" stop-color="#a689fb"/></linearGradient></defs>
</svg>"""

def sitemap(urls):
    today = date.today().isoformat()
    items = ""
    for u, pr in urls:
        items += f"  <url><loc>{u}</loc><lastmod>{today}</lastmod><priority>{pr}</priority></url>\n"
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{items}</urlset>\n'

ROBOTS = f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}/sitemap.xml\n"


# --------------------------------------------------------------------------- #
#  Build
# --------------------------------------------------------------------------- #
def write(path, content):
    fp = OUT / path
    fp.parent.mkdir(parents=True, exist_ok=True)
    with open(fp, "w", encoding="utf-8") as f:
        f.write(content)

def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    # ---- pages ----
    write("index.html", page_home())
    write("research/index.html", page_research())
    write("projects/index.html", page_projects())
    write("publications/index.html", page_publications())
    write("teaching/index.html", page_teaching())
    write("cv/index.html", page_cv())
    write("404.html", page_404())

    projs = PROJECTS["projects"]
    # ordering for prev/next: by category then importance, matching projects page
    ordered = []
    for c in PROJECTS["categories"]:
        ordered += sorted([p for p in projs if p["category"] == c],
                          key=lambda x: x.get("importance", 99))
    for i, p in enumerate(ordered):
        prev_p = ordered[i - 1] if i > 0 else None
        next_p = ordered[i + 1] if i < len(ordered) - 1 else None
        write(f"projects/{p['id']}/index.html", page_project_detail(p, prev_p, next_p))

    # ---- blog ----
    write("blog/index.html", page_blog_index())
    for i, p in enumerate(BLOG):
        newer = BLOG[i - 1] if i > 0 else None
        older = BLOG[i + 1] if i < len(BLOG) - 1 else None
        write(f"blog/{p['slug']}/index.html", page_blog_post(p, newer, older))

    # ---- static files ----
    write("favicon.svg", FAVICON)
    write("robots.txt", ROBOTS)
    (OUT / ".nojekyll").write_text("", encoding="utf-8")

    urls = [(BASE_URL + "/", "1.0"), (BASE_URL + "/research/", "0.8"),
            (BASE_URL + "/projects/", "0.9"), (BASE_URL + "/publications/", "0.8"),
            (BASE_URL + "/teaching/", "0.6"), (BASE_URL + "/blog/", "0.7"),
            (BASE_URL + "/cv/", "0.6")]
    for p in ordered:
        urls.append((BASE_URL + f"/projects/{p['id']}/", "0.6"))
    for p in BLOG:
        urls.append((BASE_URL + f"/blog/{p['slug']}/", "0.6"))
    write("sitemap.xml", sitemap(urls))

    # ---- copy CSS / JS ----
    (OUT / "assets" / "css").mkdir(parents=True, exist_ok=True)
    (OUT / "assets" / "js").mkdir(parents=True, exist_ok=True)
    shutil.copy2(SRC / "css" / "site.css", OUT / "assets" / "css" / "site.css")
    for js in ("cosmos.js", "app.js", "dynamics.js"):
        shutil.copy2(SRC / "js" / js, OUT / "assets" / "js" / js)

    # ---- copy images: every file in assets/img (so blog/news images "just work") ----
    img_out = OUT / "assets" / "img"
    img_out.mkdir(parents=True, exist_ok=True)
    copied_imgs = 0
    for src in sorted(IMG_SRC.glob("*")):
        if src.is_file() and not src.name.startswith("."):
            shutil.copy2(src, img_out / src.name)
            copied_imgs += 1
    # warn about referenced-but-missing images
    needed = {"prof_pic.jpg"}
    for p in projs:
        needed.add(p["image"])
    for t in TEACHING["teaching"]:
        if t.get("image"):
            needed.add(t["image"])
    missing = [n for n in sorted(needed) if not (IMG_SRC / n).exists()]

    # ---- copy CV pdf ----
    cv_out = OUT / "assets" / "cv"
    cv_out.mkdir(parents=True, exist_ok=True)
    if CV_PDF_SRC.exists():
        shutil.copy2(CV_PDF_SRC, cv_out / "Curriculum_Vitae.pdf")
    else:
        missing.append("Curriculum_Vitae.pdf")

    # ---- report ----
    n_pages = 8 + len(ordered) + len(BLOG)
    print(f"[ok] Built {n_pages} pages into {OUT}")
    print(f"     - {len(ordered)} project detail pages")
    print(f"     - {len(BLOG)} blog posts")
    print(f"     - {copied_imgs} images copied")
    if missing:
        print("  !! MISSING assets (fix these):")
        for m in missing:
            print("     -", m)
    print("\nPreview:  python -m http.server -d dist 8000   ->  http://localhost:8000")


if __name__ == "__main__":
    main()
