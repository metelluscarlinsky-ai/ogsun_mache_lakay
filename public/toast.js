// ========== SISTÈM TOAST NOTIFICATIONS ==========

class Toast {
    static container = null;

    static init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    static show(message, type = 'success', duration = 3000) {
        this.init();

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || '📢'}</span>
            <span class="toast-message">${message}</span>
            <span class="toast-close">✕</span>
        `;

        // Fèmen lè klike
        toast.querySelector('.toast-close').onclick = () => {
            toast.remove();
        };

        // Fèmen lè klike sou toast la
        toast.onclick = (e) => {
            if (e.target === toast) toast.remove();
        };

        this.container.appendChild(toast);

        // Retire apre tan
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'fadeOut 0.5s ease forwards';
                setTimeout(() => toast.remove(), 500);
            }
        }, duration);
    }

    static success(message) { this.show(message, 'success'); }
    static error(message) { this.show(message, 'error'); }
    static info(message) { this.show(message, 'info'); }
    static warning(message) { this.show(message, 'warning'); }
}

// ========== KONFETI ==========
function launchConfetti() {
    const emojis = ['🎉', '🎊', '✨', '🌟', '💫', '🎯', '🔥', '💚', '🟡', '🟢'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.fontSize = (Math.random() * 20 + 15) + 'px';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 3500);
        }, i * 30);
    }
}

// ========== MODAL ==========
function showModal(title, message, icon = '🎉', onClose = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-icon">${icon}</div>
            <h2 class="modal-title">${title}</h2>
            <p class="modal-text">${message}</p>
            <button class="modal-btn" onclick="this.closest('.modal-overlay').remove(); ${onClose ? 'typeof ' + onClose + ' === "function" && ' + onClose + '()' : ''}">OK 👍</button>
        </div>
    `;
    
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
            if (onClose && typeof onClose === 'function') onClose();
        }
    };
    
    document.body.appendChild(overlay);
}

// ========== LOADING ==========
function showLoading(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner"></span> Chajman...';
    button.disabled = true;
    return () => {
        button.innerHTML = originalText;
        button.disabled = false;
    };
}

// ========== ANIMASYON BADGE PANIER ==========
function animateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
        badge.classList.add('pop');
        setTimeout(() => badge.classList.remove('pop'), 400);
    }
}

// Ekspòte fonksyon yo pou tout paj
window.Toast = Toast;
window.launchConfetti = launchConfetti;
window.showModal = showModal;
window.showLoading = showLoading;
window.animateCartBadge = animateCartBadge;
