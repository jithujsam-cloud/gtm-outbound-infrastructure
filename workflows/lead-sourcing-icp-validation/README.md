# Lead Sourcing + ICP Validation

Pulls leads from Apify, validates ICP fit with Gemini AI, checks email deliverability via Clearout, and writes everything to Airtable. Runs on a schedule. Skips leads that already have a `Safe To Send` value so reruns are idempotent.

---

## The problem

Raw lead lists from Apollo/Apify are noisy. You get staffing firms, irrelevant industries, and bad emails mixed in. Processing all of them manually before sending is too slow. Sending without filtering burns your domain.

This workflow automates the triage layer — ICP check + email check — before anything hits the send queue.

---

## Flow

```
Schedule Trigger
    └── Google Sheets (pull raw leads from "DB - Industry" sheet)
            └── Filter (drop rows where Keyword Check = FALSE)
                    └── Limit (cap at 30/run)
                            └── Airtable Upsert (write raw lead fields to Leads table)

Schedule Trigger 2
    └── Airtable Search (pull up to 20 unvalidated records from "Not Validated Data" view)
            └── Loop Over Items
                    ├── [batch item] → AI Agent (Gemini)
                    │       Checks ICP vertical match + email score
                    │       Returns: vertical_match, matched_vertical, email_check, email_score,
                    │                keyword_reasoning, email_reasoning
                    │
                    └── Information Extractor (parse AI JSON output)
                            └── If (vertical_match = true AND Safe To Send not yet set)
                                    ├── [true]  → HTTP Request (Clearout API email verify)
                                    │               └── Airtable Upsert (write all validation fields)
                                    │                       └── Loop (next item)
                                    └── [false] → Airtable Upsert (write AI results, skip Clearout)
                                                    └── Loop (next item)
```

---

## ICP verticals

The AI agent validates against 5 target verticals:

- D2C / E-commerce
- Defense / Aviation
- Fintech
- Pharma
- Semiconductor / Data Center

Staffing, RPO, and HR firms are explicitly excluded regardless of industry tag. See the workflow JSON for the full classification rules and definitions used in the system prompt.

---

## Email scoring

The agent runs a deterministic scoring algorithm (not fuzzy):

| Check | Points |
|---|---|
| Valid email structure | +20 |
| First name in local part | +15 |
| Last name in local part | +15 |
| Domain matches company domain | +25 |
| Clean pattern (firstname.lastname, etc.) | +10 |
| Generic prefix (info, support, sales...) | -20 |

Score >= 60 = VALID. Below 60 = NOT VALID.

Clearout API (SMTP-level verification) only runs on leads that pass the ICP check, to conserve API credits.

---

## Fields written to Airtable

**Stage 1 (raw ingest):**
Full Name, Company Name, Position, Email, Industry, State, Domain, Employee Size, Country, Company Description, Company LinkedIn, LinkedIn Url, Website

**Stage 2 (validation):**
Email Check, AI Summary, Vertical Match, Reasoning, Status, Safe To Send, Smtp Provider, MX Record, Domain (Clearout API), Account, AI Response (Clearout API)

---

## Nodes

| Node | Type | Purpose |
|---|---|---|
| Schedule Trigger | Trigger | Run ingest on interval |
| Get row(s) in sheet | Google Sheets | Pull raw leads |
| Filter | Filter | Drop non-ICP rows |
| Limit | Limit | Cap at 30 leads/run |
| Create or update a record | Airtable | Upsert raw fields |
| Schedule Trigger 2 | Trigger | Run validation on interval |
| Search records | Airtable | Pull unvalidated batch (max 20) |
| Loop Over Items | Split in Batches | Process one lead at a time |
| AI Agent | LangChain Agent | Gemini ICP + email scoring |
| Google Gemini Chat Model | LLM | Powers AI Agent |
| Information Extractor | LangChain | Parse structured JSON from agent output |
| If | Conditional | Route by vertical_match |
| HTTP Request | HTTP | Clearout email verify |
| Create or update a record 1 | Airtable | Write validation results |
| Get dataset items | Apify | Alternative Apify dataset source |
| Create or update a record 2 | Airtable | Upsert Apify-sourced leads |

---

## Setup

1. Import `lead-sourcing-icp-validation.json` into n8n
2. Create credentials:
   - Apify OAuth2 → replace `YOUR_APIFY_CREDENTIAL_ID`
   - Google Gemini (PaLM) API → replace `YOUR_GEMINI_CREDENTIAL_ID`
   - Airtable Personal Access Token → replace `YOUR_AIRTABLE_CREDENTIAL_ID`
   - Google Sheets OAuth2 → replace `YOUR_GOOGLE_SHEETS_CREDENTIAL_ID`
3. Update IDs in nodes:
   - `YOUR_APIFY_DATASET_ID` → your Apify dataset ID
   - `YOUR_AIRTABLE_BASE_ID` / `YOUR_AIRTABLE_TABLE_ID` → your base and table
   - `YOUR_AIRTABLE_VIEW_NOT_VALIDATED` → a view filtered to records with no `Safe To Send` value
   - `YOUR_GOOGLE_SHEETS_DOC_ID` / `YOUR_SHEET_TAB_ID` → your leads sheet
4. In the HTTP Request node, replace `YOUR_CLEAROUT_API_KEY` with your Clearout token
5. Activate both schedule triggers
