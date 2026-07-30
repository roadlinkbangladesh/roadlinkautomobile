import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import worker from './worker/src/index.js';

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());

// Raw body parser for /api routes so Web Request gets unparsed body
app.use('/api', express.raw({ type: '*/*', limit: '50mb' }));

// Initialize SQLite database via sql.js
const DB_FILE = path.join(process.cwd(), 'database.sqlite');
const SQL = await initSqlJs();

let sqliteDb;
if (fs.existsSync(DB_FILE)) {
  try {
    const filebuffer = fs.readFileSync(DB_FILE);
    sqliteDb = new SQL.Database(filebuffer);
    sqliteDb.run("CREATE INDEX IF NOT EXISTS idx_vehicles_published_status ON vehicles(is_published, status, archived_at);");
    sqliteDb.run("CREATE INDEX IF NOT EXISTS idx_vehicles_featured ON vehicles(is_featured, archived_at, featured_position);");
    saveDatabase();
  } catch (err) {
    console.warn('Database loading error, re-initializing database:', err.message);
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
    sqliteDb = new SQL.Database();
    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'worker/database/schema.sql'), 'utf8');
    sqliteDb.run(schemaSql);
    const seedSql = fs.readFileSync(path.join(process.cwd(), 'worker/database/seed.sql'), 'utf8');
    sqliteDb.run(seedSql);
    saveDatabase();
  }
} else {
  sqliteDb = new SQL.Database();
  const schemaSql = fs.readFileSync(path.join(process.cwd(), 'worker/database/schema.sql'), 'utf8');
  sqliteDb.run(schemaSql);
  const seedSql = fs.readFileSync(path.join(process.cwd(), 'worker/database/seed.sql'), 'utf8');
  sqliteDb.run(seedSql);
  saveDatabase();
}

function saveDatabase() {
  const data = sqliteDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

// Build D1 database adapter for sql.js
function createD1Adapter() {
  function prepareStatement(sqlStr, params = []) {
    let bound = params;
    return {
      sql: sqlStr,
      bind(...newParams) {
        bound = newParams;
        return this;
      },
      async first(colName) {
        const stmt = sqliteDb.prepare(sqlStr);
        stmt.bind(bound);
        let result = null;
        if (stmt.step()) {
          const row = stmt.getAsObject();
          result = colName ? row[colName] : row;
        }
        stmt.free();
        return result;
      },
      async all() {
        const stmt = sqliteDb.prepare(sqlStr);
        stmt.bind(bound);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return { results, success: true };
      },
      async run() {
        sqliteDb.run(sqlStr, bound);
        const changes = sqliteDb.getRowsModified();
        let last_row_id = 0;
        try {
          const res = sqliteDb.exec("SELECT last_insert_rowid() as id");
          if (res.length > 0 && res[0].values.length > 0) {
            last_row_id = res[0].values[0][0];
          }
        } catch (e) {}
        saveDatabase();
        return { success: true, meta: { changes, last_row_id } };
      },
      async raw() {
        const stmt = sqliteDb.prepare(sqlStr);
        stmt.bind(bound);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.get());
        }
        stmt.free();
        return rows;
      }
    };
  }

  return {
    prepare(sqlStr) {
      return prepareStatement(sqlStr);
    },
    async batch(statements) {
      const results = [];
      sqliteDb.run("BEGIN TRANSACTION");
      try {
        for (const stmt of statements) {
          const sqlLower = (stmt.sql || "").trim().toLowerCase();
          if (sqlLower.startsWith("select") || sqlLower.startsWith("pragma")) {
            results.push(await stmt.all());
          } else {
            results.push(await stmt.run());
          }
        }
        sqliteDb.run("COMMIT");
        saveDatabase();
      } catch (err) {
        sqliteDb.run("ROLLBACK");
        throw err;
      }
      return results;
    },
    async exec(sqlStr) {
      sqliteDb.run(sqlStr);
      saveDatabase();
    }
  };
}

// Storage adapter
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storageAdapter = {
  async get(key) {
    const cleanKey = String(key || '').replace(/^\/+/, '');
    const filePath = path.join(UPLOADS_DIR, cleanKey);
    if (!filePath.startsWith(UPLOADS_DIR)) return null;
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;

    const data = fs.readFileSync(filePath);
    return {
      body: data,
      httpMetadata: {}
    };
  },
  async put(key, body, options = {}) {
    const cleanKey = String(key || '').replace(/^\/+/, '');
    const filePath = path.join(UPLOADS_DIR, cleanKey);
    if (!filePath.startsWith(UPLOADS_DIR)) throw new Error('Invalid storage key');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let buffer;
    if (Buffer.isBuffer(body)) {
      buffer = body;
    } else if (body instanceof ArrayBuffer) {
      buffer = Buffer.from(body);
    } else if (typeof body === 'string') {
      buffer = Buffer.from(body);
    } else if (body && typeof body.arrayBuffer === 'function') {
      const ab = await body.arrayBuffer();
      buffer = Buffer.from(ab);
    } else {
      buffer = Buffer.from(String(body));
    }

    fs.writeFileSync(filePath, buffer);
    return { key: cleanKey };
  },
  async delete(key) {
    const cleanKey = String(key || '').replace(/^\/+/, '');
    const filePath = path.join(UPLOADS_DIR, cleanKey);
    if (filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  }
};

const env = {
  DB: createD1Adapter(),
  STORAGE: storageAdapter,
  FILES: storageAdapter,
  MEDIA: storageAdapter,
  IMAGES: storageAdapter,
  JWT_SECRET: process.env.JWT_SECRET || "roadlink-automobiles-secret-key-2026-default"
};

// API route handler forwarding to worker
app.all('/api/*', async (req, res) => {
  try {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) {
        if (Array.isArray(v)) {
          v.forEach(val => headers.append(k, val));
        } else {
          headers.set(k, String(v));
        }
      }
    }

    let body = null;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        body = req.body;
      }
    }

    const webReq = new Request(fullUrl, {
      method: req.method,
      headers,
      body
    });

    const webRes = await worker.fetch(webReq, env, {});

    res.status(webRes.status);
    webRes.headers.forEach((val, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, val);
      }
    });

    const arrayBuffer = await webRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve admin static files
app.use('/admin', express.static(path.join(process.cwd(), 'admin')));

// Serve public static files
app.use(express.static(path.join(process.cwd(), 'public')));

// Admin fallback for SPA / HTML
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'admin/index.html'));
});

// Public fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Roadlink Automobiles server running on port ${PORT}`);
});
