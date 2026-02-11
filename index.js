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
const multer = require('multer');   
const sharp = require('sharp');       
const invoiceManagementService = require('./services/invoiceManagementService');
const permissionService = require('./services/permissionService');
const navigationService = require('./services/navigationService');


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
const statsService = require('./services/statsServices');

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

// ===== CONFIGURATION UPLOAD D'IMAGES =====
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images (JPEG, PNG, GIF, WebP) sont autorisées'));
    }
  }
});
// ===== FIN CONFIGURATION UPLOAD =====

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
      // Au lieu d'afficher une erreur 403, rediriger vers la première page accessible
      const firstAccessiblePage = navigationService.getFirstAccessiblePage(username);
      
      if (!firstAccessiblePage) {
        // Aucune page accessible - afficher un message d'erreur
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
                  <h1>Aucun accès configuré</h1>
                  <p>Votre compte n'a accès à aucune section du panneau d'administration.</p>
                  <p>Veuillez contacter votre administrateur système pour configurer vos permissions.</p>
                  <a href="/logout">← Se déconnecter</a>
              </div>
          </body>
          </html>
        `);
      }
      
      // Rediriger vers la première page accessible
      console.log(`🔄 Redirection de ${username} vers ${firstAccessiblePage.path} (pas d'accès à la page actuelle)`);
      return res.redirect(firstAccessiblePage.path);
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

app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));

app.use('/admin/js', (req, res, next) => {
  res.set('Content-Type', 'application/javascript; charset=UTF-8');
  next();
}, express.static(path.join(__dirname, 'admin/js')));

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
      // Rediriger vers la première page accessible
      const firstPage = navigationService.getFirstAccessiblePage(username);
      
      if (!firstPage) {
        return res.status(403).send(`
          Votre compte administrateur n'a accès à aucune section. 
          Veuillez contacter l'administrateur système. 
          <a href="/logout">Se déconnecter</a>
        `);
      }
      
      console.log(`✅ Login admin ${username} - Redirection vers ${firstPage.path}`);
      return res.redirect(firstPage.path);
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

app.get('/admin/suppliers', requireLogin, requireAdmin, requirePermission('suppliers'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'suppliers.html'));
});

app.get('/admin/stats', requireLogin, requireAdmin, requirePermission('stats'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'stats.html'));
});

app.get('/admin/stats', requireLogin, requireAdmin, requirePermission('stats'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'stats.html'));
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

