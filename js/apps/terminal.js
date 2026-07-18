import { registerAppRenderer } from '../core.js';

window.MXOS = window.MXOS || {};

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function normalizePath(cwd, input) {
    if (!input) return cwd;
    let p = input;
    if (!p.startsWith('/')) {
        p = (cwd === '/' ? '' : cwd) + '/' + p;
    }
    p = p.replace(/\/+/g, '/');
    const parts = p.split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
        if (part === '..') stack.pop();
        else if (part === '.') continue;
        else stack.push(part);
    }
    return '/' + stack.join('/');
}

function parentPath(path) {
    if (path === '/') return '/';
    const idx = path.lastIndexOf('/');
    if (idx <= 0) return '/';
    return path.slice(0, idx);
}

function baseName(path) {
    if (path === '/') return '/';
    return path.slice(path.lastIndexOf('/') + 1);
}

registerAppRenderer('terminal', (contentEl) => {
    const MXOS = window.MXOS;
    let cwd = '/';
    let history = [];
    let histIdx = -1;
    let currentInput = '';

    const root = document.createElement('div');
    root.className = 'term-app';
    root.innerHTML = `
        <style>
            .term-app{height:100%;background:#0a0a0a;color:#22c55e;font-family:'Consolas','Courier New',monospace;font-size:13px;display:flex;flex-direction:column;position:relative;overflow:hidden}
            .term-output{flex:1;overflow-y:auto;padding:10px 12px;white-space:pre-wrap;word-break:break-all;line-height:1.5}
            .term-output::-webkit-scrollbar{width:8px}
            .term-output::-webkit-scrollbar-thumb{background:#22c55e44;border-radius:4px}
            .term-line{min-height:18px}
            .term-cmd{color:#fff}
            .term-prompt{color:#60a5fa}
            .term-input-line{display:flex;align-items:center;padding:0 12px 8px 12px}
            .term-input{flex:1;background:transparent;border:none;color:#22c55e;font-family:inherit;font-size:inherit;outline:none;caret-color:transparent}
            .term-cursor{display:inline-block;width:8px;height:16px;background:#22c55e;animation:term-blink 1s step-end infinite;margin-left:1px;vertical-align:middle}
            @keyframes term-blink{0%,50%{opacity:1}51%,100%{opacity:0}}
            .term-err{color:#ef4444}
            .term-info{color:#60a5fa}
            .term-warn{color:#fbbf24}
            .term-success{color:#22c55e}
        </style>
        <div class="term-output" id="termOutput"></div>
        <div class="term-input-line">
            <span class="term-prompt" id="termPrompt">mxos@MXOS:/ $</span>
            <input type="text" class="term-input" id="termInput" autocomplete="off" spellcheck="false">
            <span class="term-cursor" id="termCursor"></span>
        </div>
    `;
    contentEl.appendChild(root);

    const output = root.querySelector('#termOutput');
    const input = root.querySelector('#termInput');
    const promptEl = root.querySelector('#termPrompt');
    const cursor = root.querySelector('#termCursor');

    function updatePrompt() {
        const displayCwd = cwd === '/' ? '/' : cwd;
        promptEl.textContent = `mxos@MXOS:${displayCwd} $`;
    }

    function print(text, cls = '') {
        const line = document.createElement('div');
        line.className = 'term-line' + (cls ? ' term-' + cls : '');
        line.innerHTML = text;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    function printCmd(cmd) {
        print(`<span class="term-prompt">${escapeHtml(promptEl.textContent)}</span> <span class="term-cmd">${escapeHtml(cmd)}</span>`);
    }

    async function runCommand(raw) {
        const cmd = raw.trim();
        if (!cmd) return;
        printCmd(cmd);
        history.unshift(cmd);
        if (history.length > 100) history.pop();
        histIdx = -1;

        const parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const command = parts[0];
        const args = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

        try {
            switch (command) {
                case 'help': return cmdHelp(args);
                case 'ls': return await cmdLs(args);
                case 'cd': return cmdCd(args);
                case 'cat': return await cmdCat(args);
                case 'echo': return cmdEcho(args);
                case 'mkdir': return await cmdMkdir(args);
                case 'touch': return await cmdTouch(args);
                case 'rm': return await cmdRm(args);
                case 'clear': return cmdClear();
                case 'neofetch': return cmdNeofetch();
                case 'open': return cmdOpen(args);
                case 'date': return print(new Date().toString());
                case 'whoami': return print('mxos');
                case 'mxos': return cmdMxosApi(args);
                case 'pwd': return print(cwd);
                default:
                    print(`命令未找到: ${command}. 输入 "help" 查看可用命令。`, 'err');
            }
        } catch (e) {
            print('错误: ' + (e.message || e), 'err');
        }
    }

    function cmdHelp() {
        const help = [
            ['help', '显示帮助'],
            ['ls [path]', '列出目录'],
            ['cd <path>', '切换目录'],
            ['cat <file>', '显示文件内容'],
            ['echo <text>', '输出文本'],
            ['mkdir <name>', '创建目录'],
            ['touch <name>', '创建文件'],
            ['rm <path>', '删除文件或目录'],
            ['clear', '清屏'],
            ['neofetch', '显示系统信息'],
            ['open <app>', '打开应用'],
            ['date', '显示日期'],
            ['whoami', '显示当前用户'],
            ['pwd', '显示当前目录'],
            ['mxos api', '显示 API 文档'],
            ['Tab', '路径自动补全'],
            ['↑/↓', '历史命令切换']
        ];
        print('可用命令:', 'info');
        help.forEach(([c, d]) => {
            print(`  ${c.padEnd(16)} ${d}`);
        });
    }

    async function cmdLs(args) {
        const path = normalizePath(cwd, args[0]);
        const items = await MXOS.fs.listFiles(path);
        if (!items.length) {
            print('(空目录)');
            return;
        }
        items.forEach(it => {
            const marker = it.type === 'folder' ? '/' : '';
            const cls = it.type === 'folder' ? 'info' : '';
            print(`${escapeHtml(it.name)}${marker}`, cls);
        });
    }

    function cmdCd(args) {
        if (!args[0] || args[0] === '~') { cwd = '/'; updatePrompt(); return; }
        const path = normalizePath(cwd, args[0]);
        cwd = path;
        updatePrompt();
    }

    async function cmdCat(args) {
        if (!args[0]) { print('用法: cat <file>', 'warn'); return; }
        const path = normalizePath(cwd, args[0]);
        const content = await MXOS.fs.readFile(path);
        content.split('\n').forEach(line => print(escapeHtml(line)));
    }

    function cmdEcho(args) {
        print(escapeHtml(args.join(' ')));
    }

    async function cmdMkdir(args) {
        if (!args[0]) { print('用法: mkdir <name>', 'warn'); return; }
        const path = normalizePath(cwd, args[0]);
        await MXOS.fs.createFolder(path);
        print(`已创建目录: ${path}`, 'success');
    }

    async function cmdTouch(args) {
        if (!args[0]) { print('用法: touch <name>', 'warn'); return; }
        const path = normalizePath(cwd, args[0]);
        const exists = await MXOS.fs.exists(path);
        if (!exists) {
            await MXOS.fs.writeFile(path, '');
        }
        print(`已创建文件: ${path}`, 'success');
    }

    async function cmdRm(args) {
        if (!args[0]) { print('用法: rm <path>', 'warn'); return; }
        const path = normalizePath(cwd, args[0]);
        await MXOS.fs.delete(path);
        print(`已删除: ${path}`, 'success');
    }

    function cmdClear() {
        output.innerHTML = '';
    }

    function cmdNeofetch() {
        const hw = (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.hardware === 'function')
            ? window.MXOS.Real.hardware() : {};
        const sys = (window.MXOS && window.MXOS.system && typeof window.MXOS.system.getOSInfo === 'function')
            ? window.MXOS.system.getOSInfo() : {};
        const logo = [
            '    ███╗   ███╗██╗ ██╗  ██████╗',
            '    ████╗ ████║██║ ██║ ██╔═══██╗',
            '    ██╔████╔██║███████║ ██║   ██║',
            '    ██║╚██╔╝██║██╔══██║ ██║   ██║',
            '    ██║ ╚═╝ ██║██║  ██║ ╚██████╔╝',
            '    ╚═╝     ╚═╝╚═╝  ╚═╝  ╚═════╝'
        ];
        const info = [
            ['OS', sys.name + ' ' + (sys.version || '')],
            ['Build', sys.build || '-'],
            ['Platform', hw.platform || '-'],
            ['CPU 核心', hw.cpuCores || '-'],
            ['内存', hw.deviceMemoryGB ? hw.deviceMemoryGB + ' GB' : '-'],
            ['屏幕', hw.screen ? `${hw.screen.width}×${hw.screen.height}` : '-'],
            ['时区', hw.timezone || '-'],
            ['语言', hw.language || '-'],
            ['网络', hw.online ? '在线' : '离线'],
            ['运行时间', sys.uptime ? Math.round(sys.uptime/1000)+'s' : '-']
        ];
        print('');
        const lines = Math.max(logo.length, info.length + 1);
        for (let i = 0; i < lines; i++) {
            const left = logo[i] || '';
            let right = '';
            if (i === 0) right = '<span class="term-info">mxos@MXOS</span>';
            else if (i === 1) right = '----------------';
            else if (i - 2 < info.length) {
                const [k, v] = info[i - 2];
                right = `<span class="term-info">${escapeHtml(k)}:</span> ${escapeHtml(v)}`;
            }
            print(`${left}    ${right}`);
        }
        print('');
    }

    function cmdOpen(args) {
        if (!args[0]) { print('用法: open <app>', 'warn'); return; }
        if (window.MXOS && typeof window.MXOS.openApp === 'function') {
            const ok = window.MXOS.openApp(args[0]);
            if (ok) print(`已打开应用: ${args[0]}`, 'success');
            else print(`无法打开应用: ${args[0]}`, 'err');
        } else {
            print('应用管理器不可用', 'err');
        }
    }

    function cmdMxosApi(args) {
        if (args[0] !== 'api') {
            print('用法: mxos api', 'warn');
            return;
        }
        if (window.MXOS && typeof window.MXOS.apiHelp === 'function') {
            const apis = window.MXOS.apiHelp();
            print('MXOS 公共 API 文档:', 'info');
            apis.forEach(({ api, desc, available }) => {
                const marker = available ? '●' : '○';
                print(`  ${marker} ${api.padEnd(38)} ${desc}`);
            });
            print('● 可用  ○ 依赖模块未加载', 'info');
            return;
        }
        const apis = [
            ['MXOS.openApp(id)', '打开应用'],
            ['MXOS.closeApp(id)', '关闭应用'],
            ['MXOS.listApps()', '列出所有应用'],
            ['MXOS.fs.readFile(path)', '读取文件'],
            ['MXOS.fs.writeFile(path, content)', '写入文件'],
            ['MXOS.fs.listFiles(path)', '列出目录'],
            ['MXOS.fs.createFolder(path)', '创建目录'],
            ['MXOS.fs.delete(path)', '删除文件/目录'],
            ['MXOS.fs.move(from, to)', '移动'],
            ['MXOS.fs.copy(from, to)', '复制'],
            ['MXOS.fs.exists(path)', '检查存在'],
            ['MXOS.dialog.alert/confirm/prompt/toast', '对话框'],
            ['MXOS.clipboard.set/get/history()', '剪贴板'],
            ['MXOS.storage.get/set/remove(key)', '本地存储'],
            ['MXOS.theme.get/set(mode, accent)', '主题'],
            ['MXOS.system.getOSInfo()', '系统信息'],
            ['MXOS.system.lock()', '锁定系统'],
            ['MXOS.shortcut.register/unregister(combo, cb)', '快捷键'],
            ['MXOS.events.on/off/emit(event, ...)', '事件总线'],
            ['MXOS.notify(options)', '通知']
        ];
        print('MXOS 公共 API 文档:', 'info');
        apis.forEach(([api, desc]) => {
            print(`  ${api.padEnd(38)} ${desc}`);
        });
    }

    async function tabComplete() {
        const val = input.value;
        const lastSpace = val.lastIndexOf(' ');
        const token = val.slice(lastSpace + 1);
        if (!token) return;

        const slashIdx = token.lastIndexOf('/');
        const dirPart = token.slice(0, slashIdx + 1);
        const namePart = token.slice(slashIdx + 1);

        const dirPath = normalizePath(cwd, dirPart || '/');
        try {
            const items = await MXOS.fs.listFiles(dirPath);
            const matches = items.filter(it => it.name.startsWith(namePart));
            if (matches.length === 1) {
                const m = matches[0];
                const suffix = m.type === 'folder' ? '/' : '';
                input.value = val.slice(0, val.length - namePart.length) + m.name + suffix;
            } else if (matches.length > 1) {
                printCmd(val);
                matches.forEach(m => {
                    const marker = m.type === 'folder' ? '/' : '';
                    print(m.name + marker, m.type === 'folder' ? 'info' : '');
                });
            }
        } catch (e) {}
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value;
            input.value = '';
            runCommand(val);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length === 0) return;
            if (histIdx === -1) { currentInput = input.value; histIdx = 0; }
            else if (histIdx < history.length - 1) histIdx++;
            input.value = history[histIdx];
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx === -1) return;
            if (histIdx === 0) { histIdx = -1; input.value = currentInput; }
            else { histIdx--; input.value = history[histIdx]; }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            tabComplete();
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            cmdClear();
        }
    });

    root.addEventListener('click', () => input.focus());

    print('MXOS Terminal v1.1  -  输入 "help" 查看可用命令', 'info');
    print('文件系统: MXOS.fs  |  提示: Tab 补全, ↑↓ 历史, Ctrl+L 清屏', 'info');
    print('');
    updatePrompt();
    setTimeout(() => input.focus(), 100);
});

window.MXOS.Terminal = {
    version: '1.1',
    commands: ['help','ls','cd','cat','echo','mkdir','touch','rm','clear','neofetch','open','date','whoami','pwd','mxos']
};

console.log('[MXOS.Terminal] 终端应用已加载');
