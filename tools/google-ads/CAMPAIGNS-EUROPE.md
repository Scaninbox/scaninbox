# Campaigns for the other 19 site languages

Prepared on **19 October 2026** for the 19 site languages that had no campaign
yet (Latvian and English/Ireland already exist). **Status: prepared in this
repository, not yet created in Google Ads.** Account **821-195-4796**. Nothing
here was imported or enabled; check the live account before relying on it.

## Settings (one campaign per language)

| Setting | Value |
| --- | --- |
| Name | `ScanInbox \| <LANG> \| <Country> \| Desktop \| EUR50` |
| Location | One country per language (table below), Presence option |
| Languages | The language of the page plus English |
| Network / devices | Google Search only; desktop (mobile and tablet −100%) |
| Bidding | Manual CPC, **€0.25** maximum CPC |
| Total budget | **€50 per campaign for the whole run**, 19 × €50 = up to **€950** |
| Dates | 19 October – 18 November 2026 (Europe/Riga account time) |
| Destination | `https://scaninbox.me/<lang>/` |
| Ad groups | `Printer SMTP`, `Scan-to-Email Setup`, `Microsoft 365 Alternative` |

The €50 is a *total* campaign budget (not per day), like the Ireland and Latvia
campaigns, so Google spends at most that and may spend less in small markets.
The generic CSV `Budget` column means a daily budget: do not enter 50 there.

| Lang | Country (geo ID) | Lang | Country (geo ID) |
| --- | --- | --- | --- |
| it | Italy (2380) | hr | Croatia (2191) |
| fr | France (2250) | hu | Hungary (2348) |
| de | Germany (2276) | lt | Lithuania (2440) |
| bg | Bulgaria (2100) | nl | Netherlands (2528) |
| cs | Czechia (2203) | pl | Poland (2616) |
| da | Denmark (2208) | pt | Portugal (2620) |
| el | Greece (2300) | ro | Romania (2642) |
| es | Spain (2724) | sk | Slovakia (2703) |
| fi | Finland (2246) | sl | Slovenia (2705) |
| | | sv | Sweden (2752) |

## Keywords and ads

- **154 English keywords** per campaign, copied from the
  [Ireland CSV](ScanInbox-ENG-154-Keywords-and-Ads.csv) into their original ad
  groups, **Exact** match.
- **12–16 native-language keywords per ad group** (36–48 per language, 811 in
  total), **Phrase** match, written without troubleshooting or support wording
  (those phrases triggered Google's Third Party Consumer Technical Support
  review on the English set).
- One responsive search ad per ad group: 6 headlines (≤ 30 characters) and
  3 descriptions (≤ 90 characters), neutral wording modelled on the Latvian
  ads, no price or free-offer claim. Headline 1 is the sign-up call to action.

**The native-language keywords and ads were written by a language model and
have not been read by a native speaker.** Have someone who speaks each language
look at the ads before they are enabled, as with the page translations.

## Files

| File | Purpose |
| --- | --- |
| `data/native/<lang>.json` | Source of truth: campaign name, country, native keywords and ad copy |
| `build_native_campaigns.js` | Validates the JSON (limits, duplicates, support wording) and writes the CSVs; no dependencies |
| `campaigns/ScanInbox-<LANG>-<n>-Keywords-and-Ads.csv` | One Google Ads Editor CSV per language, same 21 columns as the other CSVs |
| `data/campaign-settings.json` | Country, language IDs, budget and dates per campaign (the CSV cannot carry these) |

Regenerate after editing any JSON: `node tools/google-ads/build_native_campaigns.js`.
As with the other CSVs every row sets **Campaign status = Paused**, and the file
configures only keywords and ads, not budget, dates, location, language or
devices; set those from `campaign-settings.json`.

## Before enabling, know this

- On 19 October the Ireland (since 9 October) and Latvia (since 12 October)
  campaigns showed **0 impressions and 0 clicks** for the last 7 days in the
  campaigns list, with status "Eligible". The cause is unknown (a €0.10 bid,
  Exact match, desktop only and low search volume are all candidates).
  Understand that before spending up to €950 the same way.
- The signup conversion has never received data (see
  [CAMPAIGN-LV.md](CAMPAIGN-LV.md)); a real attributed signup is unverified. The
  Cookiebot subscription also needs to stay active, otherwise consent stays
  denied and conversions are not measured.
