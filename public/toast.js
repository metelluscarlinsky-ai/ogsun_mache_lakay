function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        success: 'background: #00d494; color: #000;',
        error: 'background: #ef4444; color: #fff;'
    };
    
    toast.style.cssText = `
        ${colors[type] || colors.success}
        padding: 12px 24px; border-radius: 30px; font-weight: bold; font-family: sans-serif; font-size: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 10px;
        animation: slideDown 0.3s ease forwards; pointer-events: auto;
    `;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOutUp 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Ajoute animasyon CSS la nan tèt paj la
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeOutUp { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-20px); } }
`;
document.head.appendChild(style);

const Toast = { success: (msg) => showToast(msg, 'success'), error: (msg) => showToast(msg, 'error') };
