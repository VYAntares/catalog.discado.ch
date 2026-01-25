// sites/catalog.discado.ch/index.js
// require('dotenv').config();

// ===== IMPORTATIONS =====
// Modules externes
const express = require('express');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const invoiceManagementService = require('./services/invoiceManagementService');
const permissionService = require('./services/permissionService');


// securite dom protection XSS
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    const sanitizeObject = (obj) => {
      if (!obj) return obj;
      
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
          obj[key] = DOMPurify.sanitize(obj[key]);
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      });
      
      return obj;
    };
    
    req.body = sanitizeObject(req.body);
  }
  
  next();
};

// Configuration et services
const keys = require('./config/keys');
const userService = require('./services/userService');
const orderService = require('./services/orderService');
const productService = require('./services/productService');
const invoiceService = require('./services/invoiceService');
const cryptoService = require('./services/cryptoService');
const deliveryNoteService = require('./services/deliveryNoteService');
const dbModule = require('./services/db');

// ===== CONFIGURATION DE BASE =====
const app = express();
const PORT = process.env.PORT || 3000;

// Vérification de la configuration de sécurité
if (!process.env.ENCRYPTION_KEY || !process.env.ENCRYPTION_IV) {
  console.warn('⚠️ Attention: Certaines clés de sécurité utilisent des valeurs par défaut. Utilisez le fichier .env en production.');
} else {
  console.log('✅ Configuration de sécurité chargée correctement.');
}

// ===== MIDDLEWARES PRINCIPAUX =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(sanitizeMiddleware);
app.set('trust proxy', 1);
app.use(helmet());

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
    scriptSrcAttr: ["'unsafe-inline'"],  // ← AJOUTÉ CETTE LIGNE
    styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
    fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "blob:"],
    connectSrc: ["'self'"]
  }
}));

// Configuration de la session
app.use(session({
  secret: keys.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true,
    maxAge: 3 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'strict'
  }
}));

// ===== SYSTÈME DE SÉCURITÉ =====
const loginAttempts = {};

function checkLoginThrottling(identifier) {
  const now = Date.now();
  const attemptsInfo = loginAttempts[identifier];
  
  if (!attemptsInfo || now - attemptsInfo.timestamp > 15 * 60 * 1000) {
    loginAttempts[identifier] = { count: 0, timestamp: now };
    return { allowed: true, remainingAttempts: 5 };
  }
  
  if (attemptsInfo.count >= 5) {
    const timeLeft = Math.ceil((attemptsInfo.timestamp + 15 * 60 * 1000 - now) / 60000);
    return { 
      allowed: false, 
      timeLeft: timeLeft,
      message: `Trop de tentatives échouées. Veuillez réessayer dans ${timeLeft} minute(s).`
    };
  }
  
  return { allowed: true, remainingAttempts: 5 - attemptsInfo.count };
}