app.get('/api/accessible-pages', requireLogin, requireAdmin, (req, res) => {
  const username = req.session.user.username;
  const accessiblePages = navigationService.getAccessiblePages(username);
  
  res.json({
    pages: accessiblePages,
    count: accessiblePages.length
  });
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

// Statistiques pour un produit spécifique (utilisé dans l'édition de batch)
app.get('/api/stats/product/:productName', requireLogin, requireAdmin, (req, res) => {
  try {
    const { productName } = req.params;
    const { year } = req.query;
    
    let whereClause = '';
    const params = [productName];
    
    if (year && year !== 'all') {
      whereClause += ` AND strftime('%Y', o.date) = ?`;
      params.push(year.toString());
    }
    
    // 🆕 Requête pour les quantités livrées (order_items avec status='delivered')
    const deliveredQuery = `
      SELECT
        SUM(CASE WHEN oi.status = 'delivered' THEN oi.quantity ELSE 0 END) AS total_delivered,
        SUM(CASE WHEN oi.status = 'delivered' THEN oi.product_price * oi.quantity ELSE 0 END) AS sum_total_delivered_price,
        COUNT(DISTINCT o.order_id) as order_count,
        ROUND(AVG(oi.product_price), 2) as unit_price,
        oi.category
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.order_id
      WHERE oi.product_name = ? ${whereClause}
      GROUP BY oi.category
    `;

    const deliveredStmt = dbModule.db.prepare(deliveredQuery);
    const deliveredResult = deliveredStmt.get(...params);
    
    // 🆕 Requête pour les quantités à livrer (pending_deliveries avec filtre année)
    let remainingWhereClause = '';
    const remainingParams = [productName];

    if (year && year !== 'all') {
        remainingWhereClause = ` AND strftime('%Y', created_at) = ?`;
        remainingParams.push(year.toString());
    }

    const remainingQuery = `
      SELECT
        SUM(quantity) AS total_remaining,
        SUM(product_price * quantity) AS sum_total_remaining_price
      FROM pending_deliveries
      WHERE product_name = ? ${remainingWhereClause}
    `;

    const remainingStmt = dbModule.db.prepare(remainingQuery);
    const remainingResult = remainingStmt.get(...remainingParams);

    // 🆕 Requête pour les quantités en commande fournisseur non livrée
    const supplierOrderQuery = `
      SELECT
        SUM(osi.quantity) AS supplier_order_quantity
      FROM order_supplier_items osi
      INNER JOIN order_supplier os ON osi.order_supplier_id = os.id
      WHERE osi.product_name = ?
        AND os.status != 'Livrée'
    `;

    const supplierOrderStmt = dbModule.db.prepare(supplierOrderQuery);
    const supplierOrderResult = supplierOrderStmt.get(productName);

    const total_delivered = deliveredResult?.total_delivered || 0;
    const total_remaining = remainingResult?.total_remaining || 0;
    const sum_total_delivered_price = deliveredResult?.sum_total_delivered_price || 0;
    const sum_total_remaining_price = remainingResult?.sum_total_remaining_price || 0;
    const supplier_order_quantity = supplierOrderResult?.supplier_order_quantity || 0;

    const result = {
      product_name: productName,
      category: deliveredResult?.category || null,
      total_delivered: total_delivered,
      total_remaining: total_remaining,
      total_quantity: total_delivered + total_remaining,
      sum_total_delivered_price: sum_total_delivered_price,
      sum_total_remaining_price: sum_total_remaining_price,
      sum_total_quantity_price: sum_total_delivered_price + sum_total_remaining_price,
      unit_price: deliveredResult?.unit_price || 0,
      order_count: deliveredResult?.order_count || 0,
      supplier_order_quantity: supplier_order_quantity
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({ error: 'Failed to fetch product stats' });
  }
});

// Récupérer les années disponibles pour les stats produit
app.get('/api/stats/product/:productName/years', requireLogin, requireAdmin, (req, res) => {
  try {
    const { productName } = req.params;
    
    const query = `
      SELECT DISTINCT strftime('%Y', o.date) as year
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.order_id
      WHERE oi.product_name = ?
      ORDER BY year DESC
    `;
    
    const stmt = dbModule.db.prepare(query);
    const rows = stmt.all(productName);
    
    res.json(rows.map(r => r.year));
    
  } catch (error) {
    console.error('Error fetching product years:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
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

// REMPLACER la route app.put('/api/products/:id') existante par celle-ci :
app.put('/api/products/:id', requireLogin, requireAdmin, requirePermission('stock'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, origin_price, category, supplier, image_url, stock, barcode } = req.body;

    console.log(`📝 Mise à jour produit ${id}:`, { name, price, origin_price, category, supplier, image_url, stock, barcode });

    // Validation
    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Nom, prix et catégorie sont requis' });
    }

    const priceNum = Number(price);
    const stockNum = Number(stock);
    const originPriceNum = Number(origin_price) || 0; // NOUVEAU

    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'Prix invalide' });
    }

    if (isNaN(stockNum) || stockNum < 0) {
      return res.status(400).json({ error: 'Stock invalide' });
    }

    if (isNaN(originPriceNum) || originPriceNum < 0) {
      return res.status(400).json({ error: 'Prix d\'origine invalide' });
    }

    // Vérifier si le produit existe
    const product = dbModule.db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    const oldName = product.name;

    // Mettre à jour le produit
    const updateStmt = dbModule.db.prepare(`
      UPDATE products
      SET name = ?, price = ?, origin_price = ?, category = ?, supplier = ?, image_url = ?, stock = ?, barcode = ?
      WHERE id = ?
    `);

    updateStmt.run(name, priceNum, originPriceNum, category, supplier || null, image_url || null, stockNum, barcode || null, id);

    // Si le nom a changé, mettre à jour order_items et pending_deliveries
    if (oldName && oldName !== name) {
      dbModule.db.prepare('UPDATE order_items SET product_name = ? WHERE product_name = ?').run(name, oldName);
      dbModule.db.prepare('UPDATE pending_deliveries SET product_name = ? WHERE product_name = ?').run(name, oldName);
      console.log(`✅ Nom propagé: "${oldName}" → "${name}" dans order_items et pending_deliveries`);
    }

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
        origin_price: Number(updatedProduct.origin_price) || 0, // NOUVEAU
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
    const { name, price, category, supplier, image_url, stock, barcode } = req.body;

    console.log(`➕ Ajout nouveau produit:`, { name, price, category, supplier, image_url, stock, barcode });

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
      INSERT INTO products (name, price, category, supplier, image_url, stock, barcode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(name, priceNum, category, supplier || null, image_url || null, stockNum, barcode || '');

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

// ===== ROUTES UPLOAD D'IMAGES ===== ← AJOUTER TOUT CE BLOC JUSTE APRÈS
// Route pour l'upload d'image
app.post('/api/products/upload-image', requireLogin, requireAdmin, requirePermission('stock'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }
    
    // Récupérer la catégorie depuis le FormData
    const category = req.body.category || 'other';
    
    console.log('📤 Upload image - Catégorie:', category);
    console.log('📤 Fichier reçu:', req.file.originalname);
    
    // Créer le dossier de destination si nécessaire
    const uploadPath = path.join(__dirname, 'public/images/products', category);
    
    if (!fs.existsSync(uploadPath)) {
      console.log('📁 Création du dossier:', uploadPath);
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    // Générer un nom de fichier unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(req.file.originalname);
    const nameWithoutExt = path.basename(req.file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '-');
    const filename = sanitizedName + '-' + uniqueSuffix + ext;
    
    const fullPath = path.join(uploadPath, filename);
    const imagePath = `/images/products/${category}/${filename}`;
    
    console.log('💾 Sauvegarde dans:', fullPath);
    
    // Optimiser et sauvegarder l'image avec sharp
    try {
      await sharp(req.file.buffer)
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(fullPath);
      
      console.log('✅ Image optimisée et sauvegardée');
    } catch (sharpError) {
      console.warn('⚠️ Sharp optimization failed, saving original:', sharpError.message);
      // Si sharp échoue, sauvegarder l'original
      fs.writeFileSync(fullPath, req.file.buffer);
    }
    
    console.log('✅ Chemin final:', imagePath);
    
    res.json({
      success: true,
      imagePath: imagePath,
      message: 'Image uploadée avec succès'
    });
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'upload de l\'image',
      details: error.message 
    });
  }
});


// Route pour supprimer une image
app.delete('/api/products/delete-image', requireLogin, requireAdmin, requirePermission('stock'), (req, res) => {
  try {
    const { imagePath } = req.body;
    
    if (!imagePath) {
      return res.status(400).json({ error: 'Chemin d\'image manquant' });
    }
    
    const fullPath = path.join(__dirname, 'public', imagePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      res.json({ success: true, message: 'Image supprimée avec succès' });
    } else {
      res.status(404).json({ error: 'Image non trouvée' });
    }
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression de l\'image',
      details: error.message 
    });
  }
});
// ===== FIN ROUTES UPLOAD =====


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

