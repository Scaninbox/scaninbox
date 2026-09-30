# ScanInbox — landing lapa

Produkta idejas validācijas lapa **ScanInbox** — inbox.eu pakalpojumam, kas
skenētos dokumentus nogādā tieši e-pastā, izmantojot inbox.eu SMTP.

Lapas vienīgais mērķis ir noskaidrot, **vai produkts ir vajadzīgs**: tā
paskaidro ideju un savāc priekšreģistrācijas pieteikumus. Forma prasa **tikai
e-pastu**; segmentu, ierīču skaitu un zīmolu jautā turpat kartītē pēc tam,
kad pieteikums jau ir saglabāts — trīs jautājumi, katrs ar vienu pieskārienu
uz vienu no spiežamajām pogām (nav ne «Tālāk» pogas, ne brīvā teksta lauka),
un katra atbilde aiziet uz serveri uzreiz, tāpēc pusceļā pamesta aptauja tik
un tā kaut ko pasaka.

### Otrā iterācija

Kas mainījies pēc 8. septembra pārskatīšanas ar komandu:

- **Animācija** hero sadaļā izstāsta visu ceļu uz viena pulksteņa
  (`--cycle`): nospiežas SCAN taustiņš, lampa pārskrien lapu un **dokuments
  parādās zem tās**, vēstule aizlido pa vadu uz adresi, un skenējums nolaižas
  iesūtnes saraksta augšgalā. Adrese vadā seko tam, ko cilvēks raksta formā,
  un, tiklīdz tā ir derīga, stāsts sākas no jauna — lai cilvēks redz vēstuli
  aizlidojam uz **savu** adresi. Ārpus ekrāna animācija stāv; atgriežoties tā
  sākas no nulles, nevis no vidus.
- **Izmestas** sadaļas «Salīdzinājums» un «Kas iekļauts» — pirmā bija gara un
  neko nepārdeva, otrā tagad dzīvo cenas kartītē un BUJ.
- **Pievienota** sadaļa «Kurš no šiem esi tu» — četri lietojuma stāsti, starp
  tiem Microsoft 365 gadījums, kas ir asākais pieprasījuma iemesls.
- **Laika atskaite** — ~5 min uzstādīšana, < 1 min līdz pastkastei, uz katra
  soļa savs laiks.
- **Uzstādīšana** ir pārņemta 1:1 no kolēģa lapas: ievads par to, kā cilvēki
  līdz šai problēmai nonāk, tad četri soļi vertikālā sarakstā (ikona kolonnā,
  numurs virsrakstā, laiks ieaudzēts tekstā, nevis atsevišķā nozīmītē). Tās
  pašas klases un tās pašas CSS vērtības. (Bultiņu josla un «Ģenerētā
  konfigurācija» piemēra tabula, kas te bija agrāk, ir noņemta — cits kolēģis,
  kas no mūsu lapas atzaroja savu versiju, to izmeta, un mēs sekojām.)
- **Cena** ir skaitlis: 10 € gadā par ierīci, pirmajiem 50 — gads bez maksas.
- **BUJ** ir akordeons ar 14 jautājumiem, no kuriem daļa ir tehniska un tur
  ir SEO dēļ. Divi aizgūti no kolēģu lapām: «Kas ir ScanInbox?» ievadam un
  «Vai ar to var skenēt arī viesis?».
- **21 valoda**: latviešu, angļu, itāļu, franču, vācu, bulgāru, čehu, dāņu,
  grieķu, holandiešu, horvātu, lietuviešu, poļu, portugāļu, rumāņu, slovāku,
  slovēņu, somu, spāņu, ungāru un zviedru — tāda pati izvēle, kāda ir kolēģa
  nimda5 lapā.

## Publicētā lapa

<https://scaninbox.me/> — hostēta uz **Netlify**, pieteikumi nonāk **Supabase**.

Katrai valodai ir sava adrese, un tur ved reklāmas kampaņas:

| | |
| --- | --- |
| <https://scaninbox.me/lv/> | latviski |
| <https://scaninbox.me/en/> | angliski |
| <https://scaninbox.me/it/> | itāliski |
| <https://scaninbox.me/fr/> | franciski |
| <https://scaninbox.me/de/> | vāciski |

