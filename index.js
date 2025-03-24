require('dotenv').config();

// ===== IMPORTATIONS =====
// Modules externes
const express = require('express');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Configuration et services
const keys = require('./config/keys');
const userService = require('./services/userService');
const orderService = require('./services/orderService');
const productService = require('./services/productService');
const invoiceService = require('./services/invoiceService');
const cryptoService = require('./services/cryptoService');
const deliveryNoteService = require('./services/deliveryNoteService');

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

// Configuration de la session
app.use(session({
  secret: keys.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'strict'
  }
}));

// ===== SYSTÈME DE SÉCURITÉ =====
// Gestion des tentatives de connexion
const loginAttempts = {};

// Fonction pour vérifier et gérer les tentatives de connexion
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
// Middleware pour vérifier la connexion
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

// Middleware pour l'accès administrateur
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).send('Access denied');
}

// Middleware pour vérifier que le profil est complet
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
// Pages d'accueil et de connexion
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pages/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

// ===== RESSOURCES STATIQUES =====
// Ressources publiques sans authentification
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/fonts', express.static(path.join(__dirname, 'public/fonts')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/components', express.static(path.join(__dirname, 'public/components')));

// Configuration des modules ES6 pour les fichiers admin JS
app.use('/admin/js', (req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.set('Content-Type', 'application/javascript; charset=UTF-8');
  }
  next();
});

// Ressources admin
app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));
app.use('/admin/js', express.static(path.join(__dirname, 'admin/js')));

// Protection des pages
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
// Route de login
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
      return res.redirect('/admin');
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

// Route de déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send('Error during logout');
    res.redirect('/');
  });
});

// ===== ROUTES ADMINISTRATEUR PROTÉGÉES =====
app.get('/admin', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/orders', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'orders.html'));
});

app.get('/admin/clients', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'clients.html'));
});

app.get('/admin/order-history', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'order-history.html'));
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
// Vérification de l'authentification
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
// Récupération du profil utilisateur
app.get('/api/user-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profile = userService.getUserProfile(userId);
  res.json(profile || {});
});

// Sauvegarde du profil utilisateur
app.post('/api/save-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profileData = req.body;
  
  try {
    // Vérifier si une demande de changement de mot de passe est incluse
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
    
    // Validation des données du profil
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

// Changement de mot de passe
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
// Récupération des produits
app.get('/api/products', requireLogin, async (req, res) => {
  try {
    const products = await productService.getProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Error getting products' });
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
// Commandes en attente
app.get('/api/admin/pending-orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const pendingOrders = orderService.getPendingOrders();
    res.json(pendingOrders);
  } catch (error) {
    res.status(500).json({ error: 'Error getting pending orders' });
  }
});

// Commandes traitées
app.get('/api/admin/treated-orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const treatedOrders = orderService.getTreatedOrders();
    res.json(treatedOrders);
  } catch (error) {
    res.status(500).json({ error: 'Error getting treated orders' });
  }
});

// Profils clients
app.get('/api/admin/client-profiles', requireLogin, requireAdmin, (req, res) => {
  try {
    const profiles = userService.getAllClientProfiles();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: 'Error getting client profiles' });
  }
});

// Profil client spécifique
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

// Traitement de commande
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

// Détails de commande
app.get('/api/admin/order-details/:orderId/:userId', requireLogin, requireAdmin, (req, res) => {
  const { orderId, userId } = req.params;
  
  try {
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    res.json(orderDetails);
  } catch (error) {
    res.status(500).json({ error: 'Error getting order details' });
  }
});

// Commandes d'un client
app.get('/api/admin/client-orders/:clientId', requireLogin, requireAdmin, (req, res) => {
  const clientId = req.params.clientId;
  
  try {
    const orders = orderService.getUserOrders(clientId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error getting client orders' });
  }
});

// Téléchargement de facture (admin)
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

// Création d'un compte client
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

// Création de commande à partir d'articles en attente
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

// Suppression d'articles en attente
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

// ===== ROUTES DE GESTION DES ERREURS =====
// Route catch-all
app.get('*', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.status(404).send('Page not found. <a href="/">Return to homepage</a>');
});

// Middleware de gestion des erreurs
app.use((req, res, next) => {
  res.status(404).send('Page not found. <a href="/">Return to homepage</a>');
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Server error occurred. Please try again later.');
});

// ===== DÉMARRAGE DU SERVEUR =====
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server started on http://localhost:${PORT}`);
});