// config/keys.js
const crypto = require('crypto');

// Fonction pour générer une clé de chiffrement aléatoire
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex'); // 32 octets = 256 bits
}

// Fonction pour générer un vecteur d'initialisation aléatoire
function generateIV() {
  return crypto.randomBytes(16).toString('hex'); // 16 octets = 128 bits
}

// Fonction pour générer une clé secrète pour les sessions
function generateSecretKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Récupération des clés depuis les variables d'environnement ou génération de nouvelles clés
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || generateEncryptionKey();
const ENCRYPTION_IV = process.env.ENCRYPTION_IV || generateIV();
const SECRET_KEY = process.env.SECRET_KEY || generateSecretKey();

// Afficher les clés générées si elles n'existaient pas dans l'environnement
if (!process.env.ENCRYPTION_KEY) {
  console.log('⚠️ Clé de chiffrement non trouvée dans les variables d\'environnement. Clé générée automatiquement:');
  console.log(`   Pour la sécurité en production, définissez: export ENCRYPTION_KEY=${ENCRYPTION_KEY}`);
}

if (!process.env.ENCRYPTION_IV) {
  console.log('⚠️ Vecteur d\'initialisation non trouvé dans les variables d\'environnement. IV généré automatiquement:');
  console.log(`   Pour la sécurité en production, définissez: export ENCRYPTION_IV=${ENCRYPTION_IV}`);
}

if (!process.env.SECRET_KEY) {
  console.log('⚠️ Clé secrète de session non trouvée dans les variables d\'environnement. Clé générée automatiquement:');
  console.log(`   Pour la sécurité en production, définissez: export SECRET_KEY=${SECRET_KEY}`);
}

// Exporter les clés pour utilisation dans l'application
module.exports = {
  ENCRYPTION_KEY: Buffer.from(ENCRYPTION_KEY, 'hex'),
  ENCRYPTION_IV: Buffer.from(ENCRYPTION_IV, 'hex'),
  SECRET_KEY: SECRET_KEY
};