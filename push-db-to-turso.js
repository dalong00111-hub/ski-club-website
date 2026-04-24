const { createClient } = require('@libsql/client');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TURSO_URL = 'libsql://ski-club-db-dalong00111-hub.aws-ap-northeast-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzcwMjg1ODEsImlkIjoiMDE5ZGJmMjYtZDIwMS03YWYyLWEyZmItNzQ3OTY2NDc3MmVjIiwicmlkIjoiNzdjOWMyOWItODVkYy00NWZiLTk3NGItOTVjMjQ4MGQyNDFiIn0.VxGLFHZcIejQCh5MVvKyTPaDKJPOjKY7fIkyWzsIzK3BcqfRQRfkoAMRbYZgrkO7bNTkcSz1Ggsr9CvQGOe0Bg';

const LOCAL_DB_PATH = path.join(__dirname, 'data', 'ski-club.db');

async function pushToTurso() {
  console.log('🔄 Connecting to Turso...');
  
  const turso = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  console.log('📖 Reading local database...');
  const localDb = new Database(LOCAL_DB_PATH, { readonly: true });

  // Get all tables
  const tables = localDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 Tables found:', tables.map(t => t.name).join(', '));

  for (const table of tables) {
    const tableName = table.name;
    console.log(`\n📤 Processing table: ${tableName}`);
    
    // Get table schema
    const schema = localDb.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
    console.log(`  Schema: ${schema.sql}`);
    
    // Create table in Turso
    try {
      await turso.execute(schema.sql);
      console.log(`  ✅ Created table in Turso`);
    } catch (err) {
      console.log(`  ⚠️ Table creation: ${err.message}`);
    }
    
    // Get all rows
    const rows = localDb.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`  📝 Rows: ${rows.length}`);
    
    if (rows.length > 0) {
      // Insert rows
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const insertSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      for (const row of rows) {
        try {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return null;
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
          });
          await turso.execute(insertSql, values);
        } catch (err) {
          console.log(`  ⚠️ Insert error: ${err.message}`);
        }
      }
      console.log(`  ✅ Inserted ${rows.length} rows`);
    }
  }

  console.log('\n🎉 Database push complete!');
  process.exit(0);
}

pushToTurso().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
