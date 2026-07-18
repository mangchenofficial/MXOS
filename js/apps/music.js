import { registerAppRenderer } from '../core.js';

var defaultSongIds = [484311588, 3377324867, 1404797306, 2003841390, 35566904, 2124462309, 3316857125, 2657106104, 3375593652, 3325266889];

var defaultSongs = [
    { id: 1, title: "神经病之歌", artist: "洛天依/言和", url: "", albumPic: "https://p2.music.126.net/CMWWIl0TQwTmxF3Peyk0Gg==/18780758115978593.jpg" },
    { id: 2, title: "一瞬间", artist: "洛天依", url: "", albumPic: "https://p1.music.126.net/pZQS5xtjpH6esPTHgANWgA==/109951173157648302.jpg" },
    { id: 3, title: "权御天下", artist: "洛天依", url: "", albumPic: "https://p1.music.126.net/QAT0oEoKn6vphJJfEQk9CA==/109951164541031933.jpg" },
    { id: 4, title: "普通DISCO", artist: "洛天依/言和", url: "", albumPic: "https://p1.music.126.net/fk9d2keRDcHKjyKtYPa4fQ==/109951168113572828.jpg" },
    { id: 5, title: "桃花笑", artist: "言和/乐正绫", url: "", albumPic: "https://p1.music.126.net/vxgfa3lfZBHU0weqIbQvtg==/18364043207207915.jpg" },
    { id: 6, title: "大哉乾元", artist: "洛天依", url: "", albumPic: "https://p1.music.126.net/pwTPHAcgNKkXRqctCBj8bA==/109951172369926129.jpg" },
    { id: 7, title: "我的悲伤是水做的", artist: "洛天依", url: "", albumPic: "https://p1.music.126.net/KY9yuvYlsmJtJZC9ghzdfw==/109951172267819738.jpg" },
    { id: 8, title: "东京不太热", artist: "洛天依", url: "", albumPic: "https://p1.music.126.net/uccVkm6DN_WZXxACcPNR7A==/109951170268133935.jpg" },
    { id: 9, title: "晚风拂过山川", artist: "洛天依", url: "", albumPic: "https://p1.music.126.net/0fMNS4LVuYuudleBY6W3Vw==/109951173136058011.jpg" },
    { id: 10, title: "玉兰开花三月三", artist: "洛天依", url: "", albumPic: "https://p1.music.126.net/VKyykN7jSgTDVyY33HOaHA==/109951172388353900.jpg" }
];

for (var defaultSongIndex = 0; defaultSongIndex < defaultSongs.length; defaultSongIndex++) {
    defaultSongs[defaultSongIndex].sourceId = defaultSongIds[defaultSongIndex];
    defaultSongs[defaultSongIndex].server = 'netease';
}

var musicAppData = {
    playlist: [],
    currentIndex: 0,
    isPlaying: false,
    audio: null,
    currentPage: 1,
    perPage: 10,
    searchResults: [],
    searchMessage: '',
    isPreloaded: false,
    savedSongTitle: '',
    savedSongArtist: '',
    savedCurrentTime: 0,
    lyrics: [],
    lyricsSynced: false,
    lyricStatus: 'idle',
    activeLyricIndex: -1,
    lyricSongKey: '',
    lyricRequestToken: 0,
    lyricCache: {},
    resizeObserver: null,
    resizeTimer: null
};

function preloadMusicUrls() {
    if (musicAppData.isPreloaded) return;

    Promise.all(defaultSongIds.map(function(id, index) {
        return fetch('https://api.injahow.cn/meting/?server=netease&type=song&id=' + id)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data && data[0] && defaultSongs[index]) {
                    if (data[0].url) {
                        defaultSongs[index].url = data[0].url;
                    }
                    if (data[0].pic) {
                        defaultSongs[index].albumPic = data[0].pic;
                    }
                    if (data[0].lrc) {
                        defaultSongs[index].lyricUrl = data[0].lrc;
                    }
                }
            })
            .catch(function(e) {});
    }))
    .then(function() {
        musicAppData.isPreloaded = true;
    })
    .catch(function(e) { console.log('预加载失败', e); });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadMusicUrls);
} else {
    preloadMusicUrls();
}

