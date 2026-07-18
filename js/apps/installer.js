import { registerAppRenderer, launchThirdPartyApp, updateAppStartMenu, handleInstallerFileSimple } from '../core.js';
import { state } from '../state.js';

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function isImageIcon(icon) {
    return typeof icon === 'string' && /^(https?:|\/api\/|data:image|blob:)/.test(icon);
}

function renderIconHtml(icon, size = 32) {
    if (isImageIcon(icon)) {
        return '<img src="' + escapeHtml(icon) + '" alt="" style="width:' + size + 'px;height:' + size + 'px;object-fit:contain;display:block" onerror="this.style.visibility=\'hidden\';this.title=\'图标加载失败\';">';
    }
    if (!icon) return '<span style="width:' + size + 'px;height:' + size + 'px;display:flex;align-items:center;justify-content:center;color:#ef4444;font-size:12px">!</span>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 40 40"><use href="#svg-' + escapeHtml(icon) + '"/></svg>';
}

async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => reject(new Error('JSZip 加载失败'));
        document.head.appendChild(script);
    });
}

async function extractMxIconInfo(file) {
    const JSZip = await ensureJSZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('manifest.json 不存在');
    let manifest;
    try { manifest = JSON.parse(await manifestFile.async('text')); }
    catch { throw new Error('manifest.json 解析失败'); }
    const iconPath = String(manifest.icon || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!iconPath) throw new Error('manifest.icon 缺失，必须指向包内 svg.png');
    if (iconPath.split('/').pop() !== 'svg.png') throw new Error('manifest.icon 必须指向文件名严格为 svg.png 的包内图标');
    const iconFile = zip.file(iconPath);
    if (!iconFile) throw new Error('mx 包缺少 manifest.icon 指向的 svg.png：' + iconPath);
    return { appId: manifest.id || 'app_' + Date.now(), iconUrl: 'data:image/png;base64,' + await iconFile.async('base64'), iconPath };
}

registerAppRenderer('installer', async (contentEl, windowEl, appId) => {
    let currentView = 'home';
    let selectedApp = null;

    function renderInstaller() {
        if (currentView === 'home') {
            contentEl.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%">
                    <div style="padding:20px;border-bottom:1px solid rgba(255,255,255,0.1)">
                        <h2 style="margin:0 0 8px 0">应用安装器</h2>
                        <p style="margin:0;color:#9ca3af;font-size:14px">安装 .mx 格式的应用程序</p>
                    </div>
                    <div style="flex:1;overflow:auto;padding:20px">
                        <div class="installer-dropzone" id="dropzone">
                            <div class="installer-dropzone-icon"><svg class="icon" width="48" height="48"><use href="#icon-package"/></svg></div>
                            <h3 style="margin:0 0 8px 0">拖放 .mx 文件到这里</h3>
                            <p style="margin:0;color:#9ca3af;font-size:14px">或者点击选择文件</p>
                            <input type="file" id="fileInput" accept=".mx" style="display:none">
                        </div>
                        <div style="margin-top:30px">
                            <h3 style="margin:0 0 16px 0">已安装的应用</h3>
                            <div class="installed-app-grid" id="installedGrid">
                                ${renderInstalledApps()}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            setupDropzone();
        } else if (currentView === 'detail') {
            contentEl.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%">
                    <div style="padding:20px;border-bottom:1px solid rgba(255,255,255,0.1)">
                        <button id="backBtn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;gap:8px">
                            <span>‹</span> 返回
                        </button>
                    </div>
                    <div class="app-detail-info">
                        <div class="app-detail-header">
                            <div class="app-detail-icon">${renderIconHtml(selectedApp.icon, 48)}</div>
                            <div class="app-detail-meta">
                                <h2>${selectedApp.name}</h2>
                                <p>版本 ${selectedApp.version || '1.0.0'}</p>
                                <p style="margin-top:4px">${selectedApp.description || '暂无描述'}</p>
                            </div>
                        </div>
                        <div style="margin-top:20px">
                            <button id="uninstallBtn" class="uninstall-btn">卸载应用</button>
                            <button id="launchBtn" style="background:#60a5fa;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;margin-left:12px">启动应用</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('backBtn').onclick = () => {
                currentView = 'home';
                renderInstaller();
            };
            document.getElementById('uninstallBtn').onclick = () => uninstallApp(selectedApp.id);
            document.getElementById('launchBtn').onclick = () => launchThirdPartyApp(selectedApp);
        }
    }

    function renderInstalledApps() {
        if (state.installedApps.length === 0) {
            return '<div style="grid-column:1/-1;text-align:center;color:#9ca3af;padding:40px">暂无已安装的应用</div>';
        }
        return state.installedApps.map(app => `
            <div class="installed-app-item" data-app-id="${app.id}">
                <div class="installed-app-icon">${renderIconHtml(app.icon, 32)}</div>
                <div class="installed-app-name">${escapeHtml(app.name)}</div>
            </div>
        `).join('');
    }

    async function installFile(file) {
        await handleInstallerFileSimple(file, contentEl, currentView, () => {
            renderInstaller();
        });
    }

    function setupDropzone() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');

        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) installFile(file);
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) installFile(file);
        });
    }

    function uninstallApp(appId) {
        if (confirm('确定要卸载这个应用吗？')) {
            const idx = state.installedApps.findIndex(a => a.id === appId);
            if (idx >= 0) state.installedApps.splice(idx, 1);
            delete state.thirdPartyAppData[appId];
            localStorage.setItem('mxos_installed_apps', JSON.stringify(state.installedApps));
            updateAppStartMenu();
            currentView = 'home';
            renderInstaller();
        }
    }

    renderInstaller();

    contentEl.addEventListener('click', (e) => {
        const appItem = e.target.closest('.installed-app-item');
        if (appItem) {
            const appId = appItem.dataset.appId;
            selectedApp = state.installedApps.find(a => a.id === appId);
            if (selectedApp) {
                currentView = 'detail';
                renderInstaller();
            }
        }
    });
});
