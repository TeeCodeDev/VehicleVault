# 🛠️ Onderhoud, Vaste Lasten & TCO Engine

VehicleVault berekent de werkelijke **Total Cost of Ownership (TCO)** van je voertuig en bewaakt alle onderhoudsintervallen op basis van zowel afstand als tijd.

---

## 1. Dual-Trigger Onderhoudsintervallen

Elk onderdeel (zoals *Motorolie & Oliefilter*, *Remvloeistof*, *Bougies*, *Lucht- & Interieurfilter*, *Transmissievloeistof*) wordt bewaakt op twee assen:
- **Afstand (km):** bijv. elke `15.000 km`.
- **Tijd (maanden):** bijv. elke `12 maanden`.

Wat het eerst wordt bereikt, bepaalt het voortgangspercentage en de status:
- 🟢 **Goed (< 90%)**
- 🟠 **Binnenkort (90% – 99% of binnen 30 dagen / 1.000 km)**
- 🔴 **Verlopen (≥ 100%)**

### Meerdere Intervallen Tegelijk Resetten
Bij een grote beurt worden vaak meerdere onderdelen tegelijk vervangen. In het venster *Onderhoud Registreren / Bewerken* kun je met **checkboxes meerdere intervallen tegelijk aanvinken**. VehicleVault werkt elk aangevinkt interval bij naar de datum en kilometerstand van de meest recente gekoppelde beurt — ook als je oudere facturen later toevoegt.

---

## 2. Aankoopgegevens & Vorige Eigenaar (Zuivere TCO)

Wanneer je een gebruikte of geïmporteerde auto koopt, wil je wél de oude onderhoudsfacturen van de vorige eigenaar in je **Onderhoudspaspoort** hebben (voor een sluitende historie en juiste interval-standen), maar die oude rekeningen heb jij natuurlijk niet zelf betaald.

Daarom werkt VehicleVault met een **TCO-startpunt**:
1. Bij **Mijn Garage ➔ Voertuig Bewerken** stel je onder *Aankoopgegevens & TCO-startpunt* je **Aankoopdatum** (standaard ingevuld vanuit de RDW `datum_tenaamstelling`), **Aankoopstand (km)** en **Aankoopprijs (€)** in.
2. Voer je een onderhoudsfactuur in met een datum **vóór jouw aankoopdatum** of een kilometerstand **lager dan jouw aankoopstand**? Dan vinkt VehicleVault automatisch **`Historische beurt / Vorige eigenaar (buiten eigen TCO houden)`** aan.
3. Deze beurten krijgen in het overzicht het label `Vorige eigenaar (buiten TCO)`: ze blijven volledig zichtbaar in het paspoort en werken je onderhoudsintervallen bij, maar tellen **niet** mee in je eigen onderhoudskosten, maandelijkse uitgaven of TCO per kilometer.

---

## 3. Vaste Lasten (`Recurring Expenses`)

Onder **Vaste Lasten** registreer je periodieke kosten zoals:
- Motorrijtuigenbelasting (MRB / Wegenbelasting)
- Autoverzekering (WA / Allrisk)
- Pechhulp (ANWB / merk-mobiliteitsgarantie)
- Abonnementen & Lease

Of je nu maandelijks, per kwartaal of jaarlijks betaalt: de TCO-engine rekent de bedragen automatisch om naar de exacte bezitsperiode.

---

## 4. PDF Voertuigdossier Exporteren

Via de knop **PDF Dossier** op het Dashboard maak je een compleet Nederlands voertuigrapport aan:
- **Voertuigspecificaties & Huidige Kilometerstand**
- **Optioneel: Huidige Bandenset & Profieldieptes** (`LV`, `RV`, `LA`, `RA` in mm, maat, DOT-code en gereden kilometers).
- **Onderhouds- & Reparatiehistorie** (inclusief garagenaam en kosten).
- **Optioneel: Tankbeurtenregister**
- **Optioneel: Facturen & Tankbonnen als Aparte Bijlagepagina's** — Gekoppelde PDF-facturen worden met `pdf-lib` pagina voor pagina op volledige A4-grootte achteraan het PDF-dossier samengevoegd met een eigen kopbalk.