// ===== MIDDLEWARES D'AUTORISATION =====
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).send('Access denied');
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/');
    }

    const username = req.session.user.username;
    
    // Vérifier la permission en base de données
    const hasPermission = permissionService.hasPermission(username, permission);

    if (!hasPermission) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Accès refusé</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    text-align: center;
                    max-width: 500px;
                }
                h1 {
                    color: #f56565;
                    margin-bottom: 20px;
                }
                p {
                    color: #4a5568;
                    margin-bottom: 30px;
                    line-height: 1.6;
                }
                a {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: transform 0.2s;
                }
                a:hover {
                    transform: translateY(-2px);
                }
                .icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">🔒</div>
                <h1>Accès refusé</h1>
                <p>Vous n'avez pas l'autorisation d'accéder à cette section.</p>
                <p>Contactez <strong>Endrit</strong> si vous pensez que c'est une erreur.</p>
                <a href="/admin/orders">← Retour au tableau de bord</a>
            </div>
        </body>
        </html>
      `);
    }

    next();
  };
}


function requireCompleteProfile(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  if (req.session.user.role === 'admin') {
    return next();
  }
  
  if (!userService.isProfileComplete(req.session.user.username)) {
    return res.redirect('/profile');
  }
  
  next();
}

// ===== ROUTES PUBLIQUES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pages/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

// ===== RESSOURCES STATIQUES =====
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/fonts', express.static(path.join(__dirname, 'public/fonts')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/components', express.static(path.join(__dirname, 'public/components')));

app.use('/admin/js', (req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.set('Content-Type', 'application/javascript; charset=UTF-8');
  }
  next();
});

app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));
app.use('/admin/js', express.static(path.join(__dirname, 'admin/js')));

app.use('/pages/', (req, res, next) => {
  const requestPath = req.path;
  
  if (requestPath === '/login.html') {
    return next();
  }
  
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  next();
});

// ===== ROUTES D'AUTHENTIFICATION =====
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const identifier = `${req.ip}:${username}`;
  
  const throttleCheck = checkLoginThrottling(identifier);
  if (!throttleCheck.allowed) {
    return res.status(429).send(`${throttleCheck.message} <a href="/">Retour</a>`);
  }
  
  const user = userService.getUser(username);
  
  if (user && cryptoService.verifyPassword(user.password, password)) {
    delete loginAttempts[identifier];
    
    req.session.user = {
      username: user.username,
      role: user.role
    };
    
    if (user.role === 'admin') {
      return res.redirect('/admin/orders');
    } else {
      if (userService.isProfileComplete(username)) {
        return res.redirect('/pages/catalog.html');
      } else {
        return res.redirect('/profile');
      }
    }
  } else {
    if (!loginAttempts[identifier]) {
      loginAttempts[identifier] = { count: 0, timestamp: Date.now() };
    }
    loginAttempts[identifier].count++;
    
    const remainingAttempts = 5 - loginAttempts[identifier].count;
    
    if (remainingAttempts <= 0) {
      return res.status(429).send(`Trop de tentatives échouées. Votre compte est temporairement bloqué. <a href="/">Retour</a>`);
    } else {
      return res.status(401).send(`Identifiants invalides. Il vous reste ${remainingAttempts} tentative(s). <a href="/">Réessayer</a>`);
    }
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send('Error during logout');
    res.redirect('/');
  });
});

// ===== ROUTES ADMINISTRATEUR PROTÉGÉES =====
// app.get('/admin', requireLogin, requireAdmin, (req, res) => {
//   res.sendFile(path.join(__dirname, 'admin', 'index.html'));
// });

app.get('/admin/orders', requireLogin, requireAdmin, requirePermission("orders"), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'orders.html'));
});

app.get('/admin/clients', requireLogin, requireAdmin, requirePermission("clients"), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'clients.html'));
});

app.get('/admin/order-history', requireLogin, requireAdmin, requirePermission("order_history"), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'order-history.html'));
});

app.get('/admin/compta', requireLogin, requireAdmin, requirePermission('compta'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'compta.html'));
});

app.get('/admin/client-invoices', requireLogin, requireAdmin, requirePermission('compta'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/pages/client-invoices.html'));
});

app.get('/admin/stock', requireLogin, requireAdmin, requirePermission('stock'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'stock.html'));
});

app.get('/admin/compta-details', requireLogin, requireAdmin, requirePermission('compta'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/pages/compta-details.html'));
});

app.get('/admin/compta-month', requireLogin, requireAdmin, requirePermission('compta'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/pages/compta-month.html'));
});

// ===== ROUTES CLIENT PROTÉGÉES =====
app.get('/pages/catalog.html', requireLogin, requireCompleteProfile, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'catalog.html'));
});

app.get('/profile', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'profile.html'));
});

app.get('/pages/profile.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'profile.html'));
});

app.get('/orders', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'orders.html'));
});

app.get('/pages/orders.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'orders.html'));
});

// ===== API ROUTES - GÉNÉRALES =====
app.get('/api/check-auth', (req, res) => {
  if (req.session.user) {
    res.json({ 
      authenticated: true, 
      username: req.session.user.username,
      role: req.session.user.role
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// ===== API ROUTES - PROFIL UTILISATEUR =====
app.get('/api/user-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profile = userService.getUserProfile(userId);
  res.json(profile || {});
});

app.post('/api/save-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profileData = req.body;
  
  try {
    if (profileData.passwordChange) {
      const { currentPassword, newPassword } = profileData.passwordChange;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Données de mot de passe incomplètes'
        });
      }
      
      const user = userService.getUser(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false, 
          message: 'Utilisateur non trouvé'
        });
      }
      
      if (!cryptoService.verifyPassword(user.password, currentPassword)) {
        return res.status(401).json({
          success: false, 
          message: 'Le mot de passe actuel est incorrect'
        });
      }
      
      try {
        const updateResult = userService.updateUserPassword(userId, newPassword);
        
        if (!updateResult) {
          throw new Error('Échec de la mise à jour du mot de passe');
        }
        
        if (req.session.user) {
          delete req.session.user.password;
        }
        
        delete profileData.passwordChange;
      } catch (pwError) {
        return res.status(500).json({ 
          success: false, 
          message: `Erreur lors de la mise à jour du mot de passe: ${pwError.message}`,
          error: pwError.message
        });
      }
    }
    
    if (!profileData.firstName || !profileData.lastName || !profileData.email) {
      return res.status(400).json({
        success: false,
        message: 'Les champs obligatoires du profil sont manquants'
      });
    }
    
    const result = userService.saveUserProfile(profileData, userId);
    
    if (!result) {
      throw new Error('Échec de la sauvegarde du profil');
    }
    
    const updatedProfile = userService.getUserProfile(userId);
    
    res.json({ 
      success: true,
      passwordSameAsUsername: result.passwordSameAsUsername,
      message: result.message,
      passwordChanged: profileData.passwordChange !== undefined,
      isProfileComplete: result.isProfileComplete,
      profile: updatedProfile,
      shouldRedirect: result.shouldRedirect,
      redirectUrl: result.shouldRedirect ? '/pages/catalog.html' : null
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la sauvegarde du profil: ${error.message}`,
      error: error.message
    });
  }
});

