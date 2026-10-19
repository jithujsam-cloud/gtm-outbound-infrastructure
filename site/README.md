# Personal website

Jithu Jobin Sam's personal website: an introduction, his experience, three projects with their real status, a selection of enterprise programmes, skills, and a clear way to get in touch. Static HTML, no build step, no dependencies.

| File | Purpose |
|---|---|
| `index.html` | The whole page. Font: Schibsted Grotesk from Google Fonts. Animation: Motion 11 (motion.dev, the Framer Motion engine) from jsDelivr; the page stays fully readable if it fails to load or the visitor prefers reduced motion. |
| `Jithu-Jobin-Sam-CV.pdf` | Two-page resume, linked from the page. Exported from a Word file kept outside this repo. |
| `cv-source.html` | Source of the earlier one-page CV, kept for reference. The current PDF does not come from it. Not deployed. |
| `404.html` | Not-found page, served automatically by Vercel |
| `favicon.svg`, `og.png` | Tab icon and link-preview image |
| `assets/jithu.jpg` | Portrait |
| `assets/logos/` | Company logos for the brand strip, taken from each company's website or Simple Icons |
| `vercel.json` | Clean URLs, security headers, caching |

## Deploy on Vercel

1. **Add New → Project**, import `jithujsam-cloud/gtm-outbound-infrastructure`.
2. Set **Root Directory** to `site`.
3. Framework Preset: **Other**. Leave Build Command and Output Directory empty.
4. Deploy, then attach your domain and change `og:image` in `index.html` to the absolute URL (for example `https://yourdomain.com/og.png`).

