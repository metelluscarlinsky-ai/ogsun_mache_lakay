// ==========================================
// KÒD POU SWIV VANT (AFFILIATE TRACKING)
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // 1. Nou chèche si gen yon kòd afilye nan URL a (pa egzanp: ?ref=AF001)
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
        console.log("Kòd afilye jwenn:", refCode);

        // 2. Nou voye enfòmasyon yo bay sèvè prensipal la (OGCARS/Shop lan)
        fetch('https://ogsunentreprise.onrender.com/api/admin/webhook/sale', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                referral_code: refCode,
                customer_name: 'Non Kliyan an', // Ou ka modifye sa si w gen enfòmasyon kliyan an
                amount: 1500, // Montan an (GDS)
                site_source: 'OGCARS', // Non sit la
                secret: 'OGSUN_SECRET_KEY' // Sekrè a
            })
        })
        .then(response => {
            if (response.ok) {
                console.log("✅ Vant lan byen anrejistre pou afilye a.");
            } else {
                console.log("⚠️ Sèvè a reponn ak yon erè.");
            }
        })
        .catch(err => {
            console.error("❌ Erè koneksyon lè w ap voye tracking lan:", err);
        });
    }
});