app.post('/api/change-password', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const { currentPassword, newPassword } = req.body;
  
  try {
    const user = userService.getUser(userId);
    
    if (!user || !cryptoService.verifyPassword(user.password, currentPassword)) {
      return res.status(401).json({
        success: false,
        message: 'Mot de passe actuel incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }
    
    const result = userService.updateUserPassword(userId, newPassword);
    
    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du mot de passe',
      error: error.message
    });
  }
});

// ===== API ROUTES - PRODUITS ET COMMANDES =====
// 🔥 ROUTES SPÉCIFIQUES EN PREMIER (ORDRE CRITIQUE!)

// Récupération des produits pour la gestion du stock
app.get('/api/products/stock', requireLogin, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 Requête /api/products/stock reçue');
    const products = await productService.getProductsStock();
    console.log(`📤 Envoi de ${products.length} produits`);
    res.json(products);
  } catch (error) {
    console.error('❌ Error fetching stock products:', error);
    res.status(500).json({ error: 'Error getting stock products' });
  }
});

// GET stock statistics
app.get('/api/products/stats/stock', requireLogin, requireAdmin, async (req, res) => {
  try {
    const stats = await new Promise((resolve, reject) => {
      dbModule.db.get(`
        SELECT 
          COUNT(*) as total_products,
          SUM(CASE WHEN stock > 10 THEN 1 ELSE 0 END) as in_stock,
          SUM(CASE WHEN stock > 0 AND stock <= 10 THEN 1 ELSE 0 END) as low_stock,
          SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
          SUM(price * stock) as total_value
        FROM products
      `, [], (err, row) => err ? reject(err) : resolve(row));
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stock stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// BULK UPDATE stock
app.put('/api/products/bulk/stock', requireLogin, requireAdmin, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Format de données invalide' });
    }

    await new Promise((resolve, reject) => dbModule.db.run('BEGIN TRANSACTION', err => err ? reject(err) : resolve()));

    try {
      for (const update of updates) {
        const stock = Number(update.stock);
        if (isNaN(stock) || stock < 0) throw new Error('Valeur de stock invalide');

        await new Promise((resolve, reject) => {
          dbModule.db.run('UPDATE products SET stock = ? WHERE id = ?', [stock, update.id], err => err ? reject(err) : resolve());
        });
      }

      await new Promise((resolve, reject) => dbModule.db.run('COMMIT', err => err ? reject(err) : resolve()));

      res.json({ message: 'Stock mis à jour avec succès', count: updates.length });
    } catch (err) {
      await new Promise((resolve, reject) => dbModule.db.run('ROLLBACK', err2 => err2 ? reject(err2) : resolve()));
      throw err;
    }
  } catch (error) {
    console.error('Error bulk updating stock:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du stock' });
  }
});

// GET products by category
app.get('/api/products/category/:category', requireLogin, async (req, res) => {
  try {
    const { category } = req.params;

    const products = await new Promise((resolve, reject) => {
      dbModule.db.all('SELECT * FROM products WHERE category = ? ORDER BY name', [category], (err, rows) => err ? reject(err) : resolve(rows));
    });

    res.json(products.map(p => ({
      ...p,
      stock: Number(p.stock) || 0,
      price: Number(p.price) || 0
    })));
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

// GET low stock products
app.get('/api/products/low-stock/:threshold?', requireLogin, requireAdmin, async (req, res) => {
  try {
    const threshold = parseInt(req.params.threshold) || 250;

    const products = await new Promise((resolve, reject) => {
      dbModule.db.all('SELECT * FROM products WHERE stock > 0 AND stock <= ? ORDER BY stock ASC', [threshold], (err, rows) => err ? reject(err) : resolve(rows));
    });

    res.json(products.map(p => ({
      ...p,
      stock: Number(p.stock) || 0,
      price: Number(p.price) || 0
    })));
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

// GET out-of-stock products
app.get('/api/products/out-of-stock', requireLogin, requireAdmin, async (req, res) => {
  try {
    const products = await new Promise((resolve, reject) => {
      dbModule.db.all('SELECT * FROM products WHERE stock = 0 ORDER BY name', [], (err, rows) => err ? reject(err) : resolve(rows));
    });

    res.json(products.map(p => ({
      ...p,
      stock: Number(p.stock) || 0,
      price: Number(p.price) || 0
    })));
  } catch (error) {
    console.error('Error fetching out-of-stock products:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

// UPDATE product stock
app.put('/api/products/:id/stock', requireLogin, requireAdmin, requirePermission('stock'), async (req, res) => {
  try {
    const { id } = req.params;
    let { stock } = req.body;

    console.log(`📦 Mise à jour stock produit ${id}: ${stock}`);

    stock = Number(stock);
    if (isNaN(stock) || stock < 0) {
      console.error('❌ Valeur de stock invalide:', stock);
      return res.status(400).json({ error: 'Valeur de stock invalide' });
    }

    // ✅ Utiliser directement better-sqlite3 de façon synchrone
    try {
      // Vérifier si le produit existe
      const product = dbModule.db.prepare('SELECT * FROM products WHERE id = ?').get(id);

      if (!product) {
        console.error('❌ Produit non trouvé:', id);
        return res.status(404).json({ error: 'Produit non trouvé' });
      }

      console.log(`✅ Produit trouvé: ${product.name}, stock actuel: ${product.stock}`);

      // Mettre à jour le stock
      const updateStmt = dbModule.db.prepare('UPDATE products SET stock = ? WHERE id = ?');
      updateStmt.run(stock, id);

      console.log(`✅ Stock mis à jour: ${product.stock} → ${stock}`);

      // Récupérer le produit mis à jour
      const updatedProduct = dbModule.db.prepare('SELECT * FROM products WHERE id = ?').get(id);

      res.json({
        success: true,
        message: 'Stock mis à jour avec succès',
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          stock: Number(updatedProduct.stock) || 0,
          price: Number(updatedProduct.price) || 0
        }
      });
    } catch (dbError) {
      console.error('❌ Erreur DB:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('❌ Error updating stock:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la mise à jour du stock',
      details: error.message 
    });
  }
});

// Routes API à ajouter dans index.js pour la mise à jour des produits

// UPDATE product (toutes les informations)
app.put('/api/products/:id', requireLogin, requireAdmin, requirePermission('stock'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category, supplier, image_url, stock } = req.body;

    console.log(`📝 Mise à jour produit ${id}:`, { name, price, category, supplier, image_url, stock });

    // Validation
    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Nom, prix et catégorie sont requis' });
    }

    const priceNum = Number(price);
    const stockNum = Number(stock);

    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'Prix invalide' });
    }

    if (isNaN(stockNum) || stockNum < 0) {
      return res.status(400).json({ error: 'Stock invalide' });
    }

    // Vérifier si le produit existe
    const product = dbModule.db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Mettre à jour le produit
    const updateStmt = dbModule.db.prepare(`
      UPDATE products 
      SET name = ?, price = ?, category = ?, supplier = ?, image_url = ?, stock = ?
      WHERE id = ?
    `);

    updateStmt.run(name, priceNum, category, supplier || null, image_url || null, stockNum, id);

    // Récupérer le produit mis à jour
    const updatedProduct = dbModule.db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    console.log('✅ Produit mis à jour:', updatedProduct);

    res.json({
      success: true,
      message: 'Produit mis à jour avec succès',
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        price: Number(updatedProduct.price) || 0,
        category: updatedProduct.category,
        supplier: updatedProduct.supplier,
        image_url: updatedProduct.image_url,
        stock: Number(updatedProduct.stock) || 0
      }
    });
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la mise à jour du produit',
      details: error.message 
    });
  }
});

// DELETE product
app.delete('/api/products/:id', requireLogin, requireAdmin, requirePermission('stock'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Suppression produit ${id}`);

    // Vérifier si le produit existe
    const product = dbModule.db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Supprimer le produit
    const deleteStmt = dbModule.db.prepare('DELETE FROM products WHERE id = ?');
    deleteStmt.run(id);

    console.log('✅ Produit supprimé');

    res.json({
      success: true,
      message: 'Produit supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la suppression du produit',
      details: error.message 
    });
  }
});

// ADD product (CREATE)
app.post('/api/products', requireLogin, requireAdmin, requirePermission('stock'), async (req, res) => {
  try {
    const { name, price, category, supplier, image_url, stock } = req.body;

    console.log(`➕ Ajout nouveau produit:`, { name, price, category, supplier, image_url, stock });

    // Validation
    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Nom, prix et catégorie sont requis' });
    }

    const priceNum = Number(price);
    const stockNum = Number(stock);

    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'Prix invalide' });
    }

    if (isNaN(stockNum) || stockNum < 0) {
      return res.status(400).json({ error: 'Stock invalide' });
    }

    // Insérer le nouveau produit
    const insertStmt = dbModule.db.prepare(`
      INSERT INTO products (name, price, category, supplier, image_url, stock)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(name, priceNum, category, supplier || null, image_url || null, stockNum);

    // Récupérer le produit créé
    const newProduct = dbModule.db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

    console.log('✅ Produit créé:', newProduct);

    res.status(201).json({
      success: true,
      message: 'Produit ajouté avec succès',
      product: {
        id: newProduct.id,
        name: newProduct.name,
        price: Number(newProduct.price) || 0,
        category: newProduct.category,
        supplier: newProduct.supplier,
        image_url: newProduct.image_url,
        stock: Number(newProduct.stock) || 0
      }
    });
  } catch (error) {
    console.error('❌ Error adding product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'ajout du produit',
      details: error.message 
    });
  }
});

