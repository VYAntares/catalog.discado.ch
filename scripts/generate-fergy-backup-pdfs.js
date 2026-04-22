// scripts/generate-fergy-backup-pdfs.js
//
// Regenerate invoice PDFs using deliveryNoteService.backup.js
// + InvoiceService2.js (the v2 invoice renderer).
//
// Usage:
//   node scripts/generate-fergy-backup-pdfs.js                     # regen Fergy's 2 reference orders
//   node scripts/generate-fergy-backup-pdfs.js <order_id> [<order_id> ...]
//
// Example:
//   node scripts/generate-fergy-backup-pdfs.js 260306-0085
//   node scripts/generate-fergy-backup-pdfs.js 260306-0085 251227-0530
//
// Output: public/images/pdf-backup-fergy/<User>_<order_id>_v2.pdf
// (served at /images/pdf-backup-fergy/<file>.pdf)

const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const ROOT = path.resolve(__dirname, '..');
const SERVICES = path.join(ROOT, 'services');

// --- Module swap: make deliveryNoteService.backup.js use InvoiceService2 -----
//
// deliveryNoteService.backup.js does `require('./invoiceService')` at load
// time. We pre-load InvoiceService2 and register it in Node's require cache
// under the canonical invoiceService.js path, so the backup delivery-note
// module picks up the v2 renderer for its invoice page.

const invoiceV2Path = path.join(SERVICES, 'InvoiceService2.js');
const canonicalInvoicePath = path.join(SERVICES, 'invoiceService.js');

const invoiceV2 = require(invoiceV2Path);
require.cache[canonicalInvoicePath] = require.cache[invoiceV2Path];

const deliveryBackup = require(path.join(SERVICES, 'deliveryNoteService.backup.js'));

// Real DB-backed services (order + user lookups)
const orderService = require(path.join(SERVICES, 'orderService'));
const userService = require(path.join(SERVICES, 'userService'));
const dbModule = require(path.join(SERVICES, 'db'));

const DEFAULT_ORDER_IDS = ['260306-0085', '251227-0530'];
const OUT_DIR = path.join(ROOT, 'public', 'images', 'pdf-backup-fergy');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function sanitize(name) {
  return String(name || '').replace(/[^a-z0-9_\-]/gi, '_');
}

async function generateForOrder(orderId) {
  const orderRow = dbModule.db
    .prepare('SELECT * FROM orders WHERE order_id = ?')
    .get(orderId);
  if (!orderRow) throw new Error(`Order ${orderId} not found in DB`);

  const userId = orderRow.user_id;
  const invoice = dbModule.db
    .prepare('SELECT * FROM invoices WHERE order_id = ?')
    .get(orderId);

  const orderDetails = orderService.getOrderDetails(orderId, userId);
  const userProfile = userService.getUserProfile(userId);
  const orderItems = orderDetails.deliveredItems || orderDetails.items;
  const remainingItems = orderDetails.remainingItems || [];
  const orderDate = new Date(
    (invoice && invoice.invoice_date) ||
      orderDetails.lastProcessed ||
      orderDetails.date
  );

  const clientTag = sanitize(userProfile?.shopName || userProfile?.firstName || userId);
  const outPath = path.join(OUT_DIR, `${clientTag}_${orderId}_v2.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  await deliveryBackup.generateDeliveryNotePDF(
    doc,
    orderItems,
    userProfile,
    orderDate,
    orderId,
    remainingItems
  );
  // No-op under the guard in InvoiceService2, kept for parity with the live route
  await invoiceV2.generateInvoicePDF(
    doc,
    orderItems,
    userProfile,
    orderDate,
    orderId
  );

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font('Helvetica').fontSize(7.5).fillColor('#888888');
    doc.text(
      `Page ${i + 1} / ${range.count}`,
      50,
      doc.page.height - 65,
      { width: doc.page.width - 100, align: 'center', lineBreak: false }
    );
  }
  doc.flushPages();
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  const { size } = fs.statSync(outPath);
  const rel = path.relative(ROOT, outPath);
  console.log(`[OK] ${orderId} -> ${rel} (${(size / 1024).toFixed(1)} KB)`);
  console.log(`     URL: /images/pdf-backup-fergy/${path.basename(outPath)}`);
  return outPath;
}

(async () => {
  const args = process.argv.slice(2).filter(Boolean);
  const orderIds = args.length > 0 ? args : DEFAULT_ORDER_IDS;

  console.log(`Using InvoiceService2 for: ${orderIds.join(', ')}`);
  try {
    for (const id of orderIds) {
      await generateForOrder(id);
    }
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error generating PDFs:', err.message);
    process.exit(1);
  }
})();
