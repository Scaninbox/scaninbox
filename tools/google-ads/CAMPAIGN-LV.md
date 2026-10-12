# Latvia campaign CSV and settings

## Existing campaign

Account: **821-195-4796**. Campaign ID: **24348983011**.
Campaign name: **ScanInbox | LV | Latvia | Desktop | EUR25**.

This records the configuration observed and updated in Google Ads on
**12 October 2026**. The campaign is enabled with a future start date of
**13 October 2026** and an end date of **12 November 2026**, in Europe/Riga
account time. Check the live account before making changes; this is a
documented snapshot, not a live export of performance or policy status.

## CSV and companion data

[Download the CSV](ScanInbox-LV-187-Keywords-and-Ads.csv).
The UTF-8 file uses the same 21-column Google Ads Editor layout as the
[Ireland CSV](ScanInbox-ENG-154-Keywords-and-Ads.csv): a header, **187 keyword
rows** and **three responsive search ad rows**. There are **186 enabled
keywords** and **one paused duplicate**. All keywords use Exact match and a
**€0.10 maximum CPC bid**.

| Live ad-group identifier | English description | Enabled keywords | Paused keywords | Ads |
| --- | --- | ---: | ---: | ---: |
| Printeru SMTP | Printer SMTP | 57 | 0 | 1 |
| Skenēšana uz e-pastu | Scan-to-email setup | 91 | 1 | 1 |
| Microsoft 365 un SMTP | Microsoft 365 and SMTP | 38 | 0 | 1 |
| Total | | 186 | 1 | 3 |

The live ad-group identifiers are retained exactly so imports can match the
existing groups. Documentation and data field names are English; localized
keywords, ad copy and existing Google Ads identifiers retain their actual text.

The enabled set contains all **154 English keywords** from the Ireland CSV
in their corresponding groups, plus **18 additional English keywords** and
**14 Latvian keywords**. The keyword `smtp for scan to email` is enabled in
`Printeru SMTP`; its earlier copy in `Skenēšana uz e-pastu` is paused and
included in the CSV to preserve that state. Do not re-enable that copy when
comparing groups.

Each ad has six headlines and two descriptions, with the final URL
`https://scaninbox.me/lv/`. Display paths and headline pinning are not set.
The third description column stays empty to preserve the shared CSV schema.

Companion JSON files:

- [latvian-keywords.json](data/latvian-keywords.json): campaign metadata and
  keyword records with `ad_group`, `keyword`, `match_type`, `max_cpc_eur` and
  `status` fields. Keyword text does not include Exact-match brackets.
- [Latvian-Ad-Drafts.json](data/Latvian-Ad-Drafts.json): ads identified by
  `ad_group`, with headlines, descriptions, status, final URL and empty paths;
  `headline_1_position: null` means no pin.

These are separate from the English inputs. The existing Python preparation
and launch scripts are tied to Ireland and do not consume these Latvian files.

## Import behavior

**The campaign already exists. Do not create another campaign by changing its
name during import.** Download current changes in Google Ads Editor and match
the campaign and groups above before reviewing the proposed changes.

As in the Ireland CSV, every row deliberately sets **Campaign status = Paused**
for safe import. This differs from the enabled live campaign. Posting that
field to the existing campaign may pause it; review the status change before
posting. The paused duplicate has its own **Status = Paused**, which should
remain paused regardless of the campaign status. Ad-group status is Enabled.

The CSV only contains keywords and ads. It does **not** configure the total
budget, dates, location, language, devices, networks or conversion goals.
**Do not enter €25 as a daily budget.** Compare all settings below in the live
account. Review whether existing ads are matched or new ads are proposed to
avoid creating duplicates. An import is not necessary just to archive these
files in GitHub.

## Campaign settings and comparison

| Setting | Latvia | Ireland |
| --- | --- | --- |
| Campaign ID | 24348983011 | 24331063425 |
| Location | Latvia | Ireland |
| Location option | Presence: people in or regularly in the location | Same |
| Languages | Latvian and English | English |
| Ad language / landing page | Latvian / `/lv/` | English / `/en/` |
| Keyword languages | Latvian and English | English |
| Enabled keyword count | 186 | 154 |
| Dates (Europe/Riga) | 13 October–12 November 2026 | 9 October–8 November 2026 |
| Total campaign budget | €25 | €25 |
| Bidding | Manual CPC, €0.10 maximum CPC | Same |
| Devices | Desktop; mobile and tablet bid adjustments −100% | Same |
| Networks | Google Search; search partners and Display off | Same |
| Match type | Exact | Exact |
| AI Max | Off | Off |

The Latvia campaign also has broad match and automatically created assets
off. The budget belongs to this campaign separately from Ireland's budget.
English keywords let the Latvia campaign cover relevant English searches
alongside Latvian searches; this setup does not prove a searcher's native
language. Equal keyword coverage makes the comparison more useful, but these
are different markets and dates, not a controlled A/B test.

## Policy and measurement status

Some added English keywords triggered Google's third-party consumer technical
support policy checks, and review requests were submitted during setup.
Saving a keyword or submitting a review request is not confirmation of approval
or eligibility. Check current policy and delivery status in Google Ads.

The existing primary signup conversion is shared with the Ireland experiment.
At the time of the account check, Google Ads showed that it had never received
conversion data. **A real attributed signup has not been verified.** Validate
the end-to-end signup event and attribution before interpreting zero conversions
as evidence that the keywords do not work.

Review impressions, clicks, cost, actual search terms and verified signups by
ad group and keyword. A €25 total budget, a €0.10 bid and low search demand may
produce too little data to rank every keyword reliably; more keyword rows alone
do not guarantee enough observations.

## Related repository changes

Nimda's original campaign commit, `5605ed6`, added the English CSV, this tool
directory's README and campaign instructions, Python research/preparation/launch
scripts, dependency files, root README links and credential/report exclusions
in `.gitignore`. Follow-up commit `5e8f7da` added the CSV-derived English JSON
inputs and their `.gitignore` exceptions. This Latvia addition follows the
CSV/documentation/data structure and leaves those Ireland scripts and inputs
unchanged.
