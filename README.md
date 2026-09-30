# ScanInbox — landing page

A product-idea validation page for **ScanInbox** — an inbox.eu service that
delivers scanned documents straight to e-mail, using inbox.eu SMTP.

The page's only goal is to find out **whether the product is needed**: it
explains the idea and collects pre-registration sign-ups. The form asks
**only for an e-mail address**; segment, device count, and brand are asked
right in the same card afterwards, once the sign-up is already saved — three
questions, each a single tap on one of the pressable chips (no "Next"
button, no free-text field), and each answer goes to the server right away,
so a survey abandoned halfway still says something.

### Second iteration

What changed after the September 8 review with the team:

- **The animation** in the hero section tells the whole story on one clock
  (`--cycle`): the SCAN key presses in, the lamp sweeps the page and **the
  document appears beneath it**, the letter flies down the wire to the
  address, and the scan lands at the top of the inbox list. The address on
  the wire follows what the person types in the form, and as soon as it's
  valid, the story restarts — so the person sees the letter fly to **their
  own** address. Off-screen the animation stops; coming back it starts from
  zero, not from the middle.
- **Removed** the "Comparison" and "What's included" sections — the first
  was long and sold nothing, the second now lives in the price card and the
  FAQ.
- **Added** the "Which one are you" section — four use-case stories,
  including the Microsoft 365 case, which is the sharpest reason for demand.
- **Time accounting** — ~5 min setup, < 1 min to the mailbox, each step with
  its own time.
- **Setup** is taken 1:1 from a colleague's page: an intro about how people
  arrive at this problem, then four steps in a vertical list (icon in its
  own column, number in the heading, time worked into the text rather than
  a separate badge). Same classes and the same CSS values. (The arrow strip
  and the "Generated configuration" example table that used to sit here
  have been removed — another colleague, who forked our page, dropped it,
  and we followed.)
- **Price** is a number: €10/year per device, first 50 — a free year.
- **FAQ** is an accordion with 14 questions, some of which are technical and
  there for SEO. Two are borrowed from colleagues' pages: "What is
  ScanInbox?" for the intro and "Can a visitor scan too?".
- **21 languages**: Latvian, English, Italian, French, German, Bulgarian,
  Czech, Danish, Greek, Dutch, Croatian, Lithuanian, Polish, Portuguese,
  Romanian, Slovak, Slovenian, Finnish, Spanish, Hungarian, and Swedish —
  the same choice as a colleague's nimda5 page.

## The published page

<https://scaninbox.me/> — hosted on **Netlify**, leads are stored in **Supabase**.

Each language has its own address, and that's what ad campaigns link to:

| | |
| --- | --- |
| <https://scaninbox.me/lv/> | Latvian |
| <https://scaninbox.me/en/> | English |
| <https://scaninbox.me/it/> | Italian |
| <https://scaninbox.me/fr/> | French |
| <https://scaninbox.me/de/> | German |

...plus 16 more (`/bg/ /cs/ /da/ /el/ /es/ /fi/ /hr/ /hu/ /lt/ /nl/ /pl/
/pt/ /ro/ /sk/ /sl/ /sv/`) — 22 pages in total.

### How it is wired

- **Netlify** runs `node .github/build-site.js` on every push to `main` and
  publishes `_site`. Build settings and variables live in `netlify.toml`, not
  in the Netlify dashboard, so everyone working on the repository can see
  them. Every PR gets a preview link; there the form is deliberately in
  preview mode so testing never pollutes real leads.
- **Supabase** (project `scaninbox`, Frankfurt) stores the leads. The schema
  and all saving logic are in `db/supabase.sql` — one function,
  `submit_lead(jsonb)`, which the page calls directly. To change the schema,
  edit that file and run it in the Supabase SQL Editor (it is idempotent).
- The browser may **only submit**: every table has RLS with no policies, and
  the anon role has no privileges on them. `submit_lead()` also rate-limits
  per e-mail and globally (no IPs). Read leads in the Supabase dashboard →
  Table Editor or SQL Editor, e.g. `select * from v_leads`.
- The **domain** `scaninbox.me` is at GoDaddy: A `@` → `75.2.60.5`, CNAME
  `www` → `scaninbox.netlify.app`. Netlify issues and renews the HTTPS
  certificate itself.

`server.js` and SQLite remain for local development and tests.

