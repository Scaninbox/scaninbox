# Google Ads improvements — 3 November 2026

Customer: 821-195-4796 (UI account scope 8574215478). Times use Europe/Riga.

## English keywords — applied

`english-keywords.csv` adds 216 keywords to the 18 campaigns launched on 2 November: 12 per campaign, split across the existing three ad groups. Each of six English terms has exact and phrase match variants. Existing native keywords remain enabled. Maximum CPC remains EUR0.90.

Google Ads preview: 216 successful rows, zero errors. Application finished successfully at 12:23 on 3 November. Execution ID: `5203890453419736820`.

## Callouts and sitelinks — applied

`callouts-sitelinks.csv` adds four localized callouts and five localized section sitelinks per campaign: 72 callouts and 90 sitelinks in total. The destinations are the existing audience, setup, pricing, FAQ and signup sections on each campaign's language page. These are section links, not additional product pages.

Google Ads preview: 162 successful rows, zero errors. Application finished successfully at 12:28 on 3 November. Execution ID: `4810695599204492942`. The older Google callout sample used an obsolete row type; the accepted current type is `Callout`.

## Search ad improvements

`improved-ads.csv` edits the 54 existing ads in the 18 new campaigns, using their exported ad IDs. Each has 15 unique headlines and four descriptions. Group-specific localized text comes from the repository's native campaign drafts, supplemented by the corresponding English technical search terms. The existing prelaunch headline stays pinned in position 1. Existing URLs and enabled status are retained.

Before: eight headlines and two descriptions, identical across the three groups in each language. Exported strength was Poor for all 54 new ads. After the edit, Google must reassess strength and policy eligibility; a higher strength score or delivery is not guaranteed.

## Lead conversion — blocked on GTM access

The signed-in account `ingmars.j@gmail.com` has no containers listed in Google Tag Manager. Therefore the published configuration of `GTM-W4W896PC` could not be inspected or changed. The site source emits `generate_lead` only after the API returns `created`, excluding preview mode and duplicate updates. That event alone does not prove Google Ads conversion receipt.

Required configuration to inspect in GTM:

- Google Ads conversion ID: `18484946256`.
- Conversion label: `ZboxCLn_tpQdENDKp-5E`.
- Existing Ads conversion: `ScanInbox - Успешная заявка`, ctId `7827472313`.
- Custom Event trigger: exact event name `generate_lead`.
- Check the Google tag, Conversion Linker and Cookiebot consent integration before publishing.
- Verify that the actual conversion tag fires once for a newly saved lead, respects consent, and does not fire for page views, duplicate updates, preview submissions or follow-up survey answers.

No new test lead was submitted. Do not treat page-view or remarketing pings as lead conversions. Do not add a second direct conversion implementation without first checking the existing GTM tags for duplicate counting.

## Unchanged

No campaign budgets, bidding settings, targeting, campaign end dates, account access or site tracking code were changed. Each new campaign retains its EUR50 total period budget through 2 December 2026; this is not EUR50 per day. The original ENG, LV and DE campaigns are outside these keyword, asset and ad-text imports.

## Next checks

Review policy and ad-strength reassessment, keyword eligibility, relevant search terms and actual impressions after processing. Compare costs and verified lead conversions before considering higher bids or budgets. Resolve GTM access and conversion receipt before using lead-based automated bidding.