### Kā tas ir savienots

- **Netlify** katrā push uz `main` palaiž `node .github/build-site.js` un
  publicē `_site`. Iestatījumi un vides mainīgie ir `netlify.toml` — nevis
  Netlify panelī, lai tos redz katrs, kas strādā ar repozitoriju. Katram PR
  Netlify uztaisa priekšskatījuma saiti; tur forma apzināti ir
  priekšskatījuma režīmā, lai testi nepiesārņotu īstos pieteikumus.
- **Supabase** (projekts `scaninbox`, Frankfurte) glabā pieteikumus. Shēma
  un visa saglabāšanas loģika ir `db/supabase.sql` — viena funkcija
  `submit_lead(jsonb)`, ko lapa izsauc tieši. Mainot shēmu, izlabo šo failu
  un izpildi to Supabase SQL Editor (tas ir idempotents).
- Pārlūks drīkst **tikai iesniegt**: tabulām ir RLS bez politikām, un anon
  lomai nav tiesību tās lasīt. Pieteikumus skaties Supabase panelī →
  Table Editor vai SQL Editor, piemēram `select * from v_leads`.
- **Domēns** `scaninbox.me` ir GoDaddy: A `@` → `75.2.60.5`, CNAME `www` →
  `scaninbox.netlify.app`. HTTPS sertifikātu Netlify izsniedz un atjauno pats.

`server.js` un SQLite paliek lokālai izstrādei un testiem.

Sakne pāradresē uz valodu pēc sīkdatnes, laika joslas vai pārlūka. Lapa, kas
jau nosaukta savā valodā, nekad netiek pāradresēta prom no tā, kas prasīts.
Vecais `?lang=` joprojām strādā, lai jau izsūtītās saites nepārtrūktu.

Šo saiti var sūtīt kolēģiem pārskatīšanai. Ņem vērā divas lietas:

- **Forma saglabā īstus pieteikumus** Supabase. PR priekšskatījumos un
  kopijās bez `SCANINBOX_API` tā neko nesaglabā — sīkāk zemāk,
  «Priekšskatījuma režīms».
- **Lapa ir publiski sasniedzama** ikvienam, kam ir saite. Piekļuves kontrole
  Pages lapām ir tikai GitHub Enterprise Cloud. Meklētājos tā nenonāk, jo
  `index.html` nes `noindex, nofollow` — to noņem pirms palaišanas.

Publicē CI darbplūsma no `main` zara: `.github/build-site.js` no viena
`index.html` saliek 22 lapas — sakni un 21 valodu.

> Pages avots ir jāieslēdz **vienu reizi** ar roku: Settings → Pages →
> Source: **GitHub Actions**. Darbplūsma to nevar izdarīt pati — noklusējuma
> `GITHUB_TOKEN` drīkst publicēt uz Pages, bet ne izveidot vietni.

### Priekšskatījuma režīms

Pages ir statisks hostings, tāpēc tur API nav. Lapa to pamana pati: ja
`/api/leads` atbild ar 404, forma **iziet cauri līdz galam** — parāda
apstiprinājumu un papildjautājumus —, bet neko nesūta un rindā zem formas
godīgi saka «Šī ir priekšskatījuma versija — adrese netika saglabāta».
Papildjautājumu atbildes tādā režīmā nekur neaiziet.

Tas attiecas **tikai** uz 404 un 405. Pārtrūcis savienojums joprojām ir kļūda
ar iespēju mēģināt vēlreiz — citādi cilvēks vilcienā ar sliktu signālu
dabūtu «paldies» un pazustu.

Tiklīdz ir īsts API un `SCANINBOX_API` ir uzstādīts, lapa saglabā, un
priekšskatījuma rinda pazūd pati.

## Prasības

Node.js 22.5 vai jaunāks. Nekas cits. **Nav npm atkarību** — SQLite nāk no
Node iebūvētā `node:sqlite` moduļa.

```powershell
node --version    # v24.19.0 vai jaunāka
```

## Palaišana

