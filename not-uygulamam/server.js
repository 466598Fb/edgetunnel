const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const Database = require('better-sqlite3');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const APP_PASSWORD = '1234';
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    path.join(__dirname, 'data'),
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {}
  }
  const fallback = path.join(__dirname, 'data');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

const DATA_DIR = resolveDataDir();

const db = new Database(path.join(DATA_DIR, 'notes.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Yeni Not',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )
`);

const stmts = {
  getAll: db.prepare('SELECT id, title, updated_at FROM notes ORDER BY updated_at DESC'),
  getOne: db.prepare('SELECT * FROM notes WHERE id = ?'),
  insert: db.prepare("INSERT INTO notes (title, content) VALUES (?, '')"),
  updateContent: db.prepare("UPDATE notes SET content = ?, updated_at = datetime('now','localtime') WHERE id = ?"),
  updateTitle: db.prepare("UPDATE notes SET title = ?, updated_at = datetime('now','localtime') WHERE id = ?"),
  remove: db.prepare('DELETE FROM notes WHERE id = ?'),
  search: db.prepare("SELECT id, title, updated_at FROM notes WHERE title LIKE '%' || ? || '%' OR content LIKE '%' || ? || '%' ORDER BY updated_at DESC"),
};

function makeToken() {
  return crypto.createHmac('sha256', SESSION_SECRET).update(APP_PASSWORD).digest('hex');
}

function isAuthed(req) {
  return req.cookies && req.cookies.token === makeToken();
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.cookie('token', makeToken(), {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Yanlis sifre' });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/check', (req, res) => {
  res.json({ authed: isAuthed(req) });
});

function authGuard(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Yetkisiz' });
  next();
}

app.get('/api/notes', authGuard, (_req, res) => {
  res.json(stmts.getAll.all());
});

app.get('/api/notes/:id', authGuard, (req, res) => {
  const note = stmts.getOne.get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not bulunamadi' });
  res.json(note);
});

app.post('/api/notes', authGuard, (req, res) => {
  const title = req.body.title || 'Yeni Not';
  const info = stmts.insert.run(title);
  res.json(stmts.getOne.get(info.lastInsertRowid));
});

app.get('/api/notes/search/:query', authGuard, (req, res) => {
  const q = req.params.query;
  res.json(stmts.search.all(q, q));
});

app.delete('/api/notes/:id', authGuard, (req, res) => {
  stmts.remove.run(req.params.id);
  broadcast({ type: 'note-deleted', noteId: Number(req.params.id) });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

function broadcast(data, excludeWs) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'update-content') {
      stmts.updateContent.run(msg.content, msg.noteId);
      broadcast({ type: 'content-changed', noteId: msg.noteId, content: msg.content }, ws);
    } else if (msg.type === 'update-title') {
      stmts.updateTitle.run(msg.title, msg.noteId);
      broadcast({ type: 'title-changed', noteId: msg.noteId, title: msg.title }, ws);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Not uygulamasi calisiyor: http://0.0.0.0:${PORT}`);
  console.log(`Data dizini: ${DATA_DIR}`);
});
