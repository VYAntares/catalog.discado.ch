require('dotenv').config();

const express = require('express');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Import services
const userService = require('./services/userService');
const orderService = require('./services/orderService');
const productService = require('./services/productService');
const invoiceService = require('./services/invoiceService');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure express-session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'discado-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'strict'
  }
}));

// Middleware for checking login
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

// Middleware for admin access
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).send('Access denied');
}

// Middleware for complete profile
function requireCompleteProfile(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  if (req.session.user.role === 'admin') {
    return next(); // Admins don't need complete profiles
  }
  
  if (!userService.isProfileComplete(req.session.user.username)) {
    return res.redirect('/profile');
  }
  
  next();
}

// Only serve the login page and index.html from public root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pages/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

// Serve non-sensitive static assets without authentication
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/fonts', express.static(path.join(__dirname, 'public/fonts')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/components', express.static(path.join(__dirname, 'public/components')));

// Configure ES6 modules for admin JS files
app.use('/admin/js', (req, res, next) => {
  // Serve JS files with appropriate Content-Type header for ES modules
  if (req.path.endsWith('.js')) {
    res.set('Content-Type', 'application/javascript; charset=UTF-8');
  }
  next();
});

// Admin static files (protected by requireAdmin middleware later for admin routes)
app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));
app.use('/admin/js', express.static(path.join(__dirname, 'admin/js')));

app.use('/pages/', (req, res, next) => {
  const requestPath = req.path;
  
  if (requestPath === '/login.html') {
    return next();
  }
  
  // Require authentication for all other pages
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  // Continue for authenticated users
  next();
});

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Check database for user
  const user = userService.getUser(username);
  
  if (user && user.password === password) {
    req.session.user = user;
    
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
    // Remplacer cette section qui vérifie allowedUsers
    // Par un simple message d'erreur
    return res.status(401).send('Invalid credentials. <a href="/">Try again</a>');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send('Error during logout');
    res.redirect('/');
  });
});

// Protected routes - With proper middleware
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

// Protected client routes - All with requireLogin
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

// API routes for checking authentication
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

// API routes for user profile
app.get('/api/user-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profile = userService.getUserProfile(userId);
  res.json(profile || {});
});

/**
 * Route pour sauvegarder le profil utilisateur et gérer le changement de mot de passe
 * Gère à la fois la mise à jour du profil et le changement de mot de passe si nécessaire
 */