```powershell
node server.js
```

Tad atver <http://localhost:8123/>. Cits ports: `node server.js --port 9000`.

Serveris pasniedz lapu un pieņem pieteikumus. Datubāze tiek izveidota
automātiski pirmajā startā (`data/scaninbox.db`), un shēma tiek piemērota
katrā startā — tā ir idempotenta, tāpēc migrācijas nav vajadzīgas.

## Saturs

| Fails | Nozīme |
| --- | --- |
| `index.html` | Visa lapa — HTML, CSS un JS vienā failā. Vienīgais avots. |
| `server.js` | Statiskā lapa + pieteikumu API. Bez atkarībām. |
| `db/schema.sql` | Datubāzes shēma, uzmeklēšanas tabulas un skati. |
| `leads.js` | Pieteikumu atskaite terminālī. |
| `test/` | Testi. `node --test`. |
| `build-artifact.ps1` | Ģenerē `dist/artifact.html` priekšskatīšanai kā Claude Artifact. |
| `.github/build-site.js` | Saliek `_site`: sakne plus pa lapai katrai valodai. |
| `i18n/` | Tulkojumi. `lv.json` ir ģenerēts, pārējie četri — avots. |
| `tools/i18n.js` | Tekstu izvilkšana, iemontēšana un parītātes pārbaude. |
| `CLAUDE.md` | Konteksts Claude Code sesijai: lēmumi, iemesli, slazdi. |
| `data/` | SQLite datubāze. **Nav git repozitorijā** — tie ir dati, ne kods. |

## Pieteikumu apskate

Ātrākais ceļš, bez servera un bez pilnvaras:

```powershell
node leads.js           # kopsavilkums: valodas, segmenti, zīmoli
node leads.js --list    # visi pieteikumi
node leads.js --csv     # eksports
```

## API

| Metode | Ceļš | Piekļuve |
| --- | --- | --- |
| `POST` | `/api/leads` | atvērts — šeit sūta forma |
| `GET` | `/api/health` | atvērts |
| `GET` | `/api/leads` | pilnvara |
| `GET` | `/api/leads.csv` | pilnvara |
| `GET` | `/api/stats` | pilnvara |

Lasīšanas galapunkti ir **slēgti, kamēr nav uzstādīta pilnvara**. Tā ir
apzināta noklusējuma vērtība: pieteikumi ir personas dati, un tie nedrīkst būt
publiski pieejami tikai tāpēc, ka serveris darbojas.

```powershell
$env:SCANINBOX_ADMIN_TOKEN = "kada-gara-nejauna-virkne"
node server.js
```

```bash
curl -H "Authorization: Bearer kada-gara-nejauna-virkne" http://localhost:8123/api/stats
```

### Vides mainīgie

| Mainīgais | Nozīme |
| --- | --- |
| `SCANINBOX_DB` | datubāzes fails (noklusējums `./data/scaninbox.db`) |
| `SCANINBOX_ADMIN_TOKEN` | atver lasīšanas galapunktus |
| `SCANINBOX_ALLOW_ORIGIN` | CORS izcelsme, ja lapa hostēta atsevišķi |
| `PORT` | ports |

## Datu modelis

`leads` — viena rinda uz e-pastu. Atkārtots pieteikums ar to pašu adresi
**atjauno atbildes**, nevis rada dublikātu; e-pasts tiek salīdzināts mazajos
burtos.

Tā kā lapa pieraksta cilvēku ar e-pastu vien un pārējo jautā pēc tam, pa vienam
jautājumam, uz serveri viens pieteikums aiziet kā **vairāki pieprasījumi** —
pa vienam uz katru atbildi. Tāpēc atjaunošana
izmanto `COALESCE`: iesniegums, kas nes mazāk atbilžu, jau saglabātās
**nenodzēš**. Vienīgais izņēmums ir zīmolu saraksts — ja lauks vispār ir
klāt, tas aizstāj kopu pilnībā, lai atzīmēto varētu arī noņemt.

`lead_events` — audita pēdas. Katrs iesniegums saglabājas kā saņemtais JSON,
tāpēc redzams, ja kāds maina atbildi, un abi soļi paliek atsevišķi.

