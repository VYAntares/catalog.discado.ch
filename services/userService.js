// userService.js
// Service de gestion des utilisateurs et profils
const dbModule = require('./db');
const cryptoService = require('./cryptoService');

const userService = {
    // Récupération d'un utilisateur par son username
    getUser(username) {
        return dbModule.getUserByUsername.get(username);
    },
    
    // Récupération de tous les utilisateurs
    getAllUsers() {
        return dbModule.getAllUsers.all();
    },
    
    // Création d'un nouvel utilisateur avec mot de passe haché
    createUser(username, password, role) {
        try {
            const hashedPassword = cryptoService.hashPassword(password);
            return dbModule.createUser.run(username, hashedPassword, role);
        } catch (error) {
            throw error;
        }
    },
    
    // Récupération du profil utilisateur formaté
    getUserProfile(username) {
        try {
            const profile = dbModule.getUserProfile.get(username);
            
            if (profile) {
                return {
                    clientId: username,
                    firstName: profile.first_name,
                    lastName: profile.last_name,
                    fullName: `${profile.first_name} ${profile.last_name}`,
                    email: profile.email,
                    phone: profile.phone,
                    shopName: profile.shop_name,
                    shopAddress: profile.shop_address,
                    shopCity: profile.shop_city,
                    shopZipCode: profile.shop_zip_code,
                    referralSource: profile.referral_source || '',
                    lastUpdated: profile.last_updated
                };
            }
            
            return null;
        } catch (error) {
            return null;
        }
    },
    
    // Vérification si le mot de passe est identique au nom d'utilisateur
    isPasswordSameAsUsername(username) {
        try {
            const user = this.getUser(username);
            if (!user) return false;
            return cryptoService.verifyPassword(user.password, username);
        } catch (error) {
            return false;
        }
    },
    
    // Sauvegarde du profil utilisateur (création ou mise à jour)
    saveUserProfile(profileData, username) {
        try {
            const isPasswordWeak = this.isPasswordSameAsUsername(username);
            
            // Normalisation des données
            const normalizedData = {
                firstName: profileData.firstName || '',
                lastName: profileData.lastName || '',
                email: profileData.email || '',
                phone: profileData.phone || '',
                shopName: profileData.shopName || '',
                shopAddress: profileData.shopAddress || profileData.address || '',
                shopCity: profileData.shopCity || profileData.city || '',
                shopZipCode: profileData.shopZipCode || profileData.postalCode || '',
                referralSource: profileData.referralSource || '',
                lastUpdated: profileData.lastUpdated || new Date().toISOString()
            };
            
            const existingProfile = dbModule.getUserProfile.get(username);
            let passwordChanged = false;
            
            // Mise à jour ou création du profil
            if (existingProfile) {
                this._updateProfile(username, normalizedData);
            } else {
                this._createProfile(username, normalizedData);
            }
            
            // Gestion du changement de mot de passe
            if (profileData.passwordChange && profileData.passwordChange.newPassword) {
                try {
                    const user = this.getUser(username);
                    if (!user || user.password !== profileData.passwordChange.currentPassword) {
                        return { 
                            success: false,
                            code: 'INVALID_CURRENT_PASSWORD',
                            message: 'Le mot de passe actuel est incorrect',
                            shouldRedirect: false
                        };
                    }
                    
                    this.updateUserPassword(username, profileData.passwordChange.newPassword);
                    passwordChanged = true;
                } catch (passwordError) {
                    // Continuer malgré l'erreur
                }
            }
            
            const isComplete = this.isProfileComplete(username);
            const savedProfile = this.getUserProfile(username);
            
            return { 
                success: true,
                isProfileComplete: isComplete,
                shouldRedirect: !isPasswordWeak,
                passwordSameAsUsername: isPasswordWeak && !passwordChanged,
                profile: savedProfile,
                message: isPasswordWeak && !passwordChanged ? 
                    'Profil sauvegardé. Veuillez changer votre mot de passe.' : 
                    'Profil sauvegardé avec succès'
            };
        } catch (error) {
            throw error;
        }
    },
    
    // Mise à jour d'un profil existant
    _updateProfile(username, data) {
        try {
            const hasReferralSource = dbModule.columnExists('user_profiles', 'referral_source');
            
            if (hasReferralSource) {
                dbModule.updateUserProfile.run(
                    data.firstName, data.lastName, data.email, data.phone,
                    data.shopName, data.shopAddress, data.shopCity, data.shopZipCode,
                    data.referralSource, data.lastUpdated, username
                );
            } else {
                dbModule.fallbackUpdateUserProfile.run(
                    data.firstName, data.lastName, data.email, data.phone,
                    data.shopName, data.shopAddress, data.shopCity, data.shopZipCode,
                    data.lastUpdated, username
                );
            }
        } catch (error) {
            // Tentative de secours sans referral_source
            dbModule.fallbackUpdateUserProfile.run(
                data.firstName, data.lastName, data.email, data.phone,
                data.shopName, data.shopAddress, data.shopCity, data.shopZipCode,
                data.lastUpdated, username
            );
        }
    },
    
    // Création d'un nouveau profil
    _createProfile(username, data) {
        try {
            const hasReferralSource = dbModule.columnExists('user_profiles', 'referral_source');
            
            if (hasReferralSource) {
                dbModule.createUserProfile.run(
                    username, data.firstName, data.lastName, data.email, 
                    data.phone, data.shopName, data.shopAddress, data.shopCity, 
                    data.shopZipCode, data.referralSource, data.lastUpdated
                );
            } else {
                dbModule.fallbackCreateUserProfile.run(
                    username, data.firstName, data.lastName, data.email, 
                    data.phone, data.shopName, data.shopAddress, data.shopCity, 
                    data.shopZipCode, data.lastUpdated
                );
            }
        } catch (error) {
            // Tentative de secours sans referral_source
            dbModule.fallbackCreateUserProfile.run(
                username, data.firstName, data.lastName, data.email, 
                data.phone, data.shopName, data.shopAddress, data.shopCity, 
                data.shopZipCode, data.lastUpdated
            );
        }
    },
    
    // Récupération de tous les profils clients (pour admin)
    getAllClientProfiles() {
        try {
            const profiles = dbModule.getAllProfiles.all();
            
            return profiles.map(profile => ({
                clientId: profile.username,
                firstName: profile.first_name,
                lastName: profile.last_name,
                fullName: `${profile.first_name} ${profile.last_name}`,
                email: profile.email,
                phone: profile.phone,
                shopName: profile.shop_name,
                shopAddress: profile.shop_address,
                shopCity: profile.shop_city,
                shopZipCode: profile.shop_zip_code,
                referralSource: profile.referral_source || '',
                lastUpdated: profile.last_updated
            }));
        } catch (error) {
            return []; 
        }
    },
    
    // Vérification si un profil est complet (tous champs obligatoires)
    isProfileComplete(username) {
        const profile = this.getUserProfile(username);
        
        if (!profile) return false;
        
        const requiredFields = [
            'firstName', 'lastName', 'email', 'phone', 
            'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
        ];
        
        return requiredFields.every(field => 
            profile[field] && profile[field].trim() !== ''
        );
    },

    // Mise à jour du mot de passe utilisateur
    updateUserPassword(username, newPassword) {
        try {
            const user = this.getUser(username);
            if (!user) throw new Error('Utilisateur non trouvé');
            
            // Nettoyage des doublons éventuels
            const db = dbModule.db;
            const duplicates = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get(username);
            
            if (duplicates && duplicates.count > 1) {
                db.prepare('DELETE FROM users WHERE username = ? AND rowid NOT IN (SELECT MIN(rowid) FROM users WHERE username = ?)').run(username, username);
            }
            
            // Hachage et mise à jour du mot de passe
            const hashedPassword = cryptoService.hashPassword(newPassword);
            const updateStmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
            const updateResult = updateStmt.run(hashedPassword, username);
            
            if (!updateResult || updateResult.changes === 0) {
                throw new Error('Aucune ligne mise à jour dans la base de données');
            }
            
            // Vérification et nettoyage du cache
            const updatedUser = this.getUser(username);
            if (!updatedUser) {
                throw new Error('L\'utilisateur n\'a pas été correctement mis à jour');
            }
            
            // Nettoyage du cache de session si présent
            if (global.sessionCache && global.sessionCache[username]) {
                delete global.sessionCache[username];
            }
            
            return true;
        } catch (error) {
            throw error;
        }
    },

    // Validation de la force du mot de passe
    validatePasswordStrength(password) {
        const criteria = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };
        
        return Object.values(criteria).every(valid => valid);
    }
};

module.exports = userService;