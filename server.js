require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const app = express();

// ========== SEKIRITE ==========
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use('/api/', rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 100,
  validate: { trustProxy: false },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ========== DOSYE DATA ==========
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readJSON(name) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

// ========== INISYALIZE DONE — SÈLMAN SI FICHYE A PA EGZISTE ==========
// 🔒 PA JANM EKRAZE DONE KI DEJA EGZISTE!

function initIfNotExists(filename, defaultData) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    writeJSON(filename, defaultData);
    console.log('✅ Kreye ' + filename + ' (premye fwa)');
  } else {
    console.log('📂 ' + filename + ' deja egziste — KONSÈVE!');
  }
}

initIfNotExists('categories.json', [
  { id:1, name:'Manje', slug:'manje' },
  { id:2, name:'Bwason', slug:'bwason' },
  { id:3, name:'Vètman', slug:'vetman' },
  { id:4, name:'Elektwonik', slug:'elektwonik' },
  { id:5, name:'Kay ak Jaden', slug:'kay' },
  { id:6, name:'Bote ak Swen', slug:'bote' },
  { id:7, name:'Sante', slug:'sante' },
  { id:8, name:'Lwazi', slug:'lwazi' },
  { id:9, name:'Edikasyon', slug:'edikasyon' },
  { id:10, name:'Lòt', slug:'lot' }
]);

initIfNotExists('products.json', [
  { id:1, name:'Diri blan 1 sak', description:'Diri lokal 25 lb', price:1500, image_url:'logo.png', category_id:1, created_at: new Date().toISOString() },
  { id:2, name:'Ji pòm', description:'Ji pòm natirèl 1 lit', price:500, image_url:'logo.png', category_id:2, created_at: new Date().toISOString() },
  { id:3, name:'Mayo blan', description:'Mayo koton 100%', price:800, image_url:'logo.png', category_id:3, created_at: new Date().toISOString() },
  { id:4, name:'Telefòn pòtatif', description:'Telefòn entelijan debaz', price:5000, image_url:'logo.png', category_id:4, created_at: new Date().toISOString() }
]);

initIfNotExists('orders.json', []);
initIfNotExists('commissions.json', []);

initIfNotExists('affiliates.json', (() => {
  const affs = [];
  for (let i = 1; i <= 10; i++) {
    affs.push({ 
      id: i, name: 'Afilye ' + i, code: 'AF00' + i, 
      commission_percent: 5 + (i % 6),
      clicks: 0, total_sales: 0, total_revenue: 0, total_commission: 0
    });
  }
  return affs;
})());

// ========== KONFIG ADMIN ==========
const JWT_SECRET = process.env.JWT_SECRET || 'OgsunSecret2026!';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'metelluscarlinsky@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'OGPLUG45';
const ADMIN_SECRET_CODE = process.env.ADMIN_SECRET_CODE || 'carlinsky';

const verifyAdmin = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Non otorize' });
  try { jwt.verify(token.replace('Bearer ', ''), JWT_SECRET); next(); }
  catch (e) { res.status(401).json({ error: 'Token invalide' }); }
};

// ========== API PIBLIK ==========

app.get('/api/categories', (req, res) => res.json(readJSON('categories.json')));

app.get('/api/products', (req, res) => {
  let products = readJSON('products.json');
  const categories = readJSON('categories.json');
  products = products.map(p => ({
    ...p,
    categories: { name: categories.find(c => c.id === p.category_id)?.name || '' }
  }));
  if (req.query.category) {
    const cat = categories.find(c => c.slug === req.query.category);
    if (cat) products = products.filter(p => p.category_id === cat.id);
    else return res.json([]);
  }
  res.json(products.reverse());
});

