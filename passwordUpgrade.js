// passwordUpgrade.js
// Script pour hacher les mots de passe en texte clair dans la base de données
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Configuration des clés de cryptage (extraites des variables d'environnement PM2)
const ENCRYPTION_KEY = '3b03a304cd946527ab80f071cfb1fe77f3a2c969b947550c2a8e01de6887854b';
const ENCRYPTION_IV = 'f88c3c866f2a940368c22b890ab675b4';

// Fonctions de cryptographie (reproduites depuis cryptoService.js)
const cryptoService = {
  hashPassword(password) {
    try {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      return `${salt}:${hash}`;
    } catch (error) {
      throw new Error('Échec du hachage du mot de passe');
    }
  },
  
  isPasswordHashed(storedPassword) {
    return storedPassword && storedPassword.includes(':');
  }
};

// Chemin de la base de données
const dbPath = path.join(__dirname, 'database', 'discado.db');

// Vérification de l'existence de la base de données
if (!fs.existsSync(dbPath)) {
  console.error(`Erreur: La base de données n'existe pas à l'emplacement ${dbPath}`);
  process.exit(1);
}

// Création d'une sauvegarde de la base de données
const backupPath = path.join(__dirname, 'database', `discado_backup_${Date.now()}.db`);
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Sauvegarde de la base de données créée: ${backupPath}`);
} catch (error) {
  console.error(`❌ Erreur lors de la création de la sauvegarde: ${error.message}`);
  process.exit(1);
}

// Connexion à la base de données
let db;
try {
  db = new Database(dbPath);
  console.log('✅ Connexion à la base de données établie avec succès');
} catch (error) {
  console.error(`❌ Erreur de connexion à la base de données: ${error.message}`);
  process.exit(1);
}

// Fonction principale pour mettre à jour les mots de passe
function upgradePasswords() {
  console.log('🔐 MISE À NIVEAU DES MOTS DE PASSE 🔐');
  console.log('====================================\n');
  
  try {
    // Récupération de tous les utilisateurs
    const users = db.prepare('SELECT username, password, role FROM users').all();
    console.log(`Nombre total d'utilisateurs: ${users.length}`);
    
    // Compteurs pour le suivi
    let updatedCount = 0;
    let alreadyHashedCount = 0;
    let errorCount = 0;
    
    // Préparation de la requête de mise à jour
    const updatePasswordStmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
    
    // Début de la transaction
    const transaction = db.transaction(() => {
      for (const user of users) {
        const { username, password, role } = user;
        
        // Vérifier si le mot de passe est déjà haché
        if (cryptoService.isPasswordHashed(password)) {
          console.log(`[IGNORÉ] Le mot de passe de l'utilisateur ${username} est déjà haché`);
          alreadyHashedCount++;
          continue;
        }
        
        try {
          // Hachage du mot de passe
          const hashedPassword = cryptoService.hashPassword(password);
          
          // Mise à jour dans la base de données
          updatePasswordStmt.run(hashedPassword, username);
          
          if (role === 'admin') {
            console.log(`[ADMIN] Mot de passe mis à jour pour l'administrateur ${username}`);
          } else {
            console.log(`[CLIENT] Mot de passe mis à jour pour ${username}`);
          }
          
          updatedCount++;
        } catch (error) {
          console.error(`[ERREUR] Échec de la mise à jour du mot de passe pour ${username}: ${error.message}`);
          errorCount++;
        }
      }
    });
    
    // Exécution de la transaction
    transaction();
    
    // Affichage du résumé
    console.log('\n===== RÉSUMÉ DE LA MISE À JOUR =====');
    console.log(`Total des utilisateurs: ${users.length}`);
    console.log(`Mots de passe mis à jour: ${updatedCount}`);
    console.log(`Mots de passe déjà hachés: ${alreadyHashedCount}`);
    console.log(`Erreurs rencontrées: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  ATTENTION: Des erreurs ont été rencontrées lors de la mise à jour.');
      console.log(`Une sauvegarde de la base de données a été créée à: ${backupPath}`);
    } else {
      console.log('\n✅ Tous les mots de passe ont été mis à jour avec succès!');
      console.log(`Une sauvegarde de la base de données originale a été créée à: ${backupPath}`);
    }
    
  } catch (error) {
    console.error(`Erreur générale lors de la mise à jour des mots de passe: ${error.message}`);
  } finally {
    // Fermeture de la connexion à la base de données
    if (db) {
      db.close();
      console.log('Connexion à la base de données fermée');
    }
  }
}

// Exécution du script
upgradePasswords();