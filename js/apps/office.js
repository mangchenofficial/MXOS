import { registerAppRenderer } from '../core.js';

registerAppRenderer('office', async (contentEl, windowEl, appId) => {
    contentEl.innerHTML = `
        <div class="office-welcome">
            <div class="office-welcome-header">
                <h1>欢迎使用 喜Office</h1>
                <p>选择您要使用的应用</p>
            </div>
            <div class="office-apps-grid">
                <div class="office-app-card" onclick="openApp('ppt')">
                    <div class="office-app-icon ppt-icon">
                        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="8" y="4" width="48" height="40" rx="4"/>
                            <rect x="16" y="12" width="32" height="24" rx="2"/>
                            <polygon points="32,44 44,52 32,52"/>
                        </svg>
                    </div>
                    <span class="office-app-name">喜演示</span>
                    <span class="office-app-desc">制作演示文稿</span>
                </div>
                <div class="office-app-card" onclick="openApp('word')">
                    <div class="office-app-icon word-icon">
                        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="8" y="4" width="48" height="56" rx="4"/>
                            <text x="32" y="42" text-anchor="middle" fill="rgba(255,255,255,0.85)" stroke="none" font-size="24" font-weight="bold">W</text>
                        </svg>
                    </div>
                    <span class="office-app-name">喜文档</span>
                    <span class="office-app-desc">文字处理文档</span>
                </div>
                <div class="office-app-card" onclick="openApp('excel')">
                    <div class="office-app-icon excel-icon">
                        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="8" y="4" width="48" height="56" rx="4"/>
                            <rect x="14" y="12" width="10" height="8" rx="1"/>
                            <rect x="27" y="12" width="10" height="8" rx="1"/>
                            <rect x="40" y="12" width="10" height="8" rx="1"/>
                            <rect x="14" y="24" width="10" height="8" rx="1"/>
                            <rect x="27" y="24" width="10" height="8" rx="1"/>
                            <rect x="40" y="24" width="10" height="8" rx="1"/>
                            <rect x="14" y="36" width="10" height="8" rx="1"/>
                            <rect x="27" y="36" width="10" height="8" rx="1"/>
                            <rect x="40" y="36" width="10" height="8" rx="1"/>
                        </svg>
                    </div>
                    <span class="office-app-name">喜表格</span>
                    <span class="office-app-desc">电子表格制作</span>
                </div>
            </div>
        </div>
    `;
});

registerAppRenderer('ppt', async (contentEl, windowEl, appId) => {
    contentEl.innerHTML = `
        <div class="office-app-container">
            <div class="office-toolbar">
                <button class="office-btn"><svg class="icon"><use href="#icon-file-text"/></svg> 新建</button>
                <button class="office-btn"><svg class="icon"><use href="#icon-folder-open"/></svg> 打开</button>
                <button class="office-btn"><svg class="icon"><use href="#icon-save"/></svg> 保存</button>
            </div>
            <div class="office-app-content">
                <h2>喜演示 - 演示文稿</h2>
                <p>创建专业的演示文稿</p>
            </div>
        </div>
    `;
});

registerAppRenderer('word', async (contentEl, windowEl, appId) => {
    contentEl.innerHTML = `
        <div class="office-app-container">
            <div class="office-toolbar">
                <button class="office-btn"><svg class="icon"><use href="#icon-file-text"/></svg> 新建</button>
                <button class="office-btn"><svg class="icon"><use href="#icon-folder-open"/></svg> 打开</button>
                <button class="office-btn"><svg class="icon"><use href="#icon-save"/></svg> 保存</button>
                <button class="office-btn" style="margin-left:auto">B</button>
                <button class="office-btn"><i>I</i></button>
                <button class="office-btn"><u>U</u></button>
            </div>
            <div class="office-app-content">
                <div class="office-document">
                    <div class="office-title" contenteditable="true">新建文档</div>
                    <div class="office-text" contenteditable="true">
                        <p>在这里开始编辑您的文档...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
});

registerAppRenderer('excel', async (contentEl, windowEl, appId) => {
    contentEl.innerHTML = `
        <div class="office-app-container">
            <div class="office-toolbar">
                <button class="office-btn"><svg class="icon"><use href="#icon-file-text"/></svg> 新建</button>
                <button class="office-btn"><svg class="icon"><use href="#icon-folder-open"/></svg> 打开</button>
                <button class="office-btn"><svg class="icon"><use href="#icon-save"/></svg> 保存</button>
            </div>
            <div class="office-app-content excel-content">
                <table class="excel-table">
                    <tr>
                        <th></th>
                        <th>A</th>
                        <th>B</th>
                        <th>C</th>
                        <th>D</th>
                    </tr>
                    <tr>
                        <th>1</th>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                    </tr>
                    <tr>
                        <th>2</th>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                    </tr>
                    <tr>
                        <th>3</th>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                    </tr>
                </table>
            </div>
        </div>
    `;
});
