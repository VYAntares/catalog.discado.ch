// services/deliveryNoteService.js
// Service de génération de bons de livraison PDF
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { generateInvoicePDF } = require('./invoiceService');

// Génération du bon de livraison PDF (version simplifiée sans prix)
async function generateDeliveryNotePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems = []) {
  // Ajout d'un élément d'en-tête
  function addHeaderElement(text, x, y, options = {}) {
    doc.font('Helvetica').fontSize(9).text(text, x, y, options);
  }

  // En-tête du bon de livraison
  function addDeliveryNoteHeader() {
    const rootDir = path.resolve(__dirname, '..');
    doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

    // Informations expéditeur
    const senderY = 50;
    const lineSpacing = 12;
    
    addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
    addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
    addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
    addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
    addHeaderElement('discadoswiss@gmail.com', 50, senderY + lineSpacing * 5);
    
    // Informations client (au même niveau que l'expéditeur)
    const clientY = senderY;
    
    addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientY + lineSpacing * 1);
    addHeaderElement(userProfile.shopName, 350, clientY + lineSpacing * 2);
    addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientY + lineSpacing * 3);
    addHeaderElement(
      `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
      350,
      clientY + lineSpacing * 4
    );

    // Position pour le titre
    const titleY = senderY + lineSpacing * 8;
    
    // Titre du bon de livraison sans numéro
    doc.font('Helvetica-Bold').fontSize(14).text('Delivery Note', 50, titleY + 5);
    
    // Date sous le titre
    addHeaderElement(`Order processing date: ${deliveryDate.toLocaleDateString('Fr')}`, 50, titleY + 30);

    return titleY + 50;
  }

  // Création du tableau
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

  // Ajout d'une nouvelle page
  const addNewPage = () => {
    doc.addPage();
    return createCompactTable(40).yPosition;
  };

  // Vérification besoin nouvelle page
  const needsNewPage = (currentY, requiredHeight = 30) => {
    return currentY + requiredHeight > doc.page.height - 120;
  };

  // Date de livraison
  const deliveryDate = orderDate;
  
  // Ajout en-tête
  let yPos = addDeliveryNoteHeader();
  
  // Initialisation tableau
  const tableConfig = createCompactTable(yPos);
  yPos = tableConfig.yPosition;

  // Groupement par catégorie
  const groupedItems = {};
  orderItems.forEach(item => {
    const category = item.categorie || 'autres';
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  });

  // Tri des catégories
  const sortedCategories = Object.keys(groupedItems).sort();
  
  // Ajout des articles par catégorie
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
  
  // Traitement des articles restants
  if (remainingItems && remainingItems.length > 0) {
    // Nouvelle page pour les articles restants
    doc.addPage();
    yPos = 40;
    
    // Titre pour les articles restants
    doc.font('Helvetica-Bold').fontSize(14).text('Items to be delivered later', 50, yPos);
    yPos += 20;
    doc.font('Helvetica').fontSize(9).text('The following items from your order will be delivered at a later date.', 50, yPos);
    yPos += 25;
    
    // Nouveau tableau pour articles restants
    const remainingTableConfig = createCompactTable(yPos);
    yPos = remainingTableConfig.yPosition;
    
    // Groupement des articles restants
    const groupedRemainingItems = {};
    remainingItems.forEach(item => {
      const category = item.categorie || 'autres';
      if (!groupedRemainingItems[category]) {
        groupedRemainingItems[category] = [];
      }
      groupedRemainingItems[category].push(item);
    });
    
    // Tri des catégories restantes
    const sortedRemainingCategories = Object.keys(groupedRemainingItems).sort();
    
    // Ajout des articles restants par catégorie
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
    
    // Note de bas de page
    if (needsNewPage(yPos, 30)) {
      doc.addPage();
      yPos = 40;
    }
    
    yPos += 20;
    doc.font('Helvetica').fontSize(9);
    doc.text('These items will be delivered as soon as they are available in stock.', 50, yPos, { align: 'center', width: doc.page.width - 100 });
  }

  // Ajout d'une page et génération de la facture
  doc.addPage();
  await generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
}

module.exports = {
  generateDeliveryNotePDF
};
