import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { RdwService } from './rdwService.js';
import { VehiclePhoto } from '../controllers/photoController.js';

export interface ShowcaseHighlight {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface ShowcaseOptionGroup {
  category: string;
  items: string[];
}

export interface CompiledShowcase {
  id: string;
  vehicle_id: string;
  public_slug: string;
  is_active: boolean;
  asking_price: number | null;
  price_label: string;
  title: string;
  subtitle: string;
  highlights: ShowcaseHighlight[];
  options_list: ShowcaseOptionGroup[];
  transparency_notes: string;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_location: string | null;
  show_maintenance_history: boolean;
  show_tire_status: boolean;
  show_rdw_specs: boolean;
  vehicle: {
    id: string;
    name: string;
    type: string;
    license_plate: string | null;
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    fuel_type: string | null;
    current_odometer: number;
    apk_expiration_date: string | null;
    apk_status?: string;
  };
  stats: {
    bouwjaar: string;
    kilometerstand: string;
    brandstof_transmissie: string;
    vermogen: string;
    apk_vervaldatum: string;
    apk_status: string;
    energielabel: string;
    nap_oordeel: string;
  };
  photos: VehiclePhoto[];
  specs: {
    basis: { label: string; value: string }[];
    motor: { label: string; value: string }[];
    milieu: { label: string; value: string }[];
  };
  maintenance_records: {
    date: string;
    odometer: number;
    category: string;
    description: string;
    has_invoice: boolean;
  }[];
  tires: {
    name: string;
    brand_model?: string;
    brand?: string;
    model?: string;
    season: string;
    tire_size?: string;
    rim_size?: string;
    speed_index?: string;
    tread_depth_fl?: number;
    tread_depth_fr?: number;
    tread_depth_rl?: number;
    tread_depth_rr?: number;
    last_measured_date?: string;
  } | null;
}

export class ShowcaseService {
  /**
   * Generates a clean URL slug from vehicle name and license plate.
   */
  public static generateDefaultSlug(vehicle: any): string {
    const parts = [
      vehicle.make || '',
      vehicle.model || vehicle.name || '',
      vehicle.year || '',
      vehicle.license_plate ? RdwService.normalizePlate(vehicle.license_plate) : '',
    ]
      .filter(Boolean)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    const clean = parts.length > 3 ? parts : `auto-${crypto.randomUUID().slice(0, 8)}`;
    // Verify uniqueness
    const existing = db.get<any>('SELECT id FROM vehicle_showcases WHERE public_slug = ?', [clean]);
    return existing ? `${clean}-${crypto.randomUUID().slice(0, 4)}` : clean;
  }

  /**
   * Formats Dutch currency.
   */
  public static formatCurrency(val?: number | null): string {
    if (val === undefined || val === null) return 'Prijs op aanvraag';
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  }

  /**
   * Formats Dutch display date.
   */
  public static formatDutchDate(isoDate?: string | null): string {
    if (!isoDate) return 'Onbekend';
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoDate;
    }
  }

  /**
   * Retrieves or automatically initializes a showcase dossier for a vehicle.
   */
  public static getOrInitShowcase(vehicleId: string): CompiledShowcase | null {
    const vehicle = db.get<any>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) return null;

    let showcase = db.get<any>('SELECT * FROM vehicle_showcases WHERE vehicle_id = ?', [vehicleId]);

    // Parse RDW data if available
    let rdw: any = {};
    if (vehicle.rdw_data) {
      try {
        rdw = typeof vehicle.rdw_data === 'string' ? JSON.parse(vehicle.rdw_data) : vehicle.rdw_data;
      } catch {
        rdw = {};
      }
    }

    // Determine current odometer from latest fuel entry, trip, service, or initial
    const latestFuel = db.get<any>('SELECT MAX(odometer) as max_odo FROM fuel_entries WHERE vehicle_id = ?', [vehicleId]);
    const latestTrip = db.get<any>('SELECT MAX(end_odometer) as max_odo FROM trips WHERE vehicle_id = ?', [vehicleId]);
    const latestService = db.get<any>('SELECT MAX(odometer) as max_odo FROM service_records WHERE vehicle_id = ?', [vehicleId]);
    const currentOdometer = Math.max(
      vehicle.initial_odometer || 0,
      latestFuel?.max_odo || 0,
      latestTrip?.max_odo || 0,
      latestService?.max_odo || 0
    );

