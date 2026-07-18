import { registerAppRenderer } from '../core.js';

registerAppRenderer('recycle-bin', async (contentEl, windowEl, appId) => {
    contentEl.innerHTML = `
        <div class="recycle-bin-content">
            <div class="recycle-bin-header">回收站</div>
            <div class="recycle-bin-empty">
                <svg width="80" height="80" viewBox="0 0 40 40"><use href="#svg-recycle-bin"/></svg>
                <p>回收站为空</p>
            </div>
        </div>
    `;
});
