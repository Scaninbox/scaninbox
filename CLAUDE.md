# CLAUDE.md

Šis fails ir Claude Code darba atmiņa par šo projektu. Tajā ir tas, ko **nevar
izlasīt no koda** — lēmumi, iemesli un slazdi. Visu pārējo skaties `README.md`,
kas ir rakstīts cilvēkiem un ir aktuāls.

## Kas šis ir

Validācijas landing lapa **ScanInbox** — iecerētam inbox.eu pakalpojumam, kas
biroja skenerim vai daudzfunkciju printerim iedod savus SMTP piekļuves datus, lai
iekārtas poga «Scan to E-mail» beidzot strādātu.

**Lapas vienīgais mērķis ir savākt e-pastu pieteikumus.** Produkta nav. Lēmumi
par saturu tiek pieņemti par labu pieteikumu skaitam, ne pilnībai.

Trīs kolēģi taisa pa savai versijai vienai un tai pašai idejai un pēc tam salīdzina
([nimda5](https://nimda5.github.io/sendscan/), [achelnov](https://achelnov.github.io/IoTMail/index.html)).
No viņu lapām ir aizgūts vairāk nekā tikai idejas — skat. «Pārņemts 1:1».

Ceturtais spēlētājs: kolēģis Mauris ir tiešs **atzars no mūsu repozitorija**
(`jeanjmauris.github.io/scaninbox`), nevis neatkarīga lapa — tāpēc tajā pašas
klases un pati struktūra, un salīdzinājums ir precīzāks nekā ar pārējiem
diviem. Viņš maina tikai tekstu un rūpīgi izstrādāto animāciju, ne uzbūvi.

## Zelta likumi

1. **`index.html` ir vienīgais avots.** Viss — HTML, CSS, JS, animācija — ir
   vienā failā bez atkarībām. Nesadali to. Tas ir apzināti: lapu publicē kā vienu
   statisku failu, un to var atvērt arī no diska.
2. **Nulle npm atkarību.** SQLite nāk no Node iebūvētā `node:sqlite` (vajag
   Node 22.5+). Neieviesi `package.json`.
3. **Tekstu maina caur `tools/i18n.js`** — skat. zemāk. Ja to izlaidīsi, lapa
   klusi rādīs latviešu teikumus vācu versijā.
4. **Nemergo bez atļaujas.** Push uz `main` publicē lapu internetā.

## Tulkojumi — vienīgā vieta, kur var kļūdīties klusi

21 valoda: lv, en, it, fr, de, bg, cs, da, el, es, fi, hr, hu, lt, nl, pl, pt,
ro, sk, sl, sv — tāda pati izvēle, kāda ir nimda5 lapai. Latviešu teksts ir
**pašā `index.html`** uz elementiem ar `data-i18n="atslēga"`. Pārējās 20 ir
`i18n/<lang>.json`, un tās iemontē lapā kā `window.SCANINBOX_I18N` bloku.

Mainot jebkuru tekstu:

```bash
node tools/i18n.js extract      # atjauno i18n/lv.json no lapas
git diff i18n/lv.json           # redzi, kuras atslēgas jātulko
# izlabo tās pašas atslēgas i18n/<lang>.json katrai no 20 valodām
node tools/i18n.js merge        # ieliek vārdnīcas atpakaļ lapā
node --test
```

**16 no šīm valodām (visas, izņemot en/it/fr/de) ir tulkotas ar AI, bez dzimtā
valodā runājoša cilvēka pārbaudes.** Tas ir apzināts kompromiss — tulkot 21
valodu pašrocīgi nav reāli šai iterācijai —, bet pirms publiskas palaišanas
katra jāizlasa cilvēkam, kurš to valodu runā. Skat. arī «Kas bloķē
palaišanu».

`i18n/lv.json` ir **ģenerēts** — to raksta `extract`, nevis cilvēks. Tas pastāv
tikai tāpēc, lai `git diff` parādītu, kas mainījies.

Slazdi, kas jau vienreiz iekoduši:

- **Atslēga atslēgā.** `data-i18n` elements iekšā citam `data-i18n` elementam
  tiek iznīcināts, pārslēdzot valodu. Nedari tā.
- **Marķējums.** Tulkojumā jābūt tiem pašiem tagiem un entītijām. `tools/i18n.js
  check` to pārbauda, un tas ir piesiets pie `node --test`.
- **Kodi pret etiķetēm.** Pogas `data-v` ir datubāzes kods (`6-20` ar defisi),
  redzamais teksts ir tipogrāfisks (`6–20` ar domuzīmi). Reiz tie bija vienādi,
  un serveris klusi izmeta katru atbildi.
- **`<code id="modal-mail">`** un tamlīdzīgi id tulkojumā jāsaglabā — JS tos
  meklē pēc pārslēgšanas.

## Valodas noteikšana un adreses

Publicētajā versijā katrai valodai ir sava lapa: `/lv/ /en/ /it/ /fr/ /de/` un
vēl 16 klāt (`/bg/ /cs/ /da/ /el/ /es/ /fi/ /hr/ /hu/ /lt/ /nl/ /pl/ /pt/ /ro/
/sk/ /sl/ /sv/`). Tās saliek `.github/build-site.js` no viena `index.html`.
Sakne pāradresē.

Secība: **adrese → `?lang=` → sīkdatne `scaninbox_lang` → pārlūka valoda →
laika josla → angļu.**

Divas lietas, kas izskatās pēc kļūdas, bet nav:

- **Pārlūks stāv pirms laika joslas.** Otrādi bija, un tas nozīmēja, ka Latvijā
  visi dabūja latviešu valodu, arī angļu pārlūki. Reklāmai tas ir slikti: vācietim
  bez `?lang=` saitē jāatveras vācu versijai.
- **Laika josla, nevis IP ģeolokācija.** Lapa pie formas apsola IP neglabāt, tāpēc
  sūtīt to uz svešu geo-IP servisu būtu pretrunā ar pašas tekstu. Laika josla ir
  bezmaksas, tūlītēja un neprasa atļauju.

Lokāli valodu ceļu nav (marķieri ieliek CI), tāpēc lokāli slēdzis maina tekstu uz
vietas un pāradresācijas nenotiek. Viens fails, kas strādā abos režīmos.

## Priekšskatījuma režīms — izskatās pēc kļūdas, bet ir apzināts

GitHub Pages ir statisks hostings, tur API nav. Lapa to pamana: ja `/api/leads`
atbild ar **404 vai 405**, forma iziet cauri līdz galam — apstiprinājums un
papildjautājumi — bet **neko nesūta**, un rinda zem formas saka, ka adrese netika
saglabāta.

Tas attiecas tikai uz 404/405. Pārtrūcis savienojums joprojām ir kļūda ar
iespēju mēģināt vēlreiz, citādi cilvēks ar sliktu signālu dabūtu «paldies» un
pazustu.

To prasīja pasūtītājs, lai lapa būtu salīdzināma ar kolēģu versijām, kuras
**neko nesaglabā vispār** un par to neko nesaka. Godīgā rinda ir atslēga
`msg.savedDemo`.

## Papildjautājumi — trīs, ne četri, un visi ar vienu pieskārienu

Bija četri jautājumi (kam der, cik ierīcēm, kāda zīmola — vairākas atbildes,
un modelis — brīvs teksts). Tagad ir **trīs**, un katrs — arī zīmols — ir
**viena pieskāriena izvēle**: klikšķis uz čipa uzreiz saglabā atbildi un
virza tālāk (`advance()`), nevis gaida «Tālāk» pogu. Iemesls: mazāk berzes,
ātrāk līdz beigām.

Modeļa jautājums (brīvā teksta lauks) ir **pilnībā izņemts** no lapas, ne
tikai paslēpts — `fu-model`, `q4.h`, `q4.ph`, `fu.next`, `fu.send` vairs
neeksistē. Serveris joprojām pieņem `model` lauku pa API (`device_model`
kolonna, `v_device_models` skats) — tas paliek tāpēc, ka to var aizpildīt
citādi (piem., roku darbā vai nākotnē), tāpat kā `price_bands` paliek, lai
gan forma to vairs nejautā. **Nesāc no jauna pievienot modeļa jautājumu UI,
nesaprotot, kāpēc tas tika izņemts** — tas bija tiešs pasūtījums samazināt
jautājumu skaitu.

Zīmolu jautājums JS pusē tagad izskatās tāpat kā segments un ierīces —
`answers.brands = [v]` (masīvs ar vienu vērtību, nevis toggle) —, lai
`saveAnswers()` varētu sūtīt to pašu `brands` masīva formu, ko API jau
sagaidīja, kad vēl bija vairākatbilžu izvēle.

## Pārņemts 1:1 no kolēģa lapas

Sadaļa «Kā tas strādā» — virsraksts, ievads, visi četri soļi, ikonas — ir
**burtiski nokopēta** no nimda5 versijas pēc tiešas pasūtītāja prasības, kas
atkārtota divreiz. Bultiņu josla un «Ģenerētā konfigurācija» piemēra tabula,
kas te bija zem soļiem, ir **noņemta** — sekojot Maura atzaram, kas to izmeta
(skat. zemāk), nevis nimda5, kurai tā joprojām ir.

**Tāpēc lapa sola AI printera atpazīšanu no bildes, kā ScanInbox nav.** Tā ir
nimda produkta ideja. Validācijas lapai tas ir pieļaujams tests (kājenē skaidri
rakstīts, ka pakalpojums nav pieejams), bet, ja kāds prasa to noņemt vai maina
produkta apjomu, sākt vajag no šīs sadaļas.

## Ņemts no Maura atzara (foršs.html) — un kas no tā *nav* ņemts

Kolēģis Mauris atzaroja mūsu repozitoriju un uztaisīja savu versiju:
[jeanjmauris.github.io/scaninbox](https://jeanjmauris.github.io/scaninbox/en/).
Ņemts pāri:

- **Hero virsraksts un ievadteksts** — jauns, kodolīgāks formulējums.
- **`hero.offer`** — jauna izcelta rindiņa zem ievadteksta (fona krāsa,
  kreisā apmale), kas aizstāj veco `hero.terms`/`hero.meta*` josliņu virs un
  zem formas. Tā pati doma, kodolīgāk pateikta vienuviet.
- **Pilnāka iesūtnes animācija** — no 3 rindām uz 8: piecas papildu (nekad
  neanimētas) vēstules, lai saraksts izskatās pēc īstas iesūtnes, nevis
  demo. `.inbox__list` tāpēc dabūja fiksētu augstumu 3 rindām
  (`height:calc(3 * 46px);overflow:hidden`) — pārējās ir markup, ne redzamas.
- **Cenas piedāvājums no «pirmajiem 10» uz «pirmajiem 50».** Šis nav tikai
  teksts — tas ir biznesa lēmums (vairāk cilvēku, kam solām bezmaksas gadu),
  un tas nav atsevišķi apstiprināts, tikai pārņemts kopā ar pārējo tekstu pēc
  tiešas pasūtītāja prasības. Ja tas nav domāts, meklē `50` visā `i18n/`.
- **`foot.about`** rindkopa footerī — īss teikums par to, ka ScanInbox ir
  inbox.eu komandas darbs ar 20+ gadu pieredzi pasta infrastruktūrā. Tas nāk
  nevis no Maura, bet no **nimda5** lapas, kur tāda informācija ir vesela
  sadaļa (`.trust`); pasūtītājs prasīja to ielikt kodolīgi footerī, nevis kā
  jaunu sadaļu.
- **Sekcija «Kā tas strādā»** zaudēja bultiņu joslu un konfigurācijas tabulu
  (skat. augšā).

**Apzināti NAV ņemts**, lai gan Maura lapā tas ir:

- **Maura IT/FR/DE un LV teksti pašā lapā ir savā starpā nesaskaņoti.** Viņš
  mainīja «10» uz «50» un pārrakstīja virsrakstus (`who.h2`, `how.h2`) tikai
  savā EN vārdnīcā — viņa LV avota teksts un IT/FR/DE vārdnīcas palika
  nemainītas un joprojām saka «10» un vecos virsrakstus. Tāpēc visur, kur
  ņēmām viņa tekstu, par pamatu ņēmām **viņa angļu tekstu**, un LV/IT/FR/DE
  uzrakstījām no jauna paši — nevis kopējām viņa (nesaskaņotās) versijas.
  Šis ir iemesls, kāpēc «ņem tekstu no kolēģa» nedrīkst nozīmēt «kopē visas
  viņa vārdnīcas» — jāpārbauda, vai viņa pats ir tulkojumus turējis sinhronus.
- **Divkolonnu figūras izkārtojums** (`@container (min-width:28rem)`, kur
  printeris un iesūtne stāv blakus, nevis viens zem otra) — Maura lapā tas ir,
  mūsu lapā joprojām ir viencolonnu izkārtojums no otrās iterācijas. Apzināti
  atstāts kā iespējams nākamais solis, ne izdarīts klusībā.

## Citi apzināti lēmumi, ko nevajag «salabot»

- **`noindex, nofollow`** ir vietā ar nodomu, kamēr lapa ir pārskatīšanai.
- **`price_bands` tabula paliek**, lai gan forma cenu vairs nejautā — tur ir
  pirmās iterācijas atbildes. `leads.js` to rāda tikai, ja kaut kas ir.
- **`COALESCE` atjaunošanā.** Viens pieteikums aiziet kā vairāki pieprasījumi
  (e-pasts, tad pa vienam uz katru atbildi), tāpēc vēlāks iesniegums ar mazāk
  atbildēm jau saglabātās nedrīkst nodzēst. Zīmoli ir izņēmums: ja lauks ir klāt,
  tas aizstāj kopu pilnībā, lai atzīmēto varētu noņemt.
- **`/api/health` neatgriež pieteikumu skaitu.** Tas ir gan konkurenta mērījums,
  gan veids pierādīt, ka «pirmie 50» jau aizņemti, kamēr lapa to vēl sola.
- **Sargtests** `test/api.test.js` pārbauda, ka lapā ir tieši viens `fetch` un
  nav otras glabātavas. Ja tas nokrīt, **nemaini testu** pirms nesaproti, kas
  lapā sūta datus otrā vietā.
- **Divi privātuma testi** `test/schema.test.js` neļauj shēmā parādīties `ip` vai
  `user_agent` kolonnai. Tie sargā solījumu, ne kodu.

## Animācija

Hero figūra iet pa **vienu pulksteni** — `--cycle` mainīgais `:root` blokā (9 s).
Visas keyframes ir procentos pret to, tāpēc takti nevar aizpeldēt.

Takti: skenē 5–27 % → sūta 33–53 % → nolaižas 54–60 % → atmaksa 60–88 % →
atiestate 88–100 %. Mainot vienu, jāpārbauda kaimiņi.

Pārbaudīt var, pauzējot un skrollējot animāciju:

```js
document.getAnimations()
  .filter(a => a.effect && document.getElementById('anim').contains(a.effect.target))
  .forEach(a => { a.pause(); a.currentTime = 9000 * 0.44; });
```

Divas lietas, kas jau bija salauztas un var atkārtoties:

- **`IntersectionObserver` ieraksti pienāk ar nobīdi**, un pēdējais uzliktais
  uzvar arī tad, kad tas vairs neatbilst patiesībai. Tāpēc `syncFigure()` un
  `syncDock()` nolasa elementa **reālo pozīciju**, nevis tic notikumam. Neatgriez
  to atpakaļ uz `entry.isIntersecting`.
- **`prefers-reduced-motion`** blokam jāparāda **viens saskanīgs kadrs** (lapa
  noskenēta, vēstule nolaidusies), nevis sasaldēts vidus. Pievienojot jaunu
  animāciju, pievieno arī tās beigu stāvokli tur.

## Palaišana

```bash
node server.js                  # lapa + API uz http://localhost:8123
node --test                     # 128 testi
node leads.js --list            # pieteikumi terminālī
node tools/i18n.js check        # tulkojumu parītāte
SITE_URL=... node .github/build-site.js   # kā CI saliek _site
```

Datubāze ir `data/`, git-ā nav. Ja `lang` kolonnas `CHECK` saraksts mainās,
vecā datubāze jāizdzēš — SQLite `CHECK` ar `ALTER TABLE` nemaina.

## Kas bloķē palaišanu

Nav kods, bet jāzina:

1. ~~Nav vietas, kur darbināt `server.js`.~~ **Atrisināts:** lapa ir Netlify
   (`netlify.toml`), pieteikumi iet uz Supabase funkciju `submit_lead()`
   (`db/supabase.sql`). Šī funkcija ir `server.js` `validate()`/`saveLead()`
   dvīnis — **mainot vienu, maini otru**, citādi lokāli un publicētajā lapā
   pieteikumi uzvedīsies atšķirīgi. Ātruma ierobežojuma pēc IP Supabase pusē
   nav (IP neglabājam un nelasām).
2. **Nav privātuma paziņojuma.** VDAR 13. pants prasa pārzini, tiesības un
   kontaktu. Bez tā formu nedrīkst laist reālā apritē.
3. **Nav kontaktadreses.** BUJ tāpēc saka «atbildi uz mūsu vēstuli», nevis
   «raksti mums».
4. **Nav `og:image`.** Pārējie dalīšanās tagi ir.
5. **Nav analītikas.** Bez tās uzzināsim pieteikumu skaitu, bet ne konversiju un
   ne to, kura valoda pelna.
6. **16 no 21 valodām nav lasījis neviens, kas tajā valodā runā.** Tās ir AI
   tulkotas, tagu/entītiju parītāte ir pārbaudīta automātiski (`node
   tools/i18n.js check`), bet **nozīme, tonis un dabiskums — nav**. Pirms
   reklāmas šajās valodās katra jāizlasa cilvēkam.

Pilns saraksts ar atzīmēm — `README.md`, sadaļa «Pirms publiskas palaišanas».

## Tirgus konteksts (no izpētes, kas nav repozitorijā)

- Pieprasījumu rada **Microsoft, nevis papīra kultūra**: kopš 2020. gada janvāra
  jaunajiem Microsoft 365 nomniekiem SMTP AUTH ir izslēgts pēc noklusējuma, un
  2026. gada decembra beigās tas tiks izslēgts arī esošajiem. Tas ir asākais
  arguments lapā un tāpēc ir atsevišķs lietojuma stāsts un BUJ ieraksts. **Šie
  datumi jāpārbauda** — Microsoft grafiku jau ir pārcēlis trīs reizes.
- **Cenu grīda ir tuvu nullei**: neviens SMTP serviss nemaksā par ierīci. 10 €
  gadā (0,83 €/mēn.) ir uz konkurences līnijas; par ierīci *mēnesī* būtu miris.
- **Itālija** ir strukturāli spēcīgākais tirgus (zemākais IT speciālistu īpatsvars
  ES), **Vācija un Francija** — lielākie pēc apjoma. Tāpēc **sākotnēji** tulkots
  uz šīm trim.
- **Latvija viena ir par mazu** (~484 tūkst. € gadā pat pie 100 % tirgus daļas).
- **21 valoda ir plašāka par šo tirgus analīzi**, ne tās rezultāts. Paplašinājums
  uz nimda5 valodu sarakstu notika, lai lapas būtu salīdzināmas savā starpā, ne
  tāpēc, ka izpēte parādīja 16 jaunus mērķa tirgus. Ja lēmums ir sašaurināt
  reklāmu atpakaļ uz IT/FR/DE (vai LV/EN/IT/FR/DE), pārējās valodas paliek
  pieejamas pēc `?lang=` vai tiešas adreses — tās vienkārši nesaņem reklāmas
  budžetu.
