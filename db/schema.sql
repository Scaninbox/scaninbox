-- ScanInbox — pieteikumu (leads) datubāzes shēma
--
-- Idempotenta: server.js to izpilda katrā startā, tāpēc visur IF NOT EXISTS
-- un INSERT OR IGNORE.
--
-- Ko šeit APZINĀTI NAV: IP adreses un user-agent. Lapas teksts lietotājam
-- apsola glabāt tikai e-pastu un formas atbildes, tāpēc neko citu arī
-- neglabājam. IP tiek izmantots tikai atmiņā ātruma ierobežošanai.

-- ---------------------------------------------------------------------------
-- Uzmeklēšanas tabulas. Kodi ir tie paši, ko sūta forma; etiķetes abās
-- valodās, lai portāls vēlāk varētu rādīt cilvēklasāmus nosaukumus, un lai
-- datubāze pati sevi paskaidro bez atsauces uz HTML.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS segments (
  code     TEXT PRIMARY KEY,
  label_lv TEXT    NOT NULL,
  label_en TEXT    NOT NULL,
  sort     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device_bands (
  code     TEXT PRIMARY KEY,
  label_lv TEXT    NOT NULL,
  label_en TEXT    NOT NULL,
  sort     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS price_bands (
  code       TEXT PRIMARY KEY,
  label_lv   TEXT    NOT NULL,
  label_en   TEXT    NOT NULL,
  -- Vidējā vērtība eiro, lai varētu rēķināt aptuvenu ARPU. NULL, ja josla
  -- nav skaitliska ("vēl nevaru pateikt").
  eur_midpoint REAL,
  sort       INTEGER NOT NULL
);

-- Iekārtu zīmoli. Nosaukumi ir īpašvārdi, tāpēc abās valodās vienādi, bet
-- kolonnas paliek, lai tabula izskatītos tāpat kā pārējās uzmeklēšanas tabulas
-- un lai «Cits» un «Nezinu» varētu tulkot.
CREATE TABLE IF NOT EXISTS brands (
  code     TEXT PRIMARY KEY,
  label_lv TEXT    NOT NULL,
  label_en TEXT    NOT NULL,
  sort     INTEGER NOT NULL
);

INSERT OR IGNORE INTO segments (code, label_lv, label_en, sort) VALUES
  ('private', 'Es pats, mājās',                    'Myself, at home',                    1),
  ('small',   'Mazs uzņēmums, līdz 10 cilvēkiem',  'Small business, up to 10 people',    2),
  ('medium',  'Uzņēmums, 10 līdz 100 cilvēku',     'Company, 10 to 100 people',          3),
  ('large',   'Liels uzņēmums vai valsts iestāde', 'Large company or public institution', 4);

INSERT OR IGNORE INTO device_bands (code, label_lv, label_en, sort) VALUES
  ('1',     '1',     '1',     1),
  ('2-5',   '2–5',   '2–5',   2),
  ('6-20',  '6–20',  '6–20',  3),
  ('20+',   '20+',   '20+',   4);

INSERT OR IGNORE INTO price_bands (code, label_lv, label_en, eur_midpoint, sort) VALUES
  ('lt2',    'Zem 2 €',            'Under €2',        1.0,  1),
  ('2-5',    '2–5 €',              '2–5 €',           3.5,  2),
  ('5-10',   '5–10 €',             '5–10 €',          7.5,  3),
  ('10+',    'Vairāk par 10 €',    'Over €10',        12.0, 4),
  ('unsure', 'Vēl nevaru pateikt', 'Cannot say yet',  NULL, 5);

INSERT OR IGNORE INTO brands (code, label_lv, label_en, sort) VALUES
  ('canon',   'Canon',          'Canon',          1),
  ('hp',      'HP',             'HP',             2),
  ('brother', 'Brother',        'Brother',        3),
  ('epson',   'Epson',          'Epson',          4),
  ('kyocera', 'Kyocera',        'Kyocera',        5),
  ('xerox',   'Xerox',          'Xerox',          6),
  ('ricoh',   'Ricoh',          'Ricoh',          7),
  ('konica',  'Konica Minolta', 'Konica Minolta', 8),
  ('lexmark', 'Lexmark',        'Lexmark',        9),
  ('sharp',   'Sharp',          'Sharp',         10),
  ('other',   'Cits',           'Other',         11),
  ('unknown', 'Nezinu',         'Do not know',   12);

-- ---------------------------------------------------------------------------
-- Pieteikumi. Viena rinda uz e-pastu — atkārtots pieteikums atjauno atbildes,
-- nevis rada dublikātu. Vēsture glabājas lead_events.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,

  email        TEXT    NOT NULL,                 -- kā lietotājs ierakstīja
  email_norm   TEXT    NOT NULL UNIQUE,          -- mazie burti, dublikātu novēršanai
  name         TEXT,

  segment      TEXT    REFERENCES segments(code),
  device_band  TEXT    REFERENCES device_bands(code),
  device_model TEXT,
  price_band   TEXT    REFERENCES price_bands(code),

  wants_beta   INTEGER NOT NULL DEFAULT 0 CHECK (wants_beta IN (0, 1)),
  consent      INTEGER NOT NULL            CHECK (consent = 1),  -- bez piekrišanas rindas nav
  -- Valodas, kurās lapa pastāv. Ja sarakstam pievieno vēl vienu, datubāze ir
  -- jāizveido no jauna: CHECK ierobežojumu SQLite ar ALTER TABLE nemaina.
  lang         TEXT    NOT NULL DEFAULT 'lv'
               CHECK (lang IN ('lv', 'en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el',
                               'es', 'fi', 'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro',
                               'sk', 'sl', 'sv')),

  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  -- Komandas darba lauki, ko forma nekad neaizpilda
  contacted_at TEXT,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads (created_at);
CREATE INDEX IF NOT EXISTS idx_leads_segment  ON leads (segment);
CREATE INDEX IF NOT EXISTS idx_leads_price    ON leads (price_band);
CREATE INDEX IF NOT EXISTS idx_leads_beta     ON leads (wants_beta) WHERE wants_beta = 1;

-- ---------------------------------------------------------------------------
-- Zīmoli uz pieteikumu. Cilvēkam mēdz būt vairāku ražotāju iekārtas, tāpēc šī
-- ir saite, nevis kolonna leads tabulā. Atkārtots pieteikums šo kopu aizstāj
-- pilnībā — atzīmēto var arī noņemt.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_brands (
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  brand      TEXT    NOT NULL REFERENCES brands(code),
  PRIMARY KEY (lead_id, brand)
);

CREATE INDEX IF NOT EXISTS idx_lead_brands_brand ON lead_brands (brand);

-- ---------------------------------------------------------------------------
-- Audita pēdas. leads glabā pašreizējo stāvokli, šī tabula — ko tieši un kad
-- iesniedza. Noder, ja kāds maina atbildi, un atbild uz jautājumu "vai cena
-- mainījās pēc tam, kad cilvēks izlasīja lapu otrreiz".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL CHECK (kind IN ('created', 'updated')),
  payload    TEXT    NOT NULL,   -- iesniegtais JSON, kā saņemts
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_events_lead ON lead_events (lead_id, created_at);

-- ---------------------------------------------------------------------------
-- Skati, kas atbild uz to jautājumu, kura dēļ šī lapa vispār eksistē.
-- ---------------------------------------------------------------------------

-- Pieteikumi ar cilvēklasāmām etiķetēm
CREATE VIEW IF NOT EXISTS v_leads AS
SELECT
  l.id,
  l.email,
  l.name,
  l.segment,      s.label_lv AS segment_lv,
  l.device_band,  d.label_lv AS device_band_lv,
  l.device_model,
  l.price_band,   p.label_lv AS price_band_lv, p.eur_midpoint,
  (SELECT group_concat(b.label_lv, ' / ')
     FROM lead_brands lb JOIN brands b ON b.code = lb.brand
    WHERE lb.lead_id = l.id
    ORDER BY b.sort) AS brands,
  l.wants_beta,
  l.lang,
  l.created_at,
  l.updated_at,
  l.contacted_at
FROM leads l
LEFT JOIN segments     s ON s.code = l.segment
LEFT JOIN device_bands d ON d.code = l.device_band
LEFT JOIN price_bands  p ON p.code = l.price_band;

-- Cik cilvēki kurā cenu joslā — vai vispār ir gatavība maksāt
CREATE VIEW IF NOT EXISTS v_price_demand AS
SELECT
  p.code,
  p.label_lv,
  p.eur_midpoint,
  COUNT(l.id) AS leads,
  ROUND(COUNT(l.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM leads WHERE price_band IS NOT NULL), 0), 1) AS pct
FROM price_bands p
LEFT JOIN leads l ON l.price_band = p.code
GROUP BY p.code
ORDER BY p.sort;

-- Segmenti un cik ierīces tie pieteiktu — kur ir apjoms
CREATE VIEW IF NOT EXISTS v_segment_demand AS
SELECT
  s.code,
  s.label_lv,
  COUNT(l.id)                                        AS leads,
  SUM(CASE WHEN l.wants_beta = 1 THEN 1 ELSE 0 END)  AS beta_volunteers,
  -- Ierīču skaita joslas apakšējā robeža, konservatīvai aplēsei
  SUM(CASE l.device_band WHEN '1' THEN 1 WHEN '2-5' THEN 2
           WHEN '6-20' THEN 6 WHEN '20+' THEN 20 ELSE 0 END) AS min_devices
FROM segments s
LEFT JOIN leads l ON l.segment = s.code
GROUP BY s.code
ORDER BY s.sort;

-- Kuru ražotāju izvēlnes jāapraksta vispirms. Viens pieteikums var būt vairākos
-- zīmolos, tāpēc summa pārsniedz pieteikumu skaitu — procenti ir no tiem, kas
-- uz šo jautājumu vispār atbildēja.
CREATE VIEW IF NOT EXISTS v_brand_demand AS
SELECT
  b.code,
  b.label_lv,
  COUNT(lb.lead_id) AS leads,
  ROUND(COUNT(lb.lead_id) * 100.0 /
        NULLIF((SELECT COUNT(DISTINCT lead_id) FROM lead_brands), 0), 1) AS pct
FROM brands b
LEFT JOIN lead_brands lb ON lb.brand = b.code
GROUP BY b.code
ORDER BY leads DESC, b.sort;

-- Kuras iekārtas jāatbalsta vispirms
CREATE VIEW IF NOT EXISTS v_device_models AS
SELECT
  TRIM(device_model) AS model,
  COUNT(*)           AS mentions
FROM leads
WHERE device_model IS NOT NULL AND TRIM(device_model) <> ''
GROUP BY LOWER(TRIM(device_model))
ORDER BY mentions DESC, model;
