require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const supabase = createClient(
  'https://tbgltnltmbeobfsctixt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2x0bmx0bWJlb2Jmc2N0aXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzcxMywiZXhwIjoyMTAwMzIzNzEzfQ.HvP5aRKwjIXbJIaUdIT4_04nun9hNv6tD-UClQ-G-cA'
);

const JWT_SECRET = 'OgsunSecret2026!';
const upload = multer({ storage: multer.memoryStorage() });

// ========== MIDDLEWARE POU SOOVE KÒD AFILYE A (30 JOU) ==========
app.use((req, res, next) => {
    if (req.query.ref) {
        res.cookie('affiliate_ref', req.query.ref, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    }
    next();
});

// ========== WOUT SEKRÈ POU THANK YOU PAGE LAN ==========
app.post('/api/webhook/sale', async (req, res) => {
    try {
        const { referral_code, customer_name, amount } = req.body;
        
        // Nou voye l bay Enterprise lan ak kle ki nan .env la
        await axios.post('https://ogsunentreprise.onrender.com/api/partner/webhook/sale', {
            api_key: process.env.OGSUN_API_KEY, // Kle a chache nan .env
            referral_code: referral_code,
            customer_name: customer_name,
            amount: amount,
            site_source: "OGSUN MACHE LAKAY"
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });
        
        console.log('✅ Webhook voye soti nan paj Thank You.');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erè webhook Thank You:', error.message);
        res.status(500).json({ error: 'Erè koneksyon' });
    }
});

// ========== ADMIN AUTH ==========
const verifyAdmin = (req, res, next) => {
  const t = req.headers['authorization'];
  if (!t) return res.status(401).json({ error: 'Non otorize' });
  try { jwt.verify(t.replace('Bearer ', ''), JWT_SECRET); next(); } catch(e) { res.status(401).json({ error: 'Token invalide' }); }
};

app.post('/api/admin/login', (req, res) => {
  if (req.body.email === 'metelluscarlinsky@gmail.com' && req.body.password === 'OGPLUG45' && req.body.secret_code === 'carlinsky') {
    return res.json({ success: true, token: jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' }) });
  }
  res.status(401).json({ error: 'Idantifyan pa bon' });
});

// ========== MACHANN ==========
app.post('/api/merchant/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  const id = 'M' + Date.now();
  const sub_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('merchants').insert([{ 
      id, name, email, phone, password, status: 'active', sub_end, is_verified: true
  }]);
  
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, message: 'Kont ou aktive!' });
});

app.post('/api/merchant/login', async (req, res) => {
  const { data: m, error } = await supabase.from('merchants').select('*').eq('email', req.body.email).eq('password', req.body.password).single();
  if (error || !m) return res.status(401).json({ error: 'Email oswa modpas pa bon' });
  if (m.status === 'suspended') return res.status(403).json({ error: 'Kont ou sispann.' });
  
  res.json({ success: true, token: jwt.sign({ id: m.id, role: 'merchant' }, JWT_SECRET, { expiresIn: '24h' }), merchant: m });
});

app.post('/api/merchant/products', upload.single('image'), async (req, res) => {
  try {
    let image_url = 'logo.png';
    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.png';
      const fileName = Date.now() + ext;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      image_url = urlData.publicUrl;
    }

    const { data, error } = await supabase.from('products').insert([{
      name: req.body.name, price: parseFloat(req.body.price), category_id: parseInt(req.body.category_id || 1),
      image_url: image_url, merchant_id: req.body.merchant_id || null,
      merchant_phone: req.body.merchant_phone || null, merchant_name: req.body.merchant_name || null
    }]).select();
    if (error) throw error;
    res.json({ success: true, id: data[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== KÒMAND ==========
app.post('/api/order', async (req, res) => {
  try {
    const refCode = req.query.ref || req.cookies.affiliate_ref;

    const { data, error } = await supabase.from('orders').insert([{
        customer_name: req.body.customer_name,
        customer_phone: req.body.customer_phone,
        customer_address: req.body.customer_address,
        items: req.body.items,
        total: req.body.total,
        delivery_fee: req.body.delivery_fee,
        affiliate_code: refCode || null,
        status: 'pending',
        created_at: new Date().toISOString()
    }]).select();

    if (error) throw error;
    res.json({ success: true, order_id: data[0].id });
  } catch (e) {
    console.error('Erè kòmand:', e);
    res.status(500).json({ error: e.message });
  }
});

// ========== LÒT API YO ==========
app.get('/api/products', async (req, res) => {
  const { data } = await supabase.from('products').select('*').order('id', { ascending: false });
  const cats = [{id:1,name:'Manje'},{id:2,name:'Bwason'},{id:3,name:'Vètman'},{id:4,name:'Elektwonik'},{id:5,name:'Kay'},{id:6,name:'Bote'},{id:7,name:'Sante'},{id:8,name:'Lwazi'},{id:9,name:'Edikasyon'},{id:10,name:'Lòt'}];
  res.json((data || []).map(p => ({ ...p, categories: { name: cats.find(c => c.id === p.category_id)?.name || 'Lòt' } })));
});

app.get('/api/categories', (req, res) => res.json([{id:1,name:'Manje'},{id:2,name:'Bwason'},{id:3,name:'Vètman'},{id:4,name:'Elektwonik'},{id:5,name:'Kay'},{id:6,name:'Bote'},{id:7,name:'Sante'},{id:8,name:'Lwazi'},{id:9,name:'Edikasyon'},{id:10,name:'Lòt'}]));

app.get('/api/admin/orders', verifyAdmin, async (req, res) => {
  const { data } = await supabase.from('orders').select('*').order('id', { ascending: false });
  res.json(data || []);
});

app.get('/api/admin/merchants', verifyAdmin, async (req, res) => {
  const { data } = await supabase.from('merchants').select('*');
  res.json(data || []);
});

app.put('/api/admin/merchants/:id/pay', verifyAdmin, async (req, res) => {
  const sub_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('merchants').update({ status: 'active', sub_end }).eq('id', req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/merchants/:id/suspend', verifyAdmin, async (req, res) => {
  await supabase.from('merchants').update({ status: 'suspended' }).eq('id', req.params.id);
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/merchant', express.static(path.join(__dirname, 'merchant')));

app.listen(process.env.PORT || 8000, '0.0.0.0', () => console.log('🌴 OGSUN sou pò ' + (process.env.PORT || 8000)));