// 🔥 ROUTES GÉNÉRIQUES À LA FIN

// Récupération des produits (format ancien pour catalog client)
app.get('/api/products', requireLogin, async (req, res) => {
  try {
    const products = await productService.getProducts();
    
    const sanitizedProducts = products.map(p => ({
      ...p,
      stock: Number(p.stock) || 0,
      price: Number(p.price) || 0
    }));
    
    res.json(sanitizedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error getting products' });
  }
});

// GET single product by ID
app.get('/api/products/:id', requireLogin, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await new Promise((resolve, reject) => {
      dbModule.db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    res.json({
      ...product,
      stock: Number(product.stock) || 0,
      price: Number(product.price) || 0
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

// Sauvegarde d'une commande
app.post('/api/save-order', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const cartItems = req.body.items;
  const reference = req.body.reference || '';
  
  try {
    const result = orderService.saveOrder(userId, cartItems, reference);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving order' });
  }
});

// Récupération des commandes utilisateur
app.get('/api/user-orders', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  
  try {
    const orders = orderService.getUserOrders(userId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error getting user orders' });
  }
});

// Téléchargement de facture (client)
app.get('/api/download-invoice/:orderId', requireLogin, async (req, res) => {
  const userId = req.session.user.username;
  const orderId = req.params.orderId;
  
  try {
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    const userProfile = userService.getUserProfile(userId);
    
    if (!orderDetails || !userProfile) {
      return res.status(404).json({ error: 'Order or user profile not found' });
    }
    
    if (orderDetails.status !== 'completed' && orderDetails.status !== 'partial' && 
        (!orderDetails.deliveredItems || orderDetails.deliveredItems.length === 0)) {
      return res.status(403).json({ 
        error: 'This order has not been delivered yet. No invoice available.' 
      });
    }
    
    const orderItems = orderDetails.deliveredItems || orderDetails.items;
    const orderDate = new Date(orderDetails.lastProcessed || orderDetails.date);
    const remainingItems = orderDetails.remainingItems || [];
    
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${userId}_${orderId}.pdf`);
    
    doc.pipe(res);
    
    await deliveryNoteService.generateDeliveryNotePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems, false);
    await invoiceService.generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
    
    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

// ===== API ROUTES - ADMINISTRATEUR =====
app.get('/api/admin/pending-orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const pendingOrders = orderService.getPendingOrders();
    res.json(pendingOrders);
  } catch (error) {
    res.status(500).json({ error: 'Error getting pending orders' });
  }
});

app.get('/api/admin/treated-orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const treatedOrders = orderService.getTreatedOrders();
    res.json(treatedOrders);
  } catch (error) {
    res.status(500).json({ error: 'Error getting treated orders' });
  }
});

app.get('/api/admin/client-profiles', requireLogin, requireAdmin, (req, res) => {
  try {
    const profiles = userService.getAllClientProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: 'Error getting client profiles' });
  }
});

app.get('/api/admin/client-profile/:userId', requireLogin, requireAdmin, (req, res) => {
  const userId = req.params.userId;
  
  try {
    const profile = userService.getUserProfile(userId);
    
    if (profile) {
      res.json(profile);
    } else {
      res.status(404).json({ error: 'Client profile not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error getting client profile' });
  }
});

app.post('/api/admin/process-order', requireLogin, requireAdmin, (req, res) => {
  const { userId, orderId, deliveredItems } = req.body;
  
  if (!userId || !orderId || !Array.isArray(deliveredItems)) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }
  
  try {
    const result = orderService.processOrder(orderId, userId, deliveredItems);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error processing order' });
  }
});

app.get('/api/admin/order-details/:orderId/:userId', requireLogin, requireAdmin, (req, res) => {
  const { orderId, userId } = req.params;
  
  try {
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    res.json(orderDetails);
  } catch (error) {
    res.status(500).json({ error: 'Error getting order details' });
  }
});

app.get('/api/admin/client-orders/:clientId', requireLogin, requireAdmin, (req, res) => {
  const clientId = req.params.clientId;
  
  try {
    const orders = orderService.getUserOrders(clientId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error getting client orders' });
  }
});

app.get('/api/admin/download-invoice/:orderId/:userId', requireLogin, requireAdmin, async (req, res) => {
  const { orderId, userId } = req.params;
  
  try {
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    const userProfile = userService.getUserProfile(userId);
    
    if (!orderDetails || !userProfile) {
      return res.status(404).json({ error: 'Order or user profile not found' });
    }
    
    if (orderDetails.status !== 'completed' && orderDetails.status !== 'partial' && 
        (!orderDetails.deliveredItems || orderDetails.deliveredItems.length === 0)) {
      return res.status(403).json({ 
        error: 'This order has not been delivered yet. No invoice available.' 
      });
    }
    
    const orderItems = orderDetails.deliveredItems || orderDetails.items;
    const orderDate = new Date(orderDetails.lastProcessed || orderDetails.date);
    const remainingItems = orderDetails.remainingItems || [];
    
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${userId}_${orderId}.pdf`);
    
    doc.pipe(res);
    
    await deliveryNoteService.generateDeliveryNotePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems, false);
    await invoiceService.generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
    
    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

app.post('/api/admin/create-client', requireLogin, requireAdmin, (req, res) => {
  const { username, password, profileData } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Nom d\'utilisateur et mot de passe requis' 
    });
  }
  
  try {
    const existingUser = userService.getUser(username);
    
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Ce nom d\'utilisateur existe déjà' 
      });
    }
    
    userService.createUser(username, password, 'client');
    
    if (profileData) {
      userService.saveUserProfile(profileData, username);
    }
    
    res.json({ 
      success: true, 
      message: 'Client créé avec succès',
      username
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création du client'
    });
  }
});

