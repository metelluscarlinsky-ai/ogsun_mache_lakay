require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const TMP_DIR = path.join(__dirname, 'tmp');
[DATA_DIR, UPLOAD_DIR, TMP_DIR].forEach(d => { if (fs.existsSync(d) === false) fs.mkdirSync(d, { recursive: true }); });

function readJSON(n) { const f = path.join(DATA_DIR, n); if (fs.existsSync(f) === false) return []; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e) { return []; } }
function writeJSON(n, d) { fs.writeFileSync(path.join(DATA_DIR, n), JSON.stringify(d, null, 2)); }

// ========== INISYALIZE DONE ==========
if (fs.existsSync(path.join(DATA_DIR, 'merchants.json')) === false) writeJSON('merchants.json', []);
if (fs.existsSync(path.join(DATA_DIR, 'settings.json')) === false) {
  writeJSON('settings.json', { siteTitle: 'OGSUN MACHE LAKAY', themeColor: '#d4a017', logoUrl: '/logo.png', adminPassword: 'OGPLUG45' });
}

const JWT_SECRET = 'OgsunSecret2026!';
const verifyAdmin = (req, res, next) => {
  const t = req.headers['authorization'];
  if (t === undefined) return res.status(401).json({ error: 'Non otorize' });
  try { jwt.verify(t.replace('Bearer ', ''), JWT_SECRET); next(); } catch(e) { res.status(401).json({ error: 'Token invalide' }); }
};

// ========== SETTINGS & AUTH ==========
app.get('/api/settings', (req, res) => { const s = readJSON('settings.json'); res.json(s); });
app.post('/api/admin/login', (req, res) => {
  const s = readJSON('settings.json');
  if (req.body.email === 'metelluscarlinsky@gmail.com' && req.body.password === s.adminPassword && req.body.secret_code === 'carlinsky') {
    return res.json({ success: true, token: jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' }) });
  }
  res.status(401).json({ error: 'Idantifyan pa bon' });
});

// ========== MACHANN (MERCHANTS) API ==========
app.post('/api/merchant/register', (req, res) => {
  const merchants = readJSON('merchants.json');
  if (merchants.find(m => m.email === req.body.email)) return res.status(400).json({ error: 'Email sa a deja itilize' });
  
  const newMerchant = {
    id: 'M' + Date.now(),
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    password: req.body.password,
    status: 'active', // active, suspended, pending
    sub_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 1 mwa gratis
    created_at: new Date().toISOString()
  };
  merchants.push(newMerchant);
  writeJSON('merchants.json', merchants);
  res.json({ success: true });
});

app.post('/api/merchant/login', (req, res) => {
  const merchants = readJSON('merchants.json');
  const m = merchants.find(x => x.email === req.body.email && x.password === req.body.password);
  if (!m) return res.status(401).json({ error: 'Email oswa modpas pa bon' });
  if (m.status === 'suspended') return res.status(403).json({ error: 'Kont ou sispann. Tanpri peye abònman w.' });
  
  res.json({ success: true, token: jwt.sign({ id: m.id, role: 'merchant' }, JWT_SECRET, { expiresIn: '24h' }), merchant: m });
});

// Admin wè tout machann yo
app.get('/api/admin/merchants', verifyAdmin, (req, res) => res.json(readJSON('merchants.json')));

// Admin konfime pèman (Ajoute 30 jou)
app.put('/api/admin/merchants/:id/pay', verifyAdmin, (req, res) => {
  let merchants = readJSON('merchants.json');
  const m = merchants.find(x => x.id === req.params.id);
  if (m) {
    m.status = 'active';
    m.sub_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    writeJSON('merchants.json', merchants);
  }
  res.json({ success: true });
});

// Admin sispann yon machann
app.put('/api/admin/merchants/:id/suspend', verifyAdmin, (req, res) => {
  let merchants = readJSON('merchants.json');
  const m = merchants.find(x => x.id === req.params.id);
  if (m) { m.status = 'suspended'; writeJSON('merchants.json', merchants); }
  res.json({ success: true });
});

// ========== PWODUI (Vandè ak Admin) ==========
app.get('/api/products', (req, res) => {
  let p = readJSON('products.json');
  const merchants = readJSON('merchants.json');
  // Sèlman montre pwodui machann ki aktif yo
  p = p.filter(x => !x.merchant_id || merchants.find(m => m.id === x.merchant_id && m.status === 'active'));
  res.json(p.reverse());
});

app.post('/api/admin/products', verifyAdmin, (req, res) => {
  const p = readJSON('products.json'); const np = { ...req.body, id: p.length + 1, created_at: new Date().toISOString() }; p.push(np); writeJSON('products.json', p); res.json({ success: true });
});

app.delete('/api/admin/products/:id', verifyAdmin, (req, res) => {
  let p = readJSON('products.json'); p = p.filter(x => x.id !== parseInt(req.params.id)); writeJSON('products.json', p); res.json({ success: true });
});

app.get('/api/categories', (req, res) => res.json([{id:1,name:'Manje'},{id:2,name:'Bwason'},{id:3,name:'Vètman'},{id:4,name:'Elektwonik'}]));

// ========== KÒMAND ==========
app.post('/api/order', (req, res) => {
  const orders = readJSON('orders.json');
  const products = readJSON('products.json');
  const merchants = readJSON('merchants.json');
  
  // Jwenn machann lan ki posede premye pwodui nan kòmand lan
  let merchant_id = null, merchant_phone = null, merchant_name = null;
  if (req.body.items && req.body.items.length > 0) {
    const p = products.find(x => x.id === req.body.items[0].id);
    if (p && p.merchant_id) {
      const m = merchants.find(x => x.id === p.merchant_id);
      if (m) { merchant_id = m.id; merchant_phone = m.phone; merchant_name = m.name; }
    }
  }

  const o = { ...req.body, id: orders.length + 1, merchant_id, merchant_phone, merchant_name, status: 'pending', created_at: new Date().toISOString() };
  orders.push(o); writeJSON('orders.json', orders); res.json({ success: true, order_id: o.id });
});

app.get('/api/admin/orders', verifyAdmin, (req, res) => res.json(readJSON('orders.json').reverse()));
app.get('/api/admin/affiliates', verifyAdmin, (req, res) => res.json(readJSON('affiliates.json')));
app.get('/api/affiliates', (req, res) => res.json(readJSON('affiliates.json')));

const upload = multer({ dest: TMP_DIR });
app.post('/api/admin/upload-logo', verifyAdmin, upload.single('logo'), (req, res) => {
  if (req.file === undefined) return res.status(400).json({ error: 'Pa gen fichye' });
  const fileName = 'logo' + (path.extname(req.file.originalname) || '.png');
  fs.renameSync(req.file.path, path.join(__dirname, 'public', fileName));
  res.json({ success: true, url: '/' + fileName });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/affiliate', express.static(path.join(__dirname, 'affiliate')));
app.use('/merchant', express.static(path.join(__dirname, 'merchant')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.listen(process.env.PORT || 8000, '0.0.0.0', () => console.log('🌴 OGSUN (Multi-Vendor) sou pò ' + (process.env.PORT || 8000)));
