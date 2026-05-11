// services/deliveryNoteService.js
// Service de génération de bons de livraison PDF — Version moderne
// Backup disponible dans deliveryNoteService.backup.js
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { generateInvoicePDF } = require('./invoiceService');

// ── Palette & constantes ──
const COLORS = {
  primary:    '#1a1a2e',   // Bleu nuit profond
  secondary:  '#16213e',   // Bleu marine
  accent:     '#e94560',   // Rouge corail
  muted:      '#333333',   // Gris foncé (lisible à l'impression)
  light:      '#e8e8e8',   // Gris clair renforcé
  white:      '#ffffff',
  text:       '#111111',   // Texte principal noir
  textLight:  '#333333',   // Texte secondaire foncé
  border:     '#dee2e6',   // Bordures légères
  catBg:      '#e0e0e0',   // Fond catégorie renforcé
  rowAlt:     '#eeeeee',   // Lignes alternées renforcées
};

const MARGIN = { left: 50, right: 50, top: 45, bottom: 60 };
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.left - MARGIN.right;

// ── Helpers ──
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateShort(d) {
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
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

// ── Génération du bon de livraison PDF ──
async function generateDeliveryNotePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems = []) {
  const deliveryDate = orderDate;
  const rootDir = path.resolve(__dirname, '..');

  // ── Header ──
  function drawHeader(isFirstPage = true) {
    const y0 = MARGIN.top;

    // Logo (top left)
    const logoPath = path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, MARGIN.left, y0, { width: 80 });
    }

    // Thin accent bar under logo
    drawLine(doc, MARGIN.left, y0 + 35, MARGIN.left + 80, y0 + 35, COLORS.accent, 2);

    // Sender info
    const sX = MARGIN.left;
    let sY = y0 + 48;
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted);
    ['Discado Sàrl', 'Sevelin 4A', '1007 Lausanne', '+41 79 457 33 85', 'discadoswiss@gmail.com'].forEach(line => {
      doc.text(line, sX, sY);
      sY += 10;
    });

    // Client info — right side, lower
    const cX = 350;
    let cY = y0 + 50;
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.textLight).text('DELIVER TO', cX, cY, { characterSpacing: 1.5 });
    cY += 14;
    drawLine(doc, cX, cY, cX + 170, cY, COLORS.accent, 1);
    cY += 8;

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.primary);
    doc.text(`${userProfile.firstName} ${userProfile.lastName}`, cX, cY);
    cY += 13;
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
    doc.text(userProfile.shopName || '', cX, cY);
    cY += 11;
    doc.text(userProfile.shopAddress || userProfile.address || '', cX, cY);
    cY += 11;
    doc.text(`${userProfile.shopZipCode || userProfile.postalCode || ''} ${userProfile.shopCity || userProfile.city || ''}`, cX, cY);

    // Title line
    const titleY = y0 + 140;
    drawLine(doc, MARGIN.left, titleY + 28, MARGIN.left + CONTENT_WIDTH, titleY + 28, COLORS.border, 0.5);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.primary);
    doc.text('DELIVERY NOTE', MARGIN.left, titleY + 6);

    // Date right-aligned
    const dateStr = formatDateShort(deliveryDate);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
    doc.text(dateStr, MARGIN.left + CONTENT_WIDTH - 130, titleY + 10, { width: 130, align: 'right' });

    doc.fillColor(COLORS.text);
    return titleY + 38;
  }

  // ── Table header ──
  function drawTableHeader(y) {
    const colDescW = 370;
    const colQtyW = CONTENT_WIDTH - colDescW;

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.primary);
    doc.text('DESCRIPTION', MARGIN.left + 8, y + 4, { width: colDescW - 16, characterSpacing: 1 });
    doc.text('QTY', MARGIN.left + colDescW + 5, y + 4, { width: colQtyW - 10, align: 'center', characterSpacing: 1 });
    drawLine(doc, MARGIN.left, y + 16, MARGIN.left + CONTENT_WIDTH, y + 16, '#000000', 0.8);

    return { y: y + 20, colDescW, colQtyW };
  }

  // ── Render items ──
  function renderItems(items, startY) {
    let yPos = startY;
    const colDescW = 370;
    const colQtyW = CONTENT_WIDTH - colDescW;

    // Group by category
    const grouped = {};
    items.forEach(item => {
      const cat = item.categorie || 'autres';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    const sortedCats = Object.keys(grouped).sort();

    let totalQty = 0;
    let rowIndex = 0;

    for (const cat of sortedCats) {
      // Check page break for category header
      if (yPos + 40 > doc.page.height - MARGIN.bottom) {
        doc.addPage();
        yPos = MARGIN.top;
        const th = drawTableHeader(yPos);
        yPos = th.y;
      }

      // Category row
      yPos += 6;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.primary);
      doc.text(capitalize(cat), MARGIN.left + 8, yPos + 4, { width: CONTENT_WIDTH - 16 });

      // Category item count
      const catQty = grouped[cat].reduce((s, i) => s + (i.quantity || 0), 0);
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted);
      doc.text(`${grouped[cat].length} item${grouped[cat].length > 1 ? 's' : ''}`, MARGIN.left + colDescW + 5, yPos + 6, { width: colQtyW - 10, align: 'center' });

      yPos += 22;

      for (const item of grouped[cat]) {
        if (yPos + 22 > doc.page.height - MARGIN.bottom) {
          doc.addPage();
          yPos = MARGIN.top;
          const th = drawTableHeader(yPos);
          yPos = th.y;
        }

        // Item name (avec taille si applicable)
        doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
        const itemName = item.size ? `${item.Nom || ''} — Taille ${item.size}` : (item.Nom || '');
        doc.text(itemName, MARGIN.left + 16, yPos + 6, { width: colDescW - 30, lineBreak: false });

        // Quantity
        const qty = item.quantity || 0;
        totalQty += qty;
        const qtyStr = String(qty);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.primary);
        doc.text(qtyStr, MARGIN.left + colDescW + 5, yPos + 6, { width: colQtyW - 10, align: 'center' });

        // Fine separator line
        yPos += 20;
        drawLine(doc, MARGIN.left, yPos, MARGIN.left + CONTENT_WIDTH, yPos, '#000000', 0.3);

        rowIndex++;
      }

      yPos += 2;
    }

    return { yPos, totalQty };
  }

  // ═══════════════════════════════════════════
  // Main generation
  // ═══════════════════════════════════════════
  let yPos = drawHeader(true);

  // Table header
  const th = drawTableHeader(yPos);
  yPos = th.y;

  // Render order items
  const { yPos: afterItems, totalQty } = renderItems(orderItems, yPos);
  yPos = afterItems;

  // ── Total bar ──
  if (yPos + 36 > doc.page.height - MARGIN.bottom) {
    doc.addPage();
    yPos = MARGIN.top;
  }
  yPos += 8;
  drawLine(doc, MARGIN.left, yPos, MARGIN.left + CONTENT_WIDTH, yPos, COLORS.primary, 1);
  yPos += 8;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary);
  doc.text('TOTAL ITEMS', MARGIN.left, yPos);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.primary);
  doc.text(String(totalQty), MARGIN.left + CONTENT_WIDTH - 80, yPos - 1, { width: 80, align: 'right' });

  // ── Remaining items section ──
  if (remainingItems && remainingItems.length > 0) {
    doc.addPage();
    yPos = MARGIN.top;

    // Warning banner
    drawRoundedRect(doc, MARGIN.left, yPos, CONTENT_WIDTH, 50, 4, '#fff3cd');
    drawLine(doc, MARGIN.left, yPos, MARGIN.left, yPos + 50, COLORS.accent, 3);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
    doc.text('Items to be delivered later', MARGIN.left + 16, yPos + 10);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    doc.text('The following items from your order will be delivered at a later date.', MARGIN.left + 16, yPos + 28);
    yPos += 64;

    const thR = drawTableHeader(yPos);
    yPos = thR.y;

    const { yPos: afterRemaining } = renderItems(remainingItems, yPos);
    yPos = afterRemaining;

    // Footer note
    if (yPos + 30 > doc.page.height - MARGIN.bottom) {
      doc.addPage();
      yPos = MARGIN.top;
    }
    yPos += 16;
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted);
    doc.text('These items will be delivered as soon as they are available in stock.', MARGIN.left, yPos, {
      width: CONTENT_WIDTH, align: 'center'
    });
  }

  // Next page → Invoice
  doc.addPage();
  await generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
}

module.exports = {
  generateDeliveryNotePDF
};