app.post('/api/admin/create-order-from-pending', requireLogin, requireAdmin, async (req, res) => {
  const { userId, items } = req.body;
  
  if (!userId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Données invalides' });
  }
  
  try {
    const result = await orderService.createOrderFromPendingItems(userId, items);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error creating order: ' + error.message 
    });
  }
});

app.post('/api/admin/delete-pending-items', requireLogin, requireAdmin, (req, res) => {
  const { userId, items } = req.body;
  
  if (!userId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Paramètres invalides' 
    });
  }
  
  try {
    const result = orderService.deletePendingItems(userId, items);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des articles: ' + error.message
    });
  }
});

app.post('/api/admin/update-order-items', requireLogin, requireAdmin, async (req, res) => {
  const { orderId, userId, modifications, deletions } = req.body;
  
  if (!orderId || !userId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Paramètres invalides: orderId et userId sont requis' 
    });
  }
  
  if (modifications && !Array.isArray(modifications)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Le paramètre modifications doit être un tableau' 
    });
  }
  
  if (deletions && !Array.isArray(deletions)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Le paramètre deletions doit être un tableau' 
    });
  }
  
  try {
    const result = await orderService.updateOrderItems(
      orderId, 
      userId, 
      modifications || [], 
      deletions || []
    );
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la mise à jour: ' + error.message 
    });
  }
});

