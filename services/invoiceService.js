// services/invoiceService.js
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

/**
 * Service unifié pour la génération de factures PDF complètes
 * Gère à la fois la page des articles et la page de récapitulatif
 */
class InvoiceService {
  /**
   * Génère une facture PDF complète avec gestion intelligente des pages
   * @param {PDFDocument} doc - Instance PDFKit
   * @param {Array} orderItems - Liste des articles commandés
   * @param {Object} userProfile - Informations du profil client
   * @param {Date} orderDate - Date de la commande
   * @param {String} orderId - Identifiant de la commande
   * @returns {Promise<Object>} - Retourne les totaux calculés
   */
  static async generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId) {
    // Vérifier que le document est vide avant de commencer
    // Ceci évite la duplication si la fonction est appelée plusieurs fois
    if (doc.page.content.length > 0) {
      // Si le document contient déjà du contenu, on le réinitialise
      doc = new PDFDocument({ autoFirstPage: true });
    }
    
    // Générer la première page avec la liste des articles et récupérer la position Y finale
    const { totals, finalYPosition } = await this.generateItemsPage(doc, orderItems, userProfile, orderDate, orderId);
    
    // Générer la page de récapitulatif (toujours sur une nouvelle page)
    doc.addPage();
    
    await this.generateTotalPage(doc, {
      ...totals,
      orderDate,
      orderId,
      userProfile
    });
    
    return totals;
  }

  /**
   * Formatte l'identifiant de commande selon le format standard
   * @param {String} orderId - Identifiant de commande brut
   * @param {Date} orderDate - Date de la commande
   * @returns {String} - Identifiant formatté
   */
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

  /**
   * Génère la première page de la facture avec la liste des articles
   * et ajoute les totaux correctement alignés
   * @private
   * @returns {Object} - Totaux calculés et position Y finale
   */
  static async generateItemsPage(doc, orderItems, userProfile, orderDate, orderId) {
    const addHeaderElement = (text, x, y, options = {}) => {
      doc.font('Helvetica').fontSize(9).text(text, x, y, options);
    };

    // En-tête de facture avec espacement réduit
    const addInvoiceHeader = () => {
      const rootDir = path.resolve(__dirname, '..');
      doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

      // Informations de l'expéditeur
      const senderY = 50;
      const lineSpacing = 12;
      
      addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
      addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
      addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
      addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
      addHeaderElement('discadoswiss@gmail.com', 50, senderY + lineSpacing * 5);
      addHeaderElement('TVA CHE-114.139.308', 50, senderY + lineSpacing * 8);

      // Informations du client
      const clientStartY = senderY + lineSpacing * 7;
      
      addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientStartY);
      addHeaderElement(userProfile.shopName, 350, clientStartY + lineSpacing * 1);
      addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientStartY + lineSpacing * 2);
      addHeaderElement(
        `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
        350,
        clientStartY + lineSpacing * 3
      );

      // Détails de la facture
      const formattedOrderId = this.formatOrderId(orderId, orderDate);
      
      const titleY = senderY + lineSpacing * 11;
      
      doc.font('Helvetica-Bold').fontSize(14).text(`Invoice ${formattedOrderId}`, 50, titleY + 5);
      addHeaderElement(`Invoice date: ${orderDate.toLocaleDateString('Fr')}`, 50, titleY + 40);

      return titleY + 60;
    };

    // Définition des colonnes
    const createTableHeader = (startY) => {
      // Configuration des colonnes
      const columns = [
        { title: 'Description', width: 230, align: 'left' },
        { title: 'Quantity', width: 70, align: 'center' },
        { title: 'Unit Price', width: 100, align: 'right' },
        { title: 'Total', width: 100, align: 'right' }
      ];
      
      const tableX = 50;
      const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
      
      // Dessiner l'en-tête du tableau
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

    // Ajouter une nouvelle page avec tableau
    const addNewPage = () => {
      doc.addPage();
      return createTableHeader(40).yPosition;
    };

    // Vérifier si une nouvelle page est nécessaire
    const needsNewPage = (currentY, requiredHeight = 30) => {
      return currentY + requiredHeight > doc.page.height - 120;
    };

    // Début de la génération
    let yPos = addInvoiceHeader();
    const tableConfig = createTableHeader(yPos);
    yPos = tableConfig.yPosition;
    
    // Grouper les articles par catégorie
    const groupedItems = {};
    orderItems.forEach(item => {
      const category = item.categorie || 'autres';
      if (!groupedItems[category]) {
        groupedItems[category] = [];
      }
      groupedItems[category].push(item);
    });
    
    // Ajouter les articles au tableau par catégorie
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
    
    // Calculs des totaux
    const TVA = 0.081;
    const montantTVA = totalHT * TVA;
    const totalTTC = totalHT + montantTVA;
    
    // Vérifier s'il reste assez d'espace pour les totaux
    if (needsNewPage(yPos, 80)) {
      doc.addPage();
      yPos = 40;
    }
    
    // Extraire les positions des colonnes pour un alignement correct
    const { tableX, tableWidth, columns } = tableConfig;
    const col1Width = columns[0].width;
    const col2Width = columns[1].width;
    const col3Width = columns[2].width;
    const col4Width = columns[3].width;
    
    // Position de début pour les colonnes
    const col1X = tableX;
    const col2X = col1X + col1Width;
    const col3X = col2X + col2Width;
    const col4X = col3X + col3Width;
    
    // Hauteur de ligne pour les totaux
    const totalRowHeight = 20;
    
    // Ligne pour Sous-total HT
    // Cellule vide (col1 + col2)
    doc.rect(col1X, yPos, col1Width + col2Width, totalRowHeight).stroke();
    // Cellule "SOUS-TOTAL HT" (col3)
    doc.rect(col3X, yPos, col3Width, totalRowHeight).stroke();
    // Cellule pour le montant (col4)
    doc.rect(col4X, yPos, col4Width, totalRowHeight).stroke();
    
    // Texte "SOUS-TOTAL HT"
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text("SOUS-TOTAL HT", col3X + 5, yPos + 6, {
      width: col3Width - 10,
      align: 'left'
    });
    
    // Montant HT
    doc.text(`${totalHT.toFixed(2)} CHF`, col4X + 5, yPos + 6, {
      width: col4Width - 10,
      align: 'right'
    });
    
    yPos += totalRowHeight;
    
    // Ligne pour TVA
    // Cellule vide (col1 + col2)
    doc.rect(col1X, yPos, col1Width + col2Width, totalRowHeight).stroke();
    // Cellule "TVA 8.1%" (col3)
    doc.rect(col3X, yPos, col3Width, totalRowHeight).stroke();
    // Cellule pour le montant (col4)
    doc.rect(col4X, yPos, col4Width, totalRowHeight).stroke();
    
    // Texte "TVA 8.1%"
    doc.text("TVA 8.1%", col3X + 5, yPos + 6, {
      width: col3Width - 10,
      align: 'left'
    });
    
    // Montant TVA
    doc.text(`${montantTVA.toFixed(2)} CHF`, col4X + 5, yPos + 6, {
      width: col4Width - 10,
      align: 'right'
    });
    
    yPos += totalRowHeight;
    
    // Ligne pour TOTAL TTC et CONDITIONS DE PAIEMENT
    // Cellule "CONDITIONS DE PAIEMENT" (col1 + col2)
    doc.rect(col1X, yPos, col1Width + col2Width, totalRowHeight).stroke();
    // Cellule "TOTAL TTC" (col3)
    doc.rect(col3X, yPos, col3Width, totalRowHeight).stroke();
    // Cellule pour le montant (col4)
    doc.rect(col4X, yPos, col4Width, totalRowHeight).stroke();
    
    
    // Texte "TOTAL TTC"
    doc.text("TOTAL TTC", col3X + 5, yPos + 6, {
      width: col3Width - 10,
      align: 'left'
    });
    
    // Montant TTC
    doc.text(`${totalTTC.toFixed(2)} CHF`, col4X + 5, yPos + 6, {
      width: col4Width - 10,
      align: 'right'
    });
    
    yPos += totalRowHeight;
    
    // Note en bas de page
    yPos += 20;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('See next page for the payment slip.', 50, yPos);
    
    return {
      totals: {
        totalHT,
        montantTVA,
        totalTTC
      },
      finalYPosition: yPos + 20 // Retourner la position Y finale ajustée
    };
  }

      /**
   * Génère la page récapitulative de la facture en utilisant le même en-tête que la facture
   * et ajoute un résumé simple des conditions et du total
   * @private
   */
  static async generateTotalPage(doc, invoiceData) {
    const { totalHT, montantTVA, totalTTC, orderDate, orderId, userProfile } = invoiceData;
    
    // Formatage de l'ID de commande
    const formattedOrderId = this.formatOrderId(orderId, orderDate);
    
    // En-tête identique à celui de la facture
    const addHeaderElement = (text, x, y, options = {}) => {
      doc.font('Helvetica').fontSize(9).text(text, x, y, options);
    };

    // En-tête de facture avec espacement réduit (identique à la première page)
    const addInvoiceHeader = () => {
      const rootDir = path.resolve(__dirname, '..');
      doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

      // Informations de l'expéditeur
      const senderY = 50;
      const lineSpacing = 12;
      
      addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
      addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
      addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
      addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
      addHeaderElement('discadoswiss@gmail.com', 50, senderY + lineSpacing * 5);
      addHeaderElement('TVA CHE-114.139.308', 50, senderY + lineSpacing * 8);

      // Informations du client
      const clientStartY = senderY + lineSpacing * 7;
      
      addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientStartY);
      addHeaderElement(userProfile.shopName, 350, clientStartY + lineSpacing * 1);
      addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientStartY + lineSpacing * 2);
      addHeaderElement(
        `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
        350,
        clientStartY + lineSpacing * 3
      );

      // Détails de la facture
      const titleY = senderY + lineSpacing * 12;
      
      doc.font('Helvetica-Bold').fontSize(14).text(`Invoice ${formattedOrderId}`, 50, titleY + 5);
      doc.font('Helvetica').fontSize(10).text(`Date: ${orderDate.toLocaleDateString('Fr')}`, 50, titleY + 25);

      return titleY + 60;
    };

    // Ajouter une ligne simple avec les conditions de paiement et le total
    const addSimpleTotalLine = (yPosition) => {
      // Calculer le centre de la page (entre l'en-tête et le bulletin de paiement)
      const pageHeight = doc.page.height;
      const pageWidth = doc.page.width;
      const receiptHeight = pageHeight / 2.8; // Estimation de la hauteur du bulletin
      const availableHeight = pageHeight - receiptHeight - yPosition;
      const centerY = yPosition + (availableHeight / 2) - 70; // Centre vertical avec ajustement
      
      // Position horizontale centrée
      const horizontalCenter = Math.floor(pageWidth / 2);
      
      // Total TTC en premier
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text(`TOTAL TTC: ${totalTTC.toFixed(2)} CHF`, horizontalCenter - 90, centerY);
      
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('PAYMENT TERMS: net 30 days', horizontalCenter - 95, centerY + 50);
      
      return centerY + 50; // Retourner la position Y après la ligne
    };

    // Bulletin de paiement (conservé tel quel)
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
      
      // Empêcher le chevauchement en vérifiant si l'image a déjà été ajoutée
      if (!doc._receiptAdded) {
        doc.image(receiptImagePath, 0, receiptYPosition, { 
          width: receiptImageWidth,
          align: 'center'
        });
        doc._receiptAdded = true;
      }
    };

    // Générer la page récapitulative avec une ligne simple pour le total
    const headerEndY = addInvoiceHeader();
    const totalLineEndY = addSimpleTotalLine(headerEndY);
    addPaymentSlip();
  }
}

module.exports = {
  generateInvoicePDF: (doc, orderItems, userProfile, orderDate, orderId) => {
    // Assurer qu'on n'appelle la fonction qu'une seule fois
    if (!doc._invoiceGenerated) {
      doc._invoiceGenerated = true;
      return InvoiceService.generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
    } else {
      console.log('La génération de facture a déjà été effectuée pour ce document');
      return Promise.resolve({});
    }
  }
};