async function loadDefaultSongsUrl() {
    musicAppData.searchMessage = '';
    musicAppData.playlist = [];
    if (musicAppData.isPreloaded) {
        for (var i = 0; i < defaultSongs.length; i++) {
            musicAppData.playlist.push(defaultSongs[i]);
        }
    } else {
        for (var i = 0; i < defaultSongs.length; i++) {
            var song = defaultSongs[i];
            try {
                var response = await fetch('https://api.injahow.cn/meting/?server=netease&type=song&id=' + defaultSongIds[i]);
                var data = await response.json();
                if (data && data[0]) {
                    if (data[0].url) {
                        song.url = data[0].url;
                    }
                    if (data[0].pic) {
                        song.albumPic = data[0].pic;
                    }
                    if (data[0].lrc) {
                        song.lyricUrl = data[0].lrc;
                    }
                }
            } catch (e) {}
            musicAppData.playlist.push(song);
        }
        musicAppData.isPreloaded = true;
    }
}

function requestMusicJsonp(baseUrl, timeoutMs) {
    return new Promise(function(resolve, reject) {
        var callbackName = '__mxosMusicSearch_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        var script = document.createElement('script');
        var finished = false;
        var timer = null;

        function cleanup() {
            if (timer) clearTimeout(timer);
            if (script.parentNode) script.parentNode.removeChild(script);
            try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
        }

        function finish(error, data) {
            if (finished) return;
            finished = true;
            cleanup();
            if (error) reject(error);
            else resolve(data);
        }

        window[callbackName] = function(data) {
            finish(null, data);
        };
        script.async = true;
        script.src = baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 'format=jsonp&jsonpCallback=' + encodeURIComponent(callbackName);
        script.onerror = function() {
            finish(new Error('搜索服务加载失败'));
        };
        timer = setTimeout(function() {
            finish(new Error('搜索请求超时'));
        }, timeoutMs || 12000);
        document.head.appendChild(script);
    });
}