The root redirects to a language based on cookie, time zone, or browser.
A page already named for its own language is never redirected away from
what was asked for. The old `?lang=` still works, so links already sent out
don't break.

This link can be sent to colleagues for review. Keep two things in mind:

- **The form saves real leads** to Supabase. In PR previews and in copies
  without `SCANINBOX_API` it saves nothing — see "Preview mode" below.
- **The page is publicly reachable** by anyone with the link. Search engines
  do not index it because `index.html` carries `noindex, nofollow` — remove
  that before launch.

Netlify publishes from the `main` branch: `.github/build-site.js` turns the
single `index.html` into 22 pages — the root plus 21 languages. The project
is no longer published to GitHub Pages; CI (`.github/workflows/ci.yml`)
only runs the tests.

### Preview mode

Pages is static hosting, so there's no API there. The page notices this
itself: if `/api/leads` responds with 404, the form **runs all the way
through** — showing the confirmation and the follow-up questions — but
sends nothing, and the line under the form honestly says "This is a preview
version — the address wasn't saved." Follow-up answers go nowhere in that
mode either.

This applies **only** to 404 and 405. A dropped connection is still an
error with a chance to retry — otherwise someone on a train with a bad
signal would get a "thank you" and vanish.

As soon as there's a real API and `SCANINBOX_API` is set, the page saves,
and the preview line disappears on its own.

## Requirements

Node.js 22.5 or newer. Nothing else. **No npm dependencies** — SQLite comes
from Node's built-in `node:sqlite` module.

```powershell
node --version    # v24.19.0 or newer
```

## Running it

```powershell
node server.js
```