// GET all products (pour le module fournisseurs)
app.get('/api/products', requireLogin, requireAdmin, (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY name').all();
    console.log(`📦 API /api/products - Retour de ${products.length} produits`);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
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

// ===== AJOUTER CETTE ROUTE API APRÈS LES ROUTES /api/products =====
// (Placer cette route avec les autres routes API, par exemple après app.get('/api/products/stock'))

// GET all suppliers
app.get('/api/suppliers', requireLogin, requireAdmin, async (req, res) => {
    try {
        const suppliers = dbModule.suppliers.getAll.all();
        
        // Parser les JSON strings pour les emails, wechats, phones
        const parsedSuppliers = suppliers.map(supplier => ({
            id: supplier.id,
            name: supplier.name,
            emails: supplier.emails ? JSON.parse(supplier.emails) : [],
            wechats: supplier.wechats ? JSON.parse(supplier.wechats) : [],
            phones: supplier.phones ? JSON.parse(supplier.phones) : [],
            notes: supplier.notes || '',
            created_at: supplier.created_at,
            updated_at: supplier.updated_at
        }));
        
        res.json(parsedSuppliers);
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs' });
    }
});

// GET single supplier
app.get('/api/suppliers/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const supplier = dbModule.suppliers.getById.get(id);
        
        if (!supplier) {
            return res.status(404).json({ error: 'Fournisseur non trouvé' });
        }
        
        res.json({
            id: supplier.id,
            name: supplier.name,
            emails: supplier.emails ? JSON.parse(supplier.emails) : [],
            wechats: supplier.wechats ? JSON.parse(supplier.wechats) : [],
            phones: supplier.phones ? JSON.parse(supplier.phones) : [],
            notes: supplier.notes || '',
            created_at: supplier.created_at,
            updated_at: supplier.updated_at
        });
    } catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du fournisseur' });
    }
});

// CREATE supplier
app.post('/api/suppliers', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { name, emails, wechats, phones, notes } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Le nom du fournisseur est requis' });
        }
        
        // Vérifier si le nom existe déjà
        const existing = dbModule.suppliers.getByName.get(name);
        if (existing) {
            return res.status(409).json({ error: 'Un fournisseur avec ce nom existe déjà' });
        }
        
        const result = dbModule.suppliers.create.run(
            name,
            JSON.stringify(emails || []),
            JSON.stringify(wechats || []),
            JSON.stringify(phones || []),
            notes || ''
        );
        
        res.status(201).json({
            success: true,
            message: 'Fournisseur créé avec succès',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ error: 'Erreur lors de la création du fournisseur' });
    }
});

