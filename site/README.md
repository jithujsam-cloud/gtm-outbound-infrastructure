# Personal site

Static personal site for Jithu Jobin Sam (GTM engineer). One HTML file with inline CSS and JS, no build step and no dependencies.

| File | Purpose |
|---|---|
| `index.html` | The whole page. Fonts (Inter, Inter Tight, JetBrains Mono) load from Google Fonts. |
| `404.html` | Not-found page, served automatically by Vercel |
| `vercel.json` | Clean URLs, security headers, asset caching |
| `favicon.svg`, `og.png` | Tab icon and link-preview image |
| `assets/jithu.jpg` | Photo used in the closing section |

The page has a live status in the header that reads the current time in Delhi and shows whether the outbound engine's weekday 9 to 6 sending window is open. The "Run a sample lead" demo uses an invented company and contact.

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
