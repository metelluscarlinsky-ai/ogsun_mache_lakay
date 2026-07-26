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
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 100, validate: { trustProxy: false }, standardHeaders: true, legacyHeaders: false }));

// ========== SUPABASE ==========
const supabase = createClient(
  'https://tbgltnltmbeobfsctixt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2x0bmx0bWJlb2Jmc2N0aXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzcxMywiZXhwIjoyMTAwMzIzNzEzfQ.HvP5aRKwjIXbJIaUdIT4_04nun9hNv6tD-UClQ-G-cA'
);

// ========== ADMIN ==========
const JWT_SECRET = 'OgsunSecret2026!';
const verifyAdmin = (req, res, next) => {
  const t = req.headers['authorization'];
  if (!t) return res.status(401).json({ error: 'Non otorize' });
  try { jwt.verify(t.replace('Bearer ', ''), JWT_SECRET); next(); }
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

// ========== API PIBLIK ==========
app.get('/api/categories', (req, res) => res.json(categories));

app.get('/api/products', async (req, res) => {
  try {
    let query = supabase.from('products').select('*');
    if (req.query.category) query = query.eq('category_id', parseInt(req.query.category));
    const { data } = await query.order('id', { ascending: false });
    res.json((data || []).map(p => ({ ...p, categories: { name: categories.find(c => c.id === p.category_id)?.name || '' } })));
  } catch(e) { res.json([]); }
});

app.post('/api/order', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, items, total, delivery_fee, affiliate_code } = req.body;
    if (!customer_name || !customer_phone || !items || !total) return res.status(400).json({ error: 'Chan obligatwa manke' });

    let an = null;
    if (affiliate_code) {
      const { data: aff } = await supabase.from('affiliates').select('name').eq('code', affiliate_code).single();
      if (aff) an = aff.name;
    }

    const { data, error } = await supabase.from('orders').insert([{
      customer_name, customer_phone, customer_address, items, total,
      delivery_fee: delivery_fee || 0, affiliate_code: affiliate_code || null, affiliate_name: an
    }]).select();
    if (error) throw error;

    if (affiliate_code && an) {
      const { data: aff } = await supabase.from('affiliates').select('*').eq('code', affiliate_code).single();
      if (aff) {
        const comm = total * (aff.commission_percent || 5) / 100;
        await supabase.from('commissions').insert([{ affiliate_code, affiliate_name: an, order_id: data[0].id, amount: total, commission: comm }]);
        await supabase.from('affiliates').update({
          total_sales: (aff.total_sales || 0) + 1,
          total_revenue: (aff.total_revenue || 0) + total,
          total_commission: (aff.total_commission || 0) + comm
        }).eq('code', affiliate_code);
      }
    }
    res.json({ success: true, order_id: data[0].id, affiliate_name: an });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== AFILYE ==========
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

// ========== ADMIN ==========
app.post('/api/admin/login', (req, res) => {
  const { email, password, secret_code } = req.body;
  if (email === 'metelluscarlinsky@gmail.com' && password === 'OGPLUG45' && secret_code === 'carlinsky') {
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

app.post('/api/admin/products', verifyAdmin, async (req, res) => {
  const { name, description, price, image_url, category_id } = req.body;
  if (!name || !price || !category_id) return res.status(400).json({ error: 'Chan obligatwa manke' });
  const { data, error } = await supabase.from('products').insert([{ name, description, price, image_url: image_url || 'logo.png', category_id }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: data[0].id });
});

app.delete('/api/admin/products/:id', verifyAdmin, async (req, res) => {
  await supabase.from('products').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// ========== UPLOAD IMAJ SOU SUPABASE STORAGE ==========
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/admin/upload', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Pa gen fichye! Chwazi yon foto.' });

    const buffer = req.file.buffer;
    const fileName = Date.now() + '_' + req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '');
    const contentType = req.file.mimetype || 'image/png';

    console.log('📸 Uploading:', fileName, '(' + (buffer.length / 1024).toFixed(1) + ' KB)');

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error('Supabase storage error:', error);
      return res.status(500).json({ error: 'Upload echwe: ' + error.message });
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    console.log('✅ Uploaded:', imageUrl);
    res.json({ success: true, url: imageUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload echwe: ' + err.message });
  }
});
// ========== ESTATIK ==========
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/affiliate', express.static(path.join(__dirname, 'affiliate')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(process.env.PORT || 8000, '0.0.0.0', () => console.log('🌴 OGSUN MACHE LAKAY + ☁️ Supabase'));

