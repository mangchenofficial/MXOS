import { registerAppRenderer } from '../core.js';
import { vfs } from '../vfs.js';
import { appConfigs } from '../state.js';

registerAppRenderer('notepad', async (contentEl, windowEl, appId) => {
    const config = appConfigs[appId];
    const fileId = config.fileId;
    const initialContent = config.initialContent || '';

    contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="padding: 8px 12px; border-bottom: 1px solid var(--glass-border); display: flex; gap: 8px;">
                <button id="save-btn" style="padding: 6px 12px; background: rgba(59,130,246,0.3); border: 1px solid var(--glass-border); color: white; border-radius: 4px; cursor: pointer;">保存</button>
            </div>
            <textarea id="notepad-text" style="flex: 1; background: rgba(0,0,0,0.2); border: none; padding: 12px; color: white; resize: none; outline: none; font-family: 'MiSans', sans-serif; font-size: 14px;">${initialContent}</textarea>
        </div>
    `;

    document.getElementById('save-btn').addEventListener('click', async () => {
        const content = document.getElementById('notepad-text').value;
        if (fileId) {
            await vfs.update(fileId, { content });
        }
    });
});
