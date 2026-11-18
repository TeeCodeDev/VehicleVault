import type { documents as nl } from '../nl/documents.js';

export const documents: Record<keyof typeof nl, string> = {
  // Documents ("Digitale Handschoenenkast")
  documents: 'Documentos',
  documentsTitle: 'Guantera digital y documentos',
  documentsSubtitle: 'Almacenamiento seguro para permisos de circulación, pólizas de seguro, informes de la inspección APK, facturas y manuales.',
  uploadDocument: 'Añadir documento',
  documentName: 'Nombre del documento',
  documentCategory: 'Categoría',
  docCatAll: 'Todos los documentos',
  docCatRegistration: 'Permiso de circulación',
  docCatInsurance: 'Póliza de seguro',
  docCatApk: 'APK / informes de inspección',
  docCatInvoices: 'Facturas y tickets',
  docCatManual: 'Manual y especificaciones',
  docCatOther: 'Otros documentos',
  fileSize: 'Tamaño del archivo',
  uploadedOn: 'Subido el',
  noDocumentsFound: 'Todavía no hay documentos guardados en la guantera digital de este vehículo.',
  confirmDeleteDocument: '¿Seguro que quieres eliminar este documento?',
  dragOrClickDocument: 'Arrastra aquí un PDF o una imagen, o haz clic para buscarlo (máx. 30 MB)',
  downloadDocument: 'Descargar',
  scanDocument: 'Escanear documento con IA',
  scanningDocument: 'Analizando el documento con IA...',
  rescanDocument: 'Volver a escanear con IA',
  scanDocumentSuccess: 'Documento reconocido con IA',
  scanDocumentHint: 'La IA detecta automáticamente el título, la categoría, la fecha y los detalles',
};
