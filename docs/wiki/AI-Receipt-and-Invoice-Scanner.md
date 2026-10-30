# 🤖 AI Receipt & Maintenance Invoice Scanner

VehicleVault includes a dual-purpose **AI Vision Extraction & Translation Engine** supporting **Google Gemini Vision** (`gemini-3.8-flash`), **OpenAI Vision** (`gpt-4o-mini` / `gpt-4o` / custom OpenAI-compatible endpoints), and a zero-cloud local **Tesseract.js OCR** fallback.

---

## 1. Configuring AI Vision Providers

Navigate to **Settings → AI & OCR** to configure your preferred provider:

1. **Google Gemini Vision (Recommended):**
   - Paste your Google AI Studio API Key.
   - Click **Fetch Available Models** to dynamically discover supported vision models (`gemini-3.8-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`).
   - Click **Test Connection** and **Save**.
2. **OpenAI / Custom Compatible Endpoint:**
   - Paste your OpenAI API Key, model name (`gpt-4o-mini`), and optional custom Base URL (e.g., OpenRouter, Ollama, or Azure OpenAI).
3. **Local Tesseract OCR Fallback:**
   - When no AI API key is configured, fuel receipts are processed locally on the server using Tesseract OCR and mathematical reconciliation rules.

---

## 2. Smart Foreign Maintenance Invoice Scanner & Translator

Perfect for **imported vehicles** (e.g., from Germany, Belgium, or France) or complex multi-page workshop invoices:

1. Go to **Maintenance (`Onderhoud & Historie`)** and click **Log Service (`Onderhoud Loggen`)**.
2. Drag and drop a **PDF or photo** of a garage invoice into the **Smart AI Invoice Scanner** dropzone at the top of the modal.
3. VehicleVault automatically extracts and translates into your active UI language (`NL` or `EN`):
   - **Service Title & Summary** (e.g., `Inspektion mit Ölwechsel und Bremsflüssigkeit` → `Onderhoudsbeurt (90.000 km / 72 mnd) & Remvloeistof`)
   - **Invoice Date (`YYYY-MM-DD`) & Odometer Reading (`km`)**
   - **Garage / Dealership Name & Full Address** (automatically linked to Google Maps in your service table)
   - **Parts Cost vs. Labor Cost** (automatically reconciling net line items with 19% German MwSt or 21% Dutch BTW into exact gross totals)
   - **Every Individual Line Item:** Each part and labor operation is categorized (`PART` / `LABOR`), keeping both the translated description and the original foreign invoice text.
4. **Dedicated Extracted Parts Modal:**
   - In the service history table, click the **`X extracted & translated items`** button on any service record to open a clean modal showing the garage details, cost breakdown, and every individual translated part/labor line item.
5. **Automatic Digital Glovebox Sync:**
   - Every uploaded maintenance invoice is automatically copied and indexed under **Documents (`Documenten` → `Facturen & Bonnen`)** with a formatted `DD-MM-YYYY` date.

---

## 3. Fuel Receipt Scanner & GPS Station Lookup

When logging a fill-up under **Fuel (`Tankbeurten`)**:
- Upload or snap a photo of your fuel receipt.
- The scanner extracts **Liters**, **Price per Liter (€/L)**, **Total Cost (€)**, **Date**, **Station Brand**, and **Station Address**.
- If a dot-matrix receipt has partially faded digits, the mathematical reconciliation engine cross-checks `Liters × Price/L = Total Cost` to recover exact values.
- You can also use **GPS Nearby Stations** or **Re-scan Receipt** on existing fuel entries at any time.
