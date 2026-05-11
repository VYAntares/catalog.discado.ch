const dbModule = require('./db');

const permissionService = {
    // Vérifier si un utilisateur a une permission spécifique
    hasPermission(username, permission) {
        try {
            const stmt = dbModule.db.prepare(`
                SELECT ${permission} as has_permission 
                FROM user_permissions 
                WHERE username = ?
            `);
            
            const result = stmt.get(username);
            
            // Si l'utilisateur n'a pas de permissions définies, refuser l'accès
            if (!result) {
                return false;
            }
            
            return result.has_permission === 1;
        } catch (error) {
            console.error('Erreur vérification permission:', error);
            return false;
        }
    },

    // Récupérer toutes les permissions d'un utilisateur
    getUserPermissions(username) {
        try {
            const stmt = dbModule.db.prepare('SELECT * FROM user_permissions WHERE username = ?');
            const permissions = stmt.get(username);
            
            if (!permissions) {
                return {
                    stock: false,
                    compta: false,
                    orders: false,
                    clients: false,
                    order_history: false,
                    stats: false
                };
            }
            
            return {
                stock: permissions.stock === 1,
                compta: permissions.compta === 1,
                orders: permissions.orders === 1,
                clients: permissions.clients === 1,
                order_history: permissions.order_history === 1,
                suppliers: permissions.suppliers === 1,
                stats: permissions.stats === 1
            };
        } catch (error) {
            console.error('Erreur récupération permissions:', error);
            return null;
        }
    },

    // Définir les permissions d'un utilisateur
    setUserPermissions(username, permissions) {
        try {
            const stmt = dbModule.db.prepare(`
                INSERT OR REPLACE INTO user_permissions 
                (username, stock, compta, orders, clients, order_history, suppliers, stats)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                username,
                permissions.stock ? 1 : 0,
                permissions.compta ? 1 : 0,
                permissions.orders ? 1 : 0,
                permissions.clients ? 1 : 0,
                permissions.order_history ? 1 : 0,
                permissions.suppliers ? 1 : 0,
                permissions.stats ? 1 : 0
            );
            
            return { success: true };
        } catch (error) {
            console.error('Erreur sauvegarde permissions:', error);
            return { success: false, error: error.message };
        }
    },

    // Initialiser les permissions pour un nouvel utilisateur
    initUserPermissions(username, isAdmin = false) {
        try {
            // Vérifier si les permissions existent déjà
            const existing = dbModule.db.prepare('SELECT * FROM user_permissions WHERE username = ?').get(username);
            
            if (existing) {
                return { success: true, message: 'Permissions déjà existantes' };
            }
            
            // Créer des permissions par défaut
            const stmt = dbModule.db.prepare(`
                INSERT INTO user_permissions 
                (username, stock, compta, orders, clients, order_history, suppliers, stats)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            // Par défaut, tous les admins ont accès aux commandes et à l'historique
            stmt.run(username, 0, 0, 1, 0, 1, 0, 0);
            
            return { success: true, message: 'Permissions initialisées' };
        } catch (error) {
            console.error('Erreur initialisation permissions:', error);
            return { success: false, error: error.message };
        }
    },

    // Récupérer tous les utilisateurs avec leurs permissions
    getAllUsersPermissions() {
        try {
            const stmt = dbModule.db.prepare(`
                SELECT 
                    u.username,
                    u.role,
                    COALESCE(p.stock, 0) as stock,
                    COALESCE(p.compta, 0) as compta,
                    COALESCE(p.orders, 0) as orders,
                    COALESCE(p.clients, 0) as clients,
                    COALESCE(p.order_history, 0) as order_history,
                    COALESCE(p.suppliers, 0) as suppliers,
                    COALESCE(p.stats, 0) as stats
                FROM users u
                LEFT JOIN user_permissions p ON u.username = p.username
                WHERE u.role IN ('admin', 'admin_observateur')
            `);
            
            return stmt.all();
        } catch (error) {
            console.error('Erreur récupération tous permissions:', error);
            return [];
        }
    }
};

module.exports = permissionService;