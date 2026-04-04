// nextWEEK CMS v3 — node server.js → http://localhost:3000
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

const app  = express();
// deno-lint-ignore no-process-global
const PORT = process.env.PORT || 3000;

const DATA_DIR     = path.join(__dirname, 'data');
const ARTICLES_DIR = path.join(__dirname, 'articles');
const UPLOADS_DIR  = path.join(__dirname, 'uploads');
const AADHAAR_DIR  = path.join(__dirname, 'aadhaar');   // aadhaar docs

[DATA_DIR, ARTICLES_DIR, UPLOADS_DIR, AADHAAR_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');

// ── DEFAULT USERS ──
function ensureDefaultUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([
      { id: uuidv4(), username: 'admin',  password: 'nextweek2026', role: 'admin',     name: 'Admin',        status: 'approved', aadhaarFile: null },
      { id: uuidv4(), username: 'reader', password: 'reader123',    role: 'reader',    name: 'Guest Reader', status: 'approved', aadhaarFile: null }
    ], null, 2));
    console.log('  Created default users (admin + reader)');
  }
}
ensureDefaultUsers();

// ── HELPERS ──
const readJSON  = f => { try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch { return []; } };
const writeJSON = (f,d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));
const readUsers     = () => readJSON(USERS_FILE);
const writeUsers    = u  => writeJSON(USERS_FILE, u);
const readArticles  = () => readJSON(ARTICLES_FILE);
const writeArticles = a  => writeJSON(ARTICLES_FILE, a);

// ── MIDDLEWARE ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/aadhaar', express.static(AADHAAR_DIR)); // served for admin preview

// ── MULTER FACTORIES ──
function makeDiskStorage(destDir, nameFn) {
  return multer.diskStorage({ destination: (_r,_f,cb)=>cb(null,destDir), filename: nameFn });
}
const aadhaarUpload = multer({
  storage: makeDiskStorage(AADHAAR_DIR, (_r,f,cb)=>cb(null,`${Date.now()}-${f.originalname}`)),
  limits: { fileSize: 8*1024*1024 },
  fileFilter: (_r,f,cb) => cb(null, /pdf|jpeg|jpg|png/i.test(f.mimetype))
});

// ── AUTH MIDDLEWARE ──
function auth(req, res, next) {
  const token = req.headers['x-auth-token'];
  const user  = readUsers().find(u => u.id === token);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  req.user = user;
  next();
}
function requireApprovedPublisher(req, res, next) {
  auth(req, res, () => {
    if (req.user.role === 'admin') return next();                          // admin = always ok
    if (req.user.role !== 'publisher') return res.status(403).json({ error: 'Publisher access required' });
    if (req.user.status !== 'approved') return res.status(403).json({ error: 'Your publisher account is pending admin approval' });
    next();
  });
}
function requireAdmin(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// ══════════════════════════════════════
//  AUTH
// ══════════════════════════════════════
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = readUsers().find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

  // Block pending publishers from logging in
  if (user.role === 'publisher' && user.status === 'pending') {
    return res.status(403).json({ ok: false, error: 'Your account is pending approval. Please wait for admin to approve.' });
  }

  res.json({ ok: true, token: user.id, role: user.role, name: user.name, username: user.username, status: user.status });
});

app.get('/api/me', auth, (req, res) => {
  const { id, username, role, name, status } = req.user;
  res.json({ id, username, role, name, status });
});

// ── REGISTER (new publisher — requires aadhaar) ──
app.post('/api/register', aadhaarUpload.single('aadhaarFile'), (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'username, password, name required' });
  if (!req.file) return res.status(400).json({ error: 'Aadhaar document is required for publisher registration' });

  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username already taken' });

  const user = {
    id: uuidv4(), username, password, role: 'publisher', name,
    status: 'pending',                        // must be approved by admin
    aadhaarFile: req.file.filename,
    registeredAt: new Date().toISOString()
  };
  users.push(user);
  writeUsers(users);
  console.log(`[REG] New publisher registration: ${username} (pending approval)`);
  res.json({ ok: true, message: 'Registration submitted. Please wait for admin approval.' });
});

// ══════════════════════════════════════
//  ARTICLES
// ══════════════════════════════════════
app.get('/api/articles', (req, res) => {
  let arts = readArticles();
  if (req.query.section) arts = arts.filter(a => a.section === req.query.section);
  res.json(arts.map(({ body, ...rest }) => ({ ...rest, excerpt: (body||'').slice(0,240)+'…', wordCount: (body||'').split(/\s+/).length })));
});

app.get('/api/articles/:id', (req, res) => {
  const art = readArticles().find(a => a.id === req.params.id);
  if (!art) return res.status(404).json({ error: 'Not found' });
  res.json(art);
});