app.post('/api/save-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profileData = req.body;
  
  try {
    console.log(`Traitement de la sauvegarde de profil pour l'utilisateur: ${userId}`);
    
    // Vérifier si une demande de changement de mot de passe est incluse
    if (profileData.passwordChange) {
      console.log('Demande de changement de mot de passe détectée');
      
      const { currentPassword, newPassword } = profileData.passwordChange;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Données de mot de passe incomplètes'
        });
      }
      
      // Vérifier que le mot de passe actuel est correct
      const user = userService.getUser(userId);
      
      if (!user) {
        console.error(`Utilisateur ${userId} non trouvé dans la base de données`);
        return res.status(404).json({
          success: false, 
          message: 'Utilisateur non trouvé'
        });
      }
      
      if (user.password !== currentPassword) {
        console.log(`Tentative de changement de mot de passe avec un mot de passe actuel incorrect pour ${userId}`);
        return res.status(401).json({
          success: false, 
          message: 'Le mot de passe actuel est incorrect'
        });
      }
      
      // Mettre à jour le mot de passe
      try {
        // Utiliser le service utilisateur pour mettre à jour le mot de passe
        const updateResult = userService.updateUserPassword(userId, newPassword);
        
        if (!updateResult) {
          throw new Error('Échec de la mise à jour du mot de passe');
        }
        
        console.log(`Mot de passe mis à jour avec succès pour l'utilisateur ${userId}`);
        
        // Mettre à jour également l'utilisateur dans la session
        if (req.session.user) {
          req.session.user.password = newPassword;
        }
        
        // Supprimer les données de mot de passe du profil pour ne pas les stocker
        delete profileData.passwordChange;
      } catch (pwError) {
        console.error(`Erreur lors de la mise à jour du mot de passe pour ${userId}:`, pwError);
        return res.status(500).json({ 
          success: false, 
          message: `Erreur lors de la mise à jour du mot de passe: ${pwError.message}`,
          error: pwError.message
        });
      }
    }
    
    // Validation des données du profil (facultatif mais recommandé)
    if (!profileData.firstName || !profileData.lastName || !profileData.email) {
      return res.status(400).json({
        success: false,
        message: 'Les champs obligatoires du profil sont manquants'
      });
    }
    
    // Continuer avec la sauvegarde normale du profil
    console.log(`Sauvegarde du profil pour l'utilisateur ${userId}`);
    const result = userService.saveUserProfile(profileData, userId);
    
    if (!result) {
      throw new Error('Échec de la sauvegarde du profil');
    }
    
    // Vérifier si le profil est complet
    const isComplete = userService.isProfileComplete(userId);
    
    // Récupérer le profil mis à jour pour vérification
    const updatedProfile = userService.getUserProfile(userId);
    
    // Réponse améliorée avec plus de détails
    res.json({ 
      success: true,
      passwordSameAsUsername: result.passwordSameAsUsername, // Ajouter cet attribut
      message: result.message, // Utiliser le message provenant du résultat 
      passwordChanged: profileData.passwordChange !== undefined,
      isProfileComplete: result.isProfileComplete,
      profile: updatedProfile,
      shouldRedirect: result.shouldRedirect, // Ceci sera false si passwordSameAsUsername est true
      redirectUrl: result.shouldRedirect ? '/pages/catalog.html' : null
    });
    
    console.log(`Profil sauvegardé avec succès pour l'utilisateur ${userId}`);
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde du profil pour ${userId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la sauvegarde du profil: ${error.message}`,
      error: error.message
    });
  }
});

// API route for getting products - ALSO REQUIRES LOGIN
app.get('/api/products', requireLogin, async (req, res) => {
  try {
    const products = await productService.getProducts();
    res.json(products);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: 'Error getting products' });
  }
});

app.post('/api/save-order', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const cartItems = req.body.items;
  const reference = req.body.reference || ''; // Ajout de cette ligne pour récupérer la référence
  
  try {
    // Passage de la référence au service de commande
    const result = orderService.saveOrder(userId, cartItems, reference);
    res.json(result);
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ success: false, message: 'Error saving order' });
  }
});

// API route for getting user orders
app.get('/api/user-orders', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  
  try {
    const orders = orderService.getUserOrders(userId);
    res.json(orders);
  } catch (error) {
    console.error('Error getting user orders:', error);
    res.status(500).json({ error: 'Error getting user orders' });
  }
});

// Admin API routes
app.get('/api/admin/pending-orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const pendingOrders = orderService.getPendingOrders();
    res.json(pendingOrders);
  } catch (error) {
    console.error('Error getting pending orders:', error);
    res.status(500).json({ error: 'Error getting pending orders' });
  }
});

app.get('/api/admin/treated-orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const treatedOrders = orderService.getTreatedOrders();
    res.json(treatedOrders);
  } catch (error) {
    console.error('Error getting treated orders:', error);
    res.status(500).json({ error: 'Error getting treated orders' });
  }
});

app.get('/api/admin/client-profiles', requireLogin, requireAdmin, (req, res) => {
  try {
    const profiles = userService.getAllClientProfiles();
    res.json(profiles);
  } catch (error) {
    console.error('Error getting client profiles:', error);
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
    console.error('Error getting client profile:', error);
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
    console.error('Error processing order:', error);
    res.status(500).json({ error: 'Error processing order' });
  }
});

app.get('/api/admin/order-details/:orderId/:userId', requireLogin, requireAdmin, (req, res) => {
  const { orderId, userId } = req.params;
  
  try {
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    res.json(orderDetails);
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({ error: 'Error getting order details' });
  }
});

app.get('/api/admin/client-orders/:clientId', requireLogin, requireAdmin, (req, res) => {
  const clientId = req.params.clientId;
  
  try {
    const orders = orderService.getUserOrders(clientId);
    res.json(orders);
  } catch (error) {
    console.error('Error getting client orders:', error);
    res.status(500).json({ error: 'Error getting client orders' });
  }
});

// Route pour télécharger la facture (client)
app.get('/api/download-invoice/:orderId', requireLogin, async (req, res) => {
  const userId = req.session.user.username;
  const orderId = req.params.orderId;
  
  try {
    // Get order details
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    
    // Get user profile
    const userProfile = userService.getUserProfile(userId);
    
    if (!orderDetails || !userProfile) {
      return res.status(404).json({ error: 'Order or user profile not found' });
    }
    
    // Check if order has delivered items
    if (orderDetails.status !== 'completed' && orderDetails.status !== 'partial' && 
        (!orderDetails.deliveredItems || orderDetails.deliveredItems.length === 0)) {
      return res.status(403).json({ 
        error: 'This order has not been delivered yet. No invoice available.' 
      });
    }
    
    // Get delivered items
    const orderItems = orderDetails.deliveredItems || orderDetails.items;
    const orderDate = new Date(orderDetails.lastProcessed || orderDetails.date);
    const remainingItems = orderDetails.remainingItems || [];
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${userId}_${orderId}.pdf`);
    
    // Pipe to response
    doc.pipe(res);
    
    // NOUVEAU CODE: Générer d'abord le bon de livraison, puis la facture
    // Importer les deux services
    const deliveryNoteService = require('./services/deliveryNoteService');
    const invoiceService = require('./services/invoiceService');
    
    // 1. Générer le bon de livraison (sans section facture)
    await deliveryNoteService.generateDeliveryNotePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems, false);
    
    // 2. Générer la facture sur une nouvelle page (elle ajoutera sa propre page)
    await invoiceService.generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

