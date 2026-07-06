# Editing & Publishing Guide

A plain-English guide to adding **blog posts** and **news** to your website — no
web-development experience needed.

---

## How the site works (30-second version)

Your website is generated from simple text files:

- **News** lives in one file: `data/news.json`
- **Blog posts** are individual files in the `data/blog/` folder (one file per post)

Whenever those files change, the site **rebuilds and republishes itself
automatically**. You never edit HTML.

> **The golden rule:** change a content file → save/commit it → the live site
> updates on its own in about 1–2 minutes.

---

## Two ways to make changes

### 🟢 Option A — In your browser on GitHub (easiest, recommended)

No software to install. Good for writing a post or adding a news line.

1. Go to your repository on **github.com**.
2. Open the folder / file you want (e.g. `data/blog/`).
3. Click **Add file → Create new file** (for a new post) or the ✏️ **pencil**
   icon (to edit an existing file).
4. Type or paste your content.
5. Scroll down and click **Commit changes**.
6. Wait ~1–2 minutes. Your change is live. (You can watch progress under the
   **Actions** tab — a green ✓ means it published.)

### 💻 Option B — On your computer (to preview before publishing)

Use this if you want to *see* the result before it goes public.

1. Edit the files in a text editor.
2. In a terminal, from the project folder, run:
   ```bash
   python build.py
   ```
3. Preview it locally:
   ```bash
   python -m http.server -d dist 8000
   ```
   then open **http://localhost:8000** in your browser.
4. When happy, publish by committing and pushing:
   ```bash
   git add -A
   git commit -m "New blog post"
   git push
   ```

> ⚠️ **Always run `python build.py` after editing**, and refresh your browser.
> The site is served from the `dist/` folder, so changes only appear after a
> rebuild. (On GitHub, the rebuild happens automatically — you don't run this.)

---

## ✍️ Writing a blog post

Each post is **one file** in `data/blog/`, ending in `.md` (Markdown).

**The file name becomes the web address.** Use lowercase words with hyphens:

```
data/blog/geometry-of-estimation.md   →   yoursite.com/blog/geometry-of-estimation/
```

### The template

Copy this into a new file and edit it:

```markdown
---
title: The Geometry of Estimation
date: 2026-03-15
tags: differential geometry, information geometry
description: A short one-line summary shown on the blog card and link previews.
math: true
---

Start writing here. A blank line separates paragraphs.

## A heading

You can use **bold**, *italic*, and [links](https://example.com).

- bullet points
- like this

Inline math like $\kappa = \tfrac{1}{r^2}$ works, and so do display equations:

$$ \int_M K \, dA = 2\pi\,\chi(M). $$
```

### The part between the `---` lines (the "front matter")

| Field         | What it does                                              |
| ------------- | -------------------------------------------------------- |
| `title`       | The post title (required).                               |
| `date`        | `YYYY-MM-DD`. Posts show newest first.                   |
| `tags`        | Comma-separated labels. Optional.                        |
| `description` | One sentence for the card + social/link previews.        |
| `math`        | `true` if the post uses equations. (Auto-on if it sees a `$`.) |

### Writing the body (Markdown quick reference)

| You type                    | You get                        |
| --------------------------- | ------------------------------ |
| `## Title`                  | A section heading              |
| `**bold**`                  | **bold**                       |
| `*italic*`                  | *italic*                       |
| `` `code` ``                | inline `code`                  |
| `[text](https://url)`       | a link                         |
| `- item`                    | a bullet list                  |
| `1. item`                   | a numbered list                |
| `> quote`                   | an indented quote              |
| `$ ... $`                   | inline math                    |
| `$$ ... $$`                 | a centered equation            |
| ` ```code``` ` (three back-ticks) | a code block             |

### Adding a picture to a post

1. Put the image file in the **`assets/img/`** folder (e.g. `torus-diagram.png`).
2. Reference it in your post like this:
   ```markdown
   ![A torus and its curvature](/assets/img/torus-diagram.png)
   ```

That's it — any image in `assets/img/` is published automatically.

---

## 📰 Adding a news item

News lives in a single file: **`data/news.json`**. It looks like this:

```json
{
  "news": [
    { "date": "2026", "html": "Paper accepted at the <strong>IFAC World Congress</strong>." },
    { "date": "2023", "html": "Began my PhD at the University of Melbourne." }
  ]
}
```

To add news, insert a new line **at the top** of the list (newest first):

```json
{
  "news": [
    { "date": "Mar 2026", "html": "Gave a talk on Riemann surfaces at <em>Seminar X</em>." },
    { "date": "2026", "html": "Paper accepted at the <strong>IFAC World Congress</strong>." },
    { "date": "2023", "html": "Began my PhD at the University of Melbourne." }
  ]
}
```

Rules to avoid errors:

- Each item is `{ "date": "...", "html": "..." }`.
- Put a **comma** after every item **except the last one**.
- Inside `html` you may use `<strong>bold</strong>`, `<em>italic</em>`, and
  links `<a href="https://...">text</a>`.
- `date` can be anything short: `"2026"`, `"Mar 2026"`, `"12 May 2026"`.

> 💡 Tip: JSON is picky about commas and quotes. If the site stops updating after
> a news edit, a missing/extra comma is the usual culprit. Paste your file into
> a free "JSON validator" website to spot the problem.

---

## 🚀 Publishing (how it goes live)

- **On GitHub (Option A):** clicking **Commit changes** is publishing. Done.
- **On your computer (Option B):** `git push` is publishing.

Either way, a robot (GitHub Actions) rebuilds the site and deploys it. Check the
repo's **Actions** tab: a green ✓ on the latest run means it's live (usually
1–2 minutes). If you see a red ✗, click it — the log will point to the file with
the problem (almost always a stray comma or quote in a `.json` file).

---

## Editing other parts of the site

Same idea — everything is in the `data/` folder:

| To change…                    | Edit this file            |
| ----------------------------- | ------------------------- |
| Your bio / intro              | `data/about.json`         |
| Research areas                | `data/research.json`      |
| Projects                      | `data/projects.json`      |
| Publications                  | `data/publications.json`  |
| Teaching                      | `data/teaching.json`      |
| CV timeline                   | `data/cv.json`            |
| Name, email, links, photo     | `data/site.json`          |

To change your **profile photo**: put the image in `assets/img/`, then set
`"profile_image": "your-file-name.jpg"` in `data/site.json`.

---

## Quick troubleshooting

| Problem                              | Fix                                                        |
| ------------------------------------ | ---------------------------------------------------------- |
| Change didn't appear                 | Wait 1–2 min; hard-refresh (Ctrl/Cmd+Shift+R). Locally, re-run `python build.py`. |
| Site build failed (red ✗ in Actions) | A `.json` file has a bad comma/quote. Check the last file you edited. |
| Image not showing                    | Make sure the file is in `assets/img/` and the name matches **exactly** (including capital letters). |
| Equation not rendering               | Add `math: true` to the post's front matter.               |

---

*You only ever edit text files in `data/` (and drop images in `assets/img/`).
Everything else — the layout, styling, and the geometry animation — takes care
of itself.*
