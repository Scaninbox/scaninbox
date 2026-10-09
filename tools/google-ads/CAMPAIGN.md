# English campaign CSV and import instructions

## Existing campaign

The campaign already exists in account **821-195-4796** and was enabled on
**9 October 2026**. Its ID is **24331063425** and its name is
**ScanInbox | ENG | Ireland | Desktop | EUR25**. Check the live status in Google
Ads before making changes. This document records the launch configuration;
approval, delivery and performance can change.

## CSV contents

[Download the CSV](ScanInbox-ENG-154-Keywords-and-Ads.csv).
The UTF-8 file has a header, **154 keyword rows** and **three responsive search
ad rows**. Each keyword is Exact match with a **€0.10 maximum CPC bid**.

| Ad group | Keywords | Ads |
| --- | ---: | ---: |
| Printer SMTP | 48 | 1 |
| Scan-to-Email Setup | 77 | 1 |
| Microsoft 365 Alternative | 29 | 1 |
| Total | 154 | 3 |

Each ad contains six headlines and three descriptions. Headline 1 is pinned
to position 1. All ads use `https://scaninbox.me/en/` as their Final URL.
The visible paths `printer-smtp/sign-up` and `printer-email/sign-up` are display
text; they do not change the destination URL.

The CSV sets **Campaign status = Paused** for a controlled import. Importing it
into the existing campaign may pause that campaign. The file does not define
the total budget, dates, country, language or full device restrictions; these
settings were applied separately through the API. Do not treat the CSV as a
complete campaign configuration.

## Import with Google Ads Editor

1. Open Google Ads Editor and download the correct account's latest changes.
2. Choose **Account → Import → From file** and select the CSV. The menu wording
   can vary by Editor version.
3. Check that the English headers map correctly. Keyword rows use `Match type =
   Exact`; ad rows have six `Headline` columns and three `Description` columns
   and must be recognised as responsive search ads.
4. Inspect the import preview: 154 keywords, three ads, the exact campaign
   name above and three ad groups. Review every proposed update to an existing
   item. Do not change the campaign name unless creating a deliberate new test.
5. Review targeting and budget separately using the checklist below. The
   generic `Budget` CSV column normally means a daily budget; **do not enter
   25 there** as a substitute for the €25 lifetime budget.
6. Post only the changes you intend. Keep a new test paused until targeting,
   dates, conversion tracking and Google review status have been checked.

The running Ireland campaign already contains every CSV item. No import is
needed simply to start viewing its performance.

## Launch configuration

| Setting | Value |
| --- | --- |
| Country | Ireland only; country geo ID `2372` |
| Location option | Presence: people in or regularly in the targeted location |
| Language | English; language ID `1000` |
| Network | Google Search only |
| Search partners / Display | Off / Off |
| Devices | Desktop; mobile and tablets excluded with −100% bid adjustments |
| Bidding | Manual CPC; enhanced CPC off |
| Keyword bids | €0.10; no positive bid adjustments |
| Match type | Exact; Google can still match close variants |
| AI Max | Off |
| Budget type | Campaign total budget (`CUSTOM_PERIOD`) |
| Total budget | €25 for the whole campaign, not €25/day |
| Start | 9 October 2026; enabled at approximately 15:50 Riga time |
| End | 8 November 2026, 23:59:59 Riga account time |
| Destination | `https://scaninbox.me/en/` |

For a future one-month experiment, set explicit start and end dates before
enabling. A fixed end date does not move automatically when a campaign is
paused. At an average CPC of €0.10, €25 corresponds to 250 clicks; this is budget
arithmetic, not a traffic forecast. Low demand or auction eligibility can leave
the budget partly unspent.

## Where to verify settings

- **Campaign settings:** country/language, networks, budget, bidding and dates.
- **Locations:** one included country, Ireland. Verify the Presence option.
- **Devices:** mobile and tablet bid adjustments of −100%; desktop enabled.
- **Keywords:** select the entire campaign to see all 154. Selecting
  Scan-to-Email Setup alone shows 77.
- **Ads:** inspect each ad's Final URL, signup copy and Google review status.
- **Goals / Conversions:** an enabled primary successful-signup conversion.

The published page sends `generate_lead` only for a newly saved signup, not
for duplicate updates or previews. The launch check verified the published
event and GTM conversion mapping; it did not submit a new test lead. Before
changing the conversion setup, confirm that a genuine test signup is saved
and its event is received. A questionnaire and its signup should not be counted
as two distinct people.

## Google policy review

Initial validation flagged nine phrases under Third Party Consumer Technical
Support, mainly printer `not working` queries. The creation flow used Google's
standard exemption review requests for the exemptible phrases still flagged
at creation. Such requests do not guarantee approval. Review disapprovals in
Google Ads and remove unsuitable traffic sources or request a legitimate
review where the policy does not apply.

## After launch

Choose a date range that includes 9 October 2026 or use Today. Earlier dates
will show zero launch traffic. Check impressions, clicks, actual average CPC,
spend, unique signups and completed questionnaires. Keep the €0.10 bid and €25
total budget until the next decision. Refresh the page if a banner still
shows the earlier paused status, then confirm the actual campaign and ad-group
statuses.
