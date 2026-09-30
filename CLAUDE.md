# CLAUDE.md

This file is Claude Code's working memory for this project. It holds what
**can't be read from the code** — decisions, reasons, and traps. For
everything else see `README.md`, which is written for people and kept
current.

## What this is

A validation landing page for **ScanInbox** — a planned inbox.eu service that
gives an office scanner or multifunction printer its own SMTP credentials so
the device's «Scan to E-mail» button finally works.

**The page's only goal is to collect e-mail sign-ups.** There is no product.
Content decisions are made in favour of sign-up count, not completeness.

Three colleagues are each building their own version of the same idea and
then comparing ([nimda5](https://nimda5.github.io/sendscan/),
[achelnov](https://achelnov.github.io/IoTMail/index.html)). More than just
ideas has been borrowed from their pages — see «Taken 1:1».

A fourth player: colleague Mauris is a direct **fork of our repository**
(`jeanjmauris.github.io/scaninbox`), not an independent page — so it shares
the same classes and structure, and the comparison with it is closer than
with the other two. He changes only text and the carefully built animation,
not the structure.

## Golden rules

1. **`index.html` is the only source.** Everything — HTML, CSS, JS,
   animation — is in one file with no dependencies. Don't split it. This is
   deliberate: the page is published as a single static file, and it can also
   be opened straight from disk.
2. **Zero npm dependencies.** SQLite comes from Node's built-in `node:sqlite`
   (needs Node 22.5+). Don't introduce a `package.json`.
3. **Text changes go through `tools/i18n.js`** — see below. Skip it and the
   page will silently show Latvian sentences in the German version.
4. **Don't merge without permission.** A push to `main` publishes the page
   live.
5. **Everything written for other people to read is in English** — code,
   comments, docs, commit messages, PR titles and descriptions. The team
   works across languages; Latvian survives only where it's actual product
   content (the page's own `lv` text, `label_lv` data), never as the
   language documentation or code is written in.

## Translations — the one place a mistake stays quiet

21 languages: lv, en, it, fr, de, bg, cs, da, el, es, fi, hr, hu, lt, nl, pl,
pt, ro, sk, sl, sv — the same choice as the nimda5 page. Latvian text lives
**in `index.html` itself**, on elements with `data-i18n="key"`. The other 20
are `i18n/<lang>.json`, and they get mounted into the page as a
`window.SCANINBOX_I18N` block.

Changing any text:

```bash
node tools/i18n.js extract      # refreshes i18n/lv.json from the page
git diff i18n/lv.json           # see which keys need translating
# fix the same keys in i18n/<lang>.json for each of the 20 languages
node tools/i18n.js merge        # puts the dictionaries back into the page
node --test
```

**16 of these languages (everything except en/it/fr/de) were machine
translated, with no native-speaker check.** That's a deliberate trade-off —
translating 21 languages by hand wasn't realistic for this iteration — but
before a public launch each one needs to be read by someone who speaks it.
See also «What blocks launch».

`i18n/lv.json` is **generated** — `extract` writes it, not a person. It
exists purely so `git diff` can show what changed.

Traps that have already bitten once:

- **A key inside a key.** A `data-i18n` element nested inside another
  `data-i18n` element gets destroyed when the language switches. Don't do
  that.
- **Markup.** A translation must carry the same tags and entities. `tools/
  i18n.js check` verifies this, and it's wired into `node --test`.
- **Codes vs. labels.** A chip's `data-v` is a database code (`6-20` with a
  hyphen), the visible text is typographic (`6–20` with an en dash). Once
  those were the same, and the server silently dropped every answer.
- **`<code id="modal-mail">`** and similar ids must survive translation — JS
  looks them up after switching.

## Language detection and addresses

In the published version each language has its own page: `/lv/ /en/ /it/
/fr/ /de/` plus 16 more (`/bg/ /cs/ /da/ /el/ /es/ /fi/ /hr/ /hu/ /lt/ /nl/
/pl/ /pt/ /ro/ /sk/ /sl/ /sv/`). `.github/build-site.js` assembles those from
one `index.html`. The root redirects.

Order: **address → `?lang=` → the `scaninbox_lang` cookie → browser language
→ time zone → English.**

Two things that look like bugs but aren't:

- **Browser language comes before time zone.** It used to be the other way
  round, which meant everyone in Latvia got Latvian, including English
  browsers. That's bad for advertising: a German with no `?lang=` in the
  link needs the German version to open.
- **Time zone, not IP geolocation.** The page promises next to the form that
  it won't store IPs, so sending it to a third-party geo-IP service would
  contradict its own text. Time zone is free, immediate, and needs no
  permission.

Locally there is no language path (CI adds the marker), so locally the
switch changes the text in place and no redirect happens. One file that
works in both modes.

## Preview mode — looks like a bug, but is deliberate

GitHub Pages is static hosting, so there's no API there. The page notices
this itself: if `/api/leads` responds with **404 or 405**, the form runs all
the way through — confirmation and follow-up questions — but **sends
nothing**, and the line under the form says the address wasn't saved.

This applies only to 404/405. A dropped connection is still an error with a
chance to retry, otherwise someone with a bad signal would get a "thank you"
and vanish.

The client asked for this, so the page would be comparable with colleagues'
versions, which **save nothing at all** and say nothing about it. The
honest line is the `msg.savedDemo` key.

## Follow-up questions — three, not four, and all single-tap

There used to be four questions (who's it for, how many devices, which
brand — multiple answers, and model — free text). Now there are **three**,
and each one — brand included — is a **single-tap choice**: clicking a chip
immediately saves the answer and moves on (`advance()`), rather than waiting
for a "Next" button. Reason: less friction, faster to the end.

The model question (the free-text field) is **removed entirely** from the
page, not just hidden — `fu-model`, `q4.h`, `q4.ph`, `fu.next`, `fu.send` no
longer exist. The server still accepts a `model` field over the API
(`device_model` column, `v_device_models` view) — that stays because it can
be filled some other way (manual entry, or in future), the same way
`price_bands` stays even though the form no longer asks about price.
**Don't start re-adding a model question to the UI without understanding why
it was removed** — that was a direct request to cut the number of
questions.

The brands question on the JS side now looks like segment and devices —
`answers.brands = [v]` (a single-value array, not a toggle) — so
`saveAnswers()` can send the same `brands` array shape the API already
expected back when it was a multi-select.

## Taken 1:1 from a colleague's page

The «How it works» section — heading, intro, all four steps, icons — is
**copied verbatim** from the nimda5 version, on the client's direct request,
repeated twice. The arrow strip and the «Generated configuration» example
table that used to sit below the steps have been **removed** — following
Mauris's fork, which dropped it (see below), not nimda5, which still has it.

**That's why the page promises AI printer recognition from a photo, which
ScanInbox does not have.** That's nimda's product idea. For a validation
page this is an acceptable test (the footer clearly states the service
isn't available yet), but if anyone asks to remove it or changes the
product's scope, start from this section.

## Taken from Mauris's fork — and what *wasn't* taken from it

Colleague Mauris forked our repository and made his own version:
[jeanjmauris.github.io/scaninbox](https://jeanjmauris.github.io/scaninbox/en/).
Taken over:

- **Hero headline and lede** — new, more concise wording.
- **`hero.offer`** — a new highlighted line under the lede (background
  colour, left border) that replaces the old `hero.terms`/`hero.meta*`
  strip above and below the form. Same idea, said more concisely in one
  place.
- **A fuller inbox animation** — from 3 rows to 8: five extra (never
  animated) messages so the list reads like a real inbox rather than a
  demo. `.inbox__list` therefore got a fixed height of 3 rows
  (`height:calc(3 * 46px);overflow:hidden`) — the rest are markup, not
  visible.
- **The price offer from "first 10" to "first 50".** This isn't just text —
  it's a business decision (more people promised a free year), and it
  wasn't separately confirmed, just carried along with the rest of the text
  on the client's direct request. If that wasn't intended, search for `50`
  across `i18n/`.
- **`foot.about`** paragraph in the footer — a short line about ScanInbox
  being built by the inbox.eu team with 20+ years of mail infrastructure
  experience. This comes not from Mauris but from the **nimda5** page,
  where that information is a whole section (`.trust`); the client asked
  for it to go concisely into the footer, not as a new section.
- **The «How it works» section** lost the arrow strip and the config table
  (see above).

**Deliberately NOT taken**, even though Mauris's page has it:

- **Mauris's own IT/FR/DE and LV text are out of sync with each other on his
  page.** He changed "10" to "50" and rewrote headings (`who.h2`, `how.h2`)
  only in his EN dictionary — his LV source text and IT/FR/DE dictionaries
  stayed unchanged and still say "10" and the old headings. So everywhere we
  took his text, we used **his English text** as the basis, and wrote
  LV/IT/FR/DE ourselves from scratch — rather than copying his (out-of-sync)
  versions. This is why "take the text from the colleague" must not mean
  "copy all his dictionaries" — check whether he actually kept his own
  translations in sync.
- ~~Two-column figure layout~~ — **this was in fact added afterwards**, see
  «Two-column figure» below. Deliberately skipped on the first pass, then
  the client asked for it directly.

## Two-column figure — printer and inbox side by side, not one above the other

`.fig{container-type:inline-size}` makes the figure itself the query
container, so `@container (min-width:28rem)` reacts to the **figure's own
width**, not the viewport's — a mobile figure can be wider than 28rem
(447px), and then the layout is already side-by-side even though it's
viewed on a phone.

This part is different from Mauris's page, even though the result looks
similar:

- **Our wire (`.wire`) was already horizontal** in the narrow (stacked)
  state — a full-width bar with the address chip at its end. Mauris's wire
  in the narrow state is **rotated vertical**
  (`.wire__line{transform:rotate(90deg)}`,
  `.pkt svg{transform:rotate(-90deg)}`) and only returns to horizontal in
  the wide state. We didn't need that rotation trick, so the wide-state CSS
  is simpler: no rotations to undo.
- **The address chip (`#wire-to` / `.wire__to`) moved from the wire into the
  inbox header** (`.inbox__hd`), in **both** layouts, not just the wide one.
  Reason: in the wide state the wire shrinks to a narrow
  `clamp(2.5rem,7cqw,4.5rem)` gutter between printer and inbox, where the
  address text (sometimes long) simply cannot fit. The inbox header has far
  more room in both cases, so the address lives there permanently.
  `.inbox__label` ("Inbox") hides only in the wide state (`@container`), so
  the address has room next to the icon and the counter — in the narrow
  state both (label and address) fit, because there the inbox takes the
  full width of its own row.
- **`.inbox__list`'s height in the wide state is no longer fixed** to three
  rows (`height:calc(3 * 46px)`) — that stays in the narrow state, but in
  the wide state `.inbox{align-self:stretch}` +
  `.inbox__list{flex:1 1 0;height:0}` lets the list fill however much space
  the printer image (`.mfp`) naturally takes up, and clip the rest. How
  many rows show up depends on the printer image's height at that
  particular width — that's deliberate, not a bug, if you see 2 or 4 rows
  on different screens.
- **What actually sets the printer image's height is `.sheet{min-height:
  19rem}`** (12rem below 28rem, in its own `@container (max-width:27.99rem)`
  block) — `.bed` and `.mfp` have no height of their own, they just wrap it.
  This used to be `.bed{aspect-ratio:2.1}` instead, a flatter ratio that
  capped the whole figure — and, through the stretch above, the inbox list —
  to 2–3 rows even on a wide screen. Found by comparing against Mauris's
  fork, which still has the original `min-height` values from before that
  drift; removing the aspect-ratio and copying his two numbers fixed it.

To check both states: widen the browser window/the figure's container above
and below 28rem (447px) and watch whether `.wire` switches from a
full-width bar to a narrow gutter between printer and inbox.

## Other deliberate decisions that don't need "fixing"

- **No `noindex`** any more: it was removed on purpose for the launch, so
  the page is indexed. Do not add it back to `index.html`; PR previews are
  already kept out of search engines by Netlify.
- **The `price_bands` table stays**, even though the form no longer asks
  about price — those are first-iteration answers. `leads.js` only shows it
  when there's something to show.
- **`COALESCE` on update.** One sign-up goes out as several requests (the
  e-mail, then one per answer), so a later submission with fewer answers
  must not erase ones already saved. Brands is the exception: if the field
  is present, it replaces the set entirely, so a marked one can be removed.
- **`/api/health` doesn't return the sign-up count.** That's both a
  competitive metric and a way to prove the "first 50" are already taken
  while the page still promises them.
- **The guard test** `test/api.test.js` checks that the page has exactly one
  `fetch` and no second storage. If it fails, **don't change the test**
  before understanding what in the page is sending data somewhere else.
- **Two privacy tests** in `test/schema.test.js` don't let an `ip` or
  `user_agent` column appear in the schema. They guard the promise, not the
  code.

## Animation

The hero figure runs on **one clock** — the `--cycle` variable in the
`:root` block (9 s). Every keyframe is a percentage against it, so the
beats can't drift apart.

Beats: scan 5–27% → send 33–53% → land 54–60% → dwell 60–88% → reset
88–100%. Change one, check its neighbours.

You can check by pausing and scrubbing the animation:

```js
document.getAnimations()
  .filter(a => a.effect && document.getElementById('anim').contains(a.effect.target))
  .forEach(a => { a.pause(); a.currentTime = 9000 * 0.44; });
```

Two things that were already broken once and could recur:

- **`IntersectionObserver` entries arrive with a delay**, and the last one
  applied wins even when it no longer matches reality. That's why
  `syncFigure()` and `syncDock()` read the element's **actual position**
  rather than trusting the event. Don't revert that back to
  `entry.isIntersecting`.
- **`prefers-reduced-motion`** must show **one coherent frame** (page
  scanned, letter landed), not a frozen mid-point. When adding a new
  animation, add its end state there too.

## Running it

```bash
node server.js                  # page + API on http://localhost:8123
node --test                     # 128 tests
node leads.js --list            # sign-ups in the terminal
node tools/i18n.js check        # translation parity
SITE_URL=... node .github/build-site.js   # how CI assembles _site
```

The database is `data/`, not in git. If the `lang` column's `CHECK` list
changes, the old database has to be deleted — SQLite's `CHECK` doesn't
change via `ALTER TABLE`.

## What blocks launch

Not code, but worth knowing:

1. ~~There's nowhere to run `server.js`.~~ **Solved:** the page is on
   Netlify (`netlify.toml`) and leads go to the Supabase function
   `submit_lead()` (`db/supabase.sql`). That function is the twin of
   `validate()`/`saveLead()` in `server.js` — **change one, change the
   other**, or leads will behave differently locally and on the live page.
   Rate limits in `submit_lead()` are per e-mail and global, never per IP
   (we do not store or read IPs).
2. **There's no privacy notice.** GDPR Article 13 requires naming the
   controller, rights, and a contact. The form must not go live without
   one.
3. **There's no contact address.** That's why the FAQ says "reply to our
   e-mail" rather than "write to us".
4. **There's no `og:image`.** The other sharing tags are there.
5. **There's no analytics.** Without it we'll know the sign-up count, but
   not the conversion rate or which language earns.
6. **16 of the 21 languages haven't been read by anyone who speaks that
   language.** They're machine translated; tag/entity parity is checked
   automatically (`node tools/i18n.js check`), but **meaning, tone, and
   naturalness are not**. Each one needs a human read before advertising in
   it.

Full checklist — `README.md`, section «Before a public launch».

## Market context (from research that isn't in the repository)

- Demand comes from **Microsoft, not paper culture**: since January 2020,
  SMTP AUTH has been off by default for new Microsoft 365 tenants, and at
  the end of December 2026 it will be turned off for existing ones too.
  That's the sharpest argument on the page and so gets its own use-case
  story and FAQ entry. **These dates need re-checking** — Microsoft has
  already pushed its timeline back three times.
- **The price floor is close to zero**: no SMTP service charges per device.
  €10/year (€0.83/month) sits on the competitive line; per device *per
  month* would be dead on arrival.
- **Italy** is the structurally strongest market (lowest share of IT
  specialists in the EU), **Germany and France** are the largest by volume.
  That's why it was **initially** translated into these three.
- **Latvia alone is too small** (~€484k/year even at 100% market share).
- **21 languages is broader than this market analysis**, not a result of
  it. The expansion to nimda5's language list happened so the pages would
  be comparable with each other, not because the research turned up 16 new
  target markets. If the decision is to narrow advertising back to IT/FR/DE
  (or LV/EN/IT/FR/DE), the other languages stay available via `?lang=` or a
  direct address — they just don't get ad budget.
