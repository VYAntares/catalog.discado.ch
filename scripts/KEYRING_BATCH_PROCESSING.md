# Traitement d'un Arrivage de Porte-clefs

Ce document explique comment traiter un arrivage de porte-clefs (keyrings) en créant automatiquement les commandes pour tous les clients qui en ont en `pending_deliveries`.

## Contexte

Les porte-clefs arrivent du fournisseur et sont ajoutés à `pending_deliveries` pour chaque client qui les a commandés. Ce processus crée une commande pour chaque client ayant au moins un porte-clef en attente de livraison.

## Références de Porte-clefs Traitées

Le script traite les 32 références suivantes de porte-clefs :

- Keyring 7 - Cow edelweiss bottle opener
- Keyring 8 - Edelweiss swiss heart
- Keyring 10 - ringged dice
- Keyring 14 - Edelweiss chained Bell (3 variantes: gold, gold slimer, silver)
- Keyring 17 - Swiss sneaker label
- Keyring 22 - mosaic heart
- Keyring 24 - cow chocolate edelweiss label
- Keyring 26 - Watch switzerland label (2 variantes: GOLD, SILVER)
- Keyring 32 - nail clippers
- Keyring 33 - Swiss Key
- Keyring 34 - white bear I love swiss
- Keyring 44 - swiss flag St-Bernard
- Keyring 50 - heart letter swiss
- Keyring 56 - swiss shield (2 variantes: Gold, Silver)
- Keyring 58 - Bern coat of arm
- Keyring 61 - Love switzerland white cross
- Keyring 65 - Nail clipper
- Keyring 74 - Edelweiss. cow and bell
- Keyring 78 - Tool Swiss army knife
- Keyring 83 - Swiss knife poya
- Keyring 85 - wooden swiss army knife
- Keyring 86 - swiss army knife
- Keyring 87 - Heart shaped switzerland
- Keyring 90 - compass bottle opener
- Keyring 91 - poya swiss army knife
- Keyring 99 - Dookie skiing
- Keyring 101 - I love Swiss
- Keyring 102 - Swiss Ski

## Scripts

### 1. process-keyring-batch.js

Crée des commandes pour tous les clients ayant des porte-clefs en pending_deliveries.

**Utilisation:**
```bash
node scripts/process-keyring-batch.js
```

**Fonctionnement:**

1. Cherche tous les clients ayant au moins un porte-clef en `pending_deliveries`
2. Pour chaque client :
   - Crée une nouvelle commande avec un ID unique (format: YYMMDD-XXXX)
   - Ajoute tous les porte-clefs en attente de livraison à la commande
   - Supprime ces articles de `pending_deliveries`
3. Affiche un résumé avec :
   - Nombre de clients traités
   - Nombre de commandes créées
   - Montant total

**Résultat:** Les commandes sont créées avec le statut `pending` et attendent le traitement des factures.

### 2. generate-invoices-for-keyring-orders.js

Génère les factures pour les commandes créées.

**Utilisation:**
```bash
# Générer pour toutes les commandes sans facture
node scripts/generate-invoices-for-keyring-orders.js

# Générer pour un jour spécifique (ex: 2026-05-07)
node scripts/generate-invoices-for-keyring-orders.js 260507
```

**Fonctionnement:**

1. Cherche les commandes sans facture
2. Pour chaque commande :
   - Récupère les articles
   - Calcule le subtotal HT
   - Calcule la TVA (8.1%) arrondie au 5 centimes
   - Calcule le total TTC
   - Définit l'échéance (date + 1 mois)
   - Génère un numéro de facture (format: INV-XXX)
   - Insère la facture dans la base de données
3. Affiche un résumé avec :
   - Nombre de factures créées
   - Montants de chaque facture

**Résultat:** Les factures sont créées avec le statut `unpaid`.

## Flux Complet

### Étape 1 : Vérifier les pending_deliveries
Avant de lancer le script, vérifiez que les porte-clefs sont bien présents dans `pending_deliveries` pour les clients concernés.

### Étape 2 : Traiter l'arrivage
```bash
node scripts/process-keyring-batch.js
```

Cela crée les commandes et supprime les articles de `pending_deliveries`.

### Étape 3 : Générer les factures
```bash
node scripts/generate-invoices-for-keyring-orders.js 260507
```

Cela crée les factures pour les commandes créées (remplacer `260507` par la date appropriée).

### Étape 4 : Vérification

1. **Vérifier les commandes:**
   - Aller dans "Historique des Commandes"
   - Les nouvelles commandes devraient être visibles avec le statut "pending"

2. **Vérifier les factures:**
   - Aller dans "Comptabilité" ou "Factures"
   - Les nouvelles factures devraient être listées avec les numéros INV-XXX

3. **Vérifier le montant total:**
   - Sommer les montants des commandes créées
   - Vérifier que les factures correspondent

### Étape 5 : Traitement des commandes

