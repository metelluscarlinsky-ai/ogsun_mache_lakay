const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tbgltnltmbeobfsctixt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2x0bmx0bWJlb2Jmc2N0aXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzcxMywiZXhwIjoyMTAwMzIzNzEzfQ.HvP5aRKwjIXbJIaUdIT4_04nun9hNv6tD-UClQ-G-cA';
const supabase = createClient(supabaseUrl, supabaseKey);
const DATA_DIR = path.join(__dirname, 'data');

async function syncTable(t, f) {
    const p = path.join(DATA_DIR, f);
    if (fs.existsSync(p) === false) return console.log('Pa gen ' + f);
    
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (d.length === 0) return console.log(f + ' vid.');
    
    console.log('K ap voye ' + d.length + ' done pou ' + t + '...');
    const { error } = await supabase.from(t).upsert(d);
    
    if (error) console.error('Erè pou ' + t + ': ' + error.message);
    else console.log('✅ ' + t + ' fini ak siksè!');
}

async function run() {
    await syncTable('products', 'products.json');
    await syncTable('orders', 'orders.json');
    await syncTable('affiliates', 'affiliates.json');
    await syncTable('commissions', 'commissions.json');
    console.log('🎉 Tout done yo voye sou Supabase!');
}
run();
