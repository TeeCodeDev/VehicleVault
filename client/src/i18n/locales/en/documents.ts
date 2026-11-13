import type { documents as nl } from '../nl/documents.js';

export const documents: Record<keyof typeof nl, string> = {
  // Documents ("Digitale Handschoenenkast")
  documents: 'Documents',
  documentsTitle: 'Digital Glovebox & Documents',
  documentsSubtitle: 'Secure storage for vehicle registrations, insurance policies, APK inspection reports, invoices, and manuals.',
  uploadDocument: 'Add Document',
  documentName: 'Document Name',
  documentCategory: 'Category',
  docCatAll: 'All Documents',
  docCatRegistration: 'Vehicle Registration',
  docCatInsurance: 'Insurance Policy',
  docCatApk: 'APK / Inspection Reports',
  docCatInvoices: 'Invoices & Receipts',
  docCatManual: 'Manual & Specifications',
  docCatOther: 'Other Documents',
  fileSize: 'File Size',
  uploadedOn: 'Uploaded on',
  noDocumentsFound: 'No documents saved in this vehicle’s digital glovebox yet.',
  confirmDeleteDocument: 'Are you sure you want to delete this document?',
  dragOrClickDocument: 'Drag a PDF or image file here or click to browse (max 30MB)',
  downloadDocument: 'Download',
  scanDocument: 'Scan document with AI',
  scanningDocument: 'Analyzing document with AI...',
  rescanDocument: 'Rescan with AI',
  scanDocumentSuccess: 'Document recognized via AI',
  scanDocumentHint: 'AI automatically detects title, category, date, and details',
};
