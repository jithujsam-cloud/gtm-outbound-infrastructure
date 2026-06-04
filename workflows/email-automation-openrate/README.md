# Email Automation + Open Rate Tracking

Runs on a 15-minute schedule, weekdays only, 9am-5pm IST. Pulls leads marked safe-to-send from Airtable, rewrites each email with Claude (Anthropic) so no two sends are identical, fires via Gmail with a tracking pixel embedded, then records send status and open timestamp back to Airtable when the pixel fires.

---

## The problem

Two things kill cold email deliverability and reply rates: identical copy sent at machine speed, and no signal on what actually landed.

This workflow solves both. Claude rewrites each email differently on every pass — different opening, different framing, same core message. The random delay between sends mimics human send patterns. The pixel closes the loop so you know which emails got opened, not just sent.

---

## Flow

```
⏰ Run Every 15 Minutes
    └── Check if Weekday (not Sat/Sun)
            └── Check Business Hours (9am-5pm)
                    └── Airtable Search ("Email Sent" view — leads not yet contacted)
                            └── If (Safe To Send = "yes")
                                    └── Limit to 6/run
                                            └── Loop Over Items
                                                    └── [batch item]
                                                            ├── Generate Random Wait (0-3 min float)
                                                            └── Prepare Contact Data
                                                                    (set Subject, Body template,
                                                                     Contact Person, Company, Position,
                                                                     Email, randomNumber)
                                                                    └── AI Email Personalizer (Claude)
                                                                            ├── JSON Output Parser
                                                                            └── [output: subject + HTML body]
                                                                                    └── Send Email via Gmail
                                                                                            (pixel img tag appended)
                                                                                            └── Update Airtable
                                                                                                (Email Sent = true)
                                                                                                └── Wait (randomNumber min)
                                                                                                        └── Loop (next lead)

Webhook: /YOUR_PIXEL_WEBHOOK_ID  (fires when recipient opens email)
    └── Create pixel data (1x1 PNG base64)
            └── Convert to binary
                    └── Get Airtable record (by lead ID from ?q= param)
                            └── Filter (skip if Opened On already set)
                                    └── Update Airtable (Opened On = now)
                                            └── Return pixel image to client
```

---

## How the AI personalizer works

The system prompt instructs Claude to rewrite the email on every call with a different opening, sentence structure, and framing. Hard rules:

- Keep the core value prop and CTA intact
- Preserve all links exactly
- Output valid HTML only, no markdown
- Allowed tags: `<div>`, `<br>`, `<ul>`, `<li>`, `<strong>`, `<a>`
- No em dashes — hyphens only
- Rotate opening lines every time

The output parser enforces a structured JSON response: `{ subject, body }`. Subject is also rewritten, not just the body.

---

## Open rate tracking

Each outbound email has a 1x1 transparent PNG appended:

```html
<img src="https://YOUR_N8N_INSTANCE/webhook/YOUR_PIXEL_WEBHOOK_ID?q=AIRTABLE_RECORD_ID"
     width="1" height="1" style="display:none;" />
```

When the recipient opens the email, their client fetches the image. The webhook fires, extracts the record ID from `?q=`, looks up the lead in Airtable, and writes the open timestamp to `Opened On` — once only (Filter node prevents double-writes).

This is a standard pixel tracker implementation. It works against most desktop clients. Gmail on Android and iOS blocks remote images by default unless the user has enabled "always show images" — so open rates are an undercount, not a full picture.

---

## Email template (base)

```
Subject: Most recruiters send CVs. We solve hiring problems.

Hello {First Name},

I noticed that {Company Name} is expanding, and most teams at this stage get stuck
in 30-60 day hiring cycles. Most teams end up spending hours screening profiles
that never convert.

We solve this by delivering pre-vetted mid- to senior-level candidates with an
80% CV selection rate and 70-80% joining rate, so you are only evaluating people
who are likely to close.

We have worked with VeriPoint Technologies, Maven Silicon, Formix International,
Nexxbase (GoNoise) and more to cut hiring time nearly in half without compromising
on quality.

If this aligns with you, I would be open to a 30-minute introductory call to
explore how we can work together.

Best regards,
Ishaan Davar
Founder @ Vish
+91 99106 83662
```

Claude rewrites this on every send. The contact name and company name are injected dynamically.

---

## Airtable fields used

**Read:**
- Full Name, Company Name, Position, Email, Safe To Send

**Written after send:**
- Email Sent (boolean)

**Written on open:**
- Opened On (datetime)

---

## Nodes

| Node | Type | Purpose |
|---|---|---|
| Run Every 15 Minutes | Schedule Trigger | 15-min cadence |
| Check if Weekday | If | Skip Sat/Sun |
| Check Business Hours (9am-5pm) | If | Skip outside hours |
| Search records | Airtable | Pull "Email Sent" view |
| If | If | Filter Safe To Send = yes |
| Limit to 6/run | Limit | Cap sends per run |
| Loop Over Items | Split in Batches | One lead at a time |
| Generate Random Wait | Code | Random float 0-3 |
| Prepare Contact Data | Set | Assemble email fields |
| AI Email Personalizer | LangChain Agent | Claude rewrite |
| Anthropic Chat Model | LLM | Powers personalizer |
| JSON Output Parser | Output Parser | Enforce subject+body JSON |
| Send Email via Gmail | Gmail | Outbound send |
| Update record | Airtable | Mark Email Sent = true |
| Random Delay | Wait | Human-paced sending |
| Request img | Webhook | Pixel fire endpoint |
| Create data pix | Set | 1x1 PNG base64 |
| Create img bin | Convert to File | Binary PNG response |
| Get a record | Airtable | Fetch lead by ID |
| Filter | Filter | Skip if already opened |
| Update record1 | Airtable | Write Opened On timestamp |

---

## Setup

1. Import `email-automation-openrate.json` into n8n
2. Create credentials:
   - Gmail OAuth2 → replace `YOUR_GMAIL_CREDENTIAL_ID`
   - Anthropic API → replace `YOUR_ANTHROPIC_CREDENTIAL_ID`
   - Airtable Personal Access Token → replace `YOUR_AIRTABLE_CREDENTIAL_ID`
3. Update IDs:
   - `YOUR_AIRTABLE_BASE_ID` / `YOUR_AIRTABLE_TABLE_ID` → your Airtable base and table
   - `YOUR_AIRTABLE_VIEW_EMAIL_SENT` → a view showing leads not yet contacted (Email Sent is unchecked)
   - `YOUR_PIXEL_WEBHOOK_ID` → the webhook path for open tracking (generate a UUID)
4. In the Gmail node, update `sendTo` from `your@email.com` to your sending address
5. Update the pixel `src` URL in the Gmail node to your n8n instance URL + webhook path
6. Update the email signature block inside `Prepare Contact Data` to your details
7. Activate the schedule trigger and the webhook
8. Test: send to a test address, open the email, check that `Opened On` populates in Airtable

**Note:** n8n webhooks require the workflow to be active to respond. If you restart your n8n instance, reactivate the workflow to restore the pixel endpoint.
