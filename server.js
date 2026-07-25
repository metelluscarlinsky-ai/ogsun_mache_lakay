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
app.use(express.json({ limit: '10kb' }));
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 100, validate: { trustProxy: false }, standardHeaders: true, legacyHeaders: false }));

// ========== DOSYE ==========
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(n){ const f=path.join(DATA_DIR,n); if(!fs.existsSync(f)) return []; try{ return JSON.parse(fs.readFileSync(f,'utf8')); }catch(e){ return []; } }
function writeJSON(n,d){ fs.writeFileSync(path.join(DATA_DIR,n), JSON.stringify(d,null,2)); }

// ========== SUPABASE ==========
const supabase = createClient(
  'https://tbgltnltmbeobfsctixt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2x0bmx0bWJlb2Jmc2N0aXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzcxMywiZXhwIjoyMTAwMzIzNzEzfQ.HvP5aRKwjIXbJIaUdIT4_04nun9hNv6tD-UClQ-G-cA'
);

// ========== INISYALIZE ==========
if(!fs.existsSync(path.join(DATA_DIR,'categories.json'))) writeJSON('categories.json',[
  {id:1,name:'Manje',slug:'manje'},{id:2,name:'Bwason',slug:'bwason'},{id:3,name:'Vètman',slug:'vetman'},
  {id:4,name:'Elektwonik',slug:'elektwonik'},{id:5,name:'Kay ak Jaden',slug:'kay'},{id:6,name:'Bote ak Swen',slug:'bote'},
  {id:7,name:'Sante',slug:'sante'},{id:8,name:'Lwazi',slug:'lwazi'},{id:9,name:'Edikasyon',slug:'edikasyon'},{id:10,name:'Lòt',slug:'lot'}
]);
if(!fs.existsSync(path.join(DATA_DIR,'products.json'))) writeJSON('products.json',[
  {id:1,name:'Diri blan 1 sak',description:'Diri lokal 25 lb',price:1500,image_url:'logo.png',category_id:1,created_at:new Date().toISOString()},
  {id:2,name:'Ji pòm',description:'Ji pòm natirèl 1 lit',price:500,image_url:'logo.png',category_id:2,created_at:new Date().toISOString()},
  {id:3,name:'Mayo blan',description:'Mayo koton 100%',price:800,image_url:'logo.png',category_id:3,created_at:new Date().toISOString()},
  {id:4,name:'Telefòn pòtatif',description:'Telefòn entelijan debaz',price:5000,image_url:'logo.png',category_id:4,created_at:new Date().toISOString()}
]);
if(!fs.existsSync(path.join(DATA_DIR,'orders.json'))) writeJSON('orders.json',[]);
if(!fs.existsSync(path.join(DATA_DIR,'commissions.json'))) writeJSON('commissions.json',[]);
if(!fs.existsSync(path.join(DATA_DIR,'affiliates.json'))){
  const a=[]; for(let i=1;i<=10;i++) a.push({id:i,name:'Afilye '+i,code:'AF00'+i,commission_percent:5+(i%6),clicks:0,total_sales:0,total_revenue:0,total_commission:0});
  writeJSON('affiliates.json',a);
}

// ========== ADMIN KONFIG ==========
const JWT_SECRET='OgsunSecret2026!';
const ADMIN_EMAIL='metelluscarlinsky@gmail.com',ADMIN_PASSWORD='OGPLUG45',ADMIN_SECRET_CODE='carlinsky';
const verifyAdmin=(req,res,next)=>{
  const t=req.headers['authorization']; if(!t) return res.status(401).json({error:'Non otorize'});
  try{jwt.verify(t.replace('Bearer ',''),JWT_SECRET);next();}catch(e){res.status(401).json({error:'Token invalide'});}
};

// ========== API PIBLIK ==========
app.get('/api/categories',(req,res)=>res.json(readJSON('categories.json')));

app.get('/api/products',(req,res)=>{
  let p=readJSON('products.json'); const c=readJSON('categories.json');
  p=p.map(x=>({...x,categories:{name:c.find(y=>y.id===x.category_id)?.name||''}}));
  if(req.query.category){ const cat=c.find(y=>y.slug===req.query.category); if(cat) p=p.filter(x=>x.category_id===cat.id); else return res.json([]); }
  res.json(p.reverse());
});