// UPDATE supplier
app.put('/api/suppliers/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, emails, wechats, phones, notes } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Le nom du fournisseur est requis' });
        }
        
        // Vérifier si le fournisseur existe
        const supplier = dbModule.suppliers.getById.get(id);
        if (!supplier) {
            return res.status(404).json({ error: 'Fournisseur non trouvé' });
        }
        
        dbModule.suppliers.update.run(
            name,
            JSON.stringify(emails || []),
            JSON.stringify(wechats || []),
            JSON.stringify(phones || []),
            notes || '',
            id
        );
        
        res.json({
            success: true,
            message: 'Fournisseur mis à jour avec succès'
        });
    } catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du fournisseur' });
    }
});

// DELETE supplier
app.delete('/api/suppliers/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Vérifier si le fournisseur existe
        const supplier = dbModule.suppliers.getById.get(id);
        if (!supplier) {
            return res.status(404).json({ error: 'Fournisseur non trouvé' });
        }
        
        dbModule.suppliers.delete.run(id);
        
        res.json({
            success: true,
            message: 'Fournisseur supprimé avec succès'
        });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du fournisseur' });
    }
});

// ============================================
// ROUTES COMMANDES FOURNISSEURS
// ============================================

// Récupérer toutes les commandes fournisseurs
app.get('/api/order-suppliers', requireLogin, requireAdmin, (req, res) => {
  try {
    const orders = dbModule.orderSupplier.getAll.all();
    res.json(orders);
  } catch (error) {
    console.error('Error fetching supplier orders:', error);
    res.status(500).json({ error: 'Failed to fetch supplier orders' });
  }
});

// Récupérer une commande fournisseur par ID
app.get('/api/order-suppliers/:id', requireLogin, requireAdmin, (req, res) => {
  try {
    const order = dbModule.orderSupplier.getById.get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching supplier order:', error);
    res.status(500).json({ error: 'Failed to fetch supplier order' });
  }
});

// Récupérer toutes les commandes d'un fournisseur spécifique
app.get('/api/suppliers/:supplierId/orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const orders = dbModule.orderSupplier.getBySupplierId.all(req.params.supplierId);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching supplier orders:', error);
    res.status(500).json({ error: 'Failed to fetch supplier orders' });
  }
});

// Récupérer les statistiques d'un fournisseur
app.get('/api/suppliers/:supplierId/stats', requireLogin, requireAdmin, (req, res) => {
  try {
    const stats = dbModule.orderSupplier.getStatsBySupplierId.get(req.params.supplierId);
    res.json(stats || { total_orders: 0, total_spent: 0, total_paid: 0 });
  } catch (error) {
    console.error('Error fetching supplier stats:', error);
    res.status(500).json({ error: 'Failed to fetch supplier stats' });
  }
});

// Récupérer les items d'une commande fournisseur
app.get('/api/order-suppliers/:orderId/items', requireLogin, requireAdmin, (req, res) => {
  try {
    const items = dbModule.orderSupplierItems.getByOrderId.all(req.params.orderId);
    res.json(items);
  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(500).json({ error: 'Failed to fetch order items' });
  }
});

