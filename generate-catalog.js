// generate-catalog.js
// Génère product-catalog.json depuis la base de données discado.db
// Usage: node generate-catalog.js

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database/discado.db');
const outputPath = path.join(__dirname, 'product-catalog.json');

const db = new Database(dbPath);
const products = db.prepare('SELECT id, name, price, category FROM products ORDER BY category, name').all();

const catalog = {};

for (const p of products) {
  // Extrait le numéro depuis le nom : "Magnet 190 - Magnet box" → num=190, catWord=magnet
  const match = p.name.match(/^(\S+)\s+(\d+[a-z]?)\s+-\s+(.+)$/i);
  if (!match) continue;

  const catWord = match[1].toLowerCase();
  const num = match[2];

  const key = `${num}_${catWord}`;
  const entry = { product_id: p.id, name: p.name, price: p.price, category: p.category };

  if (!catalog[key]) {
    catalog[key] = entry;
  } else {
    // Plusieurs produits avec le même numéro dans la même catégorie → tableau
    if (!Array.isArray(catalog[key])) catalog[key] = [catalog[key]];
    catalog[key].push(entry);
  }
}

fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`✓ product-catalog.json généré — ${Object.keys(catalog).length} entrées`);
