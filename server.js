require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== SUPABASE ==========
const supabase = createClient(
  'https://tbgltnltmbeobfsctixt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2x0bmx0bWJlb2Jmc2N0aXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzcxMywiZXhwIjoyMTAwMzIzNzEzfQ.HvP5aRKwjIXbJIaUdIT4_04nun9hNv6tD-UClQ-G-cA'
);

// ========== DOSYE SETTINGS ==========
const DATA_DIR = path.join(__dirname, 'data');
const TMP_DIR = path.join(__dirname, 'tmp');
if (fs.existsSync(DATA_DIR) === false) fs.mkdirSync(DATA_DIR);
if (fs.existsSync(TMP_DIR) === false) fs.mkdirSync(TMP_DIR);

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
if (fs.existsSync(SETTINGS_FILE) === false) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ siteTitle: 'OGSUN', themeColor: '#d4a017', logoUrl: '/logo.png', adminPassword: 'OGPLUG45' }, null, 2));
}

function getSettings() { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); }
function saveSettings(d) { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(d, null, 2)); }

// ========== ADMIN AUTH ==========
const JWT_SECRET = 'OgsunSecret2026!';
const verifyAdmin = (req, res, next) => {
  const t = req.headers['authorization'];
  if (t === undefined) return res.status(401).json({ error: 'Non otorize' });
  try { jwt.verify(t.replace('Bearer ', ''), JWT_SECRET); next(); }
  catch(e) { res.status(401).json({ error: 'Token invalide' }); }
};

app.post('/api/admin/login', (req, res) => {
  const settings = getSettings();
  const { email, password, secret_code } = req.body;
  if (email === 'metelluscarlinsky@gmail.com' && password === settings.adminPassword && secret_code === 'carlinsky') {
    return res.json({ success: true, token: jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' }) });
  }
  res.status(401).json({ error: 'Idantifyan pa bon' });
});

// ========== SETTINGS API ==========
app.get('/api/settings', (req, res) => {
  const s = getSettings();
  res.json({ siteTitle: s.siteTitle, themeColor: s.themeColor, logoUrl: s.logoUrl });
});
app.post('/api/admin/settings', verifyAdmin, (req, res) => {
  const s = getSettings(); const ns = { ...s, ...req.body }; saveSettings(ns); res.json({ success: true });
});

// ========== PWODUI (SUPABASE) ==========
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/products', verifyAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').insert([req.body]).select();
    if (error) throw error;
    res.json({ success: true, id: data[0].id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/products/:id', verifyAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== KATEGORI ==========
app.get('/api/categories', (req, res) => { 
  res.json([{id:1,name:'Manje'},{id:2,name:'Bwason'},{id:3,name:'Vètman'},{id:4,name:'Elektwonik'},{id:5,name:'Kay ak Jaden'},{id:6,name:'Bote ak Swen'},{id:7,name:'Sante'},{id:8,name:'Lwazi'},{id:9,name:'Edikasyon'},{id:10,name:'Lòt'}]); 
});

// ========== KÒMAND (SUPABASE) ==========
app.post('/api/order', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').insert([req.body]).select();
    if (error) throw error;
    res.json({ success: true, order_id: data[0].id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/orders', verifyAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('id', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== AFILYE (SUPABASE) ==========
app.get('/api/affiliates', async (req, res) => {
  try {
    const { data, error } = await supabase.from('affiliates').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/affiliates', verifyAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('affiliates').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== UPLOAD LOGO ==========
const upload = multer({ dest: TMP_DIR });
app.post('/api/admin/upload-logo', verifyAdmin, upload.single('logo'), (req, res) => {
  if (req.file === undefined) return res.status(400).json({ error: 'Pa gen fichye' });
  const ext = path.extname(req.file.originalname) || '.png';
  const fileName = 'logo' + ext;
  fs.renameSync(req.file.path, path.join(__dirname, 'public', fileName));
  res.json({ success: true, url: '/' + fileName });
});

// ========== ESTATIK ==========
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/affiliate', express.static(path.join(__dirname, 'affiliate')));

app.listen(process.env.PORT || 8000, '0.0.0.0', () => {
  console.log('════════════════════════════════════════');
  console.log('🌴 OGSUN MACHE LAKAY (Supabase Cloud)');
  console.log('🌐 http://localhost:' + (process.env.PORT || 8000));
  console.log('════════════════════════════════════════');
});