// Créer une nouvelle commande fournisseur avec ses items
app.post('/api/order-suppliers', requireLogin, requireAdmin, (req, res) => {
  try {
    const { supplier_id, invoice_number, order_date, status, notes, items } = req.body;

    // Validation
    if (!supplier_id || !invoice_number || !order_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculer le total des items (peut être 0)
    let total_amount = 0;
    if (items && items.length > 0) {
      items.forEach(item => {
        item.total_price = item.unit_price * item.quantity;
        total_amount += item.total_price;
      });
    }

    // Créer la commande
    const result = dbModule.orderSupplier.create.run(
      supplier_id,
      invoice_number,
      order_date,
      status || 'Passée',
      total_amount,
      0,
      notes || null
    );

    const orderId = result.lastInsertRowid;

    // Ajouter les items si présents (tous dans batch 1 par défaut)
    if (items && items.length > 0) {
      items.forEach(item => {
        const batchNumber = item.batch_number || 1; // Par défaut batch 1
        
        dbModule.orderSupplierItems.add.run(
          orderId,
          item.product_id || null,
          item.product_name,
          item.unit_price,
          item.quantity,
          item.total_price,
          item.category || null,
          item.image_url || null,
          batchNumber
        );
      });
    }

    res.json({ 
      success: true, 
      orderId: orderId,
      message: 'Order created successfully' 
    });

  } catch (error) {
    console.error('Error creating supplier order:', error);
    res.status(500).json({ error: 'Failed to create supplier order' });
  }
});

// Mettre à jour une commande fournisseur
app.put('/api/order-suppliers/:id', requireLogin, requireAdmin, (req, res) => {
  try {
    const { supplier_id, invoice_number, order_date, status, total_amount, amount_paid, notes } = req.body;

    dbModule.orderSupplier.update.run(
      supplier_id,
      invoice_number,
      order_date,
      status,
      total_amount,
      amount_paid,
      notes,
      req.params.id
    );

    res.json({ success: true, message: 'Order updated successfully' });

  } catch (error) {
    console.error('Error updating supplier order:', error);
    res.status(500).json({ error: 'Failed to update supplier order' });
  }
});

// Mettre à jour uniquement le statut
app.patch('/api/order-suppliers/:id/status', requireLogin, requireAdmin, (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    dbModule.orderSupplier.updateStatus.run(status, req.params.id);
    res.json({ success: true, message: 'Status updated successfully' });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Mettre à jour les notes
app.patch('/api/order-suppliers/:id/notes', requireLogin, requireAdmin, (req, res) => {
  try {
    const { notes } = req.body;
    dbModule.orderSupplier.updateNotes.run(notes || '', req.params.id);
    res.json({ success: true, message: 'Notes updated successfully' });
  } catch (error) {
    console.error('Error updating order notes:', error);
    res.status(500).json({ error: 'Failed to update order notes' });
  }
});

// Mettre à jour les montants
app.patch('/api/order-suppliers/:id/amounts', requireLogin, requireAdmin, (req, res) => {
  try {
    const { total_amount, amount_paid } = req.body;

    dbModule.orderSupplier.updateAmounts.run(total_amount, amount_paid, req.params.id);
    res.json({ success: true, message: 'Amounts updated successfully' });

  } catch (error) {
    console.error('Error updating amounts:', error);
    res.status(500).json({ error: 'Failed to update amounts' });
  }
});

// === PAIEMENTS FOURNISSEURS ===

// Lister les paiements d'une commande
app.get('/api/order-suppliers/:id/payments', requireLogin, requireAdmin, (req, res) => {
  try {
    const payments = dbModule.orderSupplierPayments.getByOrderId.all(req.params.id);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Ajouter un paiement
app.post('/api/order-suppliers/:id/payments', requireLogin, requireAdmin, (req, res) => {
  try {
    const { amount_usd, amount_chf, payment_date } = req.body;
    const orderId = req.params.id;

    dbModule.orderSupplierPayments.insert.run(orderId, amount_usd || 0, amount_chf || 0, payment_date);

    // Recalculer amount_paid sur la commande
    const sums = dbModule.orderSupplierPayments.sumByOrderId.get(orderId);
    dbModule.orderSupplier.updateAmounts.run(
      dbModule.orderSupplier.getById.get(orderId).total_amount,
      sums.total_paid_usd,
      orderId
    );

    res.json({ success: true, message: 'Payment added successfully' });
  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// Supprimer un paiement
app.delete('/api/order-suppliers/:id/payments/:paymentId', requireLogin, requireAdmin, (req, res) => {
  try {
    const { id: orderId, paymentId } = req.params;

    dbModule.orderSupplierPayments.delete.run(paymentId);

    // Recalculer amount_paid sur la commande
    const sums = dbModule.orderSupplierPayments.sumByOrderId.get(orderId);
    dbModule.orderSupplier.updateAmounts.run(
      dbModule.orderSupplier.getById.get(orderId).total_amount,
      sums.total_paid_usd,
      orderId
    );

    res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// Modifier un item (prix, quantité)
app.put('/api/order-supplier-items/:id', requireLogin, requireAdmin, (req, res) => {
  try {
    const item = dbModule.orderSupplierItems.getById.get(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { product_id, product_name, unit_price, quantity, category, image_url, batch_number } = req.body;
    
    const newQuantity = quantity !== undefined ? quantity : item.quantity;
    const newUnitPrice = unit_price !== undefined ? unit_price : item.unit_price;
    const newTotalPrice = newQuantity * newUnitPrice;
    const newBatchNumber = batch_number !== undefined ? batch_number : item.batch_number;

    dbModule.orderSupplierItems.update.run(
      product_id !== undefined ? product_id : item.product_id,
      product_name || item.product_name,
      newUnitPrice,
      newQuantity,
      newTotalPrice,
      category !== undefined ? category : item.category,
      image_url !== undefined ? image_url : item.image_url,
      newBatchNumber,
      req.params.id
    );

    // Recalculer le total de la commande
    const totalResult = dbModule.orderSupplierItems.getTotalByOrderId.get(item.order_supplier_id);
    const newTotal = totalResult.total || 0;

    const order = dbModule.orderSupplier.getById.get(item.order_supplier_id);
    dbModule.orderSupplier.updateAmounts.run(newTotal, order.amount_paid, item.order_supplier_id);

    res.json({ success: true, message: 'Item updated successfully' });

  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Supprimer un item
app.delete('/api/order-supplier-items/:id', requireLogin, requireAdmin, (req, res) => {
  try {
    const item = dbModule.orderSupplierItems.getById.get(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const orderId = item.order_supplier_id;
    dbModule.orderSupplierItems.delete.run(req.params.id);

    const totalResult = dbModule.orderSupplierItems.getTotalByOrderId.get(orderId);
    const newTotal = totalResult.total || 0;

    const order = dbModule.orderSupplier.getById.get(orderId);
    dbModule.orderSupplier.updateAmounts.run(newTotal, order.amount_paid, orderId);

    res.json({ success: true, message: 'Item deleted successfully' });

  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Supprimer une commande fournisseur
app.delete('/api/order-suppliers/:id', requireLogin, requireAdmin, (req, res) => {
  try {
    dbModule.orderSupplier.delete.run(req.params.id);
    res.json({ success: true, message: 'Order deleted successfully' });

  } catch (error) {
    console.error('Error deleting supplier order:', error);
    res.status(500).json({ error: 'Failed to delete supplier order' });
  }
});

// Ajouter un item à une commande fournisseur
app.post('/api/order-suppliers/:orderId/items', requireLogin, requireAdmin, (req, res) => {
  try {
    const { orderId } = req.params;
    const { product_id, product_name, unit_price, quantity, category, image_url, batch_number } = req.body;

    if (!product_name || !unit_price || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const total_price = unit_price * quantity;
    const batchNum = batch_number || 1; // Par défaut batch 1

    // Ajouter l'item
    dbModule.orderSupplierItems.add.run(
      orderId,
      product_id || null,
      product_name,
      unit_price,
      quantity,
      total_price,
      category || null,
      image_url || null,
      batchNum
    );

    // Recalculer le total de la commande
    const totalResult = dbModule.orderSupplierItems.getTotalByOrderId.get(orderId);
    const newTotal = totalResult.total || 0;

    const order = dbModule.orderSupplier.getById.get(orderId);
    dbModule.orderSupplier.updateAmounts.run(newTotal, order.amount_paid, orderId);

    res.json({ success: true, message: 'Item added successfully' });

  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});


// ============================================
// 🆕 GESTION DES BATCH
// ============================================

// Récupérer les statistiques des batch d'une commande
app.get('/api/order-suppliers/:orderId/batch-stats', requireLogin, requireAdmin, (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Vérifier que la commande existe
    const order = dbModule.orderSupplier.getById.get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Récupérer les stats par batch
    const batchStats = dbModule.orderSupplierItems.getBatchStatsByOrderId.all(orderId);
    
    // Récupérer le nombre total de batch
    const batchCount = dbModule.orderSupplierItems.countBatchesByOrderId.get(orderId);
    
    res.json({
      order_id: orderId,
      batch_count: batchCount.batch_count,
      batches: batchStats
    });
    
  } catch (error) {
    console.error('Error fetching batch stats:', error);
    res.status(500).json({ error: 'Failed to fetch batch stats' });
  }
});

// Récupérer les items d'un batch spécifique
app.get('/api/order-suppliers/:orderId/batches/:batchNumber', requireLogin, requireAdmin, (req, res) => {
  try {
    const { orderId, batchNumber } = req.params;
    
    const items = dbModule.orderSupplierItems.getByOrderIdAndBatch.all(
      orderId, 
      parseInt(batchNumber)
    );
    
    res.json(items);
    
  } catch (error) {
    console.error('Error fetching batch items:', error);
    res.status(500).json({ error: 'Failed to fetch batch items' });
  }
});

// Créer un nouveau batch (retourne le numéro du nouveau batch)
app.post('/api/order-suppliers/:orderId/batches/create', requireLogin, requireAdmin, (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = dbModule.orderSupplier.getById.get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const batches = dbModule.orderSupplierItems.getBatchNumbersByOrderId.all(orderId);
    
    let newBatchNumber = 1;
    if (batches.length > 0) {
      const maxBatch = Math.max(...batches.map(b => b.batch_number));
      newBatchNumber = maxBatch + 1;
    }
    
    // 🆕 Créer un item placeholder pour que le batch existe
    dbModule.orderSupplierItems.add.run(
      orderId,
      null,  // product_id
      `[Batch ${newBatchNumber} - Glissez des articles ici]`,  // product_name
      0,     // unit_price
      0,     // quantity
      0,     // total_price
      'placeholder',  // category
      null,  // image_url
      newBatchNumber  // batch_number
    );
    
    res.json({
      success: true,
      message: `Batch ${newBatchNumber} créé`,
      batch_number: newBatchNumber
    });
    
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// Déplacer un item vers un autre batch (avec division de quantité)
app.post('/api/order-suppliers/:orderId/items/:itemId/move-to-batch', requireLogin, requireAdmin, (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { target_batch, quantity_to_move } = req.body;
    
    // Validation
    if (!target_batch || !quantity_to_move) {
      return res.status(400).json({ error: 'Missing required fields: target_batch, quantity_to_move' });
    }
    
    if (quantity_to_move <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }
    
    // Récupérer l'item source
    const sourceItem = dbModule.orderSupplierItems.getById.get(itemId);
    
    if (!sourceItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    if (sourceItem.order_supplier_id !== parseInt(orderId)) {
      return res.status(400).json({ error: 'Item does not belong to this order' });
    }
    
    // Vérifier que la quantité à déplacer n'est pas supérieure à la quantité disponible
    if (quantity_to_move > sourceItem.quantity) {
      return res.status(400).json({ 
        error: `Cannot move ${quantity_to_move} units. Only ${sourceItem.quantity} available.` 
      });
    }
    
    // Vérifier que le batch cible est différent du batch source
    if (sourceItem.batch_number === parseInt(target_batch)) {
      return res.status(400).json({ 
        error: 'Target batch must be different from source batch' 
      });
    }
    
    // CAS 1 : Déplacer toute la quantité (simple UPDATE)
    if (quantity_to_move === sourceItem.quantity) {
      dbModule.orderSupplierItems.updateItemBatchNumber.run(target_batch, itemId);
      
      return res.json({
        success: true,
        message: 'Item moved successfully',
        action: 'moved',
        item_id: itemId,
        from_batch: sourceItem.batch_number,
        to_batch: target_batch,
        quantity: quantity_to_move
      });
    }
    
    // CAS 2 : Division de l'item (UPDATE source + INSERT nouveau)
    const remainingQuantity = sourceItem.quantity - quantity_to_move;
    const pricePerUnit = sourceItem.unit_price;
    
    // Mettre à jour l'item source avec la quantité restante
    const newSourceTotal = remainingQuantity * pricePerUnit;
    dbModule.orderSupplierItems.update.run(
      sourceItem.product_id,
      sourceItem.product_name,
      sourceItem.unit_price,
      remainingQuantity,
      newSourceTotal,
      sourceItem.category,
      sourceItem.image_url,
      sourceItem.batch_number, // Garde le batch original
      itemId
    );
    
    // Créer un nouvel item dans le batch cible
    const newItemTotal = quantity_to_move * pricePerUnit;
    dbModule.orderSupplierItems.add.run(
      sourceItem.order_supplier_id,
      sourceItem.product_id,
      sourceItem.product_name,
      sourceItem.unit_price,
      quantity_to_move,
      newItemTotal,
      sourceItem.category,
      sourceItem.image_url,
      target_batch
    );
    
    // Recalculer le total de la commande (reste inchangé normalement)
    const totalResult = dbModule.orderSupplierItems.getTotalByOrderId.get(orderId);
    const newTotal = totalResult.total || 0;
    
    const order = dbModule.orderSupplier.getById.get(orderId);
    dbModule.orderSupplier.updateAmounts.run(newTotal, order.amount_paid, orderId);
    
    res.json({
      success: true,
      message: 'Item split and moved successfully',
      action: 'split',
      original_item_id: itemId,
      from_batch: sourceItem.batch_number,
      to_batch: target_batch,
      quantity_moved: quantity_to_move,
      quantity_remaining: remainingQuantity
    });
    
  } catch (error) {
    console.error('Error moving item to batch:', error);
    res.status(500).json({ error: 'Failed to move item: ' + error.message });
  }
});

// Valider la cohérence des quantités pour un produit
app.get('/api/order-suppliers/:orderId/validate-quantities/:productId', requireLogin, requireAdmin, (req, res) => {
  try {
    const { orderId, productId } = req.params;
    
    // Récupérer tous les items de ce produit dans tous les batch
    const items = dbModule.orderSupplierItems.getByOrderId.all(orderId)
      .filter(item => item.product_id === parseInt(productId));
    
    if (items.length === 0) {
      return res.status(404).json({ error: 'Product not found in this order' });
    }
    
    // Calculer le total
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Détail par batch
    const batchDetails = items.map(item => ({
      batch_number: item.batch_number,
      quantity: item.quantity,
      item_id: item.id
    }));
    
    res.json({
      product_id: productId,
      product_name: items[0].product_name,
      total_quantity: totalQuantity,
      batch_count: items.length,
      batches: batchDetails,
      is_valid: true
    });
    
  } catch (error) {
    console.error('Error validating quantities:', error);
    res.status(500).json({ error: 'Failed to validate quantities' });
  }
});

// Supprimer un batch vide
app.delete('/api/order-suppliers/:orderId/batches/:batchNumber', requireLogin, requireAdmin, (req, res) => {
  try {
    const { orderId, batchNumber } = req.params;
    
    // Vérifier que le batch est vide
    const items = dbModule.orderSupplierItems.getByOrderIdAndBatch.all(
      orderId, 
      parseInt(batchNumber)
    );
    
    if (items.length > 0) {
      return res.status(400).json({ 
        error: `Cannot delete batch ${batchNumber}. It contains ${items.length} item(s). Move items first.` 
      });
    }
    
    // Batch vide, on peut le supprimer (mais en fait il n'y a rien à supprimer)
    // Les batch sont virtuels, définis par les items
    
    res.json({
      success: true,
      message: `Batch ${batchNumber} deleted (was empty)`,
      batch_number: parseInt(batchNumber)
    });
    
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

// ============================================
// FIN DES ROUTES BATCH
// ============================================

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


// ===== API ROUTES - STATISTIQUES =====
/**
 * GET /api/stats/overview
 * Récupère les statistiques générales pour une année donnée
 */
app.get('/api/stats/overview', requireLogin, requireAdmin, requirePermission('stats'), async (req, res) => {
    try {
        const year = req.query.year; // Ne pas mettre de valeur par défaut
        const stats = await statsService.getYearlyOverview(year);
        res.json(stats);
    } catch (error) {
        console.error('❌ Erreur /api/stats/overview:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

/**
 * GET /api/stats/top-products
 * Récupère les produits les plus vendus
 */
app.get('/api/stats/top-products', requireLogin, requireAdmin, requirePermission('stats'), async (req, res) => {
    try {
        const { year, category, limit = 10 } = req.query;
        const topProducts = await statsService.getTopProducts({
            year,
            category,
            limit: parseInt(limit)
        });
        res.json(topProducts);
    } catch (error) {
        console.error('❌ Erreur /api/stats/top-products:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
    }
});

/**
 * GET /api/stats/monthly-evolution
 * Récupère l'évolution mensuelle du chiffre d'affaires
 */
app.get('/api/stats/monthly-evolution', requireLogin, requireAdmin, requirePermission('stats'), async (req, res) => {
    try {
        const year = req.query.year; // Ne pas mettre de valeur par défaut
        const evolution = await statsService.getMonthlyEvolution(year);
        res.json(evolution);
    } catch (error) {
        console.error('❌ Erreur /api/stats/monthly-evolution:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'évolution mensuelle' });
    }
});

/**
 * GET /api/stats/top-clients
 * Récupère les meilleurs clients
 */
app.get('/api/stats/top-clients', requireLogin, requireAdmin, requirePermission('stats'), async (req, res) => {
    try {
        const { year, limit = 10 } = req.query;
        const topClients = await statsService.getTopClients({
            year,
            limit: parseInt(limit)
        });
        res.json(topClients);
    } catch (error) {
        console.error('❌ Erreur /api/stats/top-clients:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des clients' });
    }
});

/**
 * GET /api/stats/categories
 * Récupère les statistiques par catégorie
 */
app.get('/api/stats/categories', requireLogin, requireAdmin, requirePermission('stats'), async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const categories = await statsService.getCategoryStats(year);
        res.json(categories);
    } catch (error) {
        console.error('❌ Erreur /api/stats/categories:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
    }
});

/**
 * GET /api/stats/payment-status
 * Récupère les statistiques de paiement
 */
app.get('/api/stats/payment-status', requireLogin, requireAdmin, requirePermission('stats'), async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const paymentStats = await statsService.getPaymentStats(year);
        res.json(paymentStats);
    } catch (error) {
        console.error('❌ Erreur /api/stats/payment-status:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques de paiement' });
    }
});

/**
 * GET /api/stats/categories-list
 * Récupère la liste des catégories disponibles
 */
app.get('/api/stats/categories-list', requireLogin, requireAdmin, requirePermission('stats'), async (req, res) => {
    try {
        const categories = await statsService.getAvailableCategories();
        res.json(categories);
    } catch (error) {
        console.error('❌ Erreur /api/stats/categories-list:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
    }
});

/**
 * GET /api/stats/category-details
 * Récupère les statistiques détaillées par catégorie
 */
app.get('/api/stats/category-details', requireLogin, requireAdmin, requirePermission('stats'), async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const categoryDetails = await statsService.getCategoryDetails(year);
        res.json(categoryDetails);
    } catch (error) {
        console.error('❌ Erreur /api/stats/category-details:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des détails par catégorie' });
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