`lead_brands` — saite starp pieteikumu un zīmoliem. Cilvēkam mēdz būt vairāku
ražotāju iekārtas, tāpēc tā ir tabula, nevis kolonna.

`segments`, `device_bands`, `price_bands`, `brands` — uzmeklēšanas tabulas ar
etiķetēm latviski un angliski. Serveris derīgos kodus lasa no datubāzes, nevis
no otras kopijas JS pusē, un nezināmu kodu klusi izmet kā `NULL`.

Skati `v_leads`, `v_brand_demand`, `v_segment_demand`, `v_price_demand`,
`v_device_models` atbild uz lēmuma jautājumiem tieši SQL līmenī. `leads.lang`
ir tuvākais, kas mums ir, tirgum: katra kampaņa ved uz savu valodu, tāpēc
valodu sadalījums pasaka, kur pieprasījums vispār ir.

> Cenas jautājumu forma vairs neuzdod, bet `price_bands` un kolonna paliek —
> tur ir pirmās iterācijas atbildes. `leads.js` to tabulu parāda tikai tad, ja
> kaut kas tur ir.

**Ja datubāze ir taisīta pirms otrās iterācijas, tā jāizveido no jauna.**
`lang` kolonnas `CHECK` sarakstu SQLite ar `ALTER TABLE` nemaina, tāpēc vecā
datubāze noraidītu `it`, `fr` un `de`. Izdzēs `data/scaninbox.db` un palaid
serveri vēlreiz.

### Ko datubāzē apzināti NAV

IP adreses un user-agent. Lapa lietotājam apsola glabāt tikai e-pastu un
formas atbildes, tāpēc neko citu arī neglabājam. IP tiek izmantots tikai
servera atmiņā ātruma ierobežošanai (30 iesniegumi 10 minūtēs — birojs sēž aiz
vienas publiskās adreses, un viens pieteikums ir vairāki pieprasījumi) un nekur
nenonāk.

## Kur nonāk pieteikumi

**Vienā vietā.** `index.html` skripta sākumā ir `LEADS_ENDPOINT`, pēc
noklusējuma `/api/leads` (lokāli — `server.js` un SQLite). Publicētajā lapā
to aizstāj `<meta name="scaninbox:api">` ar Supabase `submit_lead` adresi, un
`<meta name="scaninbox:apikey">` dod atslēgu galvenei `apikey`. Rezerves
glabātavas nav — ja lapa nevar sasniegt šo galapunktu, tā to **pasaka**,
nevis klusi noliek datus kaut kur citur.

Praktiskās sekas: lapas kopija, kas tiek pasniegta no cita servera bez šī
API (piemēram, Claude Artifact priekšskatījums), formā parāda «Šī ir
priekšskatījuma kopija — pieteikumus tā nesaglabā». Tas ir apzināti: labāk
skaidrs paziņojums nekā pieteikums, kas nonāk vietā, par kuru neviens nezina.

## Testi

Node iebūvētais testu dzinis, bez atkarībām:

```powershell
node --test
```

127 testi trīs failos:

| Fails | Ko sedz |
| --- | --- |
| `test/validate.test.js` | e-pasta pārbaude, piekrišana, kodu attīrīšana, garumu griesti, valodas, zīmolu saraksts |
| `test/schema.test.js` | datubāzes ierobežojumi, kaskādes, skatu aritmētika, privātuma garantija |
| `test/api.test.js` | HTTP statusi, divpakāpju pieteikums, dublikātu apvienošana, pilnvaras vārti, ātruma limits, ceļu aizsardzība |

Katrs tests strādā ar savu pagaidu datubāzi, tāpēc `data/scaninbox.db`
netiek aiztikta. Serveris tiek celts uz brīva porta, tāpēc testus var palaist,
kamēr `node server.js` darbojas.

Divi testi ir tur, lai apsargātu apzinātus lēmumus, nevis lai pārbaudītu kodu:
viens neļauj shēmā parādīties `ip` vai `user_agent` kolonnai, otrs pārbauda, ka
lapa sūta datus tikai uz vienu galapunktu.

