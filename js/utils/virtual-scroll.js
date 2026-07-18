import { throttle } from './debounce.js';

const STYLE_ID = 'mxos-virtual-scroll-style';
function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
.mxos-virtual-scroll { position: relative; overflow: auto; will-change: transform; -webkit-overflow-scrolling: touch; }
.mxos-virtual-spacer { width: 1px; pointer-events: none; }
.mxos-virtual-item { position: absolute; left: 0; right: 0; will-change: transform; }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
}

class VirtualScroll {
    constructor(container, options = {}) {
        injectStyle();
        this.container = container;
        this.items = [];
        this.itemHeight = options.itemHeight || 60;
        this.buffer = options.buffer || 6;
        this.renderItem = options.renderItem || (() => '');
        this.onItemClick = options.onItemClick || null;
        this.totalHeight = 0;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.lastRenderStart = -1;
        this.lastRenderEnd = -1;

        container.classList.add('mxos-virtual-scroll');
        this.spacer = document.createElement('div');
        this.spacer.className = 'mxos-virtual-spacer';
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.viewport.style.width = '100%';

        const inner = document.createElement('div');
        inner.style.position = 'relative';
        inner.style.width = '100%';
        inner.appendChild(this.spacer);
        this.viewport = inner;
        container.appendChild(inner);

        this._onScroll = throttle(() => this._render(), 16);
        container.addEventListener('scroll', this._onScroll, { passive: true });
        this._resizeObserver = new ResizeObserver(() => this._render());
        this._resizeObserver.observe(container);
    }

    setItems(items) {
        this.items = items || [];
        this.totalHeight = this.items.length * this.itemHeight;
        this.spacer.style.height = this.totalHeight + 'px';
        this._render(true);
    }

    _render(force = false) {
        const scrollTop = this.container.scrollTop;
        const viewHeight = this.container.clientHeight || 1;
        const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
        const visibleCount = Math.ceil(viewHeight / this.itemHeight) + this.buffer * 2;
        const end = Math.min(this.items.length, start + visibleCount);

        if (!force && start === this.lastRenderStart && end === this.lastRenderEnd) return;
        this.lastRenderStart = start;
        this.lastRenderEnd = end;

        const existing = this.viewport.querySelectorAll('.mxos-virtual-item');
        existing.forEach(el => el.remove());

        const fragment = document.createDocumentFragment();
        for (let i = start; i < end; i++) {
            const item = this.items[i];
            if (!item) continue;
            const el = document.createElement('div');
            el.className = 'mxos-virtual-item';
            el.style.top = (i * this.itemHeight) + 'px';
            el.style.height = this.itemHeight + 'px';
            el.dataset.index = String(i);
            el.innerHTML = this.renderItem(item, i);
            if (this.onItemClick) {
                el.addEventListener('click', (e) => this.onItemClick(item, i, e));
            }
            fragment.appendChild(el);
        }
        this.viewport.appendChild(fragment);
    }

    scrollToIndex(index) {
        if (index < 0 || index >= this.items.length) return;
        this.container.scrollTop = index * this.itemHeight;
    }

    destroy() {
        this._resizeObserver.disconnect();
        this.container.removeEventListener('scroll', this._onScroll);
        this.container.classList.remove('mxos-virtual-scroll');
        this.container.innerHTML = '';
    }
}

export function createVirtualScroll(container, options) {
    return new VirtualScroll(container, options);
}

window.MXOS = window.MXOS || {};
window.MXOS.VirtualScroll = VirtualScroll;
window.MXOS.createVirtualScroll = createVirtualScroll;

export { VirtualScroll };
export default createVirtualScroll;