Then open <http://localhost:8123/>. A different port: `node server.js
--port 9000`.

The server serves the page and accepts sign-ups. The database is created
automatically on first start (`data/scaninbox.db`), and the schema is
applied on every start — it's idempotent, so no migrations are needed.

## Contents

| File | Purpose |
| --- | --- |
| `index.html` | The whole page — HTML, CSS, and JS in one file. The single source. |
| `server.js` | The static page + the sign-up API. No dependencies. |
| `db/schema.sql` | The database schema, lookup tables, and views. |
| `leads.js` | A sign-up report in the terminal. |
| `test/` | Tests. `node --test`. |
| `build-artifact.ps1` | Generates `dist/artifact.html` for preview as a Claude Artifact. |
| `.github/build-site.js` | Assembles `_site`: the root plus one page per language. |
| `i18n/` | Translations. `lv.json` is generated, the other 20 are the source. |
| `tools/i18n.js` | Text extraction, merging, and parity checking. |
| `CLAUDE.md` | Context for the Claude Code session: decisions, reasons, traps. |
| `data/` | The SQLite database. **Not in the git repository** — that's data, not code. |

## Viewing sign-ups

The fastest way, no server and no token needed:

```powershell
node leads.js           # summary: languages, segments, brands
node leads.js --list    # every sign-up
node leads.js --csv     # export
```

## API

| Method | Path | Access |
| --- | --- | --- |
| `POST` | `/api/leads` | open — this is what the form sends to |
| `GET` | `/api/health` | open |
| `GET` | `/api/leads` | token |
| `GET` | `/api/leads.csv` | token |
| `GET` | `/api/stats` | token |

Read endpoints are **locked until a token is set**. That's a deliberate
default: sign-ups are personal data, and they must not be publicly
reachable just because the server happens to be running.

```powershell
$env:SCANINBOX_ADMIN_TOKEN = "some-long-random-string"
node server.js
```

```bash
curl -H "Authorization: Bearer some-long-random-string" http://localhost:8123/api/stats
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SCANINBOX_DB` | the database file (default `./data/scaninbox.db`) |
| `SCANINBOX_ADMIN_TOKEN` | opens the read endpoints |
| `SCANINBOX_ALLOW_ORIGIN` | CORS origin, if the page is hosted separately |
| `PORT` | the port |

## Data model

`leads` — one row per e-mail address. A repeat sign-up with the same address
**updates the answers** rather than creating a duplicate; the e-mail is
compared in lower case.

Since the page signs someone up with just an e-mail and asks the rest
afterwards, one question at a time, one sign-up reaches the server as
**several requests** — one per answer. That's why the update uses
`COALESCE`: a submission carrying fewer answers must not **erase** ones
already saved. The one exception is the brand list — if the field is
present at all, it replaces the set entirely, so a marked one can also be
removed.

`lead_events` — an audit trail. Every submission is saved as the JSON it
arrived as, so it's visible if someone changes an answer, and both steps
stay separate.

`lead_brands` — the link between a sign-up and brands. A person can have
devices from several manufacturers, so it's a table, not a column.

`segments`, `device_bands`, `price_bands`, `brands` — lookup tables with
labels in Latvian and English. The server reads valid codes from the
database, not from a second copy on the JS side, and silently drops an
unknown code as `NULL`.

The `v_leads`, `v_brand_demand`, `v_segment_demand`, `v_price_demand`,
`v_device_models` views answer decision questions right at the SQL level.
`leads.lang` is the closest thing we have to a market signal: each campaign
links to its own language, so the language breakdown says where demand
actually is.

> The form no longer asks the price question, but `price_bands` and its
> column stay — those are first-iteration answers. `leads.js` only shows
> that table when there's something in it.

**If the database was created before the second iteration, it needs to be
rebuilt.** SQLite doesn't change the `lang` column's `CHECK` list via
`ALTER TABLE`, so an old database would reject `it`, `fr`, and `de` (and
now the 16 languages after those). Delete `data/scaninbox.db` and run the
server again.

### What's deliberately NOT in the database

IP addresses and user agents. The page promises the user it stores only the
e-mail and the form answers, so nothing else gets stored either. An IP is
used only in server memory for rate limiting (30 submissions per 10
minutes — an office sits behind one public address, and one sign-up is
several requests) and goes nowhere else.

## Where sign-ups end up

**In one place.** The top of the `index.html` script has `LEADS_ENDPOINT`,
by default `/api/leads` (locally: `server.js` and SQLite). On the live page
`<meta name="scaninbox:api">` replaces it with the Supabase `submit_lead`
URL, and `<meta name="scaninbox:apikey">` supplies the `apikey` header. There
is no fallback store — if the page cannot reach this endpoint it **says so**
instead of quietly keeping the data somewhere else.

Practical consequence: a copy of the page served from another server
without this API (for example, a Claude Artifact preview) shows "This is a
preview copy — it doesn't save sign-ups" in the form. That's deliberate:
a clear notice beats a sign-up landing somewhere nobody knows about.

## Tests

Node's built-in test runner, no dependencies:

```powershell
node --test
```

128 tests across three files:

| File | Covers |
| --- | --- |
| `test/validate.test.js` | e-mail validation, consent, code sanitising, length limits, languages, brand list |
| `test/schema.test.js` | database constraints, cascades, view arithmetic, privacy guarantee |
| `test/api.test.js` | HTTP statuses, two-stage sign-up, duplicate merging, token gate, rate limit, path protection |

Each test runs against its own temporary database, so `data/scaninbox.db`
is never touched. The server is started on a free port, so tests can run
while `node server.js` is also running.

Two tests exist to guard deliberate decisions, not to check code: one
doesn't let an `ip` or `user_agent` column appear in the schema, the other
checks that the page sends data to exactly one endpoint.

In a Bash shell, files can be named directly: `node --test test/*.test.js`.

## Before a public launch

- [ ] Set `SCANINBOX_ADMIN_TOKEN` to a long random string
- [ ] Put the server behind HTTPS (the SQLite file outside the web root)
- [ ] Check the sample SMTP values in the "Device credentials" section
- [ ] Re-check the Microsoft SMTP AUTH dates in FAQ 03 and the "Microsoft
      365 blocks it" use-case story — Microsoft has already pushed its
      timeline back three times
- [ ] **Publish a privacy notice and link it from the consent checkbox.**
      The page already tells the person what it stores and for how long,
      next to the form, but GDPR Article 13 also requires naming the
      controller, rights, and a contact. Must not launch without this.
- [ ] Confirm that €10/year per device is **VAT included**. The page says
      so because the "At home" section also addresses private individuals;
      if the price is ex-VAT, fix `price.unit`, `m4`, and `hero.offer` in
      every language
- [ ] Provide a real contact address. The FAQ currently says "reply to our
      e-mail" rather than "write to us", because there's no address on the
      page
- [ ] Make an `og:image` (1200×630) and add it to the head — the other
      sharing tags are already there
- [ ] Replace the `scaninbox.eu` address examples with real ones
- [ ] Read all 21 languages with human eyes — machine translation is a
      start, not an end, and 16 of them have never been read by anyone who
      speaks that language
- [ ] Confirm the €10/year-per-device price and the "first 50" offer
- [ ] Remove `noindex, nofollow` from `index.html`
- [ ] Set up backups for `data/`
- [ ] Add analytics, if we want to measure conversion

## How the page is built

Latvian text is written directly into the HTML, on elements with
`data-i18n="key"`. The other languages live in a `window.SCANINBOX_I18N`
dictionary near the top of the same file, between `<!-- I18N:BEGIN -->` and
`<!-- I18N:END -->`. Latvian isn't duplicated there — JS reads it from the
DOM on first load. Practical consequences:

- The page reads correctly in Latvian even if JavaScript doesn't run.
- If a language is missing a key, that spot stays in Latvian rather than
  going blank.
- A Latvian text fix has to be made in the HTML **and** in every other
  language's dictionary.

The exception is form status messages ("Sending…", "Enter a valid e-mail
address"): they have no element of their own to sit on, so the Latvian
originals live in a `MSG_LV` map inside the script, and the other languages
sit in the same dictionary with an `msg.` prefix. There's no second
translation store.

Changing text:

```powershell
node tools/i18n.js extract      # refreshes i18n/lv.json from the page
git diff i18n/lv.json           # see which keys need translating
# fix the same keys in i18n/<lang>.json for each language
node tools/i18n.js merge        # puts the dictionaries back into the page
```

`i18n/lv.json` is **generated** — `extract` writes it, not a person. If a
translation is missed, `merge` says so, the test fails, and that spot in
the page stays in Latvian rather than going blank.

The language is chosen in this order:

1. **Address** — `/de/`, `/it/`, and so on. A link to `/de/` is a promise
   about what the person will see, so nothing outranks it — not the
   cookie, not anything else;
2. the `?lang=` parameter — carried by old links already sent out;
3. the person's own choice from the switcher, in the `scaninbox_lang`
   **cookie** (a year, path scoped to the page's own root, `SameSite=Lax`).
   Once that's set, the browser is never asked again;
4. **browser language** — someone whose computer speaks German reads
   German regardless of where they currently are;
5. **location** — time zone (`Europe/Rome` → Italian, `Europe/Paris` →
   French, `Europe/Berlin`/`Europe/Vienna` → German, `Europe/Riga` →
   Latvian, and a representative zone for each of the other 16 languages).
   This is only a fallback for languages we don't otherwise have a signal
   for: a Spanish browser in Rome is better served by Italian than English.
   In countries where several of our languages fit — Switzerland, Belgium,
   Luxembourg — browser language decides;
6. English.

The order between steps 4 and 5 is for advertising: time zone before
browser would mean **everyone in Latvia gets Latvian**, including people
whose browser never asked for it, and a German with no `?lang=` in the link
would get a random language instead of German.

In the published version each language has its own page, assembled by
`.github/build-site.js`. The switcher then doesn't change text in place —
it navigates to a different address, and the root page redirects per steps
3–6. The local file has no language path, so there the switcher changes
text in place and no redirect happens — one file that works in both modes.

A cookie, not `localStorage`, because it's readable across every language
path and, later, on the server side too. It's a functional cookie, set only
by the person's own choice, so it doesn't need a consent banner.

Time zone is the only location signal the page can read **without asking
for permission, without a request to a third-party server, and without
touching the IP address** — that last part matters, since the form promises
not to store IPs.

**Only** the language the person actively chose goes into the cookie. If
the auto-detected one went there too, the first guess would freeze forever
and the page would never look at where the person actually is again.

Colours and typography come from CSS variables in the `:root` block. Dark
mode only redefines the variables, so new components can be added without
thinking about the two themes separately. `--led` is the lamp's green — the
signal colour for dots, icons, and borders; text uses `--led-ink`, which is
dark enough to read.

The hero animation runs on one clock: the `--cycle` variable in the `:root`
block is the length of every keyframe animation, so the beats can't drift
apart from each other. Off-screen the animation stops (`IntersectionObserver`
adds `.is-idle`), and with `prefers-reduced-motion` it doesn't start at all
— the end state is shown instead.

The visual register is office-equipment documentation: dense spec tables,
monospace values, figure captions, and one dark "device" panel.

## Disclaimer

The service isn't available yet. The page must not create the impression
that anything can be bought — the footer has a clear note about this, which
must stay until the product actually launches.
