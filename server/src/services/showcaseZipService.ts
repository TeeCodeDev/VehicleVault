import path from 'node:path';
import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { CompiledShowcase, ShowcaseService } from './showcaseService.js';
import { DATA_PATHS } from '../config/env.js';

export class ShowcaseZipService {
  /**
   * Generates a complete, standalone static website ZIP package matching auto.romanas.nl.
   */
  public static async generateZip(showcase: CompiledShowcase): Promise<Buffer> {
    const zip = new AdmZip();

    // 1. Generate HTML
    const html = this.buildHtml(showcase);
    zip.addFile('index.html', Buffer.from(html, 'utf8'));

    // 2. Generate CSS
    const css = this.buildCss();
    zip.addFile('css/styles.css', Buffer.from(css, 'utf8'));

    // 3. Generate JS
    const js = this.buildJs(showcase);
    zip.addFile('js/app.js', Buffer.from(js, 'utf8'));

    // 4. Bundle vehicle photos into images/ folder
    for (const photo of showcase.photos) {
      const diskPath = path.join(DATA_PATHS.vehicles, photo.file_path);
      if (fs.existsSync(diskPath)) {
        try {
          const content = fs.readFileSync(diskPath);
          zip.addFile(`images/${photo.file_path}`, content);
        } catch {
          // ignore read error
        }
      }
    }

    return zip.toBuffer();
  }