Bash čaulā var norādīt failus tieši: `node --test test/*.test.js`.

## Pirms publiskas palaišanas

- [ ] Uzlikt `SCANINBOX_ADMIN_TOKEN` ar garu nejaušu virkni
- [ ] Novietot serveri aiz HTTPS (SQLite fails ārpus web saknes)
- [ ] Pārbaudīt SMTP piemēra vērtības sadaļā «Ierīces piekļuves dati»
- [ ] Pārskatīt Microsoft SMTP AUTH datumus BUJ 03 un lietojuma stāstā «Microsoft
      365 bloķē» — Microsoft grafiku jau ir pārcēlis trīs reizes
- [ ] **Publicēt privātuma paziņojumu un saistīt to pie piekrišanas rūtiņas.**
      Lapa pie formas tagad pasaka, ko glabā un cik ilgi, bet VDAR 13. pants
      prasa arī nosaukt pārzini, tiesības un kontaktu. Bez tā palaist nedrīkst.
- [ ] Apstiprināt, ka 10 € gadā par ierīci ir **ar PVN**. Lapa tā raksta, jo
      sadaļa «Mājās» uzrunā arī privātpersonas; ja cena ir bez PVN, jālabo
      `price.unit`, `m4` un `hero.offer` visās valodās
- [ ] Iedot reālu kontaktadresi. BUJ tagad saka «atbildi uz mūsu vēstuli»,
      nevis «raksti mums», jo adreses lapā nav
- [ ] Uztaisīt `og:image` (1200×630) un pievienot to galvenē — pārējie
      dalīšanās tagi jau ir
- [ ] Aizvietot `scaninbox.eu` adreses piemērus ar reālajām
- [ ] Izlasīt visas 21 valodu ar dzīvām acīm — mašīntulkojums ir sākums, ne
      gals, un 16 no tām nekad nav lasījis cilvēks, kas runā šajā valodā
- [ ] Apstiprināt cenu 10 € gadā par ierīci un «pirmajiem 50» piedāvājumu
- [ ] Noņemt `noindex, nofollow` no `index.html`
- [ ] Iestatīt `data/` dublēšanu
- [ ] Pievienot analītiku, ja gribam mērīt konversiju

## Lapas uzbūve

Latviešu teksts ir ierakstīts pašā HTML uz elementiem ar `data-i18n="atslēga"`.
Pārējās četras valodas dzīvo `window.SCANINBOX_I18N` vārdnīcā tā paša faila
augšgalā, starp `<!-- I18N:BEGIN -->` un `<!-- I18N:END -->`. Latviešu tur nav
otrreiz — to JS paņem no DOM pirmajā palaišanā. Praktiskās sekas:

- Lapa lasāma latviski arī tad, ja JavaScript nestrādā.
- Ja kādai valodai atslēga pietrūkst, tā vieta paliek latviski, nevis tukša.
- Teksta labojums latviski jāizdara HTML **un** visās četrās vārdnīcās.

Izņēmums ir formas paziņojumi («Sūta…», «Ievadi derīgu e-pasta adresi»): tiem
nav sava elementa, uz kura sēdēt, tāpēc latviešu oriģināli ir `MSG_LV` kartē
skripta iekšā, bet pārējās valodas — tajā pašā vārdnīcā ar `msg.` priedēkli.
Otras tulkojumu glabātavas nav.

Mainot tekstu:

```powershell
node tools/i18n.js extract      # atjauno i18n/lv.json no lapas
git diff i18n/lv.json           # redzi, kuras atslēgas jātulko
# izlabo tās pašas atslēgas i18n/en|it|fr|de.json
node tools/i18n.js merge        # ieliek vārdnīcas atpakaļ lapā
```

`i18n/lv.json` ir **ģenerēts** — to raksta `extract`, nevis cilvēks. Ja tulkojums
aizmirstas, `merge` par to pasaka, tests krīt, un lapā tā vieta paliek latviski,
nevis tukša.

Valodu izvēlas šādā secībā:

1. **adrese** — `/de/`, `/it/` un tā tālāk. Saite uz `/de/` ir solījums par
   to, ko cilvēks ieraudzīs, tāpēc to nepārspēj ne sīkdatne, ne nekas cits;