async function fetchMetingSong(server, sourceId) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function() { controller.abort(); }, 12000) : null;
    try {
        var response = await fetch(
            'https://api.injahow.cn/meting/?server=' + encodeURIComponent(server) + '&type=song&id=' + encodeURIComponent(sourceId),
            controller ? { signal: controller.signal } : undefined
        );
        if (!response.ok) throw new Error('歌曲信息请求失败: ' + response.status);
        var data = await response.json();
        return data && data[0] ? data[0] : null;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function searchMusic(keyword) {
    keyword = String(keyword || '').trim();
    if (!keyword) {
        var emptyBackBtn = document.getElementById('musicBackBtn');
        if (emptyBackBtn) emptyBackBtn.style.display = 'none';
        await loadDefaultSongsUrl();
        musicAppData.currentPage = 1;
        renderMusicList();
        return;
    }

    var searchInput = document.getElementById('musicSearchInput');
    var loadingEl = document.getElementById('musicLoading');
    var listArea = document.getElementById('musicListArea');
    var backBtn = document.getElementById('musicBackBtn');

    if (backBtn) backBtn.style.display = 'flex';
    if (searchInput) searchInput.disabled = true;
    if (loadingEl) loadingEl.style.display = 'flex';
    if (listArea) listArea.style.display = 'none';
    musicAppData.searchMessage = '';

    try {
        var searchUrl = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=1&n=10&aggr=1&cr=1&w=' + encodeURIComponent(keyword);
        var searchData = await requestMusicJsonp(searchUrl, 12000);
        var sourceSongs = searchData && searchData.data && searchData.data.song && Array.isArray(searchData.data.song.list)
            ? searchData.data.song.list.slice(0, 10)
            : [];

        if (sourceSongs.length === 0) {
            musicAppData.searchResults = [];
            musicAppData.playlist = [];
            musicAppData.searchMessage = '没有找到与“' + keyword + '”相关的歌曲';
        } else {
            var resolvedSongs = await Promise.all(sourceSongs.map(async function(sourceSong) {
                var sourceId = sourceSong.songmid;
                if (!sourceId) return null;
                try {
                    var metingSong = await fetchMetingSong('tencent', sourceId);
                    if (!metingSong || !metingSong.url) return null;
                    var sourceArtist = sourceSong.singer && sourceSong.singer[0] ? sourceSong.singer[0].name : '未知歌手';
                    return {
                        id: 'qq_' + sourceId,
                        sourceId: sourceId,
                        server: 'tencent',
                        title: metingSong.name || sourceSong.songname || '未知歌曲',
                        artist: metingSong.artist || sourceArtist,
                        url: metingSong.url,
                        albumPic: metingSong.pic || '',
                        lyricUrl: metingSong.lrc || ''
                    };
                } catch (e) {
                    return null;
                }
            }));

            var playableSongs = resolvedSongs.filter(function(song) { return !!song; });
            musicAppData.searchResults = playableSongs;
            musicAppData.playlist = playableSongs.slice();
            if (playableSongs.length === 0) {
                musicAppData.searchMessage = '找到了相关歌曲，但暂时没有可播放的音源';
            }
        }
    } catch (e) {
        console.error('搜索失败:', e);
        musicAppData.searchResults = [];
        musicAppData.playlist = [];
        musicAppData.searchMessage = e && e.message === '搜索请求超时'
            ? '搜索超时，请稍后重试'
            : '搜索服务暂时不可用，请稍后重试';
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
        if (listArea) listArea.style.display = 'flex';
        if (searchInput) {
            searchInput.disabled = false;
            searchInput.focus();
        }
        musicAppData.currentPage = 1;
        renderMusicList();
    }
}
function getSongLyricKey(song) {
    if (!song) return '';
    return String(song.server || 'netease') + ':' + String(song.sourceId || song.id || (song.title + '|' + song.artist));
}

function getSongLyricUrls(song) {
    var urls = [];
    if (song && song.lyricUrl) urls.push(song.lyricUrl);
    var sourceId = song && (song.sourceId || song.id);
    var server = song && song.server ? song.server : 'netease';
    if (sourceId) {
        urls.push('https://api.injahow.cn/meting/?server=' + encodeURIComponent(server) + '&type=lrc&id=' + encodeURIComponent(sourceId));
    }
    return urls.filter(function(url, index) {
        return url && urls.indexOf(url) === index;
    });
}

function extractLyricText(rawText) {
    var text = String(rawText || '').replace(/^\uFEFF/, '').trim();
    if (!text) return '';
    try {
        var data = JSON.parse(text);
        if (typeof data === 'string') return data;
        if (data && typeof data.lyric === 'string') return data.lyric;
        if (data && typeof data.lrc === 'string') return data.lrc;
        if (data && data.lrc && typeof data.lrc.lyric === 'string') return data.lrc.lyric;
        if (Array.isArray(data) && data[0]) {
            if (typeof data[0].lyric === 'string') return data[0].lyric;
            if (typeof data[0].lrc === 'string' && data[0].lrc.indexOf('[') === 0) return data[0].lrc;
        }
    } catch (e) {}
    return text;
}

function parseLyricText(rawText) {
    var text = extractLyricText(rawText);
    if (!text || /^\s*</.test(text)) return { lines: [], synced: false };

    var rawLines = text.split(/\r?\n/);
    var timedLines = [];
    var plainLines = [];
    var offsetSeconds = 0;

    for (var i = 0; i < rawLines.length; i++) {
        var rawLine = rawLines[i].trim();
        if (!rawLine) continue;
        var offsetMatch = rawLine.match(/^\[offset:([+-]?\d+)\]$/i);
        if (offsetMatch) {
            offsetSeconds = parseInt(offsetMatch[1], 10) / 1000;
            continue;
        }
        if (/^\[(ar|ti|al|by|re|ve):/i.test(rawLine)) continue;

        var timestamps = [];
        var timestampRegex = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g;
        var match;
        while ((match = timestampRegex.exec(rawLine)) !== null) {
            timestamps.push(parseInt(match[1], 10) * 60 + parseFloat(match[2]));
        }

        var lyricText = rawLine.replace(timestampRegex, '').trim();
        if (timestamps.length > 0) {
            for (var t = 0; t < timestamps.length; t++) {
                timedLines.push({ time: timestamps[t], text: lyricText || '♪' });
            }
        } else {
            var plainText = rawLine.replace(/^\[[^\]]+\]\s*/, '').trim();
            if (plainText) plainLines.push({ time: null, text: plainText });
        }
    }

    if (timedLines.length > 0) {
        timedLines.forEach(function(line) {
            line.time = Math.max(0, line.time + offsetSeconds);
        });
        timedLines.sort(function(a, b) { return a.time - b.time; });
        return { lines: timedLines, synced: true };
    }
    return { lines: plainLines, synced: false };
}

function setLyricHint(text) {
    var hint = document.getElementById('musicLyricsHint');
    if (hint) hint.textContent = text || '';
}

function renderLyrics() {
    var scrollEl = document.getElementById('musicLyricsScroll');
    if (!scrollEl) return;
    scrollEl.innerHTML = '';
    scrollEl.classList.remove('plain');
    musicAppData.activeLyricIndex = -1;

    if (musicAppData.lyricStatus === 'loading') {
        setLyricHint('加载中');
        var loading = document.createElement('div');
        loading.className = 'music-lyrics-status';
        loading.textContent = '正在加载歌词...';
        scrollEl.appendChild(loading);
        return;
    }

    if (musicAppData.lyricStatus === 'idle') {
        setLyricHint('');
        var idle = document.createElement('div');
        idle.className = 'music-lyrics-status';
        idle.textContent = '播放歌曲后显示歌词';
        scrollEl.appendChild(idle);
        return;
    }

    if (musicAppData.lyricStatus === 'error') {
        setLyricHint('加载失败');
        var error = document.createElement('div');
        error.className = 'music-lyrics-status';
        error.textContent = '歌词加载失败，请稍后重试';
        scrollEl.appendChild(error);
        return;
    }

    if (musicAppData.lyricStatus === 'empty' || musicAppData.lyrics.length === 0) {
        setLyricHint('无歌词');
        var empty = document.createElement('div');
        empty.className = 'music-lyrics-status';
        empty.textContent = '这首歌暂时没有歌词';
        scrollEl.appendChild(empty);
        return;
    }

    setLyricHint(musicAppData.lyricsSynced ? '滚动歌词' : '纯文本');
    scrollEl.classList.toggle('plain', !musicAppData.lyricsSynced);
    musicAppData.lyrics.forEach(function(line, index) {
        var lineEl = document.createElement('div');
        lineEl.className = 'music-lyric-line';
        lineEl.dataset.index = String(index);
        if (typeof line.time === 'number') {
            lineEl.dataset.time = String(line.time);
            lineEl.title = '点击跳转到 ' + formatTime(line.time);
        }
        lineEl.textContent = line.text;
        scrollEl.appendChild(lineEl);
    });
}

async function fetchLyricText(song) {
    var urls = getSongLyricUrls(song);
    var lastError = null;
    for (var i = 0; i < urls.length; i++) {
        try {
            var response = await fetch(urls[i]);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            var text = await response.text();
            if (text && !/^\s*</.test(text)) return text;
        } catch (e) {
            lastError = e;
        }
    }
    if (lastError) throw lastError;
    return '';
}

async function loadLyricsForSong(song) {
    var songKey = getSongLyricKey(song);
    var requestToken = ++musicAppData.lyricRequestToken;
    musicAppData.lyricSongKey = songKey;
    musicAppData.lyricStatus = 'loading';
    musicAppData.lyrics = [];
    musicAppData.lyricsSynced = false;
    renderLyrics();

    if (!songKey) {
        musicAppData.lyricStatus = 'empty';
        renderLyrics();
        return;
    }

    if (musicAppData.lyricCache[songKey]) {
        var cached = musicAppData.lyricCache[songKey];
        musicAppData.lyrics = cached.lines;
        musicAppData.lyricsSynced = cached.synced;
        musicAppData.lyricStatus = cached.lines.length ? 'ready' : 'empty';
        renderLyrics();
        updateLyricHighlight(musicAppData.audio ? musicAppData.audio.currentTime : 0, true);
        return;
    }

    try {
        var lyricText = await fetchLyricText(song);
        if (requestToken !== musicAppData.lyricRequestToken || songKey !== musicAppData.lyricSongKey) return;
        var parsed = parseLyricText(lyricText);
        musicAppData.lyricCache[songKey] = parsed;
        musicAppData.lyrics = parsed.lines;
        musicAppData.lyricsSynced = parsed.synced;
        musicAppData.lyricStatus = parsed.lines.length ? 'ready' : 'empty';
        renderLyrics();
        updateLyricHighlight(musicAppData.audio ? musicAppData.audio.currentTime : 0, true);
    } catch (e) {
        if (requestToken !== musicAppData.lyricRequestToken) return;
        console.warn('歌词加载失败:', e);
        musicAppData.lyricStatus = 'error';
        musicAppData.lyrics = [];
        renderLyrics();
    }
}

function updateLyricHighlight(currentTime, immediate) {
    if (!musicAppData.lyricsSynced || musicAppData.lyricStatus !== 'ready') return;
    var activeIndex = -1;
    var low = 0;
    var high = musicAppData.lyrics.length - 1;
    while (low <= high) {
        var middle = Math.floor((low + high) / 2);
        if (musicAppData.lyrics[middle].time <= currentTime + 0.12) {
            activeIndex = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    if (activeIndex === musicAppData.activeLyricIndex) return;

    var scrollEl = document.getElementById('musicLyricsScroll');
    if (!scrollEl) return;
    var oldActive = scrollEl.querySelector('.music-lyric-line.active');
    if (oldActive) oldActive.classList.remove('active');
    musicAppData.activeLyricIndex = activeIndex;
    if (activeIndex < 0) return;

    var activeEl = scrollEl.querySelector('.music-lyric-line[data-index="' + activeIndex + '"]');
    if (!activeEl) return;
    activeEl.classList.add('active');
    var targetTop = activeEl.offsetTop - scrollEl.clientHeight / 2 + activeEl.offsetHeight / 2;
    if (typeof scrollEl.scrollTo === 'function') {
        scrollEl.scrollTo({ top: Math.max(0, targetTop), behavior: immediate ? 'auto' : 'smooth' });
    } else {
        scrollEl.scrollTop = Math.max(0, targetTop);
    }
}
function initMusicApp(container) {
    var savedIsPlaying = musicAppData.isPlaying;
    var savedTime = musicAppData.savedCurrentTime;
    var savedTitle = musicAppData.savedSongTitle;
    var savedArtist = musicAppData.savedSongArtist;
    var hasSavedSong = savedTitle && savedTitle !== '喜音乐' && savedTitle !== '点击播放';

    if (!musicAppData.audio) {
        musicAppData.audio = new Audio();
    }

    loadDefaultSongsUrl().then(function() {
        renderMusicList();

        if (hasSavedSong && musicAppData.playlist.length > 0) {
            var matchingIndex = -1;
            for (var i = 0; i < musicAppData.playlist.length; i++) {
                if (musicAppData.playlist[i].title === savedTitle && musicAppData.playlist[i].artist === savedArtist) {
                    matchingIndex = i;
                    break;
                }
            }

            if (matchingIndex !== -1) {
                musicAppData.currentIndex = matchingIndex;
                var titleEl = document.getElementById('musicSongTitle');
                var artistEl = document.getElementById('musicSongArtist');
                var timeCurrentEl = document.getElementById('musicTimeCurrent');
                var progressFillEl = document.getElementById('musicProgressFill');
                var playBtn = document.getElementById('musicPlayBtn');

                if (titleEl) titleEl.textContent = musicAppData.playlist[matchingIndex].title;
                if (artistEl) artistEl.textContent = musicAppData.playlist[matchingIndex].artist;
                loadLyricsForSong(musicAppData.playlist[matchingIndex]);

                if (savedIsPlaying && musicAppData.playlist[matchingIndex].url) {
                    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(savedTime);
                    if (progressFillEl) progressFillEl.style.width = '0%';

                    var song = musicAppData.playlist[matchingIndex];
                    if (musicAppData.audio.src !== song.url) {
                        musicAppData.audio.src = song.url;
                        musicAppData.audio.currentTime = savedTime;
                    }
                    if (playBtn) {
                        playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
                    }
                } else {
                    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(savedTime);
                    if (progressFillEl) progressFillEl.style.width = '0%';
                    if (playBtn) {
                        playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                    }
                }

                renderMusicList();
            }
        }
    });

    var searchInput = document.getElementById('musicSearchInput');
    var searchBtn = document.getElementById('musicSearchBtn');
    var backBtn = document.getElementById('musicBackBtn');
    var playBtn = document.getElementById('musicPlayBtn');
    var prevBtn = document.getElementById('musicPrevBtn');
    var nextBtn = document.getElementById('musicNextBtn');
    var progressTrack = document.getElementById('musicProgressTrack');
    var lyricScroll = document.getElementById('musicLyricsScroll');

    if (backBtn) {
        backBtn.onclick = function() {
            searchInput.value = '';
            backBtn.style.display = 'none';
            loadDefaultSongsUrl().then(function() {
                renderMusicList();
            });
        };
    }

    if (searchBtn) {
        searchBtn.onclick = function() {
            searchMusic(searchInput.value);
        };
    }
    if (searchInput) {
        searchInput.onkeypress = function(e) {
            if (e.key === 'Enter') {
                searchMusic(searchInput.value);
            }
        };
    }
    if (playBtn) {
        playBtn.onclick = togglePlay;
    }
    if (prevBtn) {
        prevBtn.onclick = playPrev;
    }
    if (nextBtn) {
        nextBtn.onclick = playNext;
    }
    if (progressTrack) {
        progressTrack.onclick = function(e) {
            if (musicAppData.playlist.length > 0 && musicAppData.audio.duration) {
                var rect = progressTrack.getBoundingClientRect();
                var pos = (e.clientX - rect.left) / rect.width;
                musicAppData.audio.currentTime = pos * musicAppData.audio.duration;
                updateLyricHighlight(musicAppData.audio.currentTime, true);
            }
        };
    }
    if (lyricScroll) {
        lyricScroll.onclick = function(e) {
            var line = e.target.closest('.music-lyric-line[data-time]');
            if (!line || !musicAppData.audio) return;
            var targetTime = parseFloat(line.dataset.time);
            if (isNaN(targetTime)) return;
            try {
                musicAppData.audio.currentTime = targetTime;
                updateProgress();
                updateLyricHighlight(targetTime, true);
            } catch (error) {}
        };
    }

    musicAppData.audio.ontimeupdate = function() {
        updateProgress();
    };
    musicAppData.audio.onended = function() {
        playNext();
    };
    musicAppData.audio.onloadedmetadata = function() {
        var total = document.getElementById('musicTimeTotal');
        if (total) total.textContent = formatTime(musicAppData.audio.duration);
    };
    musicAppData.audio.onerror = function(e) {
        console.error('播放错误:', e);
        var titleEl = document.getElementById('musicSongTitle');
        if (titleEl) titleEl.textContent = "播放失败";
    };

    if (musicAppData.resizeObserver) {
        musicAppData.resizeObserver.disconnect();
        musicAppData.resizeObserver = null;
    }
    if (typeof ResizeObserver !== 'undefined') {
        musicAppData.resizeObserver = new ResizeObserver(function() {
            if (musicAppData.resizeTimer) clearTimeout(musicAppData.resizeTimer);
            musicAppData.resizeTimer = setTimeout(function() {
                renderMusicList();
                updateLyricHighlight(musicAppData.audio ? musicAppData.audio.currentTime : 0, true);
            }, 120);
        });
        musicAppData.resizeObserver.observe(container);
    }

    renderMusicList();
}

function renderMusicList() {
    var listEl = document.getElementById('musicList');
    var pagesEl = document.getElementById('musicPages');
    if (!listEl || !pagesEl) return;

    var listArea = document.getElementById('musicListArea');
    if (listArea) {
        var areaHeight = listArea.offsetHeight;
        var searchBox = document.querySelector('.music-search-box');
        var searchH = searchBox ? searchBox.offsetHeight : 0;
        var pagesH = 50;
        var availH = areaHeight - searchH - pagesH - 30;
        musicAppData.perPage = Math.max(3, Math.floor(availH / 65));
    }

    var totalPages = Math.ceil(musicAppData.playlist.length / musicAppData.perPage);
    var start = (musicAppData.currentPage - 1) * musicAppData.perPage;
    var end = start + musicAppData.perPage;
    var pageSongs = musicAppData.playlist.slice(start, end);

    listEl.innerHTML = '';
    if (musicAppData.playlist.length === 0) {
        var emptyState = document.createElement('div');
        emptyState.className = 'music-empty-state';
        emptyState.innerHTML = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M9 9h4M11 7v4"/></svg><span></span>';
        var emptyText = emptyState.querySelector('span');
        if (emptyText) emptyText.textContent = musicAppData.searchMessage || '暂无歌曲';
        listEl.appendChild(emptyState);
        pagesEl.innerHTML = '';
        return;
    }
    for (var i = 0; i < pageSongs.length; i++) {
        var song = pageSongs[i];
        var realIndex = start + i;
        var item = document.createElement('div');
        item.className = 'music-item-row' + (realIndex === musicAppData.currentIndex ? ' now-playing' : '');

        var iconHtml = '';
        if (song.albumPic) {
            iconHtml = '<img class="music-item-album-pic" src="' + song.albumPic + '" alt="专辑">';
        } else {
            iconHtml = '<div class="music-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>';
        }

        item.innerHTML = iconHtml + '<div class="music-item-text"><div class="music-item-title">' + song.title + '</div><div class="music-item-artist">' + song.artist + '</div></div>';
        item.onclick = (function(idx) {
            return function() { playMusic(idx); };
        })(realIndex);
        listEl.appendChild(item);
    }

    pagesEl.innerHTML = '';
    if (totalPages > 1) {
        for (var p = 1; p <= totalPages; p++) {
            var btn = document.createElement('button');
            btn.className = 'music-page-num' + (p === musicAppData.currentPage ? ' active' : '');
            btn.textContent = p;
            btn.onclick = (function(page) {
                return function() {
                    musicAppData.currentPage = page;
                    renderMusicList();
                };
            })(p);
            pagesEl.appendChild(btn);
        }
    }
}

function playMusic(index) {
    if (index < 0 || index >= musicAppData.playlist.length) return;
    musicAppData.currentIndex = index;
    var song = musicAppData.playlist[index];

    musicAppData.savedSongTitle = song.title;
    musicAppData.savedSongArtist = song.artist;
    musicAppData.savedCurrentTime = 0;
    loadLyricsForSong(song);

    var titleEl = document.getElementById('musicSongTitle');
    var artistEl = document.getElementById('musicSongArtist');
    var playBtn = document.getElementById('musicPlayBtn');
    var coverEl = document.getElementById('musicCoverDisplay');
    if (titleEl) titleEl.textContent = "加载中...";
    if (artistEl) artistEl.textContent = song.artist;

    if (coverEl && song.albumPic) {
        coverEl.innerHTML = '<img src="' + song.albumPic + '" style="width:100%;height:100%;border-radius:12px;object-fit:cover;">';
    } else if (coverEl) {
        coverEl.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
    }

    var timeoutId = setTimeout(function() {
        if (titleEl && titleEl.textContent === "加载中...") {
            titleEl.textContent = "加载超时";
        }
    }, 5000);

    if (song.url && song.url.indexOf('.mp3') !== -1 && !song.url.startsWith('http')) {
        musicAppData.audio = new Audio();
        musicAppData.audio.crossOrigin = "anonymous";
    }

    musicAppData.audio.src = song.url;

    var playPromise = musicAppData.audio.play();

    if (playPromise !== undefined) {
        playPromise.then(function() {
            clearTimeout(timeoutId);
            musicAppData.isPlaying = true;
            if (titleEl) titleEl.textContent = song.title;
            if (playBtn) playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        }).catch(function(e) {
            clearTimeout(timeoutId);
            console.error('播放失败:', e);
            if (titleEl) titleEl.textContent = "播放失败";
        });
    }

    renderMusicList();
}

function togglePlay() {
    var playBtn = document.getElementById('musicPlayBtn');
    if (musicAppData.playlist.length === 0) return;

    if (musicAppData.isPlaying) {
        musicAppData.audio.pause();
        if (playBtn) playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    } else {
        if (musicAppData.audio.src) {
            musicAppData.audio.play();
        } else {
            playMusic(0);
        }
        if (playBtn) playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    }
    musicAppData.isPlaying = !musicAppData.isPlaying;

    if (musicAppData.playlist[musicAppData.currentIndex]) {
        musicAppData.savedSongTitle = musicAppData.playlist[musicAppData.currentIndex].title;
        musicAppData.savedSongArtist = musicAppData.playlist[musicAppData.currentIndex].artist;
    }
}

function playNext() {
    var nextIdx = (musicAppData.currentIndex + 1) % musicAppData.playlist.length;
    playMusic(nextIdx);
}

function playPrev() {
    var prevIdx = (musicAppData.currentIndex - 1 + musicAppData.playlist.length) % musicAppData.playlist.length;
    playMusic(prevIdx);
}

function updateProgress() {
    var fillEl = document.getElementById('musicProgressFill');
    var currEl = document.getElementById('musicTimeCurrent');
    if (!fillEl || !currEl || !musicAppData.audio.duration) return;

    var pct = (musicAppData.audio.currentTime / musicAppData.audio.duration) * 100;
    fillEl.style.width = pct + '%';
    currEl.textContent = formatTime(musicAppData.audio.currentTime);

    musicAppData.savedCurrentTime = musicAppData.audio.currentTime;
    updateLyricHighlight(musicAppData.audio.currentTime, false);
}

function formatTime(seconds) {
    if (isNaN(seconds) || !seconds) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
}

registerAppRenderer('music', async (contentEl, windowEl, appId) => {
    contentEl.classList.add('music-window-content');
    contentEl.innerHTML = `
        <div class="music-app-container">
            <div class="music-list-panel">
                <div class="music-search-box">
                    <button class="music-back-btn" id="musicBackBtn" style="display:none">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <input type="text" class="music-search-input" id="musicSearchInput" placeholder="搜索音乐...">
                    <button class="music-search-btn" id="musicSearchBtn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                        </svg>
                    </button>
                </div>
                <div class="music-loading" id="musicLoading" style="display:none">
                    <div class="music-loading-spinner"></div>
                    <span>正在加载...</span>
                </div>
                <div class="music-list-area" id="musicListArea">
                    <div class="music-list" id="musicList"></div>
                    <div class="music-pages" id="musicPages"></div>
                </div>
            </div>
            <div class="music-player-panel">
                <div class="music-player-box">
                    <div class="music-cover-display" id="musicCoverDisplay">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                    </div>
                    <div class="music-song-info">
                        <div class="music-song-title" id="musicSongTitle">喜音乐</div>
                        <div class="music-song-artist" id="musicSongArtist">点击播放</div>
                    </div>
                    <div class="music-lyrics-panel" id="musicLyricsPanel">
                        <div class="music-lyrics-header">
                            <span>歌词</span>
                            <span class="music-lyrics-hint" id="musicLyricsHint"></span>
                        </div>
                        <div class="music-lyrics-scroll mxos-scroll" id="musicLyricsScroll" role="region" aria-label="歌曲歌词">
                            <div class="music-lyrics-status">播放歌曲后显示歌词</div>
                        </div>
                    </div>
                    <div class="music-progress-area">
                        <span class="music-time-current" id="musicTimeCurrent">0:00</span>
                        <div class="music-progress-track" id="musicProgressTrack">
                            <div class="music-progress-fill" id="musicProgressFill"></div>
                        </div>
                        <span class="music-time-total" id="musicTimeTotal">0:00</span>
                    </div>
                    <div class="music-buttons">
                        <button class="music-btn" id="musicPrevBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                            </svg>
                        </button>
                        <button class="music-btn-play" id="musicPlayBtn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                        <button class="music-btn" id="musicNextBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    setTimeout(() => {
        initMusicApp(contentEl);
    }, 100);
});