// Faire la même chose pour la route admin:
app.get('/api/admin/download-invoice/:orderId/:userId', requireLogin, requireAdmin, async (req, res) => {
  const { orderId, userId } = req.params;
  
  try {
    // Get order details
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    
    // Get user profile
    const userProfile = userService.getUserProfile(userId);
    
    if (!orderDetails || !userProfile) {
      return res.status(404).json({ error: 'Order or user profile not found' });
    }
    
    // Check if order has delivered items
    if (orderDetails.status !== 'completed' && orderDetails.status !== 'partial' && 
        (!orderDetails.deliveredItems || orderDetails.deliveredItems.length === 0)) {
      return res.status(403).json({ 
        error: 'This order has not been delivered yet. No invoice available.' 
      });
    }
    
    // Get delivered items
    const orderItems = orderDetails.deliveredItems || orderDetails.items;
    const orderDate = new Date(orderDetails.lastProcessed || orderDetails.date);
    const remainingItems = orderDetails.remainingItems || [];
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${userId}_${orderId}.pdf`);
    
    // Pipe to response
    doc.pipe(res);
    
    // NOUVEAU CODE: Générer d'abord le bon de livraison, puis la facture
    // Importer les deux services
    const deliveryNoteService = require('./services/deliveryNoteService');
    const invoiceService = require('./services/invoiceService');
    
    // 1. Générer le bon de livraison (sans section facture)
    await deliveryNoteService.generateDeliveryNotePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems, false);
    
    // 2. Générer la facture sur une nouvelle page (elle ajoutera sa propre page)
    await invoiceService.generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

// Route for creating a new client account (admin only)
app.post('/api/admin/create-client', requireLogin, requireAdmin, (req, res) => {
  const { username, password, profileData } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Nom d\'utilisateur et mot de passe requis' 
    });
  }
  
  try {
    // Check if user already exists
    const existingUser = userService.getUser(username);
    
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Ce nom d\'utilisateur existe déjà' 
      });
    }
    
    // Create user
    userService.createUser(username, password, 'client');
    
    // Create profile if data is provided
    if (profileData) {
      userService.saveUserProfile(profileData, username);
    }
    
    res.json({ 
      success: true, 
      message: 'Client créé avec succès',
      username
    });
  } catch (error) {
    console.error('Erreur lors de la création du client:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création du client'
    });
  }
});

app.post('/api/admin/create-order-from-pending', requireLogin, requireAdmin, (req, res) => {
  const { userId, items } = req.body;
  
  try {
      const result = orderService.createOrderFromPendingItems(userId, items);
      res.json(result);
  } catch (error) {
      console.error('Error creating order from pending items:', error);
      res.status(500).json({ success: false, message: 'Error creating order' });
  }
});

// Route pour supprimer des articles en attente (dans la section des API routes admin)
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
    console.error('Error deleting pending items:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des articles: ' + error.message
    });
  }
});

// Route pour changer le mot de passe utilisateur
app.post('/api/change-password', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const { currentPassword, newPassword } = req.body;
  
  try {
    // Vérifier que le mot de passe actuel est correct
    const user = userService.getUser(userId);
    
    if (!user || user.password !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: 'Mot de passe actuel incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }
    
    // Mettre à jour le mot de passe
    const result = userService.updateUserPassword(userId, newPassword);
    
    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du mot de passe',
      error: error.message
    });
  }
});

// Catch-all route - Redirect to login for unauthorized users
app.get('*', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  // For authenticated users, try to serve the file or send 404
  res.status(404).send('Page not found. <a href="/">Return to homepage</a>');
});

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).send('Page not found. <a href="/">Return to homepage</a>');
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Server error occurred. Please try again later.');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on http://localhost:${PORT}`);
  console.log(`Available on network at http://172.20.10.3:${PORT}`);
});
