// Her build'den önce db/schema.sql'i veritabanına uygular (package.json → build).
// Şema idempotent'tir: tekrar tekrar çalıştırmak güvenlidir ve veri silmez.
// Tek bir işlem (transaction) içinde çalışır; hata olursa hiçbir değişiklik kalmaz ve build durur.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

// DDL için havuzsuz (doğrudan) bağlantı tercih edilir; Neon entegrasyonu ikisini de tanımlar.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  console.log("[migrate] DATABASE_URL tanımlı değil; şema adımı atlandı.");
  process.exit(0);
}

const schema = readFileSync(fileURLToPath(new URL("../db/schema.sql", import.meta.url)), "utf8");
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 });

try {
  await client.connect();
  // Eşzamanlı iki build aynı anda şema uygulamasın.
  await client.query(`begin;
    select pg_advisory_xact_lock(hashtext('gri:migrate'));
    ${schema}
    ;commit;`);
  console.log("[migrate] Şema güncel.");
} catch (e) {
  console.error("[migrate] Şema uygulanamadı:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
