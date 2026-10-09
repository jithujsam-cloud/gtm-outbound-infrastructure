# Personal site

Static personal site for Jithu Jobin Sam (GTM Engineer). No build step and no dependencies.

| File | Purpose |
|---|---|
| `index.html` | The whole page (inline CSS/JS; faces embedded as data URIs; Inter from Google Fonts) |
| `404.html` | Not-found page (Vercel serves it automatically) |
| `vercel.json` | Clean URLs, security headers, asset caching |
| `favicon.svg`, `apple-touch-icon.png`, `og.png` | Tab icon, home-screen icon, link-preview image |
| `assets/jithu.jpg` | Photo |
| `assets/faces/` | Source cartoon expressions (transparent line art) used to build the embedded faces |

## Deploy on Vercel

1. In Vercel, **Add New → Project** and import `jithujsam-cloud/gtm-outbound-infrastructure`.
2. Set **Root Directory** to `site`.
3. Framework Preset: **Other**. Leave Build Command and Output Directory empty.
4. Deploy.

This is a separate Vercel project from the GTM Validation Tool (the repo-root `vercel.json` points at `gtm-validation-tool`).

After you attach a custom domain, change the `og:image` meta tag in `index.html` to the full URL (for example `https://yourdomain.com/og.png`). Some link previewers, including LinkedIn, need an absolute URL.

## Preview locally

```
npx serve site
```
