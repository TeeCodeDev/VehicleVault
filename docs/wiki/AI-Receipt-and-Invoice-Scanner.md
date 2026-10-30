# 🤖 AI Tankbon & Buitenlandse Factuur Scanner

VehicleVault bevat een multimodale AI Vision-pipeline die zowel **tankbonnen** als meerpagina **onderhoudsfacturen** (in elke taal) kan uitlezen, controleren en vertalen.

---

## 1. AI Provider Inrichten

Ga in VehicleVault naar **Instellingen ➔ AI & OCR Scanner**:
1. Kies je gewenste AI-engine:
   - **Google Gemini Vision** (aanbevolen: `gemini-2.5-flash` of `gemini-2.5-pro` — razendsnel en ondersteunt directe PDF-analyse).
   - **OpenAI Vision** (`gpt-4o` of `gpt-4o-mini`).
2. Vul je API-sleutel in en klik op **Verbinding Testen & Modellen Ophalen**.
3. Klik op **Opslaan**. *(De API-sleutel wordt versleuteld/gemaskeerd opgeslagen in de database).*

> **Geen AI-sleutel?** Geen probleem: voor tankbonnen valt VehicleVault automatisch terug op de lokaal ingebouwde **Tesseract.js OCR**-engine, en bij onderhoudsfacturen wordt het bestand direct gekoppeld zodat je de velden handmatig kunt invullen.

---

## 2. Buitenlandse Onderhoudsfacturen Scannen & Vertalen

Heb je een geïmporteerde auto met bijvoorbeeld **Duitse**, **Belgische/Franse** of **Engelse** onderhoudsfacturen?

1. Ga naar **Onderhoud** en klik op **Onderhoud / Factuur Scannen**.
2. Sleep je PDF-factuur of foto in het drop-vak bovenaan het venster.
3. De AI-scanner voert direct het volgende uit:
   - **Taalherkenning & Vertaling:** Herkent de brontaal (bijv. *Duits*) en vertaalt zowel de hoofdtitel van de beurt als **elk afzonderlijk onderdeel en arbeidsloon** naar jouw ingestelde taal (*Nederlands* of *Engels*), met behoud van de originele omschrijving ter referentie.
   - **BTW / MwSt Reconciliatie:** Controleert of de losse regels op de factuur exclusief BTW (bijv. 19% Duitse MwSt of 21% NL BTW) staan en rekent de uitsplitsing tussen *Onderdelen* en *Arbeidsloon* exact om naar het bruto eindbedrag.
   - **Garage & Adres Uitlezen:** Leest de naam én het volledige adres van de uitvoerende garage of dealer uit en maakt er in het onderhoudspaspoort een klikbare **Google Maps**-link van.
   - **Automatische Interval-Herkenning:** Vinkt op basis van de gevonden onderdelen (zoals *Motorolie 5W-30*, *Remvloeistof DOT 4*, *Luchtfilter*, *Bougies*) automatisch de juiste onderhoudsintervallen aan om te resetten.
   - **Synchronisatie naar Documenten:** Slaat de factuur niet alleen op bij de onderhoudsbeurt, maar voegt deze ook direct met de juiste `DD-MM-YYYY`-datum toe onder **Documenten (Digitale Handschoenenkast)** in de categorie *Facturen & Bonnen*.

---

## 3. Uitgelezen Onderdelen Bekijken in Modal

In de tabel **Volledig Onderhouds- & Reparatiepaspoort** verschijnt bij elke gescande factuur een knop **`Bekijk X uitgelezen & vertaalde onderdelen`**.
Klik hierop om een overzichtelijke modal te openen met:
- Datum, kilometerstand, garagegegevens en Google Maps-koppeling.
- Kostenoverzicht (*Totaalbedrag*, *Onderdelen*, *Arbeidsloon*).
- Alle losse factuurregels met label (`ONDERDEEL` / `ARBEID`), vertaalde omschrijving, aantal, originele tekst en bedrag.
- Directe knop om de originele PDF/foto-factuur in-app te bekijken.
