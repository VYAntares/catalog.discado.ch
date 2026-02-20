const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database/discado.db');
const db = new Database(DB_PATH);

const invoices = db.prepare(`
    SELECT id, order_id, amount_paid, paid_date, invoice_date, payment_status
    FROM invoices
    WHERE amount_paid > 0
`).all();

const existingPayments = db.prepare('SELECT invoice_id FROM invoice_payments').all();
const alreadyMigrated = new Set(existingPayments.map(p => p.invoice_id));

const insert = db.prepare(
    'INSERT INTO invoice_payments (invoice_id, amount, payment_date) VALUES (?, ?, ?)'
);

let count = 0;
const migrate = db.transaction(() => {
    for (const inv of invoices) {
        if (alreadyMigrated.has(inv.id)) continue;
        const payDate = inv.paid_date
            ? inv.paid_date.split('T')[0].split(' ')[0]
            : inv.invoice_date.split('T')[0].split(' ')[0];
        insert.run(inv.id, inv.amount_paid, payDate);
        count++;
        console.log(`  ${inv.order_id} → ${inv.amount_paid} CHF le ${payDate}`);
    }
});

migrate();
console.log(`\nMigration terminée: ${count} paiement(s) créé(s).`);
db.close();
