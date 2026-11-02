# Additional language campaigns launched on 2 November 2026

18 Search campaigns were created and enabled in the ScanInbox Google Ads account (UI `ocid=8574215478`). The existing Ireland/English, Latvia/Latvian and Germany/German campaigns were not changed. The account now has 21 campaigns.

## Budget and targeting

- EUR50 **total campaign budget per new campaign**, not EUR50 per day; EUR900 across the 18 new campaigns.
- Start: 2 November 2026. End: 2 December 2026. Dates use the account's Europe/Riga time zone.
- One country and one matching language per campaign; Google Search and Search Partners.
- Manual CPC: EUR0.90 default ad-group bid and keyword bid.
- Mobile and tablet adjustments: -100%; desktop traffic only.
- No EU political ads.

| Language | Country | Landing page |
| --- | --- | --- |
| Czech | Czechia | https://scaninbox.me/cs/ |
| Danish | Denmark | https://scaninbox.me/da/ |
| Spanish | Spain | https://scaninbox.me/es/ |
| French | France | https://scaninbox.me/fr/ |
| Croatian | Croatia | https://scaninbox.me/hr/ |
| Italian | Italy | https://scaninbox.me/it/ |
| Lithuanian | Lithuania | https://scaninbox.me/lt/ |
| Hungarian | Hungary | https://scaninbox.me/hu/ |
| Dutch | Netherlands | https://scaninbox.me/nl/ |
| Polish | Poland | https://scaninbox.me/pl/ |
| Portuguese | Portugal | https://scaninbox.me/pt/ |
| Romanian | Romania | https://scaninbox.me/ro/ |
| Slovak | Slovakia | https://scaninbox.me/sk/ |
| Slovenian | Slovenia | https://scaninbox.me/sl/ |
| Finnish | Finland | https://scaninbox.me/fi/ |
| Swedish | Sweden | https://scaninbox.me/sv/ |
| Greek | Greece | https://scaninbox.me/el/ |
| Bulgarian | Bulgaria | https://scaninbox.me/bg/ |

Each campaign has three ad groups: Printer SMTP, Scan-to-Email Setup, and Microsoft 365 Alternative. Each group has one responsive search ad and four keywords (two native-language terms, each in exact and phrase match). Total: 54 ad groups, 54 ads, 216 keywords. This is a focused initial set, not the older approximately 200-keyword-per-language draft in `../../campaigns/`.

## Files

- `scaninbox-campaigns.csv`: the actual campaign creation input, initially paused.
- `scaninbox-ad-groups.csv`: ad groups and explicit EUR0.90 default bids.
- `scaninbox-ads.csv`: localized headlines, descriptions, landing URLs, and a pinned prelaunch headline.
- `scaninbox-keywords.csv`: actual keywords, match types and bids.
- `scaninbox-enable.csv`: the final status changes from paused to enabled.
- `build-campaigns.ps1`: reproduces ad groups, ads and keyword CSVs from the campaign input; checks headline and description lengths.

Column names, documentation and code are in English. Ad copy and search keywords remain in the target market's language because these are the actual localized advertising assets.

**These CSVs are launch records, not idempotent migrations. Do not reapply their Add actions to the live account.** Check campaign IDs and live state first. No credentials or lead data are included.

## Verification and launch record

Google's upload preview accepted all 18 campaign rows with zero errors; campaign creation finished successfully. The combined asset preview accepted all 324 rows with zero errors and finished successfully. The final enable preview accepted all 18 status changes with zero errors; activation finished successfully. The campaign table showed enabled new campaigns with EUR50/campaign and the correct end date.

All 18 destination languages were checked using the live site's language selector, then reading the final URL, selected language, HTML language and translated heading after navigation settled. Early reads during navigation showed temporary Latvian text or the previous URL; completed checks matched the intended locale in all 18 markets. No test leads were submitted.

Campaign activation is not proof of ad approval or delivery. Check policy review, keyword eligibility, search terms and actual impressions after processing. Search-volume estimates were not collected for this new focused keyword set. The native copy has not had a professional linguistic review.

## Product and conversion constraints

ScanInbox is a service in development. Ads invite prelaunch registration and do not promise immediate service availability. The offer is one free device-year from launch for the first 50 sign-ups; the published price is EUR10/device/year. The prelaunch headline is pinned to position 1.

The existing lead conversion is `ScanInbox - Успешная заявка` (`ctId=7827472313`), Ads tag `AW-18484946256`, GTM `GTM-W4W896PC`, expected site event `generate_lead`. Its last verified status before this expansion was Awaiting conversions; attributed lead receipt remains unconfirmed. No tags, conversion settings or access rights were changed in this launch. Page views and remarketing pings must not be counted as leads.

## Monitoring

Compare impressions, clicks, CTR, spend, average CPC, attributed sign-ups and cost per sign-up by market. Investigate targeting, negative conflicts, bid/rank constraints and policy status before increasing budgets when delivery is low. Zero impressions alone do not establish a lack of demand. The older broad CSVs remain historical drafts; this folder records what was actually submitted on 2 November.