    // If no showcase exists yet, auto-populate everything!
    if (!showcase) {
      const showcaseId = crypto.randomUUID();
      const slug = this.generateDefaultSlug(vehicle);

      // Auto-generate title
      const title = `${vehicle.make || ''} ${vehicle.model || vehicle.name} ${vehicle.year ? `(${vehicle.year})` : ''}`.trim();

      // Auto-generate subtitle
      const subtitle = `Origineel Nederlands geleverd voertuig met NAP Logisch oordeel. Zorgvuldig onderhouden, voorzien van ${
        vehicle.fuel_type || 'benzine'
      } aandrijving en geldige APK keuring.`;

      // Auto-generate highlights
      const serviceCount = db.get<any>('SELECT COUNT(*) as count FROM service_records WHERE vehicle_id = ?', [vehicleId])?.count || 0;
      const highlights: ShowcaseHighlight[] = [
        {
          id: 'hl-apk',
          icon: 'ShieldCheck',
          title: vehicle.apk_expiration_date ? `APK t/m ${this.formatDutchDate(vehicle.apk_expiration_date)}` : 'Geldige APK Keuring',
          description: 'Geen directe keuringszorgen; het voertuig is voorzien van een actuele APK keuring.',
        },
        {
          id: 'hl-nap',
          icon: 'CheckCircle',
          title: 'Origineel NL & NAP Logisch',
          description: 'Nederlands kenteken met een betrouwbare, sluitende kilometerstandgeschiedenis (NAP).',
        },
        {
          id: 'hl-hist',
          icon: 'FileText',
          title: serviceCount > 0 ? `${serviceCount} Onderhoudsregistraties` : 'Onderhoudshistorie Bekend',
          description: 'Consequent onderhouden met bewaarde facturen en geregistreerde beurten ter inzage.',
        },
        {
          id: 'hl-tech',
          icon: 'Cpu',
          title: `${vehicle.fuel_type || 'Moderne'} Aandrijflijn`,
          description: rdw.nettomaximumvermogen
            ? `Vermogen van ${Math.round(Number(rdw.nettomaximumvermogen))} kW (${Math.round(Number(rdw.nettomaximumvermogen) * 1.35962)} pk).`
            : 'Prettig, zuinig en betrouwbaar rijgedrag.',
        },
      ];

      // Auto-generate default options groups
      const defaultOptions: ShowcaseOptionGroup[] = [
        {
          category: 'Comfort & Interieur',
          items: [
            'Automatische Climate Control (Airconditioning)',
            'Multifunctioneel stuurwiel met stuurwielbediening',
            'Elektrisch bedienbare ramen voor en achter',
            'Middenarmsteun voor en bekerhouders',
            'In hoogte verstelbare bestuurdersstoel',
            'Achterbank in delen neerklapbaar met ISOFIX',
          ],
        },
        {
          category: 'Veiligheid & Rijassistentie',
          items: [
            'Cruise Control met snelheidsbegrenzer',
            'Parkeersensoren / Achteruitrijhulp',
            'ABS, Electronic Stability Program (ESP) en Traction Control',
            'Airbags rondom (inclusief zij- en gordijnairbags)',
            'Centrale deurvergrendeling met afstandsbediening',
          ],
        },
        {
          category: 'Multimedia & Exterieur',
          items: [
            'Full-color touchscreen multimedia & audiosysteem',
            'Bluetooth handsfree telefonie en audiostreaming',
            'Lichtmetalen velgen met goede kwaliteitsbanden',
            'Elektrisch verstelbare en verwarmbare buitenspiegels',
            'LED-dagrijverlichting en mistlampen',
          ],
        },
      ];

      // Auto-generate transparency notes
      const transparencyNotes = `Het voertuig is consequent en met zorg onderhouden volgens fabrieksvoorschriften. Facturen en onderhoudsbonnen zijn bewaard gebleven en liggen in het voertuig ter inzage.

Om verrassingen achteraf te voorkomen zijn we volledig transparant over de optische en technische staat: uitsluitend normale lichte gebruikerssporen passend bij het bouwjaar en de kilometerstand. Zie ook de foto's onder het kopje 'Gebruikssporen' in de fotogalerij voor specifieke details.`;

      // Get owner email for contact
      const owner = db.get<any>('SELECT email FROM users WHERE id = ?', [vehicle.user_id]);

      const now = new Date().toISOString();
      db.run(
        `INSERT INTO vehicle_showcases (
          id, vehicle_id, public_slug, is_active, asking_price, price_label,
          title, subtitle, highlights, options_list, transparency_notes,
          contact_whatsapp, contact_phone, contact_email, contact_location,
          show_maintenance_history, show_tire_status, show_rdw_specs,
          created_at, updated_at
        ) VALUES (?, ?, ?, 1, NULL, 'Vraagprijs', ?, ?, ?, ?, ?, '', '', ?, 'Nederland', 1, 1, 1, ?, ?)`,
        [
          showcaseId,
          vehicleId,
          slug,
          title,
          subtitle,
          JSON.stringify(highlights),
          JSON.stringify(defaultOptions),
          transparencyNotes,
          owner?.email || '',
          now,
          now,
        ]
      );

      showcase = db.get<any>('SELECT * FROM vehicle_showcases WHERE id = ?', [showcaseId]);
    }

