// services/cryptoService.js
const crypto = require('crypto');
const keys = require('../config/keys');

const cryptoService = {
  // Chiffrer une donnée
  encrypt(text) {
    if (!text) return '';
    
    try {
      const cipher = crypto.createCipheriv('aes-256-cbc', keys.ENCRYPTION_KEY, keys.ENCRYPTION_IV);
      let encrypted = cipher.update(text.toString(), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('Erreur de chiffrement:', error);
      throw new Error('Échec du chiffrement des données');
    }
  },
  
  // Déchiffrer une donnée
  decrypt(encrypted) {
    if (!encrypted) return '';
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', keys.ENCRYPTION_KEY, keys.ENCRYPTION_IV);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Erreur de déchiffrement:', error);
      // Ne pas exposer l'erreur détaillée à l'utilisateur
      throw new Error('Échec du déchiffrement des données');
    }
  },
  
  // Hacher un mot de passe avec salt
  hashPassword(password) {
    try {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      return `${salt}:${hash}`;
    } catch (error) {
      console.error('Erreur de hachage du mot de passe:', error);
      throw new Error('Échec du hachage du mot de passe');
    }
  },
  
  // Vérifier un mot de passe
  verifyPassword(storedPassword, suppliedPassword) {
    try {
      // Vérifier si c'est un mot de passe en texte clair (ancien système)
      if (!storedPassword.includes(':')) {
        return storedPassword === suppliedPassword;
      }
      
      // Vérifier un mot de passe haché
      const [salt, storedHash] = storedPassword.split(':');
      const suppliedHash = crypto.pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512').toString('hex');
      return storedHash === suppliedHash;
    } catch (error) {
      console.error('Erreur de vérification du mot de passe:', error);
      return false;
    }
  },
  
  // Générer un token aléatoire
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
};

module.exports = cryptoService;