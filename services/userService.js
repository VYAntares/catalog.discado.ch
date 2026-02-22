// services/userService.js
// userService.js
// User and profile management service
const dbModule = require('./db');
const cryptoService = require('./cryptoService');

const userService = {
    // Get a user by username
    getUser(username) {
        return dbModule.getUserByUsername.get(username);
    },
    
    // Get all users
    getAllUsers() {
        return dbModule.getAllUsers.all();
    },
    
    // Create a new user with hashed password
    createUser(username, password, role) {
        try {
            const hashedPassword = cryptoService.hashPassword(password);
            return dbModule.createUser.run(username, hashedPassword, role);
        } catch (error) {
            throw error;
        }
    },
    
    // Get formatted user profile
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
    
    // Check if password is the same as the username
    isPasswordSameAsUsername(username) {
        try {
            const user = this.getUser(username);
            if (!user) return false;
            return cryptoService.verifyPassword(user.password, username);
        } catch (error) {
            return false;
        }
    },
    
    // Save user profile (create or update)
    saveUserProfile(profileData, username) {
        try {
            const isPasswordWeak = this.isPasswordSameAsUsername(username);
            
            // Data normalization
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
            
            // Update or create profile
            if (existingProfile) {
                this._updateProfile(username, normalizedData);
            } else {
                this._createProfile(username, normalizedData);
            }
            
            // Handle password change
            if (profileData.passwordChange && profileData.passwordChange.newPassword) {
                try {
                    const user = this.getUser(username);
                    if (!user || !cryptoService.verifyPassword(user.password, profileData.passwordChange.currentPassword)) {
                        return { 
                            success: false,
                            code: 'INVALID_CURRENT_PASSWORD',
                            message: 'Current password is incorrect',
                            shouldRedirect: false
                        };
                    }
                    
                    this.updateUserPassword(username, profileData.passwordChange.newPassword);
                    passwordChanged = true;
                } catch (passwordError) {
                    // Continue despite error
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
                    'Profile saved. Please change your password.' : 
                    'Profile saved successfully'
            };
        } catch (error) {
            throw error;
        }
    },
    
    // Update an existing profile
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
            // Fallback without referral_source
            dbModule.fallbackUpdateUserProfile.run(
                data.firstName, data.lastName, data.email, data.phone,
                data.shopName, data.shopAddress, data.shopCity, data.shopZipCode,
                data.lastUpdated, username
            );
        }
    },
    
    // Create a new profile
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
            // Fallback without referral_source
            dbModule.fallbackCreateUserProfile.run(
                username, data.firstName, data.lastName, data.email, 
                data.phone, data.shopName, data.shopAddress, data.shopCity, 
                data.shopZipCode, data.lastUpdated
            );
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
                referralSource: profile.referral_source || '',
                lastUpdated: profile.last_updated
            }));
        } catch (error) {
            return []; 
        }
    },
    
    // Check if a profile is complete (all required fields)
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

    // Update user password
    updateUserPassword(username, newPassword) {
        try {
            const user = this.getUser(username);
            if (!user) throw new Error('User not found');
            
            // Cleanup duplicates if any
            const db = dbModule.db;
            const duplicates = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get(username);
            
            if (duplicates && duplicates.count > 1) {
                db.prepare('DELETE FROM users WHERE username = ? AND rowid NOT IN (SELECT MIN(rowid) FROM users WHERE username = ?)').run(username, username);
            }
            
            // Hash and update password
            const hashedPassword = cryptoService.hashPassword(newPassword);
            const updateStmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
            const updateResult = updateStmt.run(hashedPassword, username);
            
            if (!updateResult || updateResult.changes === 0) {
                throw new Error('No rows updated in database');
            }
            
            // Verification and cache cleanup
            const updatedUser = this.getUser(username);
            if (!updatedUser) {
                throw new Error('User was not properly updated');
            }
            
            // Clear session cache if present
            if (global.sessionCache && global.sessionCache[username]) {
                delete global.sessionCache[username];
            }
            
            return true;
        } catch (error) {
            throw error;
        }
    },

    // Password strength validation
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