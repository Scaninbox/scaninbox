# ScanInbox Google Ads API tools

This directory contains the English campaign CSV and the Python scripts used
to research and prepare the ScanInbox Ireland experiment. The scripts run
locally with Google's official Python client library. They are not part of
the public website build.

## Files

| File | Purpose |
| --- | --- |
| `ScanInbox-ENG-154-Keywords-and-Ads.csv` | Google Ads Editor import: 154 exact-match keywords and three responsive search ads. |
| [CAMPAIGN.md](CAMPAIGN.md) | CSV import instructions, targeting, budget, dates and campaign checks. |
| `ads_research.py` | Read-only account checks, language/location lookup and keyword ideas. |
| `prepare_eng_campaign.py` | Validates campaign operations; the `create` command saves a paused campaign. |
| `launch_eng_campaign.py` | Checks the original experiment and enables its specific campaign. |
| `data/keywords.json` | The complete list of 154 English keywords used by the preparation script. |
| `data/English-Ad-Drafts.json` | Six headlines and three descriptions per ad group. |
| `requirements.txt` | Supported dependency ranges. |
| `requirements.lock.txt` | The dependency versions used for the October 2026 experiment. |

## Current experiment

Account: `821-195-4796`. Campaign: `24331063425`.
The campaign was enabled on **9 October 2026** and ends on **8 November 2026
at 23:59:59, Europe/Riga account time**. Budget: **€25 for the whole campaign**.
Maximum CPC bid: **€0.10**. See [CAMPAIGN.md](CAMPAIGN.md) for all settings.
The creation and launch scripts are dated snapshots of that experiment.
Use read-only commands to inspect an existing campaign; do not rerun creation
or launch as a setup step. Approval and delivery status can change in Google Ads.

## Install

Use Python 3.12 or newer. Run these commands from the repository root in
PowerShell:

```powershell
cd tools/google-ads
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
.\.venv\Scripts\python.exe ads_research.py --help
```

On macOS/Linux, use `python3 -m venv .venv`, then `.venv/bin/python` in place
of `.\.venv\Scripts\python.exe` in the commands below. Use `requirements.txt`
instead of the lock file if you deliberately want newer compatible versions.

## Configure your Google access

1. Obtain access to the ScanInbox Google Ads account from an account administrator.
2. Use an approved Google Cloud project with the Google Ads API enabled and an
   appropriate API access level. Create an OAuth client of type **Desktop app**
   and configure its consent screen and permitted users.
3. Download the Desktop OAuth client JSON. Save it locally as
   `.secrets/google-ads-desktop-client.json` inside this directory. The expected
   JSON structure contains an `installed` object and a `project_id`.
4. The default Cloud project is `psyched-oxide-510920-r9`. If you use a different
   approved project, set `SCANINBOX_ADS_PROJECT` to its project ID before running
   the tool. Your OAuth user must have access to the selected Ads account.
5. Authorize locally:

```powershell
New-Item -ItemType Directory -Force .secrets
# Save the downloaded Desktop OAuth JSON in the directory above first.
.\.venv\Scripts\python.exe ads_research.py authorize
```

Open the printed authorization URL in your ordinary browser, choose the correct
Google account and finish the consent flow. The tool listens on
`http://127.0.0.1:8765/` for up to 15 minutes. It uses PKCE and saves the offline
token locally in `.secrets/google-ads-user-token.json`.

Google's `adwords` OAuth scope can authorize Ads management. The commands in
`ads_research.py` only read account data and request keyword ideas; the two
campaign scripts perform writes. Each colleague should authorize their own
access. OAuth JSON and tokens must remain outside Git commits, CSVs and docs.

To reauthorize after access is revoked, remove your local
`google-ads-user-token.json` and run `authorize` again. Do not print or send its
contents.

### Optional configuration

```powershell
# Defaults are the ScanInbox account and its approved Cloud project.
$env:SCANINBOX_ADS_CUSTOMER = '8211954796'
$env:SCANINBOX_ADS_PROJECT = 'psyched-oxide-510920-r9'

# Optional: use a credentials folder outside the checkout.
$env:SCANINBOX_ADS_SECRETS_DIR = 'C:\private\scaninbox-ads'
```

