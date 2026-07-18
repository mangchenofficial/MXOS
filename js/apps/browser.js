import { registerAppRenderer } from '../core.js';

registerAppRenderer('browser', async (contentEl, windowEl, appId) => {
    let browserTabs = [];
    let activeTabId = 1;

    function getDomain(url) {
        if (!url || url === 'about:blank') return '新标签页';
        try {
            const urlObj = new URL(url);
            return urlObj.hostname || url;
        } catch {
            return url;
        }
    }

    function renderBrowserTabs() {
        const container = contentEl.querySelector('.browser-tabs');
        const tabsHtml = browserTabs.map(tab => `
            <div class="browser-tab ${tab.id === activeTabId ? 'active' : ''}" data-id="${tab.id}">
                <span class="browser-tab-title">${getDomain(tab.url)}</span>
                <div class="browser-tab-close" data-id="${tab.id}">✕</div>
            </div>
        `).join('');
        container.innerHTML = tabsHtml + '<div class="browser-tab-add" id="browserTabAdd">+</div>';

        container.querySelectorAll('.browser-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('browser-tab-close')) {
                    switchToTab(parseInt(tab.dataset.id));
                }
            });
        });

        container.querySelectorAll('.browser-tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(parseInt(btn.dataset.id));
            });
        });

        document.getElementById('browserTabAdd').addEventListener('click', () => createNewTab());
    }

    function switchToTab(tabId) {
        activeTabId = tabId;
        const tab = browserTabs.find(t => t.id === tabId);
        if (!tab) return;

        document.querySelectorAll('.browser-iframe-container').forEach(c => c.classList.remove('active'));
        const iframeContainer = document.getElementById('browserFrameContainer-' + tabId);
        if (iframeContainer) {
            iframeContainer.classList.add('active');
            const iframe = iframeContainer.querySelector('.browser-iframe');
            const urlInput = document.getElementById('browserUrl');
            if (iframe) {
                urlInput.value = iframe.src || '';
            } else {
                urlInput.value = tab.url === 'about:blank' ? '' : tab.url;
            }
        }
        renderBrowserTabs();
    }

    function closeTab(tabId) {
        if (browserTabs.length <= 1) return;
        const index = browserTabs.findIndex(t => t.id === tabId);
        if (index === -1) return;

        const iframeContainer = document.getElementById('browserFrameContainer-' + tabId);
        if (iframeContainer) iframeContainer.remove();

        browserTabs.splice(index, 1);

        if (activeTabId === tabId) {
            activeTabId = browserTabs[Math.max(0, index - 1)].id;
            switchToTab(activeTabId);
        }
        renderBrowserTabs();
    }

    function createNewTab(url = null) {
        const targetUrl = url || 'about:blank';
        const newId = Date.now();
        browserTabs.push({ id: newId, url: targetUrl });
        activeTabId = newId;

        const contentDiv = contentEl.querySelector('.browser-content');
        const newContainer = document.createElement('div');
        newContainer.className = 'browser-iframe-container';
        newContainer.id = 'browserFrameContainer-' + newId;

        if (targetUrl === 'about:blank') {
            newContainer.innerHTML = `
                <div class="browser-homepage" style="display:flex;">
                    <div class="browser-homepage-logo">
                        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                            <circle cx="40" cy="40" r="35" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)" stroke-width="2"/>
                            <circle cx="40" cy="40" r="20" stroke="rgba(255,255,255,0.8)" stroke-width="2" fill="none"/>
                            <circle cx="40" cy="40" r="8" fill="rgba(255,255,255,0.8)"/>
                            <line x1="40" y1="5" x2="40" y2="20" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                            <line x1="40" y1="60" x2="40" y2="75" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                            <line x1="5" y1="40" x2="20" y2="40" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                            <line x1="60" y1="40" x2="75" y2="40" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                        </svg>
                    </div>
                    <div class="browser-homepage-title">喜浏览器</div>
                    <div class="browser-homepage-sites">
                        <div class="browser-homepage-site" data-url="https://neocn.top/">
                            <div class="browser-homepage-site-icon">
                                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                    <rect width="48" height="48" rx="10" fill="rgba(59,130,246,0.2)"/>
                                    <path d="M24 10L24 38M10 24L38 24" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
                                    <rect x="14" y="14" width="20" height="20" rx="3" stroke="#3B82F6" stroke-width="2" fill="none"/>
                                </svg>
                            </div>
                            <div class="browser-homepage-site-name">作者博客</div>
                        </div>
                        <div class="browser-homepage-site" data-url="https://www.bilibili.com/">
                            <div class="browser-homepage-site-icon">
                                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                    <rect width="48" height="48" rx="10" fill="rgba(0,161,214,0.2)"/>
                                    <circle cx="19" cy="24" r="7" fill="#00A1D6"/>
                                    <circle cx="29" cy="24" r="7" fill="#FF6699"/>
                                    <rect x="12" y="17" width="24" height="14" rx="3" fill="white" fill-opacity="0.3"/>
                                </svg>
                            </div>
                            <div class="browser-homepage-site-name">哔哩哔哩</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            newContainer.innerHTML = `<iframe class="browser-iframe" src="${targetUrl}"></iframe>`;
        }

        contentDiv.appendChild(newContainer);

        document.querySelectorAll('.browser-iframe-container').forEach(c => c.classList.remove('active'));
        newContainer.classList.add('active');

        const homepage = document.getElementById('browserHomepage');
        if (homepage) homepage.style.display = 'none';

        renderBrowserTabs();

        if (targetUrl === 'about:blank') {
            newContainer.querySelectorAll('.browser-homepage-site').forEach(site => {
                site.addEventListener('click', () => {
                    const siteUrl = site.dataset.url;
                    newContainer.innerHTML = `<iframe class="browser-iframe" src="${siteUrl}"></iframe>`;
                    newContainer.classList.add('active');

                    const tab = browserTabs.find(t => t.id === newId);
                    if (tab) tab.url = siteUrl;

                    document.getElementById('browserUrl').value = siteUrl;
                    renderBrowserTabs();
                });
            });
        }
    }

    contentEl.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%">
            <div class="browser-tabs" id="browserTabs"></div>
            <div class="browser-toolbar">
                <div class="browser-nav-btn" id="browserBack">
                    <svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                </div>
                <div class="browser-nav-btn" id="browserForward">
                    <svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                </div>
                <div class="browser-nav-btn" id="browserRefresh">
                    <svg width="16" height="16" viewBox="0 0 16 16"><path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 4V2l2 2-2 2" fill="currentColor"/></svg>
                </div>
                <input type="text" class="browser-url" id="browserUrl" placeholder="搜索或输入网址">
                <div class="browser-nav-btn" id="browserNewTab">
                    <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2"/></svg>
                </div>
            </div>
            <div class="browser-content">
                <div class="browser-homepage" id="browserHomepage">
                    <div class="browser-homepage-logo">
                        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                            <circle cx="40" cy="40" r="35" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)" stroke-width="2"/>
                            <circle cx="40" cy="40" r="20" stroke="rgba(255,255,255,0.8)" stroke-width="2" fill="none"/>
                            <circle cx="40" cy="40" r="8" fill="rgba(255,255,255,0.8)"/>
                            <line x1="40" y1="5" x2="40" y2="20" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                            <line x1="40" y1="60" x2="40" y2="75" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                            <line x1="5" y1="40" x2="20" y2="40" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                            <line x1="60" y1="40" x2="75" y2="40" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                        </svg>
                    </div>
                    <div class="browser-homepage-title">喜浏览器</div>
                    <div class="browser-homepage-sites">
                        <div class="browser-homepage-site" data-url="https://neocn.top/">
                            <div class="browser-homepage-site-icon">
                                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                    <rect width="48" height="48" rx="10" fill="rgba(59,130,246,0.2)"/>
                                    <path d="M24 10L24 38M10 24L38 24" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
                                    <rect x="14" y="14" width="20" height="20" rx="3" stroke="#3B82F6" stroke-width="2" fill="none"/>
                                </svg>
                            </div>
                            <div class="browser-homepage-site-name">作者博客</div>
                        </div>
                        <div class="browser-homepage-site" data-url="https://www.bilibili.com/">
                            <div class="browser-homepage-site-icon">
                                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                    <rect width="48" height="48" rx="10" fill="rgba(0,161,214,0.2)"/>
                                    <circle cx="19" cy="24" r="7" fill="#00A1D6"/>
                                    <circle cx="29" cy="24" r="7" fill="#FF6699"/>
                                    <rect x="12" y="17" width="24" height="14" rx="3" fill="white" fill-opacity="0.3"/>
                                </svg>
                            </div>
                            <div class="browser-homepage-site-name">哔哩哔哩</div>
                        </div>
                    </div>
                </div>
                <div class="browser-iframe-container" id="browserFrameContainer-1"></div>
            </div>
        </div>
    `;

    browserTabs = [{ id: 1, url: 'about:blank' }];
    renderBrowserTabs();

    setTimeout(() => {
        const urlInput = document.getElementById('browserUrl');

        document.querySelectorAll('.browser-homepage-site').forEach(site => {
            site.addEventListener('click', () => {
                const url = site.dataset.url;
                const container = document.getElementById('browserFrameContainer-1');
                container.innerHTML = `<iframe class="browser-iframe" src="${url}"></iframe>`;
                container.classList.add('active');
                document.getElementById('browserHomepage').style.display = 'none';
                urlInput.value = url;
                browserTabs[0].url = url;
                renderBrowserTabs();
            });
        });

        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                let url = urlInput.value.trim();
                if (!url) return;
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                const activeContainer = document.querySelector('.browser-iframe-container.active');
                if (activeContainer) {
                    activeContainer.innerHTML = `<iframe class="browser-iframe" src="${url}"></iframe>`;
                    const tab = browserTabs.find(t => t.id === activeTabId);
                    if (tab) tab.url = url;
                    document.getElementById('browserHomepage').style.display = 'none';
                    renderBrowserTabs();
                }
            }
        });

        document.getElementById('browserBack').addEventListener('click', () => {
            const activeContainer = document.querySelector('.browser-iframe-container.active .browser-iframe');
            if (activeContainer && activeContainer.contentWindow) {
                activeContainer.contentWindow.history.back();
            }
        });

        document.getElementById('browserForward').addEventListener('click', () => {
            const activeContainer = document.querySelector('.browser-iframe-container.active .browser-iframe');
            if (activeContainer && activeContainer.contentWindow) {
                activeContainer.contentWindow.history.forward();
            }
        });

        document.getElementById('browserRefresh').addEventListener('click', () => {
            const activeContainer = document.querySelector('.browser-iframe-container.active .browser-iframe');
            if (activeContainer) activeContainer.src = activeContainer.src;
        });

        document.getElementById('browserNewTab').addEventListener('click', () => {
            createNewTab();
        });
    }, 0);
});