    // Compile everything into high-density presentation package
    return this.buildCompiledShowcase(vehicle, showcase, rdw, currentOdometer);
  }

  /**
   * Retrieves a public showcase by slug or token.
   */
  public static getPublicShowcase(slugOrToken: string): CompiledShowcase | null {
    const showcase = db.get<any>(
      'SELECT * FROM vehicle_showcases WHERE (public_slug = ? OR id = ?) AND is_active = 1',
      [slugOrToken, slugOrToken]
    );
    if (!showcase) return null;

    const vehicle = db.get<any>('SELECT * FROM vehicles WHERE id = ?', [showcase.vehicle_id]);
    if (!vehicle) return null;

    let rdw: any = {};
    if (vehicle.rdw_data) {
      try {
        rdw = typeof vehicle.rdw_data === 'string' ? JSON.parse(vehicle.rdw_data) : vehicle.rdw_data;
      } catch {
        rdw = {};
      }
    }

    const latestFuel = db.get<any>('SELECT MAX(odometer) as max_odo FROM fuel_entries WHERE vehicle_id = ?', [vehicle.id]);
    const latestTrip = db.get<any>('SELECT MAX(end_odometer) as max_odo FROM trips WHERE vehicle_id = ?', [vehicle.id]);
    const latestService = db.get<any>('SELECT MAX(odometer) as max_odo FROM service_records WHERE vehicle_id = ?', [vehicle.id]);
    const currentOdometer = Math.max(
      vehicle.initial_odometer || 0,
      latestFuel?.max_odo || 0,
      latestTrip?.max_odo || 0,
      latestService?.max_odo || 0
    );

    return this.buildCompiledShowcase(vehicle, showcase, rdw, currentOdometer);
  }

  /**
   * Helper that compiles the presentation payload.
   */
  private static buildCompiledShowcase(vehicle: any, showcase: any, rdw: any, currentOdometer: number): CompiledShowcase {
    const vehicleId = vehicle.id;

    // Photos
    const photos = db.query<VehiclePhoto>(
      `SELECT * FROM vehicle_photos
       WHERE vehicle_id = ?
       ORDER BY is_primary DESC, sort_order ASC, created_at ASC`,
      [vehicleId]
    );

    // If photos table was empty but vehicles.image_path is set, fallback
    if (photos.length === 0 && vehicle.image_path) {
      photos.push({
        id: 'legacy-primary',
        vehicle_id: vehicleId,
        file_path: vehicle.image_path,
        category: 'exterieur',
        title: 'Hoofdfoto',
        sort_order: 0,
        is_primary: 1,
        created_at: vehicle.created_at || new Date().toISOString(),
      });
    }

    // Maintenance records
    const maintenanceRecords = showcase.show_maintenance_history === 1
      ? db.query<any>(
          `SELECT sr.date, sr.odometer, sr.service_item, sr.notes, sr.invoice_path, sc.name as category_name
           FROM service_records sr
           LEFT JOIN service_categories sc ON sr.category_id = sc.id
           WHERE sr.vehicle_id = ?
           ORDER BY sr.date DESC, sr.odometer DESC`,
          [vehicleId]
        ).map((r) => ({
          date: this.formatDutchDate(r.date),
          odometer: Math.round(r.odometer),
          category: r.category_name || 'Onderhoud',
          description: r.service_item || r.notes || '',
          has_invoice: !!r.invoice_path,
        }))
      : [];

    // Mounted tire set
    let mountedTire: any = null;
    if (showcase.show_tire_status === 1) {
      const tire = db.get<any>(
        "SELECT * FROM tire_sets WHERE vehicle_id = ? AND status = 'mounted' LIMIT 1",
        [vehicleId]
      );
      if (tire) {
        const fullBrandModel = tire.brand
          ? `${tire.brand}${tire.model ? ` ${tire.model}` : ''}`
          : (tire.brand_model || undefined);
        mountedTire = {
          name: tire.name,
          brand_model: fullBrandModel,
          brand: tire.brand || undefined,
          model: tire.model || undefined,
          season: tire.season,
          tire_size: tire.tire_size || undefined,
          rim_size: tire.rim_size || undefined,
          speed_index: tire.speed_index || undefined,
          tread_depth_fl: tire.tread_depth_fl ?? undefined,
          tread_depth_fr: tire.tread_depth_fr ?? undefined,
          tread_depth_rl: tire.tread_depth_rl ?? undefined,
          tread_depth_rr: tire.tread_depth_rr ?? undefined,
          last_measured_date: tire.last_measured_date ? this.formatDutchDate(tire.last_measured_date) : undefined,
        };
      }
    }

    // Parse highlights & options
    let highlights: ShowcaseHighlight[] = [];
    try {
      highlights = typeof showcase.highlights === 'string' ? JSON.parse(showcase.highlights) : showcase.highlights || [];
    } catch {
      highlights = [];
    }

    let optionsList: ShowcaseOptionGroup[] = [];
    try {
      optionsList = typeof showcase.options_list === 'string' ? JSON.parse(showcase.options_list) : showcase.options_list || [];
    } catch {
      optionsList = [];
    }

    // RDW Specs
    const basisSpecs: { label: string; value: string }[] = [
      { label: 'Kenteken', value: vehicle.license_plate ? RdwService.normalizePlate(vehicle.license_plate) : 'Onbekend' },
      { label: 'Merk & Model', value: `${vehicle.make || ''} ${vehicle.model || vehicle.name}`.trim() },
      { label: 'Carrosserie', value: rdw.inrichting || rdw.voertuigsoort || vehicle.type || 'Personenauto' },
      { label: 'Kleur', value: rdw.eerste_kleur ? rdw.eerste_kleur.charAt(0).toUpperCase() + rdw.eerste_kleur.slice(1).toLowerCase() : 'Niet opgegeven' },
      { label: 'Bouwjaar', value: vehicle.year ? String(vehicle.year) : (rdw.datum_eerste_toelating ? rdw.datum_eerste_toelating.substring(0, 4) : 'Onbekend') },
      { label: 'Datum eerste toelating', value: this.formatDutchDate(rdw.datum_eerste_toelating) },
      { label: 'Eerste toelating in NL', value: this.formatDutchDate(rdw.datum_eerste_tenaamstelling_in_nederland || rdw.datum_eerste_toelating) },
      { label: 'APK Vervaldatum', value: this.formatDutchDate(vehicle.apk_expiration_date || rdw.vervaldatum_apk) },
      { label: 'Tellerstand (actueel)', value: `${currentOdometer.toLocaleString('nl-NL')} km*` },
      { label: 'Tellerstandoordeel', value: rdw.tellerstandoordeel || 'NAP Logisch' },
      { label: 'Aantal zitplaatsen', value: rdw.aantal_zitplaatsen ? String(rdw.aantal_zitplaatsen) : '5' },
      { label: 'Aantal deuren', value: rdw.aantal_deuren ? String(rdw.aantal_deuren) : '5' },
    ];

    const motorKw = rdw.nettomaximumvermogen ? Math.round(Number(rdw.nettomaximumvermogen)) : null;
    const motorPk = motorKw ? Math.round(motorKw * 1.35962) : null;
    const motorSpecs: { label: string; value: string }[] = [
      { label: 'Brandstof', value: vehicle.fuel_type || rdw.brandstof_omschrijving || 'Benzine' },
      { label: 'Cilinderinhoud', value: rdw.cilinderinhoud ? `${Number(rdw.cilinderinhoud).toLocaleString('nl-NL')} cc` : 'N.v.t.' },
      { label: 'Aantal cilinders', value: rdw.aantal_cilinders ? String(rdw.aantal_cilinders) : '4' },
      { label: 'Vermogen', value: motorKw ? `${motorPk} pk (${motorKw} kW)` : 'N.v.t.' },
      { label: 'Transmissie', value: rdw.inrichting?.toLowerCase().includes('automaat') ? 'Automaat' : (vehicle.fuel_type?.toLowerCase().includes('hybride') || vehicle.fuel_type?.toLowerCase().includes('elektr') ? 'Automaat' : 'Handgeschakeld') },
      { label: 'Topsnelheid', value: rdw.maximum_snelheid ? `${rdw.maximum_snelheid} km/u` : 'Fabrieksopgave' },
    ];

    const verbruik = rdw.brandstofverbruik_gecombineerd ? Number(rdw.brandstofverbruik_gecombineerd) : null;
    const verbruikFormatted = verbruik ? `${verbruik.toFixed(1)} l/100 km (1 op ${(100 / verbruik).toFixed(1)})` : 'Zuinig / conform fabriek';
    const milieuSpecs: { label: string; value: string }[] = [
      { label: 'Energielabel', value: rdw.zuinigheidslabel || 'A' },
      { label: 'CO2-uitstoot', value: rdw.co2_uitstoot_gecombineerd ? `${rdw.co2_uitstoot_gecombineerd} g/km` : 'Conform fabriek' },
      { label: 'Verbruik gecombineerd', value: verbruikFormatted },
      { label: 'Emissieklasse', value: rdw.emissieklasse ? `Euro ${rdw.emissieklasse}` : 'Euro 5 / 6' },
      { label: 'Massa ledig voertuig', value: rdw.massa_ledig_voertuig ? `${Number(rdw.massa_ledig_voertuig).toLocaleString('nl-NL')} kg` : 'N.v.t.' },
      { label: 'Massa rijklaar', value: rdw.massa_rijklaar ? `${Number(rdw.massa_rijklaar).toLocaleString('nl-NL')} kg` : 'N.v.t.' },
      { label: 'Max. trekgewicht geremd', value: rdw.maximum_massa_trekken_geremd ? `${Number(rdw.maximum_massa_trekken_geremd).toLocaleString('nl-NL')} kg` : 'N.v.t.' },
      { label: 'Wielbasis', value: rdw.wielbasis ? `${rdw.wielbasis} cm` : 'N.v.t.' },
    ];

    const todayDateDutch = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const apkEval = RdwService.evaluateApkStatus(vehicle.apk_expiration_date || rdw.vervaldatum_apk);

    return {
      id: showcase.id,
      vehicle_id: vehicleId,
      public_slug: showcase.public_slug,
      is_active: showcase.is_active === 1,
      asking_price: showcase.asking_price !== null ? Number(showcase.asking_price) : null,
      price_label: showcase.price_label || 'Vraagprijs',
      title: showcase.title || `${vehicle.make || ''} ${vehicle.model || vehicle.name}`,
      subtitle: showcase.subtitle || '',
      highlights,
      options_list: optionsList,
      transparency_notes: showcase.transparency_notes || '',
      contact_whatsapp: showcase.contact_whatsapp || null,
      contact_phone: showcase.contact_phone || null,
      contact_email: showcase.contact_email || null,
      contact_location: showcase.contact_location || null,
      show_maintenance_history: showcase.show_maintenance_history === 1,
      show_tire_status: showcase.show_tire_status === 1,
      show_rdw_specs: showcase.show_rdw_specs === 1,
      vehicle: {
        id: vehicle.id,
        name: vehicle.name,
        type: vehicle.type,
        license_plate: vehicle.license_plate,
        vin: vehicle.vin,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        fuel_type: vehicle.fuel_type,
        current_odometer: currentOdometer,
        apk_expiration_date: vehicle.apk_expiration_date,
        apk_status: apkEval.isOverdue ? 'overdue' : apkEval.isDueSoon ? 'due_soon' : apkEval.daysRemaining !== null ? 'valid' : 'unknown',
      },
      stats: {
        bouwjaar: vehicle.year ? String(vehicle.year) : (rdw.datum_eerste_toelating ? rdw.datum_eerste_toelating.substring(0, 4) : '—'),
        kilometerstand: `${currentOdometer.toLocaleString('nl-NL')} km* (per ${todayDateDutch}, loopt licht op)`,
        brandstof_transmissie: `${vehicle.fuel_type || 'Benzine'} ${motorSpecs.find(m => m.label === 'Transmissie')?.value || ''}`,
        vermogen: motorPk ? `${motorPk} pk (${motorKw} kW)` : (vehicle.fuel_type || '—'),
        apk_vervaldatum: this.formatDutchDate(vehicle.apk_expiration_date || rdw.vervaldatum_apk),
        apk_status: apkEval.isOverdue ? 'Verlopen' : apkEval.isDueSoon ? `Vervalt binnen ${apkEval.daysRemaining} dagen` : `Geldig (${apkEval.daysRemaining} dagen)`,
        energielabel: rdw.zuinigheidslabel || 'A',
        nap_oordeel: rdw.tellerstandoordeel || 'NAP Logisch',
      },
      photos,
      specs: {
        basis: basisSpecs,
        motor: motorSpecs,
        milieu: milieuSpecs,
      },
      maintenance_records: maintenanceRecords,
      tires: mountedTire,
    };
  }

  /**
   * Updates showcase configuration.
   */
  public static updateShowcase(vehicleId: string, data: any): CompiledShowcase | null {
    const existing = db.get<any>('SELECT * FROM vehicle_showcases WHERE vehicle_id = ?', [vehicleId]);
    if (!existing) {
      this.getOrInitShowcase(vehicleId);
    }

    const now = new Date().toISOString();

    // Verify slug uniqueness if slug is changed
    let slug = (data.public_slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
    if (!slug) {
      slug = existing?.public_slug || crypto.randomUUID().slice(0, 8);
    }

    if (existing && slug !== existing.public_slug) {
      const collision = db.get<any>('SELECT id FROM vehicle_showcases WHERE public_slug = ? AND vehicle_id != ?', [slug, vehicleId]);
      if (collision) {
        slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
      }
    }

    db.run(
      `UPDATE vehicle_showcases
       SET public_slug = ?,
           is_active = COALESCE(?, is_active),
           asking_price = ?,
           price_label = COALESCE(?, price_label),
           title = COALESCE(?, title),
           subtitle = COALESCE(?, subtitle),
           highlights = COALESCE(?, highlights),
           options_list = COALESCE(?, options_list),
           transparency_notes = COALESCE(?, transparency_notes),
           contact_whatsapp = COALESCE(?, contact_whatsapp),
           contact_phone = COALESCE(?, contact_phone),
           contact_email = COALESCE(?, contact_email),
           contact_location = COALESCE(?, contact_location),
           show_maintenance_history = COALESCE(?, show_maintenance_history),
           show_tire_status = COALESCE(?, show_tire_status),
           show_rdw_specs = COALESCE(?, show_rdw_specs),
           updated_at = ?
       WHERE vehicle_id = ?`,
      [
        slug,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : null,
        data.asking_price !== undefined && data.asking_price !== '' && data.asking_price !== null ? Number(data.asking_price) : null,
        data.price_label ?? null,
        data.title ?? null,
        data.subtitle ?? null,
        data.highlights ? (typeof data.highlights === 'string' ? data.highlights : JSON.stringify(data.highlights)) : null,
        data.options_list ? (typeof data.options_list === 'string' ? data.options_list : JSON.stringify(data.options_list)) : null,
        data.transparency_notes ?? null,
        data.contact_whatsapp ?? null,
        data.contact_phone ?? null,
        data.contact_email ?? null,
        data.contact_location ?? null,
        data.show_maintenance_history !== undefined ? (data.show_maintenance_history ? 1 : 0) : null,
        data.show_tire_status !== undefined ? (data.show_tire_status ? 1 : 0) : null,
        data.show_rdw_specs !== undefined ? (data.show_rdw_specs ? 1 : 0) : null,
        now,
        vehicleId,
      ]
    );

    return this.getOrInitShowcase(vehicleId);
  }
}
