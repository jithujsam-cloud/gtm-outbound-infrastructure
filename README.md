# gtm-outbound-infrastructure

Production n8n workflows for B2B outbound — built and used in live campaigns at Clospect.

Three workflows, one pipeline: scrape job signals → validate and score leads → send personalized emails → track open rates. Everything feeds into Airtable as the CRM layer.

---

## What's in here

### [Lead Sourcing + ICP Validation](workflows/lead-sourcing-icp-validation/)
Pulls leads from an Apify dataset, runs them through a Gemini AI agent that checks ICP fit across 5 verticals (D2C, Defense, Fintech, Pharma, Semiconductor), validates emails via Clearout API, and upserts clean records into Airtable. Runs on a schedule. Skips any lead already validated.

### [Job Signal Scraper](workflows/job-signal-scraper/)
Pulls LinkedIn job postings from an Apify dataset, groups them by company, and uses a Gemini AI agent to produce a hiring analysis and outreach hook per company. Output goes to Google Sheets. Two triggers: one to ingest raw job data, one to generate AI analysis on a 15-minute schedule.

### [Email Automation + Open Rate Tracking](workflows/email-automation-openrate/)
Runs on a 15-minute schedule, weekdays only, 9am-5pm. Pulls up to 6 leads marked safe-to-send from Airtable, rewrites each email using Claude (Anthropic) with a different tone each time, sends via Gmail with a 1x1 pixel tracker embedded, then updates Airtable with sent status and open timestamps when the pixel fires.

---

## Stack

n8n, Apify, Gemini (Google AI), Claude (Anthropic), Clearout, Airtable, Google Sheets, Gmail

---

## Setup

Each workflow folder has its own README with the full node map, data flow, and setup steps.

Credentials are scrubbed. You'll need to swap in your own:
- Apify API key + dataset ID
- Airtable Personal Access Token + base/table IDs
- Google Gemini API key
- Anthropic API key
- Clearout API key
- Gmail OAuth2 credentials
- Google Sheets OAuth2 credentials

Import the JSON into your n8n instance, reconnect credentials, update dataset/sheet/base IDs, activate.

---

## Background

Built these for Clospect's own outbound. The job signal workflow came out of a specific problem: most cold email is generic because it's sent to static lists. Job postings are a live signal — companies hiring for specific roles in specific cities tell you exactly what they're building and where the pain is. Combining that signal with ICP validation and personalized send cuts the noise significantly.

Open rate tracking via pixel isn't novel, but most teams don't close the loop back to the CRM. This wires it directly so you know which sends actually landed in an inbox that got opened.