app.post('/api/order', (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, items, total, delivery_fee, affiliate_code } = req.body;
    if (!customer_name || !customer_phone || !items || !total) {
      return res.status(400).json({ error: 'Chan obligatwa manke' });
    }
    const orders = readJSON('orders.json');
    const newOrder = {
      id: orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1,
      customer_name, customer_phone, customer_address, items, total,
      delivery_fee: delivery_fee || 0,
      affiliate_code: affiliate_code || null,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    orders.push(newOrder);
    writeJSON('orders.json', orders);

    if (affiliate_code) {
      const affiliates = readJSON('affiliates.json');
      const affiliate = affiliates.find(a => a.code === affiliate_code);
      if (affiliate) {
        const commissions = readJSON('commissions.json');
        const commissionAmount = total * affiliate.commission_percent / 100;
        commissions.push({
          id: commissions.length + 1,
          affiliate_code, affiliate_name: affiliate.name,
          order_id: newOrder.id, amount: total,
          commission: commissionAmount,
          created_at: new Date().toISOString()
        });
        writeJSON('commissions.json', commissions);
        affiliate.total_sales = (affiliate.total_sales || 0) + 1;
        affiliate.total_revenue = (affiliate.total_revenue || 0) + total;
        affiliate.total_commission = (affiliate.total_commission || 0) + commissionAmount;
        writeJSON('affiliates.json', affiliates);
      }
    }
    res.json({ success: true, order_id: newOrder.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== API AFILYE PIBLIK ==========

app.get('/api/affiliates', (req, res) => {
  const affiliates = readJSON('affiliates.json');
  res.json(affiliates.map(a => ({
    id: a.id, name: a.name, code: a.code, commission_percent: a.commission_percent
  })));
});

app.get('/api/affiliate/stats', (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Kòd afilye obligatwa' });
  const affiliates = readJSON('affiliates.json');
  const affiliate = affiliates.find(a => a.code === code);
  if (!affiliate) return res.status(404).json({ error: 'Afilye pa jwenn' });
  const commissions = readJSON('commissions.json');
  const myCommissions = commissions.filter(c => c.affiliate_code === code);
  res.json({
    name: affiliate.name, code: affiliate.code,
    commission_percent: affiliate.commission_percent,
    clicks: affiliate.clicks || 0,
    total_sales: affiliate.total_sales || 0,
    total_revenue: affiliate.total_revenue || 0,
    total_commission: affiliate.total_commission || 0,
    recent_commissions: myCommissions.slice(-10).reverse()
  });
});

app.get('/api/affiliate/click', (req, res) => {
  const { ref } = req.query;
  if (ref) {
    const affiliates = readJSON('affiliates.json');
    const affiliate = affiliates.find(a => a.code === ref);
    if (affiliate) {
      affiliate.clicks = (affiliate.clicks || 0) + 1;
      writeJSON('affiliates.json', affiliates);
    }
  }
  res.json({ success: true });
});

// ========== ADMIN AUTH ==========

app.post('/api/admin/login', (req, res) => {
  const { email, password, secret_code } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD && secret_code === ADMIN_SECRET_CODE) {
    const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token });
  }
  res.status(401).json({ error: 'Idantifyan pa bon' });
});

// ========== API ADMIN ==========

app.get('/api/admin/orders', verifyAdmin, (req, res) => {
  res.json(readJSON('orders.json').reverse());
});

app.delete('/api/admin/orders/:id', verifyAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  let orders = readJSON('orders.json');
  const index = orders.findIndex(o => o.id === id);
  if (index === -1) return res.status(404).json({ error: 'Kòmand pa jwenn' });
  orders.splice(index, 1);
  writeJSON('orders.json', orders);
  res.json({ success: true });
});

app.get('/api/admin/affiliates', verifyAdmin, (req, res) => {
  const affiliates = readJSON('affiliates.json');
  const commissions = readJSON('commissions.json');
  res.json(affiliates.map(a => ({
    ...a,
    recent_commissions: commissions.filter(c => c.affiliate_code === a.code).slice(-5).reverse()
  })));
});

app.post('/api/admin/affiliates', verifyAdmin, (req, res) => {
  try {
    const { name, code, commission_percent } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Non ak kòd obligatwa' });
    const affs = readJSON('affiliates.json');
    if (affs.find(a => a.code === code)) return res.status(400).json({ error: 'Kòd sa a deja egziste!' });
    const newAff = {
      id: affs.length > 0 ? Math.max(...affs.map(a => a.id)) + 1 : 1,
      name, code,
      commission_percent: commission_percent || 5,
      clicks: 0, total_sales: 0, total_revenue: 0, total_commission: 0
    };
    affs.push(newAff);
    writeJSON('affiliates.json', affs);
    res.json({ success: true, id: newAff.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/affiliates/:id', verifyAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let affiliates = readJSON('affiliates.json');
    const index = affiliates.findIndex(a => a.id === id);
    if (index === -1) return res.status(404).json({ error: 'Afilye pa jwenn' });
    affiliates.splice(index, 1);
    writeJSON('affiliates.json', affiliates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

app.post('/api/admin/upload', verifyAdmin, upload.single('image'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Pa gen fichye' });
  const ext = path.extname(file.originalname);
  const newName = Date.now() + ext;
  fs.renameSync(file.path, path.join(uploadDir, newName));
  res.json({ success: true, url: '/uploads/' + newName });
});

app.post('/api/admin/products', verifyAdmin, (req, res) => {
  const { name, description, price, image_url, category_id } = req.body;
  if (!name || !price || !category_id) return res.status(400).json({ error: 'Chan obligatwa manke' });
  const products = readJSON('products.json');
  const newProduct = {
    id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
    name, description: description || '', price: parseFloat(price),
    image_url: image_url || 'logo.png', category_id: parseInt(category_id),
    created_at: new Date().toISOString()
  };
  products.push(newProduct);
  writeJSON('products.json', products);
  res.json({ success: true, id: newProduct.id });
});

app.delete('/api/admin/products/:id', verifyAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  let products = readJSON('products.json');
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Pwodui pa jwenn' });
  products.splice(index, 1);
  writeJSON('products.json', products);
  res.json({ success: true });
});

// ========== FICHYE ESTATIK ==========
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/affiliate', express.static(path.join(__dirname, 'affiliate')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ========== KÒMANSE SÈVÈ ==========
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🌴 OGSUN MACHE LAKAY sou pò ' + PORT);
  console.log('🔒 Done ou yo PÈSISTE — pa janm efase!');
});
