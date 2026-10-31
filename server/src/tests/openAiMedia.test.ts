import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  AiReceiptService,
  buildOpenAiMediaPart,
  prepareMediaForOpenAi,
  openAiPdfHint,
} from '../services/aiReceiptService.js';

// Regression: scanning a PDF invoice with OpenAI failed with
//   400 "Invalid MIME type. Only image types are supported."
// because the PDF was sent as an `image_url` part. OpenAI takes PDFs as a `file` part.

const PDF_B64 = Buffer.from('%PDF-1.4 fake').toString('base64');
const PNG_B64 = Buffer.from('fake png bytes').toString('base64');

type Captured = { url: string; body: any };

/** Replace global fetch for one test; returns what was sent. */
function mockFetch(respond: () => { status: number; json: unknown }) {
  const original = globalThis.fetch;
  const calls: Captured[] = [];
  globalThis.fetch = (async (url: any, init: RequestInit = {}) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    const { status, json } = respond();
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const invoiceOk = {
  status: 200,
  json: { choices: [{ message: { content: JSON.stringify({ serviceTitle: 'Onderhoud', totalCost: 100, lineItems: [] }) } }] },
};
const receiptOk = {
  status: 200,
  json: { choices: [{ message: { content: JSON.stringify({ liters: 40, totalCost: 80, station: 'Shell' }) } }] },
};

/** The document part of the user message that went to OpenAI (the one that is not the text prompt). */
function mediaPart(call: Captured): any {
  const user = call.body.messages.find((m: any) => m.role === 'user');
  return user.content.find((p: any) => p.type !== 'text');
}

describe('OpenAI document input (PDF / images)', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  describe('buildOpenAiMediaPart', () => {
    it('sends a PDF as a `file` part, never as an image_url', () => {
      const part = buildOpenAiMediaPart(PDF_B64, 'application/pdf') as any;
      assert.equal(part.type, 'file');
      assert.equal(part.file.filename, 'document.pdf');
      assert.equal(part.file.file_data, `data:application/pdf;base64,${PDF_B64}`);
      assert.equal(part.image_url, undefined);
    });

    it('sends images as an image_url data URL', () => {
      for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
        const part = buildOpenAiMediaPart(PNG_B64, mime) as any;
        assert.equal(part.type, 'image_url', mime);
        assert.equal(part.image_url.url, `data:${mime};base64,${PNG_B64}`, mime);
      }
    });
  });

  describe('prepareMediaForOpenAi', () => {
    it('leaves PDFs and supported images untouched', async () => {
      const pdf = await prepareMediaForOpenAi(Buffer.from('%PDF-1.4 fake'), 'application/pdf');
      assert.equal(pdf.mimeType, 'application/pdf');
      assert.equal(pdf.base64Data, PDF_B64);

      const png = await prepareMediaForOpenAi(Buffer.from('fake png bytes'), 'image/png');
      assert.equal(png.mimeType, 'image/png');
      assert.equal(png.base64Data, PNG_B64);
    });

    it('fails with a clear Dutch message when a HEIC image cannot be converted', async () => {
      await assert.rejects(
        () => prepareMediaForOpenAi(Buffer.from('definitely not a heic file'), 'image/heic'),
        /HEIC/
      );
    });
  });

  describe('invoice scan request', () => {
    it('puts a PDF invoice in a `file` part, so OpenAI no longer answers "Invalid MIME type"', async () => {
      const m = mockFetch(() => invoiceOk);
      restore = m.restore;

      const result = await (AiReceiptService as any).analyzeInvoiceWithOpenAi(
        PDF_B64, 'application/pdf', 'sk-test', 'gpt-4o-mini', 'https://api.openai.com/v1', 'nl'
      );

      assert.equal(m.calls.length, 1);
      assert.equal(m.calls[0].url, 'https://api.openai.com/v1/chat/completions');
      const part = mediaPart(m.calls[0]);
      assert.equal(part.type, 'file');
      assert.equal(part.file.file_data, `data:application/pdf;base64,${PDF_B64}`);
      assert.ok(!JSON.stringify(m.calls[0].body).includes('"image_url"'), 'no image_url part for a PDF');
      assert.equal(result.engine, 'openai');
      assert.equal(result.serviceTitle, 'Onderhoud');
    });

    it('keeps sending photos as image_url', async () => {
      const m = mockFetch(() => invoiceOk);
      restore = m.restore;

      await (AiReceiptService as any).analyzeInvoiceWithOpenAi(
        PNG_B64, 'image/png', 'sk-test', 'gpt-4o-mini', undefined, 'nl'
      );

      const part = mediaPart(m.calls[0]);
      assert.equal(part.type, 'image_url');
      assert.equal(part.image_url.url, `data:image/png;base64,${PNG_B64}`);
    });

    it('adds the PDF tip to the error, but only when a PDF was sent', async () => {
      const apiError = { status: 400, json: { error: { message: 'Invalid MIME type. Only image types are supported.' } } };

      const pdf = mockFetch(() => apiError);
      restore = pdf.restore;
      await assert.rejects(
        () => (AiReceiptService as any).analyzeInvoiceWithOpenAi(PDF_B64, 'application/pdf', 'k', 'gpt-4o-mini', undefined, 'nl'),
        (err: Error) => err.message.includes('status 400') && err.message.includes('Invalid MIME type') && err.message.includes('PDF-invoer')
      );
      pdf.restore();

      const img = mockFetch(() => apiError);
      restore = img.restore;
      await assert.rejects(
        () => (AiReceiptService as any).analyzeInvoiceWithOpenAi(PNG_B64, 'image/png', 'k', 'gpt-4o-mini', undefined, 'nl'),
        (err: Error) => err.message.includes('status 400') && !err.message.includes('PDF-invoer')
      );
    });
  });

  describe('fuel receipt scan request', () => {
    it('puts a PDF receipt in a `file` part too', async () => {
      const m = mockFetch(() => receiptOk);
      restore = m.restore;

      const result = await (AiReceiptService as any).analyzeWithOpenAi(
        PDF_B64, 'application/pdf', 'sk-test', 'gpt-4o-mini', undefined
      );

      const part = mediaPart(m.calls[0]);
      assert.equal(part.type, 'file');
      assert.equal(result.liters, 40);
      assert.equal(result.totalCost, 80);
    });
  });

  it('openAiPdfHint is empty for images', () => {
    assert.equal(openAiPdfHint('image/jpeg'), '');
    assert.notEqual(openAiPdfHint('application/pdf'), '');
  });
});
