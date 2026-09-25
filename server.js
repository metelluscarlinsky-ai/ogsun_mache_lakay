require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 200, validate: { trustProxy: false } }));

// ========== DOSYE TANPORÈ ==========
const HOME_DIR = process.env.HOME || '/data/data/com.termux/files/home';
const TMP_DIR = path.join(HOME_DIR, 'ogsun-tmp');
const UPLOAD_DIR = path.join(HOME_DIR, 'ogsun-uploads');
[TMP_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ========== SUPABASE ==========
const supabase = createClient(
  'https://tbgltnltmbeobfsctixt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2x0bmx0bWJlb2Jmc2N0aXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzcxMywiZXhwIjoyMTAwMzIzNzEzfQ.HvP5aRKwjIXbJIaUdIT4_04nun9hNv6tD-UClQ-G-cA',
  { auth: { persistSession: false } }
);

console.log('☁️  Supabase konfigire');

// ========== KATEGORI (FIKSE) ==========
const categories = [
  { id:1, name:'Manje', slug:'manje' }, { id:2, name:'Bwason', slug:'bwason' },
  { id:3, name:'Vètman', slug:'vetman' }, { id:4, name:'Elektwonik', slug:'elektwonik' },
  { id:5, name:'Kay ak Jaden', slug:'kay' }, { id:6, name:'Bote ak Swen', slug:'bote' },
  { id:7, name:'Sante', slug:'sante' }, { id:8, name:'Lwazi', slug:'lwazi' },
  { id:9, name:'Edikasyon', slug:'edikasyon' }, { id:10, name:'Lòt', slug:'lot' }
];

// ========== ADMIN ==========
const JWT_SECRET = 'OgsunSecret2026!';
const verifyAdmin = (req, res, next) => {
  const t = req.headers['authorization'];
  if (!t) return res.status(401).json({ error: 'Non otorize' });
  try { jwt.verify(t.replace('Bearer ', ''), JWT_SECRET); next(); }
  catch(e) { res.status(401).json({ error: 'Token invalide' }); }
};

// ========== KATEGORI ==========
app.get('/api/categories', (req, res) => res.json(categories));

// ========== PWODUI ==========
app.get('/api/products', async (req, res) => {
  try {
    let query = supabase.from('products').select('*');
    if (req.query.category) query = query.eq('category_id', parseInt(req.query.category));
    const { data, error } = await query.order('id', { ascending: false });
    if (error) throw error;
    const products = (data || []).map(p => ({
      ...p,
      categories: { name: categories.find(c => c.id === p.category_id)?.name || '' }
    }));
    res.json(products);
  } catch(e) {
    console.error('Erè products:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/products', verifyAdmin, async (req, res) => {
  try {
    const { name, description, price, image_url, category_id } = req.body;
    if (!name || !price || !category_id) return res.status(400).json({ error: 'Chan obligatwa manke' });
    const { data, error } = await supabase.from('products').insert([{
      name, description: description || '', price: parseFloat(price),
      image_url: image_url || 'logo.png', category_id: parseInt(category_id)
    }]).select();
    if (error) throw error;
    res.json({ success: true, id: data[0].id });
  } catch(e) {
    console.error('Erè add product:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/products/:id', verifyAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', parseInt(req.params.id));
    if (error) throw error;
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== KÒMAND ==========
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
      customer_name, customer_phone, customer_address: customer_address || '',
      items, total: parseFloat(total),
      delivery_fee: parseFloat(delivery_fee) || 0,
      affiliate_code: affiliate_code || null,
      affiliate_name: affiliate_name || null,
      status: 'pending'
    }]).select();

    if (error) throw error;

    // Mete ajou komisyon afilye
    if (affiliate_code && affiliate_name) {
      const { data: aff } = await supabase.from('affiliates').select('*').eq('code', affiliate_code).single();
      if (aff) {
        const commissionAmount = parseFloat(total) * (aff.commission_percent || 5) / 100;

        await supabase.from('commissions').insert([{
          affiliate_code, affiliate_name, order_id: data[0].id,
          amount: parseFloat(total), commission: commissionAmount
        }]);

        await supabase.from('affiliates').update({
          total_sales: (aff.total_sales || 0) + 1,
          total_revenue: (parseFloat(aff.total_revenue) || 0) + parseFloat(total),
          total_commission: (parseFloat(aff.total_commission) || 0) + commissionAmount
        }).eq('code', affiliate_code);
      }
    }

    res.json({ success: true, order_id: data[0].id, affiliate_name });
  } catch(e) {
    console.error('Erè order:', e);
    res.status(500).json({ error: e.message });
  }
});

// ========== AFILYE ==========
app.get('/api/affiliates', async (req, res) => {
  try {
    const { data, error } = await supabase.from('affiliates').select('id, name, code, commission_percent');
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/affiliate/stats', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Kòd obligatwa' });
    const { data: aff, error } = await supabase.from('affiliates').select('*').eq('code', code).single();
    if (error || !aff) return res.status(404).json({ error: 'Afilye pa jwenn' });
    const { data: comm } = await supabase.from('commissions').select('*').eq('affiliate_code', code).order('id', { ascending: false }).limit(10);
    res.json({ ...aff, recent_commissions: comm || [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/affiliate/click', async (req, res) => {
  const { ref } = req.query;
  if (ref) {
    try {
      const { data: aff } = await supabase.from('affiliates').select('clicks').eq('code', ref).single();
      if (aff) {
        await supabase.from('affiliates').update({ clicks: (aff.clicks || 0) + 1 }).eq('code', ref);
      }
    } catch(e) {}
  }
  res.json({ success: true });
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
  try {
    const { data, error } = await supabase.from('orders').select('*').order('id', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/orders/:id', verifyAdmin, async (req, res) => {
  try {
    await supabase.from('orders').delete().eq('id', parseInt(req.params.id));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/affiliates', verifyAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('affiliates').select('*').order('id');
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/affiliates', verifyAdmin, async (req, res) => {
  try {
    const { name, code, commission_percent } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Non ak kòd obligatwa' });
    const { data, error } = await supabase.from('affiliates').insert([{
      name, code, commission_percent: parseFloat(commission_percent) || 5
    }]).select();
    if (error) throw error;
    res.json({ success: true, id: data[0].id });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/affiliates/:id', verifyAdmin, async (req, res) => {
  try {
    await supabase.from('affiliates').delete().eq('id', parseInt(req.params.id));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== UPLOAD IMAJ ==========
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/admin/upload', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Pa gen fichye' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const fileName = Date.now() + ext;

    // Eseye Supabase Storage
    try {
      const buffer = fs.readFileSync(req.file.path);
      const { error } = await supabase.storage.from('product-images').upload(fileName, buffer, {
        contentType: req.file.mimetype || 'image/png', upsert: true
      });
      if (!error) {
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
        fs.unlinkSync(req.file.path);
        return res.json({ success: true, url: urlData.publicUrl });
      }
    } catch(e) {}

    // Fallback lokal
    fs.renameSync(req.file.path, path.join(UPLOAD_DIR, fileName));
    res.json({ success: true, url: '/uploads/' + fileName });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== ESTATIK ==========
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/affiliate', express.static(path.join(__dirname, 'affiliate')));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ========== KÒMANSE ==========
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════════');
  console.log('🌴 OGSUN MACHE LAKAY');
  console.log('🌐 http://localhost:' + PORT);
  console.log('☁️  Done nan CLOUD Supabase');
  console.log('💾 Foto: Supabase Storage + lokal');
  console.log('════════════════════════════════════════');
});


