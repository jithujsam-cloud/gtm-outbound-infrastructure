# GTM Engineering Portfolio

I build systems for outbound and revenue operations, combining hands-on GTM experience with software, data pipelines, API integrations, and workflow automation.

This repository contains selected projects and supporting workflow definitions. They are related to the same operational problems, but they are **not one fully integrated end-to-end platform**. Each project's status and limitations are called out below.

## Featured Projects

### 1. GTM Validation Tool — Lead Data Processing

**Code:** [gtm-validation-tool](gtm-validation-tool/README.md)

A Next.js application for importing lead lists, scoring ICP fit, validating email addresses, and reviewing results.

**Implemented capabilities**
- CSV import, column mapping, and a spreadsheet-style lead review interface.
- Gemini and OpenAI structured-output classification.
- Clearout email verification with provider rate-limit handling.
- PostgreSQL-backed job processing with lease-based claiming, atomic result writes, retries, and API cost logging.
- Supabase authentication and row-level security.

**Engineering focus:** asynchronous processing, database-backed queues, provider failures, retry behaviour, API cost visibility, and data ownership.

**Quality checks:** strict TypeScript enforced at build time, and unit tests (Vitest) on the retry, rate-limit, Clearout parsing and cost logic, all run in CI on every push.

**Known gaps:** no integration tests yet for the job processor against a real database, and some database security changes have not been verified against a live staging database. These are active engineering tasks, not claims of production readiness.

### 2. Klaroh — Agency Operations and Client Visibility

**Product:** [klaroh.online](https://klaroh.online) · [Open the app](https://app.klaroh.online)

Klaroh helps cold-email and lead-generation agencies monitor campaign performance across clients and share a branded report with each client, without giving clients access to the agency's sending tools.

**What it includes**
- Cross-client campaign overview and campaign comparisons.
- A unified inbox for prospect replies.
- Sending infrastructure views for mailboxes, warmup, capacity, and domain DNS checks.
- Branded client portals with configurable visibility and rotatable secret links.
- Instantly integration, scheduled and on-demand sync, and sync history.
- Workspace membership, server-side authorization, PostgreSQL row-level security, encrypted provider credentials, and API rate limiting.

**Engineering focus:** provider API integration, normalized data models, scheduled synchronization, tenant isolation, secure client-facing reports, metric definitions, and operational visibility.

**Current scope:** private beta. Instantly is the only working sending-tool integration. Klaroh reads campaign data; it does not send email. Data is synced rather than live, and some metrics are deliberately withheld when their source cannot be verified. Billing upgrades are handled manually; there is no payment processor.

The Klaroh application lives in a separate repository. This public portfolio links to the product and describes the project; it does not contain the full Klaroh application source.

### 3. Outbound Workflow Automation

These are importable n8n workflow definitions, not hosted products.

- **[Signal-to-Pipeline](systems/signal-to-pipeline/README.md):** job-signal discovery, lead sourcing, ICP scoring, and staged email verification.
- **[Outbound Engine](systems/outbound-engine/README.md):** AI-assisted email rewriting, controlled sending cadence, and open-event tracking.

Running these workflows requires n8n and the third-party accounts and credentials documented in their individual READMEs.

## Technical Areas Demonstrated

| Area | Evidence |
|---|---|
| GTM operations | Prospecting signals, ICP qualification, outbound workflows, client reporting |
| Web applications | Next.js, React, TypeScript, Tailwind CSS |
| Data and databases | PostgreSQL, Supabase, schema migrations, RLS, database functions |
| APIs and integrations | Instantly, Clearout, Gemini, OpenAI, Apify, Airtable |
| Reliability | Job leases, retries, rate limits, atomic writes, sync status and error logging |
| Security | Workspace authorization, row-level security, encrypted provider keys, scoped public client links |
| Automation | Importable n8n workflows and scheduled jobs |

## Repository Guide

- **GTM Validation Tool:** implemented application; requires a Supabase project and provider credentials to exercise the full flow.
- **Signal-to-Pipeline and Outbound Engine:** importable n8n workflow definitions; external credentials are required.
- **systems/client-visibility-layer:** an earlier, smaller client-portal prototype. It is **not the current Klaroh application** and should not be treated as the production product. Its agency pages and API routes sit behind a single shared password (HTTP Basic Auth); it has no per-user accounts.
- **systems/klaroh/mental-model.md:** supporting architecture notes. The current product's implementation is in the separate Klaroh repository.
- **site/:** my personal website and CV (static HTML, deployed separately). It is not part of the GTM systems above.

## Honest Scope

This repository is a portfolio of related GTM engineering work, not a single production system connecting every stage. The workflow exports need external services, the validation tool still needs integration tests, and the smaller portal prototype uses a single shared password rather than real accounts. Klaroh is a separate private-beta product with its own implementation and current scope documented above.

For setup instructions, use each project's README. Do not commit API keys, service-role credentials, real prospect data, or customer data.

---

[LinkedIn](https://in.linkedin.com/in/jithujsam)
