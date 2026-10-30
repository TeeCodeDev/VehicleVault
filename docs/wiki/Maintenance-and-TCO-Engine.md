# 🛠️ Maintenance, Pure TCO & PDF Dossier Export

VehicleVault combines a proactive **Dual-Trigger Maintenance Engine** with a **Pure Ownership Total Cost of Ownership (TCO)** calculator and a **Full-Attachment PDF Dossier Generator**.

---

## 1. Dual-Trigger Maintenance Intervals

Every maintenance item (e.g., *Engine Oil & Filter*, *Timing Belt*, *Brake Fluid*, *Cabin Filter*, *Spark Plugs*) tracks both **Distance (`km`)** and **Time (`months`)**:

$$\text{Usage \%} = \max\left(\frac{\text{Current Odometer} - \text{Last Service Odometer}}{\text{Interval km}}, \frac{\text{Days Elapsed}}{\text{Interval Months} \times 30.44}\right) \times 100$$

- **Green (`Good`):** `< 90%` elapsed
- **Amber (`Due Soon`):** `90% – 99%` elapsed
- **Red (`Overdue`):** `>= 100%` elapsed

### Multi-Interval Reset from a Single Service Record
A major garage service often covers multiple maintenance intervals at once. When logging or editing a service record:
- Select **multiple intervals** via the checkboxes under **Reset Maintenance Intervals**.
- When scanning an invoice with AI, VehicleVault automatically pre-selects all matching intervals based on the translated invoice line items.
- Saving the record updates `last_service_date` and `last_service_odometer` across all selected intervals simultaneously (only advancing an interval if the record is newer than its current baseline).

---

## 2. Pure Ownership TCO & Pre-Ownership History

When you buy a used or imported car, you often digitize historical invoices from the previous owner to keep the service book complete. However, those historical bills were not paid by you and should not inflate your personal TCO.

### How Pre-Ownership Filtering Works
1. In **My Garage (`Mijn Garage`) → Edit Vehicle**, configure the **Purchase & TCO Baseline** section:
   - **Purchase Date (`Aankoopdatum / Tenaamstelling`):** Auto-filled from the RDW `datum_tenaamstelling` for Dutch plates, or set manually.
   - **Initial Odometer (`Kilometerstand bij aanschaf`):** Your odometer reading when taking ownership.
   - **Purchase Price (`Aankoopprijs`).**
2. Any service record dated **before your Purchase Date** or logged at an **odometer reading lower than your Initial Odometer** (or manually toggled with *"Previous owner / Exclude from TCO"*) is automatically badged as **`Vorige eigenaar (buiten TCO)`**.
3. These records remain **100% visible** in your Maintenance Passport and still update your maintenance intervals, but are **excluded from TCO financial totals, cost-per-km, and monthly spend charts**.

---

## 3. PDF Vehicle Dossier Export with Full-Page Invoices

From the **Dashboard** or **TCO & Analytics** page, click **Export PDF Dossier**:

- **Optional Sections:**
  - **Current Tires & Tread Depth (`Huidige Bandenset & Profieldiepte`):** Includes the mounted tire set's brand, model, tire size, rim size, load/speed index, DOT code, driven km, and 4-wheel tread depths (`LV`, `RV`, `LA`, `RA`).
  - **Fuel History Summary (`Tankhistorie`).**
  - **Attached Receipts & Maintenance Invoices (`Gekoppelde Bonnen & Facturen`).**
- **Full-Page Merged PDF & Image Attachments (`pdf-lib`):**
  - Instead of listing a filename, VehicleVault embeds every attached `.pdf` maintenance invoice (all pages) and image invoice as **full-size separate pages** at the end of the PDF dossier, complete with an identification banner showing the service date, title, and garage name.
