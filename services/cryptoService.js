// services/cryptoService.js
// Service de cryptographie pour Discado
const crypto = require('crypto');
const keys = require('../config/keys');

// Service cryptographique avec fonctions de chiffrement et hachage
const cryptoService = {
  // Chiffrement AES-256-CBC
  encrypt(text) {
    if (!text) return '';
    
    try {
      const cipher = crypto.createCipheriv('aes-256-cbc', keys.ENCRYPTION_KEY, keys.ENCRYPTION_IV);
      let encrypted = cipher.update(text.toString(), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      throw new Error('Échec du chiffrement des données');
    }
  },
  
  // Déchiffrement AES-256-CBC
  decrypt(encrypted) {
    if (!encrypted) return '';
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', keys.ENCRYPTION_KEY, keys.ENCRYPTION_IV);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error('Échec du déchiffrement des données');
    }
  },
  
  // Hachage de mot de passe avec salt aléatoire
  hashPassword(password) {
    try {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      return `${salt}:${hash}`;
    } catch (error) {
      throw new Error('Échec du hachage du mot de passe');
    }
  },
  
  // Vérification de mot de passe (compatible avec ancien système)
  verifyPassword(storedPassword, suppliedPassword) {
    try {
      // Pour mot de passe en texte clair (ancien système)
      if (!storedPassword.includes(':')) {
        return storedPassword === suppliedPassword;
      }
      
      // Pour mot de passe haché
      const [salt, storedHash] = storedPassword.split(':');
      const suppliedHash = crypto.pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512').toString('hex');
      return storedHash === suppliedHash;
    } catch (error) {
      return false;
    }
  },
  
  // Génération de token aléatoire
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
};

module.exports = cryptoService;