2. `?lang=` parametrs — to nes vecās, jau izsūtītās saites;
3. paša cilvēka izvēle no slēdža, **sīkdatnē** `scaninbox_lang` (gads, ceļš
   ierobežots ar pašas lapas sakni, `SameSite=Lax`). Kad tā ir, pārlūkam
   vairs neprasa;
4. **pārlūka valoda** — cilvēks, kura dators runā vāciski, lasa vāciski
   neatkarīgi no tā, kur viņš tobrīd atrodas;
5. **atrašanās vieta** — laika josla (`Europe/Rome` → itāļu, `Europe/Paris` →
   franču, `Europe/Berlin` un `Europe/Vienna` → vācu, `Europe/Riga` →
   latviešu). Tā ir tikai rezerve valodām, kuru mums nav: spāņu pārlūkam Romā
   itāļu der labāk nekā angļu. Valstīs, kur der vairākas mūsu valodas —
   Šveice, Beļģija, Luksemburga — izšķir pārlūka valoda;
6. angļu.

Secība starp 4. un 5. punktu ir reklāmas dēļ: laika josla pirms pārlūka
nozīmētu, ka **Latvijā visi dabū latviešu valodu**, arī tie, kuru pārlūks to
nekad nav prasījis, un vācietis bez `?lang=` saitē dabūtu nejaušu valodu, nevis
vācu.

Publicētajā versijā katrai valodai ir sava lapa, un tās saliek
`.github/build-site.js`. Slēdzis tad nevis maina tekstu uz vietas, bet
pārved uz citu adresi, un saknes lapa pāradresē pēc 3.–6. punkta. Lokālajā
failā valodu ceļu nav, tāpēc tur slēdzis maina tekstu turpat un
pāradresācijas nenotiek — viens fails, kas strādā abos režīmos.

Sīkdatne, nevis `localStorage`, jo tā ir nolasāma visos valodu ceļos un vēlāk
arī servera pusē. Tā ir funkcionāla sīkdatne, ko uzstāda tikai pēc cilvēka
paša izvēles, tāpēc piekrišanas logs tai nav vajadzīgs.

Laika josla ir vienīgais atrašanās vietas signāls, ko lapa var nolasīt **bez
atļaujas prasīšanas, bez pieprasījuma uz svešu serveri un neaiztiekot IP
adresi** — pēdējais ir svarīgi, jo pie formas mēs apsolām IP neglabāt.

Sīkdatnē nonāk **tikai** tā valoda, ko cilvēks izvēlējies pats. Ja tur liktu
arī automātiski noteikto, pirmais minējums iesaldētos uz visiem laikiem un lapa
vairs nekad nepaskatītos, kur cilvēks atrodas.

Krāsas un tipogrāfija nāk no CSS mainīgajiem `:root` blokā. Tumšais režīms
pārdefinē tikai mainīgos, tāpēc jaunus komponentus var likt klāt, nedomājot
par abām tēmām atsevišķi. `--led` ir lampas zaļais — signālkrāsa punktiem,
ikonām un apmalēm; tekstam ir `--led-ink`, kas ir pietiekami tumšs, lai to
varētu izlasīt.

Hero animācija iet pa vienu pulksteni: `--cycle` mainīgais `:root` blokā ir
visu keyframe animāciju garums, tāpēc takti nevar aizpeldēt viens no otra.
Ārpus ekrāna animācija apstājas (`IntersectionObserver` uzliek `.is-idle`), un
ar `prefers-reduced-motion` tā nemaz nesākas — tad redzams beigu stāvoklis.

Vizuālais reģistrs ir biroja tehnikas dokumentācija: blīvas specifikāciju
tabulas, monospace vērtības, attēlu paraksti un viens tumšs «ierīces»
panelis.

## Atruna

Pakalpojums vēl nav pieejams. Lapa nedrīkst radīt iespaidu, ka kaut ko var
iegādāties — kājenē par to ir skaidra piezīme, kas jāsaglabā, kamēr produkts
nav palaists.
