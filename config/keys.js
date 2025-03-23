// config/keys.js
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Fonction pour générer une clé de chiffrement aléatoire
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex'); // 32 octets = 256 bits
}

// Fonction pour générer un vecteur d'initialisation aléatoire
function generateIV() {
  return crypto.randomBytes(16).toString('hex'); // 16 octets = 128 bits
}

// Chemin vers le fichier .env
const envFilePath = path.join(process.cwd(), '.env');

// Vérifier si les clés existent déjà dans le fichier .env
function ensureKeysExist() {
  let envContent = '';
  let needsUpdate = false;
  
  try {
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
    }
  } catch (err) {
    console.log('Création d\'un nouveau fichier .env');
  }

  // Vérifier et ajouter la clé de chiffrement si nécessaire
  if (!process.env.ENCRYPTION_KEY) {
    const key = generateEncryptionKey();
    process.env.ENCRYPTION_KEY = key;
    
    if (!envContent.includes('ENCRYPTION_KEY=')) {
      envContent += `\nENCRYPTION_KEY=${key}`;
      needsUpdate = true;
    }
  }

  // Vérifier et ajouter le vecteur d'initialisation si nécessaire
  if (!process.env.ENCRYPTION_IV) {
    const iv = generateIV();
    process.env.ENCRYPTION_IV = iv;
    
    if (!envContent.includes('ENCRYPTION_IV=')) {
      envContent += `\nENCRYPTION_IV=${iv}`;
      needsUpdate = true;
    }
  }

  // Vérifier et ajouter la clé secrète pour les sessions si nécessaire
  if (!process.env.SECRET_KEY) {
    const secret = crypto.randomBytes(32).toString('hex');
    process.env.SECRET_KEY = secret;
    
    if (!envContent.includes('SECRET_KEY=')) {
      envContent += `\nSECRET_KEY=${secret}`;
      needsUpdate = true;
    }
  }

  // Mettre à jour le fichier .env si nécessaire
  if (needsUpdate) {
    fs.writeFileSync(envFilePath, envContent.trim());
    console.log('Fichier .env mis à jour avec de nouvelles clés de sécurité.');
  }
}

// Exécuter la vérification lors de l'initialisation
ensureKeysExist();

// Exporter les clés pour utilisation dans l'application
module.exports = {
  ENCRYPTION_KEY: Buffer.from(process.env.ENCRYPTION_KEY || generateEncryptionKey(), 'hex'),
  ENCRYPTION_IV: Buffer.from(process.env.ENCRYPTION_IV || generateIV(), 'hex'),
  SECRET_KEY: process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex')
};