  private static buildHtml(showcase: CompiledShowcase): string {
    const v = showcase.vehicle;
    const stats = showcase.stats;
    const priceText = showcase.asking_price
      ? `${showcase.price_label}: ${ShowcaseService.formatCurrency(showcase.asking_price)}`
      : showcase.price_label || 'Vraagprijs op aanvraag';

    return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${this.escapeHtml(showcase.title)} te koop/inruil. ${this.escapeHtml(showcase.subtitle)}">
  <title>${this.escapeHtml(showcase.title)} | Digitaal Voertuigdossier</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>

  <!-- Header / Navigation -->
  <header class="site-header">
    <div class="container nav-wrapper">
      <a href="#" class="nav-brand">
        <div class="brand-icon">VV</div>
        <div class="brand-text">
          <h1>${this.escapeHtml(showcase.title)}</h1>
          <span>Voertuiginformatie, Verkoop & Inruil</span>
        </div>
      </a>

      <nav>
        <ul class="nav-links">
          <li><a href="#fotos">Foto's (${showcase.photos.length})</a></li>
          <li><a href="#highlights">Highlights</a></li>
          <li><a href="#specificaties">Specificaties</a></li>
          <li><a href="#opties">Opties</a></li>
          <li><a href="#historie">Historie</a></li>
          <li><a href="#contact" class="btn-nav-contact">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main>
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container hero-content">
        <div class="hero-top-badges">
          ${v.license_plate ? `
          <div class="nl-plate">
            <div class="eu-flag">
              <span>NL</span>
            </div>
            <span class="plate-code">${this.escapeHtml(v.license_plate)}</span>
          </div>
          <button id="btn-copy-kenteken" class="badge badge-info" title="Klik om kenteken te kopiëren" style="cursor:pointer; border:none;">
            📋 Kopieer kenteken
          </button>
          ` : ''}
          <span class="badge badge-premium">💰 ${this.escapeHtml(priceText)}</span>
          <span class="badge badge-success">🛡️ APK t/m ${this.escapeHtml(stats.apk_vervaldatum)}</span>
          <span class="badge badge-success">✓ ${this.escapeHtml(stats.nap_oordeel)}</span>
          <span class="badge badge-info">⚡ Energielabel ${this.escapeHtml(stats.energielabel)}</span>
        </div>

        <div class="hero-title-group">
          <h2>${this.escapeHtml(showcase.title)}</h2>
          <p class="hero-subtitle">
            ${this.escapeHtml(showcase.subtitle)}
          </p>
        </div>

        <div class="hero-stats-grid">
          <div class="stat-card">
            <div class="stat-label">Bouwjaar</div>
            <div class="stat-value">${this.escapeHtml(stats.bouwjaar)}</div>
            <div class="stat-sub">Origineel Nederlands</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Kilometerstand</div>
            <div class="stat-value">${this.escapeHtml(stats.kilometerstand)}</div>
            <div class="stat-sub">Geregistreerd in VehicleVault</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Brandstof & Transmissie</div>
            <div class="stat-value">${this.escapeHtml(stats.brandstof_transmissie)}</div>
            <div class="stat-sub">Zuinig & betrouwbaar</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Vermogen</div>
            <div class="stat-value">${this.escapeHtml(stats.vermogen)}</div>
            <div class="stat-sub">Motorvermogen</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">APK Vervaldatum</div>
            <div class="stat-value">${this.escapeHtml(stats.apk_vervaldatum)}</div>
            <div class="stat-sub">Gekeurd & veilig</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Highlights Section -->
    ${showcase.highlights.length > 0 ? `
    <section id="highlights" class="section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Voordelen & Staat</span>
          <h3 class="section-title">Belangrijkste Pluspunten</h3>
          <p class="section-description">Kort samengevat waarom dit voertuig een betrouwbare aankoop of inruil is.</p>
        </div>

        <div class="highlights-grid">
          ${showcase.highlights.map(h => `
          <div class="highlight-card">
            <div class="highlight-icon">✨</div>
            <div class="highlight-body">
              <h3>${this.escapeHtml(h.title)}</h3>
              <p>${this.escapeHtml(h.description)}</p>
            </div>
          </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    <!-- Photo Gallery Section -->
    <section id="fotos" class="section section-alt">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Fotoreportage</span>
          <h3 class="section-title">Foto's & Details</h3>
          <p class="section-description">Klik op een foto voor een hoge resolutie weergave. Gebruik de filters om snel specifieke onderdelen te bekijken.</p>
        </div>

        <div class="gallery-controls">
          <button class="filter-btn active" data-filter="all">Alle foto's (${showcase.photos.length})</button>
          <button class="filter-btn" data-filter="exterieur">Exterieur (${showcase.photos.filter(p => p.category === 'exterieur').length})</button>
          <button class="filter-btn" data-filter="interieur">Interieur (${showcase.photos.filter(p => p.category === 'interieur').length})</button>
          <button class="filter-btn" data-filter="details">Details & Opties (${showcase.photos.filter(p => p.category === 'details').length})</button>
          <button class="filter-btn" data-filter="gebruikssporen">Gebruikssporen (${showcase.photos.filter(p => p.category === 'gebruikssporen').length})</button>
        </div>

        <div id="gallery-grid" class="gallery-grid">
          ${showcase.photos.map((p, idx) => `
          <div class="gallery-card" data-category="${p.category}" data-index="${idx}">
            <div class="gallery-img-wrapper">
              <img src="images/${p.file_path}" alt="${this.escapeHtml(p.title || 'Voertuigfoto')}" loading="lazy">
              <span class="gallery-badge category-${p.category}">${p.category}</span>
            </div>
            <div class="gallery-caption">
              <strong>${this.escapeHtml(p.title || 'Foto')}</strong>
              ${p.description ? `<p>${this.escapeHtml(p.description)}</p>` : ''}
            </div>
          </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- Technical Specifications Section -->
    ${showcase.show_rdw_specs ? `
    <section id="specificaties" class="section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Officiële RDW Specificaties</span>
          <h3 class="section-title">Technische Gegevens</h3>
          <p class="section-description">Geverifieerd via het officiële Nederlandse RDW-register.</p>
        </div>

        <div class="specs-wrapper">
          <div class="spec-category-card">
            <h4 class="spec-category-title">📋 Basis & Registratie</h4>
            <table class="spec-table">
              ${showcase.specs.basis.map(s => `<tr><td class="spec-key">${this.escapeHtml(s.label)}</td><td class="spec-val">${this.escapeHtml(s.value)}</td></tr>`).join('')}
            </table>
          </div>

          <div class="spec-category-card">
            <h4 class="spec-category-title">⚙️ Motor & Aandrijving</h4>
            <table class="spec-table">
              ${showcase.specs.motor.map(s => `<tr><td class="spec-key">${this.escapeHtml(s.label)}</td><td class="spec-val">${this.escapeHtml(s.value)}</td></tr>`).join('')}
            </table>
          </div>

          <div class="spec-category-card">
            <h4 class="spec-category-title">🌱 Milieu, Verbruik & Maten</h4>
            <table class="spec-table">
              ${showcase.specs.milieu.map(s => `<tr><td class="spec-key">${this.escapeHtml(s.label)}</td><td class="spec-val">${this.escapeHtml(s.value)}</td></tr>`).join('')}
            </table>
          </div>
        </div>
      </div>
    </section>
    ` : ''}

    <!-- Equipment & Options Section -->
    ${showcase.options_list.length > 0 ? `
    <section id="opties" class="section section-alt">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Uitrustingsniveau</span>
          <h3 class="section-title">Opties & Accessoires</h3>
          <p class="section-description">Compleet overzicht van alle aanwezige fabrieksopties en comfortvoorzieningen.</p>
        </div>

        <div class="options-grid">
          ${showcase.options_list.map(grp => `
          <div class="options-category-block">
            <h4>${this.escapeHtml(grp.category)}</h4>
            <ul class="options-list">
              ${grp.items.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    <!-- Maintenance & Honest Transparency Section -->
    <section id="historie" class="section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Onderhoud & Transparantie</span>
          <h3 class="section-title">Staat van het Voertuig & Historie</h3>
          <p class="section-description">Eerlijke en transparante informatie voor een betrouwbare aankoop of inruil.</p>
        </div>

        <!-- Transparency Card -->
        <div class="transparency-card">
          <div class="transparency-header">
            <h3>📖 Onderhoudshistorie & Documentatie</h3>
          </div>
          <p class="transparency-text">
            ${this.escapeHtml(showcase.transparency_notes || 'Consequent en tijdig onderhouden conform fabrieksintervallen.')}
          </p>
        </div>

        <!-- Maintenance Table -->
        ${showcase.show_maintenance_history && showcase.maintenance_records.length > 0 ? `
        <div class="table-container" style="margin-top: 2rem;">
          <h4 style="margin-bottom: 1rem; font-weight: 800;">Recent Uitgevoerde Onderhoudsbeurten</h4>
          <table class="maintenance-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Km-stand</th>
                <th>Categorie</th>
                <th>Omschrijving</th>
                <th>Factuur</th>
              </tr>
            </thead>
            <tbody>
              ${showcase.maintenance_records.map(r => `
              <tr>
                <td>${this.escapeHtml(r.date)}</td>
                <td><strong>${r.odometer.toLocaleString('nl-NL')} km</strong></td>
                <td><span class="badge badge-info">${this.escapeHtml(r.category)}</span></td>
                <td>${this.escapeHtml(r.description || '—')}</td>
                <td>${r.has_invoice ? '✓ Aanwezig' : '—'}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Tire Status -->
        ${showcase.show_tire_status && showcase.tires ? `
        <div class="tires-card" style="margin-top: 2rem;">
          <h4>🛞 Gemonteerde Bandenset</h4>
          <p><strong>${this.escapeHtml(showcase.tires.name)}</strong> (${this.escapeHtml(showcase.tires.season)} ${showcase.tires.brand_model ? `• ${this.escapeHtml(showcase.tires.brand_model)}` : ''} ${showcase.tires.tire_size ? `• ${this.escapeHtml(showcase.tires.tire_size)}` : ''})</p>
          <div class="tread-depths-grid">
            <div class="depth-item"><span>Linksvoor:</span> <strong>${showcase.tires.tread_depth_fl ? `${showcase.tires.tread_depth_fl} mm` : '—'}</strong></div>
            <div class="depth-item"><span>Rechtsvoor:</span> <strong>${showcase.tires.tread_depth_fr ? `${showcase.tires.tread_depth_fr} mm` : '—'}</strong></div>
            <div class="depth-item"><span>Linksachter:</span> <strong>${showcase.tires.tread_depth_rl ? `${showcase.tires.tread_depth_rl} mm` : '—'}</strong></div>
            <div class="depth-item"><span>Rechtsachter:</span> <strong>${showcase.tires.tread_depth_rr ? `${showcase.tires.tread_depth_rr} mm` : '—'}</strong></div>
          </div>
        </div>
        ` : ''}
      </div>
    </section>

    <!-- Contact & Inruil CTA Section -->
    <section id="contact" class="section section-cta">
      <div class="container contact-box">
        <h3 class="cta-title">Interesse of Bod Uitbrengen?</h3>
        <p class="cta-subtitle">Neem direct contact op voor een proefrit, inruilvoorstel of bezichtiging.</p>

        <div class="contact-actions">
          ${showcase.contact_whatsapp ? `
          <a href="https://wa.me/${showcase.contact_whatsapp.replace(/[^0-9]/g, '')}?text=Hallo,%20ik%20heb%20interesse%20in%20de%20${encodeURIComponent(showcase.title)}%20(${encodeURIComponent(v.license_plate || '')})" target="_blank" rel="noopener" class="btn-cta btn-whatsapp">
            💬 WhatsApp Bericht Sturen
          </a>
          ` : ''}

          ${showcase.contact_phone ? `
          <a href="tel:${showcase.contact_phone.replace(/[^0-9+]/g, '')}" class="btn-cta btn-phone">
            📞 Bellen (${this.escapeHtml(showcase.contact_phone)})
          </a>
          ` : ''}

          ${showcase.contact_email ? `
          <a href="mailto:${showcase.contact_email}?subject=Interesse%20in%20${encodeURIComponent(showcase.title)}%20(${encodeURIComponent(v.license_plate || '')})" class="btn-cta btn-email">
            ✉️ E-mail Sturen
          </a>
          ` : ''}
        </div>

        ${showcase.contact_location ? `
        <p class="contact-loc">📍 Bezichtiging mogelijk in: <strong>${this.escapeHtml(showcase.contact_location)}</strong></p>
        ` : ''}
      </div>
    </section>
  </main>

  <!-- Lightbox Modal -->
  <div id="lightbox-modal" class="lightbox-modal" role="dialog" aria-modal="true">
    <button id="lightbox-close" class="lightbox-close-btn" aria-label="Sluiten">&times;</button>
    <button id="lightbox-prev" class="lightbox-nav-btn lightbox-prev-btn" aria-label="Vorige foto">&#10094;</button>
    <button id="lightbox-next" class="lightbox-nav-btn lightbox-next-btn" aria-label="Volgende foto">&#10095;</button>

    <div class="lightbox-content-box">
      <img id="lightbox-img" class="lightbox-img" src="" alt="Voertuigfoto">
    </div>

    <div class="lightbox-footer">
      <div id="lightbox-counter" class="lightbox-counter"></div>
      <div id="lightbox-caption" class="lightbox-caption-text"></div>
    </div>
  </div>

  <footer class="site-footer">
    <div class="container footer-content">
      <p><strong>${this.escapeHtml(showcase.title)}</strong> ${v.license_plate ? `(${this.escapeHtml(v.license_plate)})` : ''}</p>
      <p>Aangemaakt via VehicleVault 2.0 &bull; Alle gegevens zijn met zorg samengesteld en geverifieerd via het RDW-register.</p>
    </div>
  </footer>

  <script src="js/app.js"></script>
</body>
</html>`;
  }

  private static buildCss(): string {
    return `/* =======================================================================
   VehicleVault Showcase Theme (Clean Luxury Automotive Design)
   ======================================================================= */
:root {
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --accent: #4f46e5;
  --bg-main: #f8fafc;
  --bg-card: #ffffff;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --radius: 16px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font); background: var(--bg-main); color: var(--text-main); line-height: 1.6; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }

/* Header */
.site-header { background: #ffffff; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50; }
.nav-wrapper { display: flex; align-items: center; justify-content: space-between; height: 70px; }
.nav-brand { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: inherit; }
.brand-icon { width: 40px; height: 40px; background: #2563eb; color: #fff; font-weight: 900; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
.brand-text h1 { font-size: 1rem; font-weight: 800; line-height: 1.2; }
.brand-text span { font-size: 0.75rem; color: var(--text-muted); }
.nav-links { display: flex; align-items: center; gap: 1.25rem; list-style: none; }
.nav-links a { text-decoration: none; color: var(--text-main); font-weight: 600; font-size: 0.875rem; transition: color 0.2s; }
.nav-links a:hover { color: var(--primary); }
.btn-nav-contact { background: var(--primary); color: #fff !important; padding: 0.5rem 1rem; border-radius: 10px; }

/* Hero */
.hero-section { background: #ffffff; border-bottom: 1px solid var(--border); padding: 3rem 0; }
.hero-top-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
.nl-plate { display: inline-flex; align-items: center; background: #f5c518; color: #000; font-family: monospace; font-weight: 900; font-size: 1.1rem; border-radius: 6px; border: 1.5px solid #d97706; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.eu-flag { background: #003399; color: #fff; padding: 0.25rem 0.4rem; font-size: 0.65rem; font-weight: bold; }
.plate-code { padding: 0.25rem 0.6rem; letter-spacing: 2px; }
.badge { display: inline-flex; align-items: center; padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; border: 1px solid transparent; }
.badge-info { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
.badge-success { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
.badge-premium { background: #fefce8; color: #854d0e; border-color: #fef08a; }
.hero-title-group h2 { font-size: 2.5rem; font-weight: 900; letter-spacing: -0.03em; margin-bottom: 0.75rem; }
.hero-subtitle { font-size: 1.05rem; color: var(--text-muted); max-width: 900px; margin-bottom: 2rem; }
.hero-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.stat-card { background: var(--bg-main); border: 1px solid var(--border); padding: 1.25rem; border-radius: var(--radius); }
.stat-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 0.25rem; }
.stat-value { font-size: 1.25rem; font-weight: 900; color: var(--text-main); }
.stat-sub { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }

/* Sections */
.section { padding: 4rem 0; }
.section-alt { background: #ffffff; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.section-header { margin-bottom: 2.5rem; }
.section-tag { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 0.08em; }
.section-title { font-size: 2rem; font-weight: 900; letter-spacing: -0.02em; margin-top: 0.25rem; }
.section-description { font-size: 0.95rem; color: var(--text-muted); margin-top: 0.25rem; }

/* Highlights */
.highlights-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; }
.highlight-card { background: #ffffff; border: 1px solid var(--border); padding: 1.5rem; border-radius: var(--radius); display: flex; gap: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.highlight-icon { font-size: 1.5rem; }
.highlight-body h3 { font-size: 1.05rem; font-weight: 800; margin-bottom: 0.35rem; }
.highlight-body p { font-size: 0.875rem; color: var(--text-muted); }

/* Gallery */
.gallery-controls { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem; }
.filter-btn { padding: 0.5rem 1rem; border-radius: 9999px; border: 1px solid var(--border); background: #ffffff; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
.filter-btn:hover { background: #f1f5f9; }
.filter-btn.active { background: var(--primary); color: #ffffff; border-color: var(--primary); }
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
.gallery-card { background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.gallery-card:hover { transform: translateY(-4px); box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1); }
.gallery-img-wrapper { position: relative; aspect-ratio: 16/10; overflow: hidden; background: #e2e8f0; }
.gallery-img-wrapper img { width: 100%; height: 100%; object-fit: cover; }
.gallery-badge { position: absolute; top: 0.75rem; right: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; background: rgba(0,0,0,0.7); color: #fff; }
.gallery-caption { padding: 1rem; }
.gallery-caption strong { font-size: 0.95rem; font-weight: 800; display: block; }
.gallery-caption p { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; }

/* Specs */
.specs-wrapper { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
.spec-category-card { background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; }
.spec-category-title { font-size: 1.1rem; font-weight: 800; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
.spec-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.spec-table tr:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
.spec-table td { padding: 0.5rem 0; }
.spec-key { color: var(--text-muted); width: 55%; font-weight: 500; }
.spec-val { color: var(--text-main); font-weight: 700; }

/* Options */
.options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
.options-category-block { background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; }
.options-category-block h4 { font-size: 1.05rem; font-weight: 800; margin-bottom: 1rem; }
.options-list { list-style: none; font-size: 0.875rem; space-y: 0.5rem; }
.options-list li { padding: 0.35rem 0; position: relative; padding-left: 1.25rem; }
.options-list li::before { content: "✓"; position: absolute; left: 0; color: #16a34a; font-weight: 900; }

/* Transparency */
.transparency-card { background: #ffffff; border: 1px solid var(--border); border-left: 5px solid #2563eb; border-radius: var(--radius); padding: 1.5rem; }
.transparency-header h3 { font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem; }
.transparency-text { font-size: 0.95rem; color: #334155; line-height: 1.7; white-space: pre-line; }

/* Tables */
.table-container { background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; overflow-x: auto; }
.maintenance-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.maintenance-table th { text-align: left; padding: 0.75rem; border-bottom: 2px solid var(--border); font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); }
.maintenance-table td { padding: 0.75rem; border-bottom: 1px solid #f1f5f9; }

/* Tires */
.tires-card { background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; }
.tires-card h4 { font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem; }
.tread-depths-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 1rem; }
.depth-item { background: var(--bg-main); padding: 0.75rem; border-radius: 10px; text-align: center; font-size: 0.8rem; border: 1px solid var(--border); }
.depth-item strong { display: block; font-size: 1.1rem; color: #16a34a; }

/* Contact CTA */
.section-cta { background: #ffffff; border-top: 1px solid var(--border); }
.contact-box { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; border-radius: 24px; padding: 3rem 2rem; text-align: center; box-shadow: 0 10px 25px -5px rgba(37,99,235,0.4); }
.cta-title { font-size: 2rem; font-weight: 900; margin-bottom: 0.5rem; }
.cta-subtitle { font-size: 1.05rem; opacity: 0.9; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; }
.contact-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; }
.btn-cta { padding: 0.85rem 1.75rem; border-radius: 12px; font-weight: 800; font-size: 0.95rem; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; display: inline-flex; align-items: center; gap: 0.5rem; }
.btn-cta:hover { transform: scale(1.03); }
.btn-whatsapp { background: #25d366; color: #ffffff; }
.btn-phone { background: #ffffff; color: #1e3a8a; }
.btn-email { background: rgba(255,255,255,0.15); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); }
.contact-loc { margin-top: 1.5rem; font-size: 0.85rem; opacity: 0.85; }

/* Lightbox Modal */
.lightbox-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 1000; align-items: center; justify-content: center; }
.lightbox-modal.active { display: flex; }
.lightbox-content-box { max-width: 90vw; max-height: 80vh; display: flex; align-items: center; justify-content: center; }
.lightbox-img { max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
.lightbox-close-btn { position: absolute; top: 1.5rem; right: 2rem; background: transparent; border: none; color: #ffffff; font-size: 2.5rem; cursor: pointer; }
.lightbox-nav-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.15); border: none; color: #ffffff; font-size: 2rem; padding: 1rem 1.25rem; cursor: pointer; border-radius: 8px; }
.lightbox-prev-btn { left: 1.5rem; }
.lightbox-next-btn { right: 1.5rem; }
.lightbox-footer { position: absolute; bottom: 1.5rem; text-align: center; color: #ffffff; width: 100%; }
.lightbox-counter { font-size: 0.8rem; opacity: 0.7; }
.lightbox-caption-text { font-size: 1rem; font-weight: 700; margin-top: 0.25rem; }

/* Footer */
.site-footer { background: #0f172a; color: #94a3b8; padding: 2rem 0; text-align: center; font-size: 0.8rem; }
.site-footer p:first-child { color: #ffffff; font-weight: 700; margin-bottom: 0.25rem; }

/* Mobile */
@media (max-width: 768px) {
  .nav-links { display: none; }
  .hero-title-group h2 { font-size: 1.75rem; }
  .section-title { font-size: 1.5rem; }
  .tread-depths-grid { grid-template-columns: repeat(2, 1fr); }
}
`;
  }

  private static buildJs(showcase: CompiledShowcase): string {
    return `// VehicleVault Interactive Showcase Script
document.addEventListener('DOMContentLoaded', () => {
  // 1. Copy kenteken button
  const copyBtn = document.getElementById('btn-copy-kenteken');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const plate = "${showcase.vehicle.license_plate || ''}";
      if (plate) {
        navigator.clipboard.writeText(plate).then(() => {
          const original = copyBtn.innerText;
          copyBtn.innerText = '✓ Gekopieerd!';
          setTimeout(() => copyBtn.innerText = original, 2000);
        });
      }
    });
  }

  // 2. Photo gallery filtering
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.gallery-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.getAttribute('data-filter');

      cards.forEach(card => {
        if (cat === 'all' || card.getAttribute('data-category') === cat) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // 3. Lightbox modal
  const photosData = ${JSON.stringify(showcase.photos)};
  const modal = document.getElementById('lightbox-modal');
  const modalImg = document.getElementById('lightbox-img');
  const modalCounter = document.getElementById('lightbox-counter');
  const modalCaption = document.getElementById('lightbox-caption');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');

  let currentIndex = 0;

  function showPhoto(idx) {
    if (!photosData || photosData.length === 0) return;
    if (idx < 0) idx = photosData.length - 1;
    if (idx >= photosData.length) idx = 0;
    currentIndex = idx;

    const p = photosData[idx];
    modalImg.src = 'images/' + p.file_path;
    modalCounter.innerText = (idx + 1) + ' / ' + photosData.length;
    modalCaption.innerText = p.title || '';
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.getAttribute('data-index'), 10);
      showPhoto(idx);
      modal.classList.add('active');
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  if (prevBtn) prevBtn.addEventListener('click', () => showPhoto(currentIndex - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => showPhoto(currentIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;
    if (e.key === 'Escape') modal.classList.remove('active');
    if (e.key === 'ArrowLeft') showPhoto(currentIndex - 1);
    if (e.key === 'ArrowRight') showPhoto(currentIndex + 1);
  });
});
`;
  }

  private static escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

