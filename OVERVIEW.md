# JIRA Creator — Project Overview

A TypeScript command-line tool for creating JIRA Cloud tickets directly through the
JIRA REST API v3. Core ticket creation needs no AI — just a JIRA API token. An optional
`uac` command additionally uses the Google Gemini API to draft acceptance criteria.

## What It Does

`jira-creator` lets you create JIRA issues from the terminal in three ways:

1. **Interactively** — answer a few prompts to create a single ticket.
2. **From templates** — guided, structured flows for common issue types
   (Bug Report, User Story, Technical Task, Epic) that assemble well-formatted descriptions.
3. **In bulk** — import many tickets at once from a `.csv`, `.json`, or `.txt` file,
   with a preview and per-ticket success/failure reporting.

It also includes helper commands to verify your credentials and inspect a project's
metadata before you start creating.

Separately, the **`uac`** command generates **User Acceptance Criteria** from a free-text
or markdown requirement using **Google Gemini**. It writes two files to `output-uac/` with
the same basename: a markdown document and a bulk-compatible JSON **ticket template**
(`summary` = the title, `description` = the UAC body, plus `issuetype`/`projectKey`/`labels`).
The markdown follows the house JIRA ticket template
(`claude-planning/JIRA-TICKET-DESCRIPTION-TEMPLATE.md`): a `[feature][sub] description`
title, a Description block of resource links, and numbered uppercase Gherkin
(GIVEN/WHEN/THEN) scenarios with optional EN/ID copy tables and Figma placeholders. `uac`
needs a `GEMINI_API_KEY` but no JIRA credentials, and does not create the ticket itself —
feed the generated JSON to `bulk` to create it.

The **`epic`** command goes one step further: given an epic description, Gemini breaks it
into a set of child tasks, and the command creates the Epic plus all child issues (each
linked to the epic) in a single run. It needs both `GEMINI_API_KEY` and JIRA credentials;
use `--dry-run` to preview/save the breakdown plan without creating anything.

## Why It Exists

Creating JIRA tickets through the web UI is slow and repetitive, especially for bulk
work or for enforcing consistent ticket structure across a team. This tool keeps the
workflow in the terminal, requires only a free JIRA API token, and standardizes ticket
formatting through reusable templates.

## Commands

| Command | Description |
|---|---|
| `whoami` | Verify the connection and credentials (`GET /myself`) |
| `list-projects` | List all visible JIRA projects |
| `list-types <projectKey>` | List the issue types available in a project |
| `create [-p KEY]` | Create a single ticket interactively |
| `template [-p KEY]` | Create a ticket from a structured template |
| `bulk <file> [-p KEY] [-o out.json]` | Create many tickets from a file |
| `uac [text] [-f file] [-l en\|id] [-o dir] [-m model] [-p KEY] [--type TYPE]` | Generate UAC via Google Gemini → `output-uac/<slug>.md` + `<slug>.json` ticket template |
| `epic [text] [-f file] [-p KEY] [-m model] [-l en\|id] [--dry-run]` | Create an Epic + Gemini-generated breakdown of child tasks (linked to the epic) |

**Flags:** `-p, --project <key>` overrides the default project; `-o, --output <file>`
(bulk only) saves results to a JSON file. For `uac`: `-f/--file` reads the requirement
from a `.md`/`.txt` file, `-t/--text` passes it inline, `-o/--out-dir` sets the output
folder (default `output-uac`), `-l/--lang` picks the output language (`en` default / `id`),
`-m/--model` overrides the Gemini model, `-p/--project` sets the template's project key, and
`--type` sets the issue type (Story/Task/Bug/Epic) without the interactive prompt.

## How It Works

The codebase is small and framework-free, split into eight single-responsibility modules
under `src/`:

- **`index.ts`** — CLI entry point. Defines all commands (`commander`) and owns every
  piece of user-facing I/O: interactive prompts (`prompts`), spinners (`ora`), and
  colored output (`chalk`). The other modules are pure logic.
- **`jira-client.ts`** — all JIRA REST API calls, routed through a single `jiraFetch`
  wrapper that handles Basic authentication and error unwrapping. Includes `toADF()`,
  a markdown→Atlassian Document Format converter (headings, bullet lists, GFM tables,
  inline links and bold, with single newlines preserved as line breaks) used for issue
  descriptions in the v3 API.
- **`templates.ts`** — the registry of ticket templates. Each template declares its
  prompt fields and builds a consistently formatted summary and description.
- **`file-reader.ts`** — parses and validates bulk input from CSV, JSON, and TXT files.
- **`gemini-client.ts`** — a single `generateContent()` wrapper around the Google Gemini
  REST API (used only by the `uac` command), mirroring the `jiraFetch` pattern.
- **`uac.ts`** — builds the UAC prompt (which enforces the house JIRA ticket template),
  calls Gemini, tidies the markdown spacing, and saves both the `.md` and a bulk-compatible
  JSON ticket template (`splitUAC` → `buildTicketTemplate` → `saveTicketTemplate`) to
  `output-uac/<title-slug>-<timestamp>.{md,json}`.
- **`epic.ts`** — asks Gemini (via forced-JSON `generateJSON`) to break an epic into a set
  of child tasks, saves the plan, and feeds it to `createTicket`/`createTicketsBulk` so the
  epic and its linked children are created together.
- **`types.ts`** — shared TypeScript interfaces.

Project key resolution is consistent across all commands: the `--project` flag wins,
then the `JIRA_PROJECT_KEY` environment variable, then a fallback default.

## Tech Stack

- **Language:** TypeScript (strict mode), targeting Node.js 18+
- **Runtime:** Node.js with native `fetch`
- **Key libraries:** `commander` (CLI), `prompts` (interactive input), `chalk` & `ora`
  (terminal UX), `csv-parse` (CSV parsing), `dotenv` (configuration)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials
cp .env.example .env
#    then edit .env with JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN

# 3. Verify the connection
npx ts-node src/index.ts whoami
```

Get a JIRA API token at
<https://id.atlassian.com/manage-profile/security/api-tokens>.

### Configuration

Credentials and defaults are read from `.env`:

| Variable | Required | Description |
|---|---|---|
| `JIRA_BASE_URL` | ✅ | e.g. `https://your-domain.atlassian.net` |
| `JIRA_EMAIL` | ✅ | Your Atlassian account email |
| `JIRA_API_TOKEN` | ✅ | API token from the link above |
| `JIRA_PROJECT_KEY` | — | Default project key (e.g. `ENG`) |
| `JIRA_DEFAULT_ISSUE_TYPE` | — | Default issue type (e.g. `Task`) |
| `JIRA_DEFAULT_PRIORITY` | — | Default priority (e.g. `Medium`) |
| `GEMINI_API_KEY` | for `uac` | Google Gemini API key ([get one](https://aistudio.google.com/app/apikey)) |
| `GEMINI_MODEL` | — | Gemini model (default `gemini-2.5-flash`) |

## Building for Production

```bash
npm run build          # compiles src/ → dist/
node dist/index.js whoami
```

## Input File Formats (Bulk)

**CSV** — the `summary` column is required; `labels` and `components` are
pipe-(`|`)-delimited:

```csv
summary,description,issuetype,priority,labels,components
Login crash on iOS,User cannot log in...,Bug,High,bug|ios,auth
```

**JSON** — an array of ticket objects:

```json
[
  {
    "summary": "Implement Google OAuth2",
    "issuetype": "Story",
    "priority": "High",
    "labels": ["feature", "auth"],
    "components": ["backend"]
  }
]
```
