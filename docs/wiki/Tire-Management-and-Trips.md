# 🛞 Bandenbeheer & Fiscale Ritregistratie

---

## 1. Bandenbeheer (`Tires`)

Onder **Bandenbeheer** beheer je al je bandensets (*Zomerbanden*, *Winterbanden* en *4-Seizoenenbanden*):

### Technische Specificaties
Per bandenset leg je vast:
- **Merk & Model** (bijv. *Bridgestone Turanza 6*)
- **Bandenmaat** (bijv. `205/60`), **Velgmaat** (`16"`), **Load/Speed Index** (`92V`) en **DOT-code** (`2324`)
- **Opslaglocatie** (voor niet-gemonteerde sets, bijv. *Bandenhotel* of *Garage thuis*)

### Live Gereden Kilometers & Bewerken
- Zodra een bandenset als **Gemonteerd op voertuig** staat ingesteld, telt VehicleVault automatisch de sindsdien gereden kilometers (`huidige km-stand − km-stand bij montage`) op bij de reeds gereden kilometers op de set.
- Via **Details Bewerken** kun je op elk moment zowel de **Reeds gereden km op deze set** als de **Km-stand voertuig bij montage** handmatig aanpassen.

### 4-Wiel Profieldiepte & Veiligheidsbewaking
Het interactieve onderstel-diagram toont de profieldiepte per wiel (`LV`, `RV`, `LA`, `RA` in mm):
- 🟢 **Veilig profiel:** `≥ 3.0 mm` (`≥ 4.0 mm` voor winterbanden)
- 🟠 **Vervangingsadvies:** `< 2.5 mm` (`< 4.0 mm` voor winterbanden)
- 🔴 **APK Afkeur / Wettelijk minimum:** `< 1.6 mm`

---

## 2. Fiscale Ritregistratie (`Trips`)

Onder **Ritregistratie** houd je een sluitende rittenadministratie bij volgens de eisen van de Nederlandse **Belastingdienst**:

- **Classificatie:** *Zakelijk*, *Woon-werk* en *Privé*.
- **Automatische Afstandsberekening:** Vul de begin- en eindkilometerstand in (of laat de beginstand automatisch overnemen van de vorige rit).
- **1-Klik Retourrit:** Maak direct een terugreis aan met omgekeerde vertrek- en aankomstlocatie.
- **Exportmogelijkheden:**
  1. **Excel (`.xlsx`):** Opgemaakte werkmap met samenvattingsstatistieken en formules.
  2. **Fiscaal PDF Dossier:** Liggend A4-overzicht voor je boekhouding of belastingaangifte.
  3. **CSV (Puntkomma-gescheiden):** Direct te openen in Excel of boekhoudsoftware.

