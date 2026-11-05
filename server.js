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

const supabase = createClient(
  'https://tbgltnltmbeobfsctixt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2x0bmx0bWJlb2Jmc2N0aXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzcxMywiZXhwIjoyMTAwMzIzNzEzfQ.HvP5aRKwjIXbJIaUdIT4_04nun9hNv6tD-UClQ-G-cA'
);

const JWT_SECRET = 'OgsunSecret2026!';
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

// ========== PWODUI ==========
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (error) throw error;
    
    // Nou ajoute non kategori yo manyèlman pou paj la ka afiche l
    const cats = [{id:1,name:'Manje'},{id:2,name:'Bwason'},{id:3,name:'Vètman'},{id:4,name:'Elektwonik'},{id:5,name:'Kay'},{id:6,name:'Bote'},{id:7,name:'Sante'},{id:8,name:'Lwazi'},{id:9,name:'Edikasyon'},{id:10,name:'Lòt'}];
    const mappedData = (data || []).map(p => ({
      ...p,
      categories: { name: cats.find(c => c.id === p.category_id)?.name || 'Lòt' }
    }));
    
    res.json(mappedData);
  } catch(e) { 
    console.error(e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/admin/products', verifyAdmin, upload.single('image'), async (req, res) => {
  // Fonksyon sa a deja la, nou kite l jan l ye a
});

const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/admin/upload', verifyAdmin, upload.single('image'), async (req, res) => {
  let image_url = 'logo.png';
  if (req.file) {
    const ext = path.extname(req.file.originalname) || '.png';
    const fileName = Date.now() + ext;
    const { error } = await supabase.storage.from('product-images').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      image_url = urlData.publicUrl;
    }
  }
  const { data, error } = await supabase.from('products').insert([{
    name: req.body.name, price: parseFloat(req.body.price), category_id: parseInt(req.body.category_id || 1),
    image_url: image_url, merchant_id: req.body.merchant_id || null,
    merchant_phone: req.body.merchant_phone || null, merchant_name: req.body.merchant_name || null
  }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: data[0].id });
});

app.get('/api/categories', (req, res) => res.json([{id:1,name:'Manje'},{id:2,name:'Bwason'},{id:3,name:'Vètman'},{id:4,name:'Elektwonik'},{id:5,name:'Kay'},{id:6,name:'Bote'},{id:7,name:'Sante'},{id:8,name:'Lwazi'},{id:9,name:'Edikasyon'},{id:10,name:'Lòt'}]));

app.get('/api/admin/orders', verifyAdmin, async (req, res) => {
  const { data } = await supabase.from('orders').select('*').order('id', { ascending: false });
  res.json(data || []);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/affiliate', express.static(path.join(__dirname, 'affiliate')));
app.use('/merchant', express.static(path.join(__dirname, 'merchant')));

app.listen(process.env.PORT || 8000, '0.0.0.0', () => console.log('🌴 OGSUN (Supabase) sou pò ' + (process.env.PORT || 8000)));
