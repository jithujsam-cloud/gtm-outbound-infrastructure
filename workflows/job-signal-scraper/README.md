# Job Signal Scraper

Pulls LinkedIn job postings from an Apify dataset, groups them by company, and generates a hiring analysis + outreach hook for each company using Gemini AI. Output goes to Google Sheets. Two schedule triggers: one ingests raw job data, one runs AI analysis on a 15-minute loop.

---

## The problem

Most cold outreach is sent to static lists. Job postings are a live signal. A company hiring 15 engineers in Bengaluru and Hyderabad right now is telling you exactly what they're building, what stage they're at, and where they're going. That's a better opening than "I noticed you might be hiring."

This workflow turns raw job posting data into a per-company signal: what they're building, where, at what seniority, and a one-liner hook you can drop directly into an outreach email.

---

## Flow

```
Schedule Trigger
    └── Apify (pull job postings dataset)
            └── Edit Fields (normalize: companyName, jobTitle, location, jobId, etc.)
                    └── Append to Google Sheets (raw dump → "Job Posts - Apify Dump" tab)
                            └── Aggregate (collect all rows)
                                    └── Code: JavaScript (group by company)
                                                └── Append to Google Sheets (grouped → "Comp wise Job" tab)
                                                        └── Loop Over Items2

Schedule Trigger 4 (every 15 min)
    └── Get rows from Sheets ("Comp wise Job" tab)
            └── Loop Over Items2
                    └── [batch item]
                            └── Code: JavaScript (parse job IDs from array)
                                    └── Get rows from Sheets (filter "Job Posts - Apify Dump" by each ID)
                                            └── Aggregate (collect job rows for this company)
                                                    └── Code: JavaScript (format job titles + JDs)
                                                            └── AI Agent (Gemini)
                                                                    Generates analysis + hook
                                                                    └── Information Extractor
                                                                            └── Update row in Sheets
                                                                                    └── Loop (next company)
```

---

## What the AI produces

For each company, the agent returns:

**analysis** — 4-6 lines covering: what the company is building (inferred from titles + JDs), where they're hiring and what that signals, seniority spread, stack/domain focus, urgency indicators (volume, recency, net-new titles).

**hook** — 1-2 lines written as a direct outreach opener. References actual location, domain, and scale. No buzzwords.

Example output:
```json
{
  "analysis": "Teradata is building out a dedicated AI engineering hub across India, with 23 open roles spanning Hyderabad, Bengaluru, and Pune. The spread runs from Senior to Principal level, with net-new titles like 'Principal AI Engineer – Agentic Systems' signalling this isn't backfill — they're standing up a new function. The domain is narrow and deep: Agentic AI, AI Marketplace, and Cloud Platform engineering, with Python and Java as the core stack.",
  "hook": "You're clearly building something significant on the AI side in India — 23 roles across three cities at this seniority level doesn't happen quietly. We place exactly this profile of engineer and we're already active in these markets."
}
```

---

## Google Sheets structure

**Tab: Job Posts - Apify Dump**
| ID | Job Title | Job Description | Location | Apply Link | Time | companyName |

**Tab: Comp wise Job**
| Company Name | Positions | Time | No of Positions | Location | Domain | Location hiring for | Dataset | Analysis | Hook | IDs |

---

## JavaScript processing (grouping logic)

The grouping node (`Code in JavaScript`) does:
- Flattens Apify output (handles both array and flat formats)
- Groups all jobs by company name
- Counts unique vs total job titles
- Tracks location counts with frequency (`Bengaluru (8), Hyderabad (5)`)
- Stores all job IDs per company for the lookup step

The formatting node (`Code in JavaScript2`) reassembles job descriptions for the AI prompt — numbered list of `Title\nDescription` per company.

---

## Nodes

| Node | Type | Purpose |
|---|---|---|
| Schedule Trigger | Trigger | Trigger raw ingest |
| Get dataset items | Apify | Pull job postings |
| Edit Fields1 | Set | Normalize field names |
| Append row in sheet1 | Google Sheets | Write raw rows |
| Aggregate | Aggregate | Collect all rows |
| Code in JavaScript | Code | Group jobs by company |
| Append row in sheet | Google Sheets | Write grouped summary |
| Loop Over Items2 | Split in Batches | Process one company at a time |
| Schedule Trigger4 | Trigger | 15-min AI analysis loop |
| Get row(s) in sheet | Google Sheets | Pull company rows for analysis |
| Code in JavaScript1 | Code | Parse job ID array |
| Get row(s) in sheet2 | Google Sheets | Fetch JDs by job ID |
| Aggregate1 | Aggregate | Collect JDs per company |
| Code in JavaScript2 | Code | Format for AI prompt |
| AI Agent | LangChain Agent | Gemini analysis + hook |
| Google Gemini Chat Model | LLM | Powers AI Agent |
| Information Extractor | LangChain | Parse structured JSON |
| Update row in sheet1 | Google Sheets | Write analysis + hook |

---

## Setup

1. Import `job-signal-scraper.json` into n8n
2. Create credentials:
   - Apify OAuth2 → replace `YOUR_APIFY_CREDENTIAL_ID`
   - Google Gemini (PaLM) API → replace `YOUR_GEMINI_CREDENTIAL_ID`
   - Google Sheets OAuth2 → replace `YOUR_GOOGLE_SHEETS_CREDENTIAL_ID`
3. Update IDs:
   - `YOUR_APIFY_DATASET_ID` → your Apify LinkedIn jobs dataset
   - `YOUR_GOOGLE_SHEETS_DOC_ID` → your Google Sheets file
   - `YOUR_COMP_WISE_JOB_SHEET_TAB_ID` / `YOUR_JOB_POSTS_SHEET_TAB_ID` → tab IDs (found in the sheet URL after `gid=`)
4. Create both sheet tabs with the column headers above
5. Activate both schedule triggers
