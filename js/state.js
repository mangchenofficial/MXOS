export const state = {
    windows: [],
    zIndex: 1000,
    activeWindow: null,
    dragState: null,
    resizeState: null,
    isLocked: true,
    clipboard: { type: null, fileId: null },
    personalizationSettings: {
        wallpaper: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&q=80',
        wallpaperType: 'image',
        accentColor: '#60a5fa'
    },
    thirdPartyAppData: {},
    installedApps: JSON.parse(localStorage.getItem('mxos_installed_apps') || '[]'),
    user: {
        id: null,
        name: '',
        avatar: '',
        token: (() => { try { return localStorage.getItem('mxos_session_token') || ''; } catch (e) { return ''; } })(),
        isLoggedIn: false
    },
    cloudSync: {
        status: 'idle',
        lastSync: 0,
        conflictMode: 'last-write-wins'
    }
};

export const appConfigs = {
    'this-pc': { title: '此电脑', icon: 'this-pc', width: 900, height: 600, content: 'this-pc' },
    'recycle-bin': { title: '回收站', icon: 'recycle-bin', width: 800, height: 500, content: 'recycle-bin' },
    'browser': { title: '喜edge', icon: 'browser', width: 1000, height: 700, content: 'browser' },
    'settings': { title: '设置', icon: 'settings', width: 900, height: 650, content: 'settings' },
    'office': { title: '喜office', icon: 'office', width: 950, height: 700, content: 'office' },
    'ppt': { title: '喜演示', icon: 'ppt', width: 1000, height: 700, content: 'ppt' },
    'word': { title: '喜文档', icon: 'word', width: 900, height: 650, content: 'word' },
    'excel': { title: '喜表格', icon: 'excel', width: 1000, height: 700, content: 'excel' },
    'music': { title: '喜音乐', icon: 'music', width: 900, height: 600, content: 'music' },

    'store': { title: '应用商店', icon: 'store', width: 1000, height: 700, content: 'store' },
    'email-verification': { title: '邮箱验证', icon: 'settings', width: 620, height: 560, content: 'email-verification' },
    'task-manager-pro': { title: '任务管理器', icon: 'task-manager-pro', width: 800, height: 600, minWidth: 500, minHeight: 400, content: 'task-manager-pro' },
    'calculator': { title: '计算器', icon: 'calc', width: 360, height: 560, content: 'calculator' },
    'clock': { title: '时钟', icon: 'clock', width: 700, height: 560, content: 'clock' },
    'terminal': { title: '终端', icon: 'cmd', width: 720, height: 480, content: 'terminal' },
    'calendar': { title: '日历', icon: 'calendar', width: 820, height: 600, content: 'calendar' },
    'dashboard': { title: '系统仪表盘', icon: 'dashboard', width: 900, height: 650, content: 'dashboard' },
    'drawing-app': { title: '画板', icon: 'drawing', width: 980, height: 680, minWidth: 640, minHeight: 480, content: 'drawing-app' },
    'pixel-editor': { title: '像素画', icon: 'pixel', width: 920, height: 660, minWidth: 600, minHeight: 460, content: 'pixel-editor' },
    'feature-center': { title: '功能中心', icon: 'feature-center', width: 1100, height: 720, minWidth: 800, minHeight: 520, content: 'feature-center' }
};

function escapeIconAttr(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function isImageIconValue(icon) {
    return typeof icon === 'string' && /^(https?:|\/api\/|data:image|blob:)/.test(icon);
}

export function iconSvg(name, size = 24) {
    if (isImageIconValue(name)) {
        return '<img src="' + escapeIconAttr(name) + '" alt="" style="width:' + size + 'px;height:' + size + 'px;object-fit:contain;display:block" onerror="this.style.visibility=\'hidden\';this.title=\'图标加载失败\';">';
    }
    if (!name) return '<span style="width:' + size + 'px;height:' + size + 'px;display:inline-flex;align-items:center;justify-content:center;color:#ef4444;font-size:10px">!</span>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 40 40"><use href="#svg-' + escapeIconAttr(name) + '"/></svg>';
}