app.post('/api/order',(req,res)=>{
  try{
    const {customer_name,customer_phone,customer_address,items,total,delivery_fee,affiliate_code}=req.body;
    if(!customer_name||!customer_phone||!items||!total) return res.status(400).json({error:'Chan obligatwa manke'});
    let an=null;
    if(affiliate_code){ const aff=readJSON('affiliates.json').find(a=>a.code===affiliate_code); if(aff) an=aff.name; }
    const orders=readJSON('orders.json');
    const o={id:orders.length+1,customer_name,customer_phone,customer_address:customer_address||'',items,total,delivery_fee:delivery_fee||0,affiliate_code:affiliate_code||null,affiliate_name:an,status:'pending',created_at:new Date().toISOString()};
    orders.push(o); writeJSON('orders.json',orders);
    if(affiliate_code&&an){
      const affs=readJSON('affiliates.json'); const aff=affs.find(a=>a.code===affiliate_code);
      if(aff){
        const comm=total*(aff.commission_percent||5)/100;
        const comms=readJSON('commissions.json'); comms.push({id:comms.length+1,affiliate_code,affiliate_name:an,order_id:o.id,amount:total,commission:comm,created_at:new Date().toISOString()}); writeJSON('commissions.json',comms);
        aff.total_sales=(aff.total_sales||0)+1; aff.total_revenue=(aff.total_revenue||0)+total; aff.total_commission=(aff.total_commission||0)+comm; writeJSON('affiliates.json',affs);
      }
    }
    res.json({success:true,order_id:o.id,affiliate_name:an});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/affiliates',(req,res)=>{ const a=readJSON('affiliates.json'); res.json(a.map(x=>({id:x.id,name:x.name,code:x.code,commission_percent:x.commission_percent}))); });
app.get('/api/affiliate/stats',(req,res)=>{
  const {code}=req.query; if(!code) return res.status(400).json({error:'Kòd obligatwa'});
  const a=readJSON('affiliates.json').find(x=>x.code===code); if(!a) return res.status(404).json({error:'Afilye pa jwenn'});
  const c=readJSON('commissions.json').filter(x=>x.affiliate_code===code).slice(-10).reverse();
  res.json({...a,recent_commissions:c});
});
app.get('/api/affiliate/click',(req,res)=>{
  const {ref}=req.query; if(ref){ const a=readJSON('affiliates.json'); const f=a.find(x=>x.code===ref); if(f){f.clicks=(f.clicks||0)+1;writeJSON('affiliates.json',a);} }
  res.json({success:true});
});

// ========== ADMIN AUTH ==========
app.post('/api/admin/login',(req,res)=>{
  const {email,password,secret_code}=req.body;
  if(email===ADMIN_EMAIL&&password===ADMIN_PASSWORD&&secret_code===ADMIN_SECRET_CODE) return res.json({success:true,token:jwt.sign({email,role:'admin'},JWT_SECRET,{expiresIn:'24h'})});
  res.status(401).json({error:'Idantifyan pa bon'});
});

// ========== ADMIN API ==========
app.get('/api/admin/orders',verifyAdmin,(req,res)=>res.json(readJSON('orders.json').reverse()));
app.delete('/api/admin/orders/:id',verifyAdmin,(req,res)=>{ let o=readJSON('orders.json'); o=o.filter(x=>x.id!==parseInt(req.params.id)); writeJSON('orders.json',o); res.json({success:true}); });

app.get('/api/admin/affiliates',verifyAdmin,(req,res)=>res.json(readJSON('affiliates.json')));
app.post('/api/admin/affiliates',verifyAdmin,(req,res)=>{
  const {name,code,commission_percent}=req.body; if(!name||!code) return res.status(400).json({error:'Non ak kòd obligatwa'});
  const a=readJSON('affiliates.json'); if(a.find(x=>x.code===code)) return res.status(400).json({error:'Kòd deja egziste!'});
  a.push({id:a.length+1,name,code,commission_percent:commission_percent||5,clicks:0,total_sales:0,total_revenue:0,total_commission:0}); writeJSON('affiliates.json',a);
  res.json({success:true,id:a.length});
});
app.delete('/api/admin/affiliates/:id',verifyAdmin,(req,res)=>{ let a=readJSON('affiliates.json'); a=a.filter(x=>x.id!==parseInt(req.params.id)); writeJSON('affiliates.json',a); res.json({success:true}); });

app.post('/api/admin/products',verifyAdmin,(req,res)=>{
  const {name,description,price,image_url,category_id}=req.body;
  if(!name||!price||!category_id) return res.status(400).json({error:'Chan obligatwa manke'});
  const p=readJSON('products.json');
  const np={id:p.length+1,name,description:description||'',price:parseFloat(price),image_url:image_url||'logo.png',category_id:parseInt(category_id),created_at:new Date().toISOString()};
  p.push(np); writeJSON('products.json',p);
  res.json({success:true,id:np.id});
});
app.delete('/api/admin/products/:id',verifyAdmin,(req,res)=>{ let p=readJSON('products.json'); p=p.filter(x=>x.id!==parseInt(req.params.id)); writeJSON('products.json',p); res.json({success:true}); });

// ========== UPLOAD IMAJ (MEMORY STORAGE) ==========
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10*1024*1024 } });

app.post('/api/admin/upload', verifyAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Pa gen fichye! Chwazi yon foto.' });

    const buffer = req.file.buffer;
    const fileName = Date.now() + '_' + req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '');
    const contentType = req.file.mimetype || 'image/png';

    console.log('📸 Uploading:', fileName, '(' + (buffer.length/1024).toFixed(1) + ' KB)');

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, buffer, { contentType, upsert: true });

    if (error) {
      console.error('Supabase error:', error);
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
app.use(express.static(path.join(__dirname,'public')));
app.use('/admin', express.static(path.join(__dirname,'admin')));
app.use('/affiliate', express.static(path.join(__dirname,'affiliate')));
app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 8000;
app.listen(PORT,'0.0.0.0',()=>console.log('🌴 OGSUN MACHE LAKAY sou pò '+PORT+'\n☁️ Upload: Supabase Storage\n💾 Done: disk'));
