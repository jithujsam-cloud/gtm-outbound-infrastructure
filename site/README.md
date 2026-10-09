# Personal site

Static personal site for Jithu Jobin Sam (GTM Engineer). No build step: open `index.html` or deploy this folder.

- `index.html` — the page (inline CSS/JS, Google Fonts)
- `assets/faces/` — source cartoon expressions (transparent line art). They are embedded in `index.html` as data URIs and tinted with the theme colour via CSS masks.
- `assets/jithu.jpg` — photo

Deploy on Vercel as a separate project with **Root Directory = `site`** (the repo-root `vercel.json` points at `gtm-validation-tool`).
