const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const app = express();

// Middleware debaz
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Dosye data
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

// Inisyalize done
if (!fs.existsSync(path.join(DATA_DIR, 'categories.json'))) {
  writeJSON('categories.json', [
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
}

if (!fs.existsSync(path.join(DATA_DIR, 'products.json'))) {
  writeJSON('products.json', [
    { id:1, name:'Diri blan 1 sak', description:'Diri lokal 25 lb', price:1500, image_url:'logo.png', category_id:1 },
    { id:2, name:'Ji pòm', description:'Ji pòm natirèl 1 lit', price:500, image_url:'logo.png', category_id:2 },
    { id:3, name:'Mayo blan', description:'Mayo koton 100%', price:800, image_url:'logo.png', category_id:3 },
    { id:4, name:'Telefòn pòtatif', description:'Telefòn entelijan debaz', price:5000, image_url:'logo.png', category_id:4 }
  ]);
}

if (!fs.existsSync(path.join(DATA_DIR, 'orders.json'))) writeJSON('orders.json', []);
if (!fs.existsSync(path.join(DATA_DIR, 'affiliates.json'))) writeJSON('affiliates.json', []);

// Konfig admin
const JWT_SECRET = 'OgsunSecret2026!';
const ADMIN_EMAIL = 'metelluscarlinsky@gmail.com';
const ADMIN_PASSWORD = 'OGPLUG45';
const ADMIN_SECRET_CODE = 'carlinsky';

function verifyAdmin(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Non otorize' });
  try { jwt.verify(token.replace('Bearer ', ''), JWT_SECRET); next(); }
  catch (e) { res.status(401).json({ error: 'Token invalide' }); }
}

// ==================== API ====================

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
    const { customer_name, customer_phone, customer_address, items, total, delivery_fee } = req.body;
    if (!customer_name || !customer_phone || !items || !total) {
      return res.status(400).json({ error: 'Chan obligatwa manke' });
    }
    const orders = readJSON('orders.json');
    const newOrder = {
      id: orders.length + 1,
      customer_name, customer_phone, customer_address, items, total,
      delivery_fee: delivery_fee || 0,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    orders.push(newOrder);
    writeJSON('orders.json', orders);
    res.json({ success: true, order_id: newOrder.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { email, password, secret_code } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD && secret_code === ADMIN_SECRET_CODE) {
    const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token });
  }
  res.status(401).json({ error: 'Idantifyan pa bon' });
});

app.get('/api/admin/orders', verifyAdmin, (req, res) => {
  res.json(readJSON('orders.json').reverse());
});

// Upload imaj
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
    id: products.length + 1,
    name, description: description || '', price: parseFloat(price),
    image_url: image_url || 'logo.png', category_id: parseInt(category_id),
    created_at: new Date().toISOString()
  };
  products.push(newProduct);
  writeJSON('products.json', products);
  res.json({ success: true, id: newProduct.id });
});

// Fichye estatik
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Kòmanse
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => console.log('🌴 OGSUN MACHE LAKAY sou pò ' + PORT));