// ===== API ROUTES - COMPTABILITÉ =====
app.put('/api/invoices/:invoiceId/payment', requireLogin, requireAdmin, requirePermission('stock'), (req, res) => {
  const { invoiceId } = req.params;
  const paymentData = req.body;
  
  console.log('PUT /api/invoices/:invoiceId/payment called');
  console.log('Invoice ID:', invoiceId);
  console.log('Payment Data:', paymentData);
  
  try {
    const result = invoiceManagementService.updatePaymentStatus(invoiceId, paymentData);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Error updating payment status: ' + error.message });
  }
});

app.get('/api/invoices/stats', requireLogin, requireAdmin, requirePermission('compta'), (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  try {
    const stats = invoiceManagementService.getInvoiceStatistics(year);
    res.json(stats);
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({ error: 'Error getting statistics' });
  }
});

app.get('/api/invoices/clients-summary', requireLogin, requireAdmin, requirePermission('stock'), (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  try {
    const clients = invoiceManagementService.getClientsSummary(year);
    res.json({ clients });
  } catch (error) {
    console.error('Error getting clients summary:', error);
    res.status(500).json({ error: 'Error getting clients summary' });
  }
});

app.get('/api/invoices/client/:userId', requireLogin, requireAdmin, requirePermission('stock'), (req, res) => {
  const { userId } = req.params;
  const year = req.query.year ? parseInt(req.query.year) : null;
  try {
    const invoices = invoiceManagementService.getClientInvoices(userId, year);
    res.json({ invoices });
  } catch (error) {
    console.error('Error getting client invoices:', error);
    res.status(500).json({ error: 'Error getting client invoices' });
  }
});

