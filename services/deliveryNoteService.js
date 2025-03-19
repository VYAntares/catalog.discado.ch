// services/deliveryNoteService.js
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { generateInvoicePDF } = require('./invoiceService');

/**
 * Generates a PDF delivery note - SIMPLIFIED VERSION WITHOUT PRICES
 * Then automatically generates an invoice as well
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Array} orderItems - List of items in the order
 * @param {Object} userProfile - Customer profile information
 * @param {Date} orderDate - Date of the order
 * @param {String} orderId - Order identifier (not displayed in simplified version)
 * @param {Array} remainingItems - Items to be delivered later (optional)
 * @returns {Promise<void>}
 */
async function generateDeliveryNotePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems = []) {
  // Function to add a header element with reduced line spacing
  function addHeaderElement(text, x, y, options = {}) {
    doc.font('Helvetica').fontSize(9).text(text, x, y, options);
  }

  // Delivery note header with reduced spacing
  function addDeliveryNoteHeader() {
    const rootDir = path.resolve(__dirname, '..');
    doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

    // Sender information
    const senderY = 50;
    const lineSpacing = 12;
    
    addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
    addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
    addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
    addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
    addHeaderElement('discadoswiss@gmail.com', 50, senderY + lineSpacing * 5);
    
    // Client information - now at the SAME level as sender (not offset vertically)
    const clientY = senderY;
    
    addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientY + lineSpacing * 1);
    addHeaderElement(userProfile.shopName, 350, clientY + lineSpacing * 2);
    addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientY + lineSpacing * 3);
    addHeaderElement(
      `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
      350,
      clientY + lineSpacing * 4
    );

    // Determine position for title (after both sender and client info sections)
    const titleY = senderY + lineSpacing * 8; // Adjusted position
    
    // Add the delivery note title WITHOUT number
    doc.font('Helvetica-Bold').fontSize(14).text('Delivery Note', 50, titleY + 5);
    
    // Add the date under the title
    addHeaderElement(`Order processing date: ${deliveryDate.toLocaleDateString('Fr')}`, 50, titleY + 30);

    // Return position for table to start
    return titleY + 50;
  }

  // Création du tableau structuré (comparable à celui de invoiceService)
  const createCompactTable = (startY) => {
    const columns = [
      { title: 'Description', width: 350, align: 'left' },
      { title: 'Quantity', width: 100, align: 'center' }
    ];
    
    const tableX = 50;
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
    
    doc.rect(tableX, startY, tableWidth, 25).stroke();
    
    let currentX = tableX;
    doc.font('Helvetica-Bold').fontSize(10);
    
    columns.forEach((col, index) => {
      if (index > 0) {
        doc.moveTo(currentX, startY).lineTo(currentX, startY + 25).stroke();
      }
      
      doc.text(col.title, currentX + 5, startY + 8, {
        width: col.width - 10,
        align: col.align
      });
      
      currentX += col.width;
    });
    
    return { 
      yPosition: startY + 25, 
      columns, 
      tableX, 
      tableWidth
    };
  };

  // Ajout d'une ligne au tableau
  const addTableRow = (item, category, rowY, isCategory = false, tableConfig) => {
    const { tableX, columns, tableWidth } = tableConfig;
    const rowHeight = 20;
    
    doc.rect(tableX, rowY, tableWidth, rowHeight).stroke();
    
    let currentX = tableX;
    
    if (isCategory) {
      doc.font('Helvetica-Bold').fontSize(9);
      doc.fillColor('#f0f0f0');
      doc.rect(tableX, rowY, tableWidth, rowHeight).fill();
      doc.fillColor('black');
      doc.text(category.charAt(0).toUpperCase() + category.slice(1), currentX + 5, rowY + 6, {
        width: tableWidth - 10
      });
    } else {
      doc.font('Helvetica').fontSize(9);
      
      doc.text(item.Nom, currentX + 5, rowY + 6, {
        width: columns[0].width - 10,
        align: columns[0].align
      });
      currentX += columns[0].width;
      
      doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
      
      doc.text(String(item.quantity), currentX + 5, rowY + 6, {
        width: columns[1].width - 10,
        align: columns[1].align
      });
    }
    
    return rowY + rowHeight;
  };

  // Ajouter une nouvelle page avec tableau
  const addNewPage = () => {
    doc.addPage();
    return createCompactTable(40).yPosition;
  };

  // Vérifier si une nouvelle page est nécessaire
  const needsNewPage = (currentY, requiredHeight = 30) => {
    return currentY + requiredHeight > doc.page.height - 120;
  };

  // Set the delivery date
  const deliveryDate = orderDate;
  
  // Add delivery note header
  let yPos = addDeliveryNoteHeader();
  
  // Initialiser le tableau
  const tableConfig = createCompactTable(yPos);
  yPos = tableConfig.yPosition;

  // Group items by category
  const groupedItems = {};
  orderItems.forEach(item => {
    const category = item.categorie || 'autres';
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  });

  // Sort categories alphabetically
  const sortedCategories = Object.keys(groupedItems).sort();
  
  // Ajouter les articles au tableau par catégorie
  for (const category of sortedCategories) {
    if (needsNewPage(yPos)) {
      yPos = addNewPage();
    }
    
    yPos = addTableRow(null, category, yPos, true, tableConfig);
    
    for (const item of groupedItems[category]) {
      if (needsNewPage(yPos)) {
        yPos = addNewPage();
      }
      
      yPos = addTableRow(item, category, yPos, false, tableConfig);
    }
  }
  
  // Process remaining items section
  if (remainingItems && remainingItems.length > 0) {
    // Always start on a new page for the remaining items section
    doc.addPage();
    yPos = 40;
    
    // Title for remaining items
    doc.font('Helvetica-Bold').fontSize(14).text('Items to be delivered later', 50, yPos);
    yPos += 20;
    doc.font('Helvetica').fontSize(9).text('The following items from your order will be delivered at a later date.', 50, yPos);
    yPos += 25;
    
    // Créer un nouveau tableau pour les articles restants
    const remainingTableConfig = createCompactTable(yPos);
    yPos = remainingTableConfig.yPosition;
    
    // Group remaining items by category
    const groupedRemainingItems = {};
    remainingItems.forEach(item => {
      const category = item.categorie || 'autres';
      if (!groupedRemainingItems[category]) {
        groupedRemainingItems[category] = [];
      }
      groupedRemainingItems[category].push(item);
    });
    
    // Sort remaining categories alphabetically
    const sortedRemainingCategories = Object.keys(groupedRemainingItems).sort();
    
    // Process remaining items by category
    for (const category of sortedRemainingCategories) {
      if (needsNewPage(yPos)) {
        yPos = addNewPage();
      }
      
      yPos = addTableRow(null, category, yPos, true, remainingTableConfig);
      
      for (const item of groupedRemainingItems[category]) {
        if (needsNewPage(yPos)) {
          yPos = addNewPage();
        }
        
        yPos = addTableRow(item, category, yPos, false, remainingTableConfig);
      }
    }
    
    // Note
    if (needsNewPage(yPos, 30)) {
      doc.addPage();
      yPos = 40;
    }
    
    yPos += 20;
    doc.font('Helvetica').fontSize(9);
    doc.text('These items will be delivered as soon as they are available in stock.', 50, yPos, { align: 'center', width: doc.page.width - 100 });
  }

  // After generating delivery note, add a page break and generate the invoice
  doc.addPage();
  await generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
}

module.exports = {
  generateDeliveryNotePDF
};