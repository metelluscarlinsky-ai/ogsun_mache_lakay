require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// ========== VERIFIKASYON ANVIWÒNMAN (POU RENDER PA CRASH) ==========
const requiredEnv = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'EMAIL_USER', 'EMAIL_PASS'];
let missingEnv = [];
requiredEnv.forEach(env => {
    if (!process.env[env]) missingEnv.push(env);
});

if (missingEnv.length > 0) {
    console.error("❌ ERÈ FATAL: Varyab anviwònman sa yo MANKE sou Render:", missingEnv.join(', '));
    console.error("👉 Ale nan Render Dashboard -> Environment epi ajoute yo.");
    process.exit(1); // Fèmen pwopman pou Render wè erè a
}

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== SUPABASE ==========
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ========== IMÈL ==========
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const JWT_SECRET = process.env.JWT_SECRET;

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

// ========== MACHANN (AK OTP) ==========
app.post('/api/merchant/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  const id = 'M' + Date.now();
  const sub_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const { error } = await supabase.from('merchants').insert([{ 
      id, name, email, phone, password, status: 'active', sub_end, is_verified: false, otp_code: otp 
  }]);
  
  if (error) return res.status(400).json({ error: error.message });
  
  const mailOptions = {
    from: '"OGSUN MACHE LAKAY" <' + process.env.EMAIL_USER + '>',
    to: email,
    subject: 'Kòd Verifikasyon Kont Machann Ou - OGSUN',
    html: `<div style="font-family: Arial; text-align: center;">
            <h2 style="color: #0a3d0a;">Byenveni sou OGSUN!</h2>
            <p>Bonjou <b>${name}</b>, men kòd verifikasyon w lan:</p>
            <h1 style="color: #00d494; letter-spacing: 5px;">${otp}</h1>
           </div>`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Kòd voye nan imèl.' });
  } catch (mailError) {
    console.error('Erè voye imèl:', mailError);
    await supabase.from('merchants').delete().eq('email', email); // Efase si imèl la pa ale
    res.status(500).json({ error: 'Pa t kapab voye imèl. Verifye App Password la.' });
  }
});

app.post('/api/merchant/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const { data: m, error } = await supabase.from('merchants').select('*').eq('email', email).single();
  if (error || !m) return res.status(404).json({ error: 'Machann pa jwenn' });
  
  if (m.otp_code === otp) {
      await supabase.from('merchants').update({ is_verified: true, otp_code: null }).eq('email', email);
      res.json({ success: true, message: 'Kont verifye!' });
  } else {
      res.status(400).json({ error: 'Kòd la pa bon.' });
  }
});

app.post('/api/merchant/login', async (req, res) => {
  const { data: m, error } = await supabase.from('merchants').select('*').eq('email', req.body.email).eq('password', req.body.password).single();
  if (error || !m) return res.status(401).json({ error: 'Email oswa modpas pa bon' });
  if (!m.is_verified) return res.status(403).json({ error: 'Tanpri verifye imèl ou anvan.' });
  if (m.status === 'suspended') return res.status(403).json({ error: 'Kont ou sispann.' });
  
  res.json({ success: true, token: jwt.sign({ id: m.id, role: 'merchant' }, JWT_SECRET, { expiresIn: '24h' }), merchant: m });
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

// ========== PWODUI ==========
app.get('/api/products', async (req, res) => {
  const { data } = await supabase.from('products').select('*').order('id', { ascending: false });
  const cats = [{id:1,name:'Manje'},{id:2,name:'Bwason'},{id:3,name:'Vètman'},{id:4,name:'Elektwonik'},{id:5,name:'Kay'},{id:6,name:'Bote'},{id:7,name:'Sante'},{id:8,name:'Lwazi'},{id:9,name:'Edikasyon'},{id:10,name:'Lòt'}];
  const mappedData = (data || []).map(p => ({ ...p, categories: { name: cats.find(c => c.id === p.category_id)?.name || 'Lòt' } }));
  res.json(mappedData);
});

const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/admin/products', upload.single('image'), async (req, res) => {
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

app.get('/api/affiliates', async (req, res) => {
  const { data } = await supabase.from('affiliates').select('*');
  res.json(data || []);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/affiliate', express.static(path.join(__dirname, 'affiliate')));
app.use('/merchant', express.static(path.join(__dirname, 'merchant')));

app.listen(process.env.PORT || 8000, '0.0.0.0', () => console.log('🌴 OGSUN (Supabase + Imèl) sou pò ' + (process.env.PORT || 8000)));
