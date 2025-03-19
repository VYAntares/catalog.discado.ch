// userService.js - Handle user and profile operations
const dbModule = require('./db');

// Service for managing users and profiles
const userService = {
    // Get a user by username
    getUser(username) {
        return dbModule.getUserByUsername.get(username);
    },
    
    // Get all users
    getAllUsers() {
        return dbModule.getAllUsers.all();
    },
    
    // Create a new user
    createUser(username, password, role) {
        try {
            return dbModule.createUser.run(username, password, role);
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    },
    
    // Get user profile
    getUserProfile(username) {
        try {
            // Get profile from database
            const profile = dbModule.getUserProfile.get(username);
            
            if (profile) {
                // Format profile to match expected structure
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
                    referralSource: profile.referral_source || '', // Gestion de valeur null/undefined
                    lastUpdated: profile.last_updated
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    },
    
    // Vérifier si le mot de passe est identique au nom d'utilisateur
    isPasswordSameAsUsername(username) {
        try {
            // Récupérer l'utilisateur 
            const user = this.getUser(username);
            
            if (!user) {
                return false;
            }
            
            // Vérifier si le mot de passe est identique au nom d'utilisateur
            return user.password === username;
            
        } catch (error) {
            console.error('Erreur lors de la vérification du mot de passe:', error);
            return false;
        }
    },
    
    // Sauvegarder le profil utilisateur
    saveUserProfile(profileData, username) {
        try {
            // Vérifier si le mot de passe est identique au nom d'utilisateur
            const isPasswordWeak = this.isPasswordSameAsUsername(username);
            
            // Normaliser les données
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
            
            // Vérifier si le profil existe déjà
            const existingProfile = dbModule.getUserProfile.get(username);
            
            if (existingProfile) {
                // Mise à jour du profil existant
                try {
                    // Vérifier si la colonne referral_source existe
                    const hasReferralSource = dbModule.columnExists('user_profiles', 'referral_source');
                    
                    if (hasReferralSource) {
                        // Utiliser la requête avec referral_source
                        dbModule.updateUserProfile.run(
                            normalizedData.firstName,
                            normalizedData.lastName,
                            normalizedData.email,
                            normalizedData.phone,
                            normalizedData.shopName,
                            normalizedData.shopAddress,
                            normalizedData.shopCity,
                            normalizedData.shopZipCode,
                            normalizedData.referralSource,
                            normalizedData.lastUpdated,
                            username
                        );
                    } else {
                        // Utiliser la requête de secours sans referral_source
                        dbModule.fallbackUpdateUserProfile.run(
                            normalizedData.firstName,
                            normalizedData.lastName,
                            normalizedData.email,
                            normalizedData.phone,
                            normalizedData.shopName,
                            normalizedData.shopAddress,
                            normalizedData.shopCity,
                            normalizedData.shopZipCode,
                            normalizedData.lastUpdated,
                            username
                        );
                    }
                } catch (updateError) {
                    console.error('Erreur lors de la mise à jour du profil:', updateError);
                    
                    // Tentative avec la requête de secours
                    dbModule.fallbackUpdateUserProfile.run(
                        normalizedData.firstName,
                        normalizedData.lastName,
                        normalizedData.email,
                        normalizedData.phone,
                        normalizedData.shopName,
                        normalizedData.shopAddress,
                        normalizedData.shopCity,
                        normalizedData.shopZipCode,
                        normalizedData.lastUpdated,
                        username
                    );
                }
            } else {
                // Création d'un nouveau profil
                try {
                    // Vérifier si la colonne referral_source existe
                    const hasReferralSource = dbModule.columnExists('user_profiles', 'referral_source');
                    
                    if (hasReferralSource) {
                        // Utiliser la requête avec referral_source
                        dbModule.createUserProfile.run(
                            username,
                            normalizedData.firstName,
                            normalizedData.lastName,
                            normalizedData.email,
                            normalizedData.phone,
                            normalizedData.shopName,
                            normalizedData.shopAddress,
                            normalizedData.shopCity,
                            normalizedData.shopZipCode,
                            normalizedData.referralSource,
                            normalizedData.lastUpdated
                        );
                    } else {
                        // Utiliser la requête de secours sans referral_source
                        dbModule.fallbackCreateUserProfile.run(
                            username,
                            normalizedData.firstName,
                            normalizedData.lastName,
                            normalizedData.email,
                            normalizedData.phone,
                            normalizedData.shopName,
                            normalizedData.shopAddress,
                            normalizedData.shopCity,
                            normalizedData.shopZipCode,
                            normalizedData.lastUpdated
                        );
                    }
                } catch (createError) {
                    console.error('Erreur lors de la création du profil:', createError);
                    
                    // Tentative avec la requête de secours
                    dbModule.fallbackCreateUserProfile.run(
                        username,
                        normalizedData.firstName,
                        normalizedData.lastName,
                        normalizedData.email,
                        normalizedData.phone,
                        normalizedData.shopName,
                        normalizedData.shopAddress,
                        normalizedData.shopCity,
                        normalizedData.shopZipCode,
                        normalizedData.lastUpdated
                    );
                }
            }
            
            // Gérer le changement de mot de passe si demandé
            let passwordChanged = false;
            if (profileData.passwordChange && profileData.passwordChange.newPassword) {
                try {
                    // Vérifier que le mot de passe actuel est correct
                    const user = this.getUser(username);
                    if (!user || user.password !== profileData.passwordChange.currentPassword) {
                        return { 
                            success: false,
                            code: 'INVALID_CURRENT_PASSWORD',
                            message: 'Le mot de passe actuel est incorrect',
                            shouldRedirect: false
                        };
                    }
                    
                    // Mettre à jour le mot de passe
                    this.updateUserPassword(username, profileData.passwordChange.newPassword);
                    passwordChanged = true;
                } catch (passwordError) {
                    console.error('Erreur lors de la mise à jour du mot de passe:', passwordError);
                    // Continuer malgré l'erreur de mot de passe
                }
            }
            
            // Vérifier si le profil est complet après la sauvegarde
            const isComplete = this.isProfileComplete(username);
            
            // Récupérer le profil mis à jour
            const savedProfile = this.getUserProfile(username);
            
            return { 
                success: true,
                isProfileComplete: isComplete,
                shouldRedirect: !isPasswordWeak, // Ne pas rediriger si le mot de passe est faible
                passwordSameAsUsername: isPasswordWeak && !passwordChanged,
                profile: savedProfile,
                message: isPasswordWeak && !passwordChanged ? 
                    'Profil sauvegardé. Veuillez changer votre mot de passe.' : 
                    'Profil sauvegardé avec succès'
            };
        } catch (error) {
            console.error('Error saving user profile:', error);
            throw error;
        }
    },
    
    // Get all client profiles (for admin)
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
                referralSource: profile.referral_source || '', // Gestion de valeur null/undefined
                lastUpdated: profile.last_updated
            }));
        } catch (error) {
            console.error('Error getting all client profiles:', error);
            return []; 
        }
    },
    
    // Check if profile is complete
    isProfileComplete(username) {
        const profile = this.getUserProfile(username);
        
        if (!profile) {
            return false;
        }
        
        const requiredFields = [
            'firstName', 'lastName', 'email', 'phone', 
            'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
        ];
        
        // Check if all required fields have valid values
        return requiredFields.every(field => 
            profile[field] && profile[field].trim() !== ''
        );
    },

    // Mise à jour du mot de passe utilisateur
    updateUserPassword(username, newPassword) {
        try {
            // 1. Vérifier si l'utilisateur existe
            const user = this.getUser(username);
            
            if (!user) {
                console.error(`Utilisateur ${username} non trouvé lors de la mise à jour du mot de passe`);
                throw new Error('Utilisateur non trouvé');
            }
            
            // 2. Vérifier s'il y a des doublons d'utilisateurs (problème potentiel)
            const db = dbModule.db;
            const duplicates = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get(username);
            
            if (duplicates && duplicates.count > 1) {
                console.warn(`ATTENTION: ${duplicates.count} entrées trouvées pour l'utilisateur ${username}`);
                
                // 2a. Nettoyage - supprimer les entrées dupliquées (optionnel mais recommandé)
                db.prepare('DELETE FROM users WHERE username = ? AND rowid NOT IN (SELECT MIN(rowid) FROM users WHERE username = ?)').run(username, username);
                console.log(`Nettoyage effectué: entrées dupliquées pour ${username} supprimées`);
            }
            
            // 3. Mise à jour du mot de passe avec journalisation détaillée
            console.log(`Début de mise à jour du mot de passe pour ${username}`);
            const updateStmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
            const updateResult = updateStmt.run(newPassword, username);
            
            console.log(`Résultat de la mise à jour: ${updateResult.changes} ligne(s) modifiée(s)`);
            
            if (!updateResult || updateResult.changes === 0) {
                throw new Error('Aucune ligne mise à jour dans la base de données');
            }
            
            // 4. Vérification que le mot de passe a bien été mis à jour
            const updatedUser = this.getUser(username);
            if (!updatedUser || updatedUser.password !== newPassword) {
                console.error('Échec de vérification du mot de passe après mise à jour');
                throw new Error('Le mot de passe n\'a pas été correctement mis à jour');
            }
            
            // 5. Nettoyage du cache de session si applicable
            if (global.sessionCache && global.sessionCache[username]) {
                delete global.sessionCache[username];
                console.log(`Cache de session nettoyé pour ${username}`);
            }
            
            console.log(`Mot de passe mis à jour avec succès pour ${username}`);
            return true;
        } catch (error) {
            console.error(`Erreur critique lors de la mise à jour du mot de passe pour ${username}:`, error);
            throw error;
        }
    }
};

module.exports = userService;