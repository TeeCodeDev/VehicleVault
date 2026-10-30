# 🛞 Tire Management & Fiscal Trip Registration

---

## 1. Tire Set Management (`Bandenbeheer`)

Track your Summer, Winter, and All-Season tire sets with visual safety monitoring:

- **Detailed Specifications:**
  - **Set Name & Season:** Summer, Winter, or All-Season (`4-Seizoenen`)
  - **Brand & Model:** Separate fields (e.g., *Bridgestone* / *Turanza 6*)
  - **Dimensions:** Tire Size (`205/60`), Rim Size (`16"`), Load/Speed Index (`92V`), and **DOT Code** (`2324`)
  - **Storage Location:** Where unmounted sets are stored (e.g., *Garage rack*, *Tire hotel*)
- **Dynamic Live Mileage (`Gereden Kilometers`):**
  - For the currently **Mounted (`Gemonteerd`)** tire set, VehicleVault automatically calculates live driven mileage:
    $$\text{Live km} = \text{Previously Driven km} + \max(0, \text{Current Vehicle Odometer} - \text{Mounted Odometer})$$
  - You can also manually edit both the **Mounted Odometer (`KM-stand bij montage`)** and **Previously Driven km** at any time via **Edit Details (`Details Bewerken`)**.
  - When swapping tire sets via **1-Click Tire Swap (`Bandenwissel`)**, the driven delta is automatically added to the unmounted set's cumulative total.
- **4-Wheel Tread Depth Diagram (`Profieldiepte`):**
  - Top-down vehicle chassis visualization for **Front-Left (`LV`)**, **Front-Right (`RV`)**, **Rear-Left (`LA`)**, and **Rear-Right (`RA`)** in millimeters (`mm`).
  - Automatic alerts for the legal minimum (`< 1.6 mm` APK rejection), summer warning (`< 2.5 mm`), and winter optimal grip limit (`< 4.0 mm`).

---

## 2. Fiscal Trip Logging (`Ritregistratie`)

Designed for Dutch **Belastingdienst** compliance and business mileage reimbursement:

- **Trip Attributes:** Date, Start Odometer, End Odometer, auto-calculated Distance (`km`), Departure Address, Destination Address, Purpose (**Business**, **Commute**, **Private**), Notes, and a **1-Click Return Trip (`Terugrit`)** toggle.
- **Fiscal Summary KPIs:** Real-time breakdown of Total Distance, Business km, Commute km, Private km, and Business Usage Percentage.
- **3 Export Formats:**
  1. **Belastingdienst CSV (`.csv`):** UTF-8 BOM semicolon-delimited export with official Dutch fiscal headers.
  2. **Formatted Excel Workbook (`.xlsx`):** Styled spreadsheet with summary KPIs and formulas.
  3. **Landscape A4 Fiscal PDF Dossier (`.pdf`):** Ready for accountant or tax audit submission.
