require('dotenv').config();
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, validate: { trustProxy: false }, standardHeaders: true, legacyHeaders: false }));

// ========== SUPABASE ==========
const supabase = createClient(
  'https://tbgltnltmbeobfsctixt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2x0bmx0bWJlb2Jmc2N0aXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzcxMywiZXhwIjoyMTAwMzIzNzEzfQ.HvP5aRKwjIXbJIaUdIT4_04nun9hNv6tD-UClQ-G-cA'
);

const JWT_SECRET = 'OgsunSecret2026!';
const ADMIN_EMAIL = 'metelluscarlinsky@gmail.com';
const ADMIN_PASSWORD = 'OGPLUG45';
const ADMIN_SECRET_CODE = 'carlinsky';

const verifyAdmin = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Non otorize' });
  try { jwt.verify(token.replace('Bearer ', ''), JWT_SECRET); next(); }
  catch(e) { res.status(401).json({ error: 'Token invalide' }); }
};

// ========== KATEGORI (FIKSE) ==========
const categories = [
  { id:1, name:'Manje', slug:'manje' }, { id:2, name:'Bwason', slug:'bwason' },
  { id:3, name:'Vètman', slug:'vetman' }, { id:4, name:'Elektwonik', slug:'elektwonik' },
  { id:5, name:'Kay ak Jaden', slug:'kay' }, { id:6, name:'Bote ak Swen', slug:'bote' },
  { id:7, name:'Sante', slug:'sante' }, { id:8, name:'Lwazi', slug:'lwazi' },
  { id:9, name:'Edikasyon', slug:'edikasyon' }, { id:10, name:'Lòt', slug:'lot' }
];

// ========== API ==========

app.get('/api/categories', (req, res) => res.json(categories));

// PWODUI
app.get('/api/products', async (req, res) => {
  try {
    let query = supabase.from('products').select('*');
    if (req.query.category) query = query.eq('category_id', parseInt(req.query.category));
    const { data } = await query.order('id', { ascending: false });
    res.json(data || []);
  } catch(e) { res.json([]); }
});

app.post('/api/admin/products', verifyAdmin, async (req, res) => {
  try {
    const { name, description, price, image_url, category_id } = req.body;
    if (!name || !price || !category_id) return res.status(400).json({ error: 'Chan obligatwa manke' });
    const { data, error } = await supabase.from('products').insert([{
      name, description, price, image_url: image_url || 'logo.png', category_id
    }]).select();
    if (error) throw error;
    res.json({ success: true, id: data[0].id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/products/:id', verifyAdmin, async (req, res) => {
  await supabase.from('products').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// KÒMAND
app.post('/api/order', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, items, total, delivery_fee, affiliate_code } = req.body;
    if (!customer_name || !customer_phone || !items || !total) return res.status(400).json({ error: 'Chan obligatwa manke' });

    let affiliate_name = null;
    if (affiliate_code) {
      const { data: aff } = await supabase.from('affiliates').select('name').eq('code', affiliate_code).single();
      if (aff) affiliate_name = aff.name;
    }

    const { data, error } = await supabase.from('orders').insert([{
      customer_name, customer_phone, customer_address, items, total,
      delivery_fee, affiliate_code, affiliate_name
    }]).select();
    if (error) throw error;

    if (affiliate_code && affiliate_name) {
      const { data: aff } = await supabase.from('affiliates').select('*').eq('code', affiliate_code).single();
      if (aff) {
        const comm = total * (aff.commission_percent || 5) / 100;
        await supabase.from('commissions').insert([{ affiliate_code, affiliate_name, order_id: data[0].id, amount: total, commission: comm }]);
        await supabase.from('affiliates').update({
          total_sales: (aff.total_sales || 0) + 1,
          total_revenue: (aff.total_revenue || 0) + total,
          total_commission: (aff.total_commission || 0) + comm
        }).eq('code', affiliate_code);
      }
    }

    res.json({ success: true, order_id: data[0].id, affiliate_name });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// AFILYE
app.get('/api/affiliates', async (req, res) => {
  const { data } = await supabase.from('affiliates').select('id, name, code, commission_percent');
  res.json(data || []);
});

app.get('/api/affiliate/stats', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Kòd obligatwa' });
  const { data: aff } = await supabase.from('affiliates').select('*').eq('code', code).single();
  if (!aff) return res.status(404).json({ error: 'Afilye pa jwenn' });
  const { data: comm } = await supabase.from('commissions').select('*').eq('affiliate_code', code).order('id', { ascending: false }).limit(10);
  res.json({ ...aff, recent_commissions: comm || [] });
});

// ADMIN
app.post('/api/admin/login', (req, res) => {
  const { email, password, secret_code } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD && secret_code === ADMIN_SECRET_CODE) {
    return res.json({ success: true, token: jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' }) });
  }
  res.status(401).json({ error: 'Idantifyan pa bon' });
});

app.get('/api/admin/orders', verifyAdmin, async (req, res) => {
  const { data } = await supabase.from('orders').select('*').order('id', { ascending: false });
  res.json(data || []);
});

app.delete('/api/admin/orders/:id', verifyAdmin, async (req, res) => {
  await supabase.from('orders').delete().eq('id', req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/affiliates', verifyAdmin, async (req, res) => {
  const { data } = await supabase.from('affiliates').select('*');
  res.json(data || []);
});

app.post('/api/admin/affiliates', verifyAdmin, async (req, res) => {
  const { name, code, commission_percent } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Non ak kòd obligatwa' });
  const { data, error } = await supabase.from('affiliates').insert([{ name, code, commission_percent: commission_percent || 5 }]).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, id: data[0].id });
});

app.delete('/api/admin/affiliates/:id', verifyAdmin, async (req, res) => {
  await supabase.from('affiliates').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// UPLOAD
const upload = multer({ dest: path.join(__dirname, 'public', 'uploads') });
app.post('/api/admin/upload', verifyAdmin, upload.single('image'), (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'Pa gen fichye' });
  const name = Date.now() + path.extname(f.originalname);
  fs.renameSync(f.path, path.join(__dirname, 'public', 'uploads', name));
  res.json({ success: true, url: '/uploads/' + name });
});

// ESTATIK
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/affiliate', express.static(path.join(__dirname, 'affiliate')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(process.env.PORT || 8000, '0.0.0.0', () => console.log('🌴 OGSUN MACHE LAKAY ☁️ Supabase'));
