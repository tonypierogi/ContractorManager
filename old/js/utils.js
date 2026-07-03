// ==================== UTILITY FUNCTIONS ====================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatAddress(profile, separator = '<br>') {
    const parts = [];
    if (profile.address_street) {
        parts.push(profile.address_street);
    }
    if (profile.address_street2) {
        parts.push(profile.address_street2);
    }
    if (profile.address_city || profile.address_state || profile.address_zip) {
        const cityStateZip = [];
        if (profile.address_city) cityStateZip.push(profile.address_city);
        if (profile.address_state) {
            if (profile.address_city) {
                cityStateZip[cityStateZip.length - 1] += ',';
            }
            cityStateZip.push(profile.address_state);
        }
        if (profile.address_zip) cityStateZip.push(profile.address_zip);
        parts.push(cityStateZip.join(' '));
    }
    return parts.length > 0 ? parts.join(separator) : 'Not provided';
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateForInput(date) {
    // Local date, NOT toISOString() (UTC) - evening times would shift to the next day
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function showConfirmModal(title, message, { okLabel = 'Confirm', okClass = 'btn-primary' } = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-message').textContent = message;
        const okBtn = document.getElementById('confirm-modal-ok');
        okBtn.textContent = okLabel;
        okBtn.className = 'btn ' + okClass;
        const close = (val) => { modal.classList.remove('active'); resolve(val); };
        document.getElementById('confirm-modal-cancel').onclick = () => close(false);
        document.getElementById('close-confirm-modal').onclick = () => close(false);
        okBtn.onclick = () => close(true);
        modal.classList.add('active');
    });
}

function compressImage(file, { maxWidth = 1920, maxHeight = 1920, quality = 0.8 } = {}) {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) { resolve(file); return; }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width <= maxWidth && height <= maxHeight && file.size < 500_000) {
                resolve(file);
                return;
            }
            const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })),
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    
    toastMessage.textContent = message;
    toastIcon.textContent = type === 'success' ? '✓' : '✕';
    toast.classList.remove('error');
    if (type === 'error') toast.classList.add('error');
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
