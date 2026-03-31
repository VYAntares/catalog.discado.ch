# Création de commandes manuelles (via email)

Ce fichier explique comment demander à Claude de créer une commande dans la base de données à partir d'un email reçu.

---

## Prérequis

- `product-catalog.json` doit être à jour (voir section Maintenance).
- Le client doit exister dans la table `users` de la base de données.

---

## Format de la demande

Colle simplement l'email reçu et dis à Claude :

> "Crée une commande pour ce client"

Claude lira `product-catalog.json`, résoudra chaque ligne, et insérera la commande dans la DB.

---

## Format attendu de l'email / liste d'articles

```
Référence    Quantité
190 Magnet   60
191 Magnet   24
422 Magnet   12
31 Porte clé 24
4 Gadget     24
178 Gadget   12
```

Chaque ligne = `{numéro} {catégorie}   {quantité}`

Les catégories acceptées (français ou anglais) :

| Ce que tu écris         | Catégorie dans le catalogue |
|-------------------------|-----------------------------|
| Magnet                  | magnet                      |
| Porte clé / Keyring     | keyring                     |
| Gadget                  | gadget                      |
| Plaque / Plate          | plates                      |
| Sac / Bag               | bags                        |
| Cloche / Bell           | bells                       |
| Briquet / Lighter       | lighters                    |
| Patch / Patches         | patches                     |
| Chiffon / Cloths        | cloths                      |
| T-Shirt / Hoodie        | tshirt / hoodie             |
| Casquette / Cap / Hat   | caps / hats                 |
| Stylo / Pen             | pens                        |
| Peluche / Soft Toy      | soft toy                    |
| Chaussettes / Socks     | socks                       |

---

## Ce que Claude fait automatiquement

1. Lit `product-catalog.json` pour résoudre chaque ligne → `product_id`, `name`, `price`, `category`
2. Vérifie que le client existe dans `users`
3. Lit `data/orderCounter.json` pour le prochain numéro séquentiel
4. Génère l'`order_id` au format `YYMMDD-XXXX` (date de l'email + compteur)
5. Insère dans `orders` et `order_items` avec `status = 'pending'`
6. Incrémente `data/orderCounter.json`

---

## Gestion des ambiguïtés

### Même numéro dans plusieurs catégories

Certains numéros existent dans plusieurs catégories. Exemple :

- `186 Magnet` → Magnet 186 - Cuckoo ✓
- `186 Gadget` → Gadget 186 - Large duck Yellow OU Large duck Red ← **ambiguïté**

Si le numéro est ambigu dans sa catégorie (ex: deux produits `186_gadget`), Claude demandera lequel choisir avant de créer la commande.

### Description ne correspondant pas exactement au catalogue

Si la description dans l'email est vague ou différente du catalogue (ex: "453 Yellow plate Switzerland" alors que le catalogue dit "Magnet 453 - Metallic Pedestrian 10x3cm"), Claude utilisera le **numéro** comme référence principale et signalera la différence de description dans sa réponse.

### Client introuvable

Si l'email du client n'est pas dans `users`, Claude le signalera et ne créera pas la commande.

---

## Maintenance du catalogue

Si de nouveaux produits ont été ajoutés à la DB, régénérer le fichier :

```bash
node generate-catalog.js
```

Ou demander à Claude :

> "Régénère le catalogue produits"

---

## Exemple complet

**Email reçu :**

```
De : molard.souvenirs@gmail.com
Objet : Commande

190 Magnet   60
344 Magnet   60
31 Porte clé 24
4 Gadget     24
```

**Demande à Claude :**

> Regarde COMMANDES.md et crée une commande pour ce client avec cette liste.

**Résultat :** Claude crée l'ordre `260317-0094` dans la DB avec les 4 articles, statut `pending`.

---

## Structure DB des commandes

**Table `orders`**
| Colonne        | Valeur                        |
|----------------|-------------------------------|
| order_id       | `YYMMDD-XXXX` (ex: 260317-0094) |
| user_id        | email du client               |
| status         | `pending`                     |
| date           | date de l'email               |
| last_processed | NULL                          |
| reference      | `''`                          |

**Table `order_items`**
| Colonne       | Valeur                        |
|---------------|-------------------------------|
| order_id      | référence vers orders         |
| product_id    | ID dans products              |
| product_name  | nom complet du produit        |
| product_price | prix unitaire                 |
| quantity      | quantité commandée            |
| category      | catégorie du produit          |
| status        | `pending`                     |
| size          | NULL (sauf textiles)          |
