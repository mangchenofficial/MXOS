import { registerAppRenderer } from '../core.js';

registerAppRenderer('this-pc', async (contentEl, windowEl, appId) => {
    const fileSystem = {
        'main': {
            title: '此电脑',
            items: [
                { name: '本地磁盘 (C:)', type: 'drive', drive: 'C' },
                { name: '本地磁盘 (D:)', type: 'drive', drive: 'D' }
            ]
        },
        'C': {
            title: '本地磁盘 (C:)',
            items: [
                { name: 'Program Files', type: 'folder', path: 'C-ProgramFiles' },
                { name: 'Program Files (x86)', type: 'folder', path: 'C-ProgramFiles86' },
                { name: 'Users', type: 'folder', path: 'C-Users' },
                { name: 'Windows', type: 'folder', path: 'C-Windows' }
            ]
        },
        'D': {
            title: '本地磁盘 (D:)',
            items: [
                { name: '喜Edge', type: 'folder', path: 'D-喜Edge' },
                { name: '设置', type: 'folder', path: 'D-设置' },
                { name: '喜Office', type: 'folder', path: 'D-喜Office' }
            ]
        },
        'C-ProgramFiles': {
            title: 'Program Files',
            items: [
                { name: 'Microsoft', type: 'folder', path: 'C-Microsoft' },
                { name: 'Internet Explorer', type: 'folder', path: 'C-IE' }
            ]
        },
        'C-ProgramFiles86': {
            title: 'Program Files (x86)',
            items: [
                { name: 'Common Files', type: 'folder', path: 'C-CommonFiles' }
            ]
        },
        'C-Users': {
            title: 'Users',
            items: [
                { name: 'Administrator', type: 'folder', path: 'C-Admin' },
                { name: 'Public', type: 'folder', path: 'C-Public' }
            ]
        },
        'C-Windows': {
            title: 'Windows',
            items: [
                { name: 'System32', type: 'folder', path: 'C-System32' },
                { name: 'Fonts', type: 'folder', path: 'C-Fonts' },
                { name: 'Resources', type: 'folder', path: 'C-Resources' },
                { name: 'notepad.exe', type: 'exe' },
                { name: 'calc.exe', type: 'exe' },
                { name: 'mspaint.exe', type: 'exe' }
            ]
        },
        'C-System32': {
            title: 'System32',
            items: [
                { name: 'cmd.exe', type: 'exe' },
                { name: 'taskmgr.exe', type: 'exe' },
                { name: 'regedit.exe', type: 'exe' },
                { name: 'config', type: 'folder', path: 'C-Config' }
            ]
        },
        'D-喜Edge': {
            title: '喜Edge',
            items: [
                { name: 'Application', type: 'folder', path: 'D-喜Edge-App' },
                { name: 'Cache', type: 'folder', path: 'D-喜Edge-Cache' }
            ]
        },
        'D-设置': {
            title: '设置',
            items: [
                { name: '主题', type: 'file', icon: 'settings' },
                { name: '壁纸', type: 'file', icon: 'wallpaper' },
                { name: '关于', type: 'file', icon: 'info' }
            ]
        },
        'D-喜Office': {
            title: '喜Office',
            items: [
                { name: 'Word', type: 'file', icon: 'word' },
                { name: 'Excel', type: 'file', icon: 'excel' },
                { name: 'PowerPoint', type: 'file', icon: 'ppt' }
            ]
        },
        'C-Fonts': {
            title: 'Fonts',
            items: [
                { name: 'msyh.ttc', type: 'file', icon: 'font' },
                { name: 'simsun.ttc', type: 'file', icon: 'font' }
            ]
        },
        'C-Resources': {
            title: 'Resources',
            items: [
                { name: 'Themes', type: 'folder', path: 'C-Themes' },
                { name: 'Icons', type: 'folder', path: 'C-Icons' }
            ]
        },
        'C-Microsoft': {
            title: 'Microsoft',
            items: [
                { name: 'Edge', type: 'folder', path: 'C-Edge' }
            ]
        },
        'C-Admin': {
            title: 'Administrator',
            items: [
                { name: 'Desktop', type: 'folder', path: 'C-AdminDesktop' },
                { name: 'Documents', type: 'folder', path: 'C-AdminDocs' },
                { name: 'Downloads', type: 'folder', path: 'C-AdminDownloads' }
            ]
        },
        'D-喜Edge-App': {
            title: 'Application',
            items: [
                { name: '喜Edge.exe', type: 'file', icon: 'exe' }
            ]
        },
        'D-喜Edge-Cache': {
            title: 'Cache',
            items: [
                { name: 'temp.dat', type: 'file', icon: 'file' }
            ]
        }
    };

    let currentPath = 'main';
    const renderThisPC = () => {
        const data = fileSystem[currentPath];
        const isMain = currentPath === 'main';
        let html = `
            <div class="this-pc-view">
                <div class="this-pc-header">
                    ${!isMain ? '<div class="back-btn"><svg width="16" height="16" viewBox="0 0 40 40"><use href="#svg-arrow-left"/></svg>返回</div>' : ''}
                    <span>${data.title}</span>
                </div>
                <div class="${isMain ? 'drive-grid' : 'file-grid'}">
        `;

        data.items.forEach((item, index) => {
            if (item.type === 'folder') {
                html += `<div class="file-item" data-path="${item.path}">
                    <svg width="48" height="48" viewBox="0 0 40 40"><use href="#svg-folder"/></svg>
                    <span>${item.name}</span>
                </div>`;
            } else if (item.type === 'drive') {
                const driveSize = item.drive === 'C' ? '234 GB 可用，共 476 GB' : '156 GB 可用，共 292 GB';
                const driveWidth = item.drive === 'C' ? '51%' : '47%';
                html += `<div class="drive-item" data-drive="${item.drive}">
                    <svg width="48" height="48" viewBox="0 0 40 40"><use href="#svg-hard-disk"/></svg>
                    <div class="drive-info">
                        <div class="drive-name">${item.name}</div>
                        <div class="drive-size">${driveSize}</div>
                        <div class="drive-bar"><div class="drive-bar-fill" style="width: ${driveWidth}"></div></div>
                    </div>
                </div>`;
            } else if (item.type === 'exe') {
                let exeIcon = '#svg-notepad';
                if (item.name.includes('calc')) exeIcon = '#svg-calc';
                else if (item.name.includes('mspaint')) exeIcon = '#svg-mspaint';
                else if (item.name.includes('cmd')) exeIcon = '#svg-cmd';
                else if (item.name.includes('taskmgr')) exeIcon = '#svg-taskmgr';
                else if (item.name.includes('regedit')) exeIcon = '#svg-regedit';
                html += `<div class="file-item">
                    <svg width="48" height="48" viewBox="0 0 40 40"><use href="${exeIcon}"/></svg>
                    <span>${item.name}</span>
                </div>`;
            } else {
                html += `<div class="file-item">
                    <svg width="48" height="48" viewBox="0 0 40 40"><use href="#svg-file"/></svg>
                    <span>${item.name}</span>
                </div>`;
            }
        });

        html += `</div></div>`;
        contentEl.innerHTML = html;

        contentEl.querySelectorAll('.file-item[data-path]').forEach(item => {
            item.addEventListener('dblclick', () => {
                currentPath = item.dataset.path;
                renderThisPC();
            });
        });

        contentEl.querySelectorAll('.drive-item').forEach(item => {
            item.addEventListener('dblclick', () => {
                currentPath = item.dataset.drive;
                renderThisPC();
            });
        });

        const backBtn = contentEl.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (currentPath === 'C' || currentPath === 'D') {
                    currentPath = 'main';
                } else if (currentPath.startsWith('C-')) {
                    currentPath = 'C';
                } else if (currentPath.startsWith('D-')) {
                    currentPath = 'D';
                } else {
                    currentPath = 'main';
                }
                renderThisPC();
            });
        }
    };
    renderThisPC();
});