app.post('/api/articles', requireApprovedPublisher, (req, res, next) => {
  multer({
    storage: makeDiskStorage(
      UPLOADS_DIR,
      (_r, f, cb) => { const e = path.extname(f.originalname); cb(null, `${Date.now()}${e}`); }
    ),
    limits: { fileSize: 5*1024*1024 }
  }).fields([{ name:'txtFile', maxCount:1 }, { name:'imageFile', maxCount:1 }])(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  const { title, author, section, tags } = req.body;
  if (!title || !author || !section) return res.status(400).json({ error: 'title, author, section required' });
  let body = req.body.body || '';
  let txtFileName = null, imageUrl = null;
  if (req.files?.txtFile?.[0]) { txtFileName = req.files.txtFile[0].filename; body = fs.readFileSync(req.files.txtFile[0].path,'utf8'); }
  if (req.files?.imageFile?.[0]) imageUrl = `/uploads/${req.files.imageFile[0].filename}`;
  const article = {
    id: uuidv4(), title: title.trim(), author: author.trim(), section: section.trim(),
    tags: tags ? tags.split(',').map(t=>t.trim()).filter(Boolean) : [],
    body, txtFileName, imageUrl,
    dateISO: new Date().toISOString(),
    publishedBy: req.user.username
  };
  const arts = readArticles(); arts.unshift(article); writeArticles(arts);
  res.json({ ok: true, id: article.id });
});

app.delete('/api/articles/:id', requireApprovedPublisher, (req, res) => {
  const arts = readArticles();
  const idx  = arts.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const art = arts[idx];
  if (art.txtFileName) try { fs.unlinkSync(path.join(ARTICLES_DIR, art.txtFileName)); } catch (_e) { /* ignore */ }
  if (art.imageUrl)    try { fs.unlinkSync(path.join(__dirname, art.imageUrl)); }       catch (_e) { /* ignore */ }
  arts.splice(idx, 1); writeArticles(arts);
  res.json({ ok: true });
});

// ══════════════════════════════════════
//  ADMIN — USER MANAGEMENT & APPROVAL
// ══════════════════════════════════════

// All users
app.get('/api/users', requireAdmin, (_req, res) => {
  res.json(readUsers().map(({ password: _password, ...u }) => u));
});

// Pending publisher approvals
app.get('/api/users/pending', requireAdmin, (_req, res) => {
  res.json(readUsers().filter(u => u.role === 'publisher' && u.status === 'pending').map(({ password: _password, ...u }) => u));
});

// Approve a publisher
app.post('/api/users/:id/approve', requireAdmin, (req, res) => {
  const users = readUsers();
  const user  = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.status = 'approved';
  user.approvedAt = new Date().toISOString();
  user.approvedBy = req.user.username;
  writeUsers(users);
  console.log(`[✓] Publisher approved: ${user.username} by ${req.user.username}`);
  res.json({ ok: true });
});

// Reject / remove a publisher
app.post('/api/users/:id/reject', requireAdmin, (req, res) => {
  const users = readUsers();
  const user  = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.status = 'rejected';
  writeUsers(users);
  res.json({ ok: true });
});

// Delete any user
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const users = readUsers().filter(u => u.id !== req.params.id);
  writeUsers(users);
  res.json({ ok: true });
});

// Add reader manually
app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, role, name } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'username, password, role required' });
  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username taken' });
  users.push({ id: uuidv4(), username, password, role, name: name||username, status: 'approved', aadhaarFile: null });
  writeUsers(users);
  res.json({ ok: true });
});

// ══════════════════════════════════════
//  MISC
// ══════════════════════════════════════
app.get('/api/sections', (_req, res) => {
  const arts = readArticles();
  const SECTIONS = ['Opinion','Politics','Food & Society','Culture','Health','Economy','History','Diaspora','Tech'];
  const counts = {}; SECTIONS.forEach(s => counts[s] = arts.filter(a => a.section === s).length);
  res.json({ sections: SECTIONS, counts });
});

app.get('/api/stats', requireApprovedPublisher, (_req, res) => {
  const arts  = readArticles();
  const users = readUsers();
  res.json({
    totalArticles:  arts.length,
    totalAuthors:   [...new Set(arts.map(a=>a.author))].length,
    txtFilesOnDisk: fs.readdirSync(ARTICLES_DIR).filter(f=>f.endsWith('.txt')).length,
    imagesOnDisk:   fs.readdirSync(UPLOADS_DIR).filter(f=>/\.(jpg|jpeg|png|webp|gif)$/i.test(f)).length,
    totalUsers:     users.length,
    pendingApprovals: users.filter(u=>u.role==='publisher'&&u.status==='pending').length
  });
});

app.get('/api/txt-files', requireApprovedPublisher, (_req, res) => {
  const files = fs.readdirSync(ARTICLES_DIR).filter(f=>f.endsWith('.txt'))
    .map(f => ({ filename:f, size: fs.statSync(path.join(ARTICLES_DIR,f)).size, modified: fs.statSync(path.join(ARTICLES_DIR,f)).mtime }));
  res.json(files);
});
app.get('/api/txt-files/:filename', requireApprovedPublisher, (req, res) => {
  const p = path.join(ARTICLES_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  res.send(fs.readFileSync(p,'utf8'));
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => {
  console.log(`\n  ◆ nextWEEK CMS v3  →  http://localhost:${PORT}`);
  console.log(`  ◆ Admin:   admin / nextweek2026`);
  console.log(`  ◆ Reader:  reader / reader123`);
  console.log(`  ◆ New publishers must register + upload Aadhaar → admin approves\n`);
});
