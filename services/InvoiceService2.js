// services/invoiceService.js
// Service de génération de factures PDF
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// Service unifié pour la génération de factures PDF
class InvoiceService {
  // Génère une facture PDF complète (page articles + page récapitulatif)
  static async generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId) {
    // Vérifier que le document est vide
    if (doc.page.content.length > 0) {
      doc = new PDFDocument({ autoFirstPage: true });
    }
    
    // Génération de la page des articles
    const { totals, finalYPosition } = await this.generateItemsPage(doc, orderItems, userProfile, orderDate, orderId);
    
    // Génération de la page de récapitulatif
    doc.addPage();
    await this.generateTotalPage(doc, {
      ...totals,
      orderDate,
      orderId,
      userProfile
    });
    
    return totals;
  }

  // Formatage de l'identifiant de commande
  static formatOrderId(orderId, orderDate) {
    if (!orderId.match(/\d{4}-\d{4}/)) {
      const orderDateObj = new Date(orderDate);
      const year = orderDateObj.getFullYear().toString().slice(-2);
      const month = (orderDateObj.getMonth() + 1).toString().padStart(2, '0');
      const day = orderDateObj.getDate().toString().padStart(2, '0');
      const hour = orderDateObj.getHours().toString().padStart(2, '0');
      
      return `${year}${month}-${day}${hour}`;
    } else {
      return orderId.replace('order ', '');
    }
  }

  // Génération de la page des articles
  static async generateItemsPage(doc, orderItems, userProfile, orderDate, orderId) {
    // Fonction pour ajouter un élément d'en-tête
    const addHeaderElement = (text, x, y, options = {}) => {
      doc.font('Helvetica').fontSize(9).text(text, x, y, options);
    };

    // Génération de l'en-tête de la facture
    const addInvoiceHeader = () => {
      const rootDir = path.resolve(__dirname, '..');
      doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

      // Informations expéditeur
      const senderY = 50;
      const lineSpacing = 12;
      
      addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
      addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
      addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
      addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
      addHeaderElement('+41 78 343 36 31', 50, senderY + lineSpacing * 5);
      addHeaderElement('catalog.discado@gmail.com', 50, senderY + lineSpacing * 6);
      addHeaderElement('TVA CHE-114.139.308', 50, senderY + lineSpacing * 8);

      // Informations client
      const clientStartY = senderY + lineSpacing * 7;
      
      addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientStartY);
      addHeaderElement(userProfile.shopName, 350, clientStartY + lineSpacing * 1);
      addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientStartY + lineSpacing * 2);
      addHeaderElement(
        `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
        350,
        clientStartY + lineSpacing * 3
      );

      // Détails facture
      const formattedOrderId = this.formatOrderId(orderId, orderDate);
      const titleY = senderY + lineSpacing * 11;
      
      doc.font('Helvetica-Bold').fontSize(14).text(`Invoice ${formattedOrderId}`, 50, titleY + 5);
      addHeaderElement(`Invoice date: ${orderDate.toLocaleDateString('Fr')}`, 50, titleY + 40);

      return titleY + 60;
    };

    // Création de l'en-tête du tableau
    const createTableHeader = (startY) => {
      // Configuration colonnes
      const columns = [
        { title: 'Description', width: 230, align: 'left' },
        { title: 'Quantity', width: 70, align: 'center' },
        { title: 'Unit Price', width: 100, align: 'right' },
        { title: 'Total', width: 100, align: 'right' }
      ];
      
      const tableX = 50;
      const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
      
      // Dessin de l'en-tête
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
        currentX += columns[1].width;
        
        doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
        
        doc.text(`${parseFloat(item.prix).toFixed(2)} CHF`, currentX + 5, rowY + 6, {
          width: columns[2].width - 10,
          align: columns[2].align
        });
        currentX += columns[2].width;
        
        doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
        
        const itemTotal = parseFloat(item.prix) * item.quantity;
        doc.text(`${itemTotal.toFixed(2)} CHF`, currentX + 5, rowY + 6, {
          width: columns[3].width - 10,
          align: columns[3].align
        });
      }
      
      return rowY + rowHeight;
    };

    // Ajout d'une nouvelle page
    const addNewPage = () => {
      doc.addPage();
      return createTableHeader(40).yPosition;
    };

    // Vérification besoin nouvelle page
    const needsNewPage = (currentY, requiredHeight = 30) => {
      return currentY + requiredHeight > doc.page.height - 120;
    };

    // Début génération
    let yPos = addInvoiceHeader();
    const tableConfig = createTableHeader(yPos);
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
    
    // Ajout des articles par catégorie
    let totalHT = 0;
    const sortedCategories = Object.keys(groupedItems).sort();
    
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
        totalHT += parseFloat(item.prix) * item.quantity;
      }
    }
    
    // Calcul des totaux
    // const TVA = 0.081;
    // const montantTVA = totalHT * TVA;
    // const totalTTC = totalHT + montantTVA;

    // Calcul des totaux
    const TVA = 0.081;
    const montantTVABrut = totalHT * TVA;
    // Arrondi au 5 centimes le plus proche
    const montantTVA = Math.round(montantTVABrut * 20) / 20;
    const totalTTC = totalHT + montantTVA;
    
    // Vérification espace pour totaux
    if (needsNewPage(yPos, 80)) {
      doc.addPage();
      yPos = 40;
    }
    
    // Extraction positions des colonnes
    const { tableX, tableWidth, columns } = tableConfig;
    const col1Width = columns[0].width;
    const col2Width = columns[1].width;
    const col3Width = columns[2].width;
    const col4Width = columns[3].width;
    
    // Positions colonnes
    const col1X = tableX;
    const col2X = col1X + col1Width;
    const col3X = col2X + col2Width;
    const col4X = col3X + col3Width;
    
    // Hauteur ligne totaux
    const totalRowHeight = 20;
    
    // Ligne sous-total HT
    doc.rect(col1X, yPos, col1Width + col2Width, totalRowHeight).stroke();
    doc.rect(col3X, yPos, col3Width, totalRowHeight).stroke();
    doc.rect(col4X, yPos, col4Width, totalRowHeight).stroke();
    
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text("SOUS-TOTAL HT", col3X + 5, yPos + 6, {
      width: col3Width - 10,
      align: 'left'
    });
    
    doc.text(`${totalHT.toFixed(2)} CHF`, col4X + 5, yPos + 6, {
      width: col4Width - 10,
      align: 'right'
    });
    
    yPos += totalRowHeight;
    
    // Ligne TVA
    doc.rect(col1X, yPos, col1Width + col2Width, totalRowHeight).stroke();
    doc.rect(col3X, yPos, col3Width, totalRowHeight).stroke();
    doc.rect(col4X, yPos, col4Width, totalRowHeight).stroke();
    
    doc.text("TVA 8.1%", col3X + 5, yPos + 6, {
      width: col3Width - 10,
      align: 'left'
    });
    
    doc.text(`${montantTVA.toFixed(2)} CHF`, col4X + 5, yPos + 6, {
      width: col4Width - 10,
      align: 'right'
    });
    
    yPos += totalRowHeight;
    
    // Ligne total TTC
    doc.rect(col1X, yPos, col1Width + col2Width, totalRowHeight).stroke();
    doc.rect(col3X, yPos, col3Width, totalRowHeight).stroke();
    doc.rect(col4X, yPos, col4Width, totalRowHeight).stroke();
    
    doc.text("TOTAL TTC", col3X + 5, yPos + 6, {
      width: col3Width - 10,
      align: 'left'
    });
    
    doc.text(`${totalTTC.toFixed(2)} CHF`, col4X + 5, yPos + 6, {
      width: col4Width - 10,
      align: 'right'
    });
    
    yPos += totalRowHeight;
    
    // Note bas de page
    yPos += 20;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('See next page for the payment slip.', 50, yPos);
    
    return {
      totals: {
        totalHT,
        montantTVA,
        totalTTC
      },
      finalYPosition: yPos + 20
    };
  }

  // Génération de la page récapitulative
  static async generateTotalPage(doc, invoiceData) {
    const { totalHT, montantTVA, totalTTC, orderDate, orderId, userProfile } = invoiceData;
    
    // Formatage ID commande
    const formattedOrderId = this.formatOrderId(orderId, orderDate);
    
    // Fonction pour élément d'en-tête
    const addHeaderElement = (text, x, y, options = {}) => {
      doc.font('Helvetica').fontSize(9).text(text, x, y, options);
    };

    // Génération en-tête identique
    const addInvoiceHeader = () => {
      const rootDir = path.resolve(__dirname, '..');
      doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

      // Infos expéditeur
      const senderY = 50;
      const lineSpacing = 12;
      
      addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
      addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
      addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
      addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
      addHeaderElement('+41 78 343 36 31', 50, senderY + lineSpacing * 5);
      addHeaderElement('catalog.discado@gmail.com', 50, senderY + lineSpacing * 6);
      addHeaderElement('TVA CHE-114.139.308', 50, senderY + lineSpacing * 8)

      // Infos client
      const clientStartY = senderY + lineSpacing * 7;
      
      addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientStartY);
      addHeaderElement(userProfile.shopName, 350, clientStartY + lineSpacing * 1);
      addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientStartY + lineSpacing * 2);
      addHeaderElement(
        `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
        350,
        clientStartY + lineSpacing * 3
      );

      // Détails facture
      const titleY = senderY + lineSpacing * 12;
      
      doc.font('Helvetica-Bold').fontSize(14).text(`Invoice ${formattedOrderId}`, 50, titleY + 5);
      doc.font('Helvetica').fontSize(10).text(`Date: ${orderDate.toLocaleDateString('Fr')}`, 50, titleY + 25);

      return titleY + 60;
    };

    // Ajout résumé avec conditions paiement
    const addSimpleTotalLine = (yPosition) => {
      const pageHeight = doc.page.height;
      const pageWidth = doc.page.width;
      const receiptHeight = pageHeight / 2.8;
      const availableHeight = pageHeight - receiptHeight - yPosition;
      const centerY = yPosition + (availableHeight / 2) - 70;
      
      const horizontalCenter = Math.floor(pageWidth / 2);
      
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text(`TOTAL TTC: ${totalTTC.toFixed(2)} CHF`, horizontalCenter - 90, centerY);
      
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('PAYMENT TERMS: net 30 days', horizontalCenter - 95, centerY + 50);
      
      return centerY + 50;
    };

    // Ajout bulletin paiement
    const addPaymentSlip = () => {
      const rootDir = path.resolve(__dirname, '..');
      const receiptImagePath = path.join(rootDir, 'public', 'images', 'logo', 'recepisse.png');
      
      const pageWidth = doc.page.width;
      const receiptImageWidth = pageWidth;
      
      const receiptAspectRatio = 1.8;
      const receiptImageHeight = receiptImageWidth / receiptAspectRatio;
      
      const receiptYPosition = doc.page.height - receiptImageHeight - 10;
      
      doc.lineWidth(0.5);
      doc.moveTo(0, receiptYPosition - 10).lineTo(pageWidth, receiptYPosition - 10).stroke();
      
      if (!doc._receiptAdded) {
        doc.image(receiptImagePath, 0, receiptYPosition, { 
          width: receiptImageWidth,
          align: 'center'
        });
        doc._receiptAdded = true;
      }
    };

    // Génération page récapitulative
    const headerEndY = addInvoiceHeader();
    const totalLineEndY = addSimpleTotalLine(headerEndY);
    addPaymentSlip();
  }
}

// Export du module
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