Les commandes peuvent maintenant être :
- Traitées (changement de statut à "completed")
- Envoyées aux clients
- Utilisées pour générer les documents de livraison

## Détails Techniques

### Structure des Données

**orders :**
- `order_id`: Identifiant unique (format: YYMMDD-XXXX)
- `user_id`: Nom d'utilisateur du client
- `status`: 'pending' (en attente)
- `date`: Date/heure de création
- `reference`: Champ libre (vide par défaut)

**order_items :**
- `order_id`: Référence à la commande
- `product_id`: ID du produit
- `product_name`: Nom du produit
- `product_price`: Prix unitaire
- `quantity`: Quantité commandée
- `category`: Catégorie (ex: 'keyring')
- `status`: 'pending'
- `size`: Taille (null pour les porte-clefs)

**invoices :**
- `invoice_number`: Numéro unique (format: INV-XXX)
- `order_id`: Référence à la commande
- `user_id`: Client
- `client_full_name`: Nom complet du client
- `invoice_date`: Date de la facture
- `subtotal_ht`: Montant HT
- `vat_amount`: Montant TVA (8.1%)
- `total_ttc`: Montant TTC
- `payment_status`: 'unpaid' (impayé)
- `amount_due`: Montant à payer

### Calculs

**Subtotal HT:**
```
Σ (prix_unitaire × quantité)
```

**TVA (8.1%):**
```
subtotal_ht × 0.081, arrondi au 5 centimes le plus proche
```

**Total TTC:**
```
subtotal_ht + tva
```

**Date d'échéance:**
```
date_facture + 1 mois
```

## Gestion des Erreurs

### Utilisateur non trouvé

Si un client en `pending_deliveries` n'existe pas dans la table `users`, il sera ignoré avec un avertissement.

**Solution:** Vérifier que les utilisateurs existent et corriger le champ `user_id` en cas de typo.

### Commande sans articles

Si aucun article ne correspond aux références, la commande ne sera pas créée.

**Solution:** Vérifier que les noms de produits correspondent exactement aux références listées.

### Facture déjà existante

Si une facture existe déjà pour une commande, elle ne sera pas recréée.

**Solution:** Supprimer la facture existante si elle doit être regénérée.

## Modification des Références

Pour traiter d'autres arrivages, modifiez le tableau `KEYRING_REFERENCES` dans les scripts :

**Dans process-keyring-batch.js (ligne ~56) :**
```javascript
const KEYRING_REFERENCES = [
    'Keyring 7 - Cow edelweiss bottle opener',
    'Keyring 8 - Edelweiss swiss heart',
    // ... ajouter d'autres références
];
```

**Dans generate-invoices-for-keyring-orders.js :**
Pas besoin de modifier ce script - il génère les factures pour n'importe quelle commande.

## Dépannage

### Le script ne trouve aucun client

1. Vérifier que les `pending_deliveries` existent pour les porte-clefs
2. Vérifier que les noms de produits correspondent exactement
3. Vérifier que l'utilisateur existe dans la table `users`

### Les factures ont des montants incorrects

1. Vérifier les prix unitaires dans `pending_deliveries`
2. Vérifier que la TVA est bien calculée (8.1%)
3. Vérifier l'arrondi au 5 centimes

### Les IDs de commande sont en désordre

Les IDs de commande sont générés séquentiellement en fonction du compteur stocké dans `data/orderCounter.json`. Si vous voyez des sauts ou des incohérences :

```bash
cat data/orderCounter.json
```

Vous pouvez réinitialiser manuellement si nécessaire (déconseillé).

## Performance

- **49 clients traités** en environ 2-5 secondes
- **49 factures générées** en environ 1-2 secondes
- **Montant total traité** : ~35 000 CHF

## Logs et Debugging

Les scripts affichent des logs détaillés :
- ✅ : Succès
- ❌ : Erreur
- ⚠️ : Avertissement
- 📦, 📝, 📄, 💰 : Informations

Pour plus de détails, vérifiez la base de données directement :

```bash
# Voir les commandes créées
sqlite3 database/discado.db "SELECT order_id, user_id, status, date FROM orders WHERE order_id LIKE '260507-%'"

# Voir les factures créées
sqlite3 database/discado.db "SELECT invoice_number, order_id, total_ttc FROM invoices WHERE invoice_number LIKE 'INV-%' ORDER BY id DESC LIMIT 50"
```

## Notes Importantes

1. **Sauvegarde:** Faites une sauvegarde avant de lancer les scripts
2. **Test:** Testez d'abord sur une petite partie des données
3. **Vérification:** Vérifiez toujours les résultats dans l'interface
4. **Transactions:** Les scripts utilisent des transactions pour la cohérence des données
5. **Idempotence:** Le script de génération de factures ne crée pas de doublon si relancé

## Support

En cas de problème :
1. Vérifiez les logs du script
2. Vérifiez la base de données directement
3. Vérifiez que les données en `pending_deliveries` sont correctes
4. Contactez le développeur avec les logs complets
