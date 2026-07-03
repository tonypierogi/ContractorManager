// ==================== IMAGE LIGHTBOX ====================

const lightbox = {
    overlay: null,
    imgEl: null,
    counterEl: null,
    prevBtn: null,
    nextBtn: null,
    markupBtn: null,
    urls: [],
    index: 0,
    touchStartX: 0,
    touchStartY: 0,
    swiping: false,
    _editorItemIdx: null,
    _editorMediaIdx: null,

    init() {
        this.overlay = document.getElementById('lightbox-overlay');
        this.imgEl = document.getElementById('lightbox-img');
        this.counterEl = document.getElementById('lightbox-counter');
        this.prevBtn = document.getElementById('lightbox-prev');
        this.nextBtn = document.getElementById('lightbox-next');
        this.markupBtn = document.getElementById('lightbox-markup');

        document.getElementById('lightbox-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay || e.target.classList.contains('lightbox-img-wrap')) this.close();
        });
        this.prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
        this.nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });

        this.markupBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = this.urls[this.index];
            if (!url) return;
            const itemIdx = this._editorItemIdx;
            const mediaIdx = this._editorMediaIdx != null ? this._editorMediaIdx + this.index : this.index;
            this.close();
            if (typeof openImageMarkup === 'function') {
                openImageMarkup(url, itemIdx, mediaIdx);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!this.overlay.classList.contains('active')) return;
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        const wrap = document.getElementById('lightbox-img-wrap');
        wrap.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.swiping = true;
        }, { passive: true });
        wrap.addEventListener('touchmove', (e) => {
            if (!this.swiping) return;
        }, { passive: true });
        wrap.addEventListener('touchend', (e) => {
            if (!this.swiping) return;
            this.swiping = false;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - this.touchStartX;
            const dy = touch.clientY - this.touchStartY;
            if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
            if (dx < 0) this.next();
            else this.prev();
        }, { passive: true });
    },

    open(urls, startIndex, editorItemIdx, editorMediaIdx) {
        this.urls = urls || [];
        this.index = startIndex || 0;
        this._editorItemIdx = editorItemIdx ?? null;
        this._editorMediaIdx = editorMediaIdx ?? null;
        this.show();
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    close() {
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
        this.imgEl.src = '';
        this._editorItemIdx = null;
        this._editorMediaIdx = null;
    },

    show() {
        if (this.urls.length === 0) return;
        this.imgEl.classList.add('loading');
        this.imgEl.src = this.urls[this.index];
        this.imgEl.onload = () => this.imgEl.classList.remove('loading');
        this.imgEl.onerror = () => this.imgEl.classList.remove('loading');

        if (this.urls.length > 1) {
            this.counterEl.textContent = `${this.index + 1} / ${this.urls.length}`;
            this.counterEl.style.display = '';
        } else {
            this.counterEl.style.display = 'none';
        }

        this.prevBtn.hidden = this.index <= 0;
        this.nextBtn.hidden = this.index >= this.urls.length - 1;

        if (this.markupBtn) {
            this.markupBtn.style.display = (this._editorItemIdx != null) ? '' : 'none';
        }
    },

    prev() {
        if (this.index > 0) { this.index--; this.show(); }
    },

    next() {
        if (this.index < this.urls.length - 1) { this.index++; this.show(); }
    }
};

document.addEventListener('DOMContentLoaded', () => lightbox.init());

window.openLightbox = function(urls, startIndex, editorItemIdx, editorMediaIdx) {
    lightbox.open(urls, startIndex, editorItemIdx, editorMediaIdx);
};