`SCANINBOX_ADS_CUSTOMER` accepts a ten-digit ID with or without hyphens.
`SCANINBOX_ADS_SECRETS_DIR` should be an absolute path. It contains both JSON
credential files. These settings are local to your terminal session.

## Read-only commands

```powershell
# Local configuration check; token existence is not a live connectivity test.
.\.venv\Scripts\python.exe ads_research.py status

# Live account connectivity check: ID, name, currency and time zone.
.\.venv\Scripts\python.exe ads_research.py account

# Available language IDs.
.\.venv\Scripts\python.exe ads_research.py languages

# Resolve Ireland's country targeting resource.
.\.venv\Scripts\python.exe ads_research.py locations --country IE --location Ireland

# Keyword ideas: English (1000), Ireland (2372), Google Search only.
.\.venv\Scripts\python.exe ads_research.py ideas --language-id 1000 --geo-id 2372 --keyword 'smtp server for scan to email' --keyword 'smtp relay service for printers' --limit 30
```

Outputs are JSON. Keyword idea requests require both a country and a language;
the network is explicitly `GOOGLE_SEARCH`. Search estimates can cover all
devices and do not forecast desktop-only traffic. Bid fields are in account
currency micros: divide by 1,000,000 to obtain currency units. A missing or
zero bid estimate does not mean the click is free. The saved CSV is the
reviewed 154-keyword list, not a promise that a fresh idea request will return
the same keywords.

## Campaign preparation and launch snapshots

`prepare_eng_campaign.py` uses the two files in `data/`, fixed Ireland/English
targeting, €25 total budget, €0.10 Manual CPC bids and the original campaign
name and dates. It creates all 154 keywords as Exact match, three ad groups and
three responsive search ads. It excludes mobile and tablet traffic, turns off
Search partners, Display and AI Max, and pins the signup headline in position 1.

```powershell
# API validation only; does not create or enable a campaign.
.\.venv\Scripts\python.exe prepare_eng_campaign.py validate

# Writes a paused campaign only after validation.
.\.venv\Scripts\python.exe prepare_eng_campaign.py create
```

The script refuses creation if the account already contains a non-removed
campaign. This protects the original experiment from duplication. For a new
experiment, review the account, name, dates and inputs in the source before
using it. Dates are fixed to 9 October–8 November 2026; they are not automatically
rolled forward. Generated plans and validation results go into ignored `reports/`.
Exemptible keyword policy violations use Google's standard review request
mechanism; saving such a keyword does not guarantee approval or serving.

`launch_eng_campaign.py` is the original, account-specific launch snapshot. It
checks the €25 total budget, €0.10 exact-match keywords, Google Search settings,
the published signup event and conversion-tag mapping. It then validates and
applies an enable operation to campaign `24331063425` and reads it back. Its
date guard deliberately limits it to **9 October 2026**. It does not submit a
new test lead or prove that Google attributed a new conversion.

```powershell
# Write operation; original experiment only. Not needed for the live campaign.
.\.venv\Scripts\python.exe launch_eng_campaign.py
```

Do not remove the date guard to reactivate an old experiment. A future launch
needs reviewed dates, targeting, budget and conversion tracking. Neither
campaign script runs on import or through the website build.

## Troubleshooting

- **Client configuration missing:** check the local OAuth JSON path and
  `SCANINBOX_ADS_SECRETS_DIR`.
- **Unexpected project:** set `SCANINBOX_ADS_PROJECT` to the approved project
  used by the downloaded OAuth JSON.
- **Authorization already saved:** use `account` to test it; reauthorize only
  if the token is invalid or access has changed.
- **Access denied:** confirm your Google account has Ads access and the Cloud
  project's API access is approved.
- **Port 8765 unavailable:** stop the other local authorization process and retry.
- **Under review:** inspect Google Ads policy status. This is separate from
  whether a campaign is enabled.

## Google documentation

- [OAuth setup](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [Google Ads API access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)
- [CSV preparation](https://support.google.com/google-ads/editor/answer/56368?hl=en)
- [CSV columns](https://support.google.com/google-ads/editor/answer/57747?hl=en)
- [Campaign total budgets](https://support.google.com/google-ads/answer/10486938?hl=en)
- [Policy exemption review requests](https://developers.google.com/google-ads/api/docs/policy-exemption/overview)
