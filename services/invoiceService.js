// services/invoiceService.js
// Service de génération de factures PDF — Version moderne
// Backup disponible dans invoiceService.backup.js
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { SwissQRBill } = require('swissqrbill/pdf');

// ── Palette & constantes ──
const COLORS = {
  primary:    '#1a1a2e',
  secondary:  '#16213e',
  accent:     '#e94560',
  muted:      '#333333',
  light:      '#e8e8e8',
  white:      '#ffffff',
  text:       '#111111',
  textLight:  '#333333',
  border:     '#dee2e6',
  catBg:      '#e0e0e0',
  rowAlt:     '#eeeeee',
  green:      '#27ae60',
};

const MARGIN = { left: 50, right: 50, top: 45, bottom: 60 };
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.left - MARGIN.right;

// ── Helpers ──
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function drawRoundedRect(doc, x, y, w, h, r, fillColor) {
  doc.save();
  doc.roundedRect(x, y, w, h, r).fill(fillColor);
  doc.restore();
}


function drawLine(doc, x1, y1, x2, y2, color = COLORS.border, width = 0.5) {
  doc.save()
     .moveTo(x1, y1)
     .lineTo(x2, y2)
     .lineWidth(width)
     .strokeColor(color)
     .stroke()
     .restore();
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDateShort(d) {
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateLong(d) {
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCHF(amount) {
  const fixed = parseFloat(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${formatted}.${decPart}`;
}

// ── Service ──
class InvoiceService {

  // Format order ID
  static formatOrderId(orderId, orderDate) {
    if (!orderId.match(/\d{4}-\d{4}/)) {
      const d = new Date(orderDate);
      const y = d.getFullYear().toString().slice(-2);
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const h = d.getHours().toString().padStart(2, '0');
      return `${y}${m}-${day}${h}`;
    }
    return orderId.replace('order ', '');
  }

  // ═══════════════════════════════════════════
  // Main entry point
  // ═══════════════════════════════════════════
  static async generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId) {
    if (doc.page.content.length > 0) {
      doc = new PDFDocument({ autoFirstPage: true });
    }

    const { totals } = await this.generateItemsPage(doc, orderItems, userProfile, orderDate, orderId);

    doc.addPage();
    await this.generateTotalPage(doc, {
      ...totals,
      orderDate,
      orderId,
      userProfile
    });

    return totals;
  }

  // ═══════════════════════════════════════════
  // Shared header builder
  // ═══════════════════════════════════════════
  static drawInvoiceHeader(doc, userProfile, orderDate, orderId, formattedOrderId) {
    const rootDir = path.resolve(__dirname, '..');
    const y0 = MARGIN.top;

    // Logo (top left)
    const logoPath = path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, MARGIN.left, y0, { width: 80 });
    }

    // Accent bar under logo
    drawLine(doc, MARGIN.left, y0 + 35, MARGIN.left + 80, y0 + 35, COLORS.accent, 2);

    // Sender info
    let sY = y0 + 48;
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted);
    ['Discado Sàrl', 'Sevelin 4A', '1007 Lausanne', '+41 79 457 33 85', '+41 78 343 36 31', 'catalog.discado@gmail.com'].forEach(line => {
      doc.text(line, MARGIN.left, sY);
      sY += 10;
    });
    sY += 6;
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.textLight).text('TVA CHE-114.139.308', MARGIN.left, sY);

    // Client block — right side, lower
    const cX = 350;
    let cY = y0 + 50;
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.textLight).text('BILL TO', cX, cY, { characterSpacing: 1.5 });
    cY += 14;
    drawLine(doc, cX, cY, cX + 170, cY, COLORS.accent, 1);
    cY += 8;

    // Bloc destinataire = adresse de facturation (fallback livraison si vide)
    const billName = [
      userProfile.billingFirstName || userProfile.firstName || '',
      userProfile.billingLastName || userProfile.lastName || ''
    ].join(' ').trim();
    const billShopName = userProfile.billingShopName || userProfile.shopName || '';
    const billAddress = userProfile.billingAddress || userProfile.shopAddress || userProfile.address || '';
    const billZip = userProfile.billingZipCode || userProfile.shopZipCode || userProfile.postalCode || '';
    const billCity = userProfile.billingCity || userProfile.shopCity || userProfile.city || '';

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.primary);
    doc.text(billName, cX, cY);
    cY += 13;
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
    doc.text(billShopName, cX, cY);
    cY += 11;
    doc.text(billAddress, cX, cY);
    cY += 11;
    doc.text(`${billZip} ${billCity}`, cX, cY);

    // Title line
    const titleY = y0 + 155;
    drawLine(doc, MARGIN.left, titleY + 28, MARGIN.left + CONTENT_WIDTH, titleY + 28, COLORS.border, 0.5);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.primary);
    doc.text(`INVOICE  ${formattedOrderId}`, MARGIN.left, titleY + 6);

    // Date right-aligned
    const dateStr = formatDateShort(orderDate);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
    doc.text(dateStr, MARGIN.left + CONTENT_WIDTH - 130, titleY + 10, { width: 130, align: 'right' });

    doc.fillColor(COLORS.text);
    return titleY + 38;
  }

  // ═══════════════════════════════════════════
  // Items page
  // ═══════════════════════════════════════════
  static async generateItemsPage(doc, orderItems, userProfile, orderDate, orderId) {
    const formattedOrderId = this.formatOrderId(orderId, orderDate);

    // Column widths
    const COL = {
      desc:  220,
      qty:   60,
      unit:  105,
      total: CONTENT_WIDTH - 220 - 60 - 105
    };

    // ── Table header ──
    function drawTableHeader(y) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.primary);
      let x = MARGIN.left;
      doc.text('DESCRIPTION', x + 8, y + 4, { width: COL.desc - 16, characterSpacing: 1 });
      x += COL.desc;
      doc.text('QTY', x + 5, y + 4, { width: COL.qty - 10, align: 'center', characterSpacing: 1 });
      x += COL.qty;
      doc.text('UNIT PRICE', x + 5, y + 4, { width: COL.unit - 10, align: 'right', characterSpacing: 1 });
      x += COL.unit;
      doc.text('TOTAL', x + 5, y + 4, { width: COL.total - 10, align: 'right', characterSpacing: 1 });
      drawLine(doc, MARGIN.left, y + 16, MARGIN.left + CONTENT_WIDTH, y + 16, '#000000', 0.8);
      return y + 20;
    }

    // ── Main header ──
    let yPos = this.drawInvoiceHeader(doc, userProfile, orderDate, orderId, formattedOrderId);
    yPos = drawTableHeader(yPos);

    // Group by category
    const grouped = {};
    orderItems.forEach(item => {
      const cat = item.categorie || 'autres';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    const sortedCats = Object.keys(grouped).sort();

    let totalHT = 0;
    let rowIndex = 0;

    for (const cat of sortedCats) {
      // page break check
      if (yPos + 44 > doc.page.height - MARGIN.bottom - 80) {
        doc.addPage();
        yPos = MARGIN.top;
        yPos = drawTableHeader(yPos);
      }

      // Category row
      yPos += 6;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.primary);
      doc.text(capitalize(cat), MARGIN.left + 8, yPos + 4, { width: COL.desc - 16 });

      // Category subtotal
      const catTotal = grouped[cat].reduce((s, i) => s + (parseFloat(i.prix) * (i.quantity || 0)), 0);
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted);
      doc.text(`${formatCHF(catTotal)} CHF`, MARGIN.left + COL.desc + COL.qty + COL.unit + 5, yPos + 6, {
        width: COL.total - 10, align: 'right'
      });

      yPos += 22;

      for (const item of grouped[cat]) {
        if (yPos + 24 > doc.page.height - MARGIN.bottom - 80) {
          doc.addPage();
          yPos = MARGIN.top;
          yPos = drawTableHeader(yPos);
        }

        let x = MARGIN.left;
        const prix = parseFloat(item.prix) || 0;
        const qty = item.quantity || 0;
        const lineTotal = prix * qty;
        totalHT += lineTotal;

        // Description (avec taille si applicable)
        doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
        const descName = item.size ? `${item.Nom || ''} — Taille ${item.size}` : (item.Nom || '');
        doc.text(descName, x + 16, yPos + 6, { width: COL.desc - 30, lineBreak: false });
        x += COL.desc;

        // Qty
        const qtyStr = String(qty);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.primary);
        doc.text(qtyStr, x + 5, yPos + 6, { width: COL.qty - 10, align: 'center' });
        x += COL.qty;

        // Unit price
        doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
        doc.text(`${formatCHF(prix)} CHF`, x + 5, yPos + 6, { width: COL.unit - 10, align: 'right' });
        x += COL.unit;

        // Line total
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.primary);
        doc.text(`${formatCHF(lineTotal)} CHF`, x + 5, yPos + 6, { width: COL.total - 10, align: 'right' });

        yPos += 20;
        drawLine(doc, MARGIN.left, yPos, MARGIN.left + CONTENT_WIDTH, yPos, '#000000', 0.3);

        rowIndex++;
      }

      yPos += 2;
    }

    // ── Totals block ──
    const TVA = 0.081;
    const montantTVABrut = totalHT * TVA;
    const montantTVA = Math.round(montantTVABrut * 20) / 20;
    const totalTTC = totalHT + montantTVA;

    // Check space for totals block (~90px)
    if (yPos + 100 > doc.page.height - MARGIN.bottom) {
      doc.addPage();
      yPos = MARGIN.top;
    }

    yPos += 14;

    // Right-aligned totals block
    const totBlockX = MARGIN.left + CONTENT_WIDTH - 220;
    const totBlockW = 220;

    // Subtotal HT
    drawLine(doc, totBlockX, yPos, totBlockX + totBlockW, yPos, COLORS.border, 0.5);
    yPos += 6;
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
    doc.text('Subtotal HT', totBlockX, yPos, { width: 120 });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
    doc.text(`${formatCHF(totalHT)} CHF`, totBlockX + 120, yPos, { width: 100, align: 'right' });
    yPos += 18;

    // TVA
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
    doc.text('VAT 8.1%', totBlockX, yPos, { width: 120 });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
    doc.text(`${formatCHF(montantTVA)} CHF`, totBlockX + 120, yPos, { width: 100, align: 'right' });
    yPos += 20;

    // Total TTC
    drawLine(doc, totBlockX, yPos, totBlockX + totBlockW, yPos, COLORS.primary, 1);
    yPos += 8;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary);
    doc.text('TOTAL TTC', totBlockX, yPos, { width: 120 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
    doc.text(`${formatCHF(totalTTC)} CHF`, totBlockX + 120, yPos - 1, { width: 100, align: 'right' });
    yPos += 28;

    // Footer note
    yPos += 10;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.primary);
    doc.text('See next page for the payment slip.', MARGIN.left, yPos);

    return {
      totals: { totalHT, montantTVA, totalTTC },
      finalYPosition: yPos + 20
    };
  }

  // ═══════════════════════════════════════════
  // Summary / QR Bill page
  // ═══════════════════════════════════════════
  static async generateTotalPage(doc, invoiceData) {
    const { totalHT, montantTVA, totalTTC, orderDate, orderId, userProfile } = invoiceData;
    const formattedOrderId = this.formatOrderId(orderId, orderDate);

    // ── Header (same style) ──
    let yPos = this.drawInvoiceHeader(doc, userProfile, orderDate, orderId, formattedOrderId);

    // ── Summary card ──
    const pageHeight = doc.page.height;
    const qrBillHeight = 297; // ~105mm
    const availableH = pageHeight - qrBillHeight - yPos - 30;
    const cardY = yPos + Math.max(0, (availableH - 140) / 2);

    // Card background
    drawRoundedRect(doc, MARGIN.left + 60, cardY, CONTENT_WIDTH - 120, 130, 8, COLORS.light);

    // Inner border
    doc.save()
       .roundedRect(MARGIN.left + 62, cardY + 2, CONTENT_WIDTH - 124, 126, 6)
       .lineWidth(0.5)
       .strokeColor(COLORS.border)
       .stroke()
       .restore();

    // Summary lines
    const cx = PAGE_WIDTH / 2;
    let sy = cardY + 18;

    // HT
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
    doc.text('Subtotal HT', cx - 100, sy, { width: 100, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text(`${formatCHF(totalHT)} CHF`, cx + 10, sy, { width: 90, align: 'left' });
    sy += 20;

    // TVA
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
    doc.text('VAT 8.1%', cx - 100, sy, { width: 100, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text(`${formatCHF(montantTVA)} CHF`, cx + 10, sy, { width: 90, align: 'left' });
    sy += 24;

    // Divider
    drawLine(doc, cx - 80, sy, cx + 80, sy, COLORS.accent, 1);
    sy += 14;

    // Total TTC big
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.primary);
    doc.text(`${formatCHF(totalTTC)} CHF`, cx - 100, sy, { width: 200, align: 'center' });
    sy += 26;

    // Label
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    doc.text('AMOUNT DUE (INCL. VAT)', cx - 100, sy, { width: 200, align: 'center', characterSpacing: 1 });

    // Payment terms
    sy = cardY + 130 + 20;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.primary);
    doc.text('PAYMENT TERMS: NET 30 DAYS', MARGIN.left, sy, {
      width: CONTENT_WIDTH, align: 'center', characterSpacing: 0.8
    });
    sy += 16;
    const dueDate = new Date(orderDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
    const dueDateStr = formatDateLong(dueDate);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    doc.text(`Payment due date: ${dueDateStr}`, MARGIN.left, sy, {
      width: CONTENT_WIDTH, align: 'center'
    });

    // ── QR Bill ──
    try {
      const qrBillData = {
        currency: 'CHF',
        amount: totalTTC,
        creditor: {
          name: 'Discado Sàrl',
          address: 'Sevelin 4A',
          zip: 1007,
          city: 'Lausanne',
          account: 'CH2380808009929375493',
          country: 'CH'
        },
        debtor: {
          name: [
            userProfile.billingFirstName || userProfile.firstName || '',
            userProfile.billingLastName || userProfile.lastName || ''
          ].join(' ').trim(),
          address: userProfile.billingAddress || userProfile.shopAddress || userProfile.address,
          zip: parseInt(userProfile.billingZipCode || userProfile.shopZipCode || userProfile.postalCode) || 1000,
          city: userProfile.billingCity || userProfile.shopCity || userProfile.city,
          country: 'CH'
        },
        message: `Facture ${formattedOrderId}`
      };

      // Reset fill color to black before QR Bill (it renders its own text)
      doc.fillColor('#000000').strokeColor('#000000');
      doc.font('Helvetica').fontSize(8);

      const swissQRBill = new SwissQRBill(qrBillData, {
        language: 'EN',
        autoGenerate: false
      });

      swissQRBill.attachTo(doc);

    } catch (error) {
      console.error('QR Bill error:', error);
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.accent);
      doc.text('QR Bill error — Please contact us', MARGIN.left, pageHeight - 100, {
        width: CONTENT_WIDTH, align: 'center'
      });
    }
  }
}

// ── Export ──
module.exports = {
  generateInvoicePDF: (doc, orderItems, userProfile, orderDate, orderId) => {
    if (!doc._invoiceGenerated) {
      doc._invoiceGenerated = true;
      return InvoiceService.generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
    } else {
      return Promise.resolve({});
    }
  }
};