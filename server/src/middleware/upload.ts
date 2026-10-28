import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { DATA_PATHS } from '../config/env.js';

const receiptStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DATA_PATHS.receipts);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const invoiceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DATA_PATHS.invoices);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const vehicleImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DATA_PATHS.vehicles);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DATA_PATHS.documents);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (allowedMimes: string[]) => {
  return (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  };
};

export const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: fileFilter(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
});

export const uploadInvoice = multer({
  storage: invoiceStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: fileFilter(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
});

export const uploadVehicleImage = multer({
  storage: vehicleImageStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: fileFilter(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
});

export const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: fileFilter([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]),
});

export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

