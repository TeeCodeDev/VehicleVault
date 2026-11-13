import type { documents as nl } from '../nl/documents.js';

export const documents: Record<keyof typeof nl, string> = {
  // Documents ("Digitale Handschoenenkast")
  documents: 'Dokumente',
  documentsTitle: 'Digitales Handschuhfach & Dokumente',
  documentsSubtitle: 'Sichere Ablage für Fahrzeugscheine, Versicherungspolicen, APK-Prüfberichte, Rechnungen und Handbücher.',
  uploadDocument: 'Dokument hinzufügen',
  documentName: 'Dokumentname',
  documentCategory: 'Kategorie',
  docCatAll: 'Alle Dokumente',
  docCatRegistration: 'Fahrzeugschein',
  docCatInsurance: 'Versicherungspolice',
  docCatApk: 'APK- / Prüfberichte',
  docCatInvoices: 'Rechnungen & Belege',
  docCatManual: 'Handbuch & Spezifikationen',
  docCatOther: 'Sonstige Dokumente',
  fileSize: 'Dateigröße',
  uploadedOn: 'Hochgeladen am',
  noDocumentsFound: 'Im digitalen Handschuhfach dieses Fahrzeugs sind noch keine Dokumente gespeichert.',
  confirmDeleteDocument: 'Möchtest du dieses Dokument wirklich löschen?',
  dragOrClickDocument: 'PDF oder Bild hierher ziehen oder klicken zum Auswählen (max. 30 MB)',
  downloadDocument: 'Herunterladen',
  scanDocument: 'Dokument mit KI scannen',
  scanningDocument: 'Dokument wird mit KI analysiert...',
  rescanDocument: 'Erneut mit KI scannen',
  scanDocumentSuccess: 'Dokument per KI erkannt',
  scanDocumentHint: 'Die KI erkennt Titel, Kategorie, Datum und Details automatisch',
};