app.get('/api/invoices/monthly-breakdown', requireLogin, requireAdmin, requirePermission('stock'), (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  const type = req.query.type || 'total_amount';
  
  try {
    const breakdown = invoiceManagementService.getMonthlyBreakdown(year, type);
    res.json(breakdown);
  } catch (error) {
    console.error('Error getting monthly breakdown:', error);
    res.status(500).json({ error: 'Error getting monthly breakdown' });
  }
});

app.get('/api/invoices/month-details', requireLogin, requireAdmin, requirePermission('stock'), (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  const month = req.query.month ? parseInt(req.query.month) : null;
  
  if (!year || !month) {
    return res.status(400).json({ error: 'Year and month are required' });
  }
  
  try {
    const invoices = invoiceManagementService.getMonthInvoices(year, month);
    res.json({ invoices });
  } catch (error) {
    console.error('Error getting month invoices:', error);
    res.status(500).json({ error: 'Error getting month invoices' });
  }
});

app.get('/api/invoices/unpaid', requireLogin, requireAdmin, requirePermission('compta'), (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  
  try {
    const invoices = invoiceManagementService.getUnpaidInvoices(year);
    res.json({ invoices });
  } catch (error) {
    console.error('Error getting unpaid invoices:', error);
    res.status(500).json({ error: 'Error getting unpaid invoices' });
  }
});

// // Routes anciennes (pour compatibilité)
// app.get('/api/admin/invoices', requireLogin, requireAdmin, (req, res) => {
//   try {
//     const invoices = invoiceManagementService.getAllInvoices();
//     res.json(invoices);
//   } catch (error) {
//     res.status(500).json({ error: 'Error getting invoices' });
//   }
// });

// app.get('/api/admin/invoices/statistics', requireLogin, requireAdmin, (req, res) => {
//   try {
//     const stats = invoiceManagementService.getInvoiceStatistics();
//     res.json(stats);
//   } catch (error) {
//     res.status(500).json({ error: 'Error getting statistics' });
//   }
// });

// app.get('/api/admin/invoices/clients-summary', requireLogin, requireAdmin, (req, res) => {
//   try {
//     const clients = invoiceManagementService.getClientsSummary();
//     res.json(clients);
//   } catch (error) {
//     res.status(500).json({ error: 'Error getting clients summary' });
//   }
// });

// app.get('/api/admin/invoices/client/:userId', requireLogin, requireAdmin, (req, res) => {
//   const { userId } = req.params;
//   try {
//     const invoices = invoiceManagementService.getClientInvoices(userId);
//     res.json(invoices);
//   } catch (error) {
//     res.status(500).json({ error: 'Error getting client invoices' });
//   }
// });

// app.get('/api/admin/invoices/:invoiceId', requireLogin, requireAdmin, (req, res) => {
//   const { invoiceId } = req.params;
//   try {
//     const invoice = invoiceManagementService.getInvoiceDetails(invoiceId);
//     if (!invoice) {
//       return res.status(404).json({ error: 'Invoice not found' });
//     }
//     res.json(invoice);
//   } catch (error) {
//     res.status(500).json({ error: 'Error getting invoice details' });
//   }
// });

// app.post('/api/admin/invoices/:invoiceId/payment', requireLogin, requireAdmin, (req, res) => {
//   const { invoiceId } = req.params;
//   const paymentData = req.body;
  
//   try {
//     const result = invoiceManagementService.updatePaymentStatus(invoiceId, paymentData);
//     res.json(result);
//   } catch (error) {
//     res.status(500).json({ error: 'Error updating payment status' });
//   }
// });

// ===== DÉMARRAGE DU SERVEUR =====
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});