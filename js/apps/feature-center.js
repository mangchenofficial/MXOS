import { registerAppRenderer } from '../core.js';

window.MXOS = window.MXOS || {};
window.MXOS.Apps = window.MXOS.Apps || {};

const LS_PREFIX = 'mxos_fc_';

const ICONS = {
    launcher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    commandPalette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3M4 17v3h3M20 7V4h-3M20 17v3h-3M9 9h6v6H9z"/></svg>',
    clipboardHistory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
    focusMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    stickyNotes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    colorPicker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    translator: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M21 12a9 9 0 0 1-9 9m9-9h-6m6 0v6"/></svg>',
    startSearch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    widgetPanel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    quickSettings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    desktopPet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M9 15a3 3 0 0 0 6 0"/></svg>',
    heartbeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    eyeCare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    focusStats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    usageReport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
    ambientSound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    soundThemes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    typingSound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h2M10 8h2M14 8h2M18 8h2M6 12h2M10 12h2M14 12h2M18 12h2M8 16h8"/></svg>',
    keyboardMusic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    seasons: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    weatherSystem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 3.2 14.2A3 3 0 1 1 8.8 9.6A4.5 4.5 0 1 1 17.5 13a2.5 2.5 0 0 1 2.5 3.2z"/><path d="M16 20l-2 2-2-2M8 22l2 2 2-2"/></svg>',
    desktopAurora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c2-3 5-5 10-5s8 2 10 5"/><path d="M2 19c2-3 5-5 10-5s8 2 10 5"/></svg>',
    nightMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    appEvolution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
    appLeaderboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>',
    stamps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    fortune: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    easterEggs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a8 8 0 0 0-8 8v2a8 8 0 0 0 16 0v-2a8 8 0 0 0-8-8z"/><path d="M9 11h.01"/><path d="M15 11h.01"/><path d="M10 15h4"/></svg>',
    terminalAdventure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    dailyJoke: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    festivalEggs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    doodle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
    particleArt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    vinyl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
    desktopPiano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 20V4M10 20V4M14 20V4M18 20V4"/></svg>',
    desktopDrum: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
    mxosRadio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M4 9h16"/><path d="M4 9l8-5 8 5"/></svg>',
    moonPhase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    clockTower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    wallpaperSlideshow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    wallpaperColor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5" fill="currentColor"/><path d="M13.5 9c-3 0-5.5 2.5-5.5 5.5 0 1.9 1.1 3.3 3 3.8V21h5v-2.7c1.9-.5 3-1.9 3-3.8C19 11.5 16.5 9 13.5 9z"/></svg>',
    cursorEffects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>',
    mouseGestures: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4z"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>',
    desktopFlip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"/><path d="M12 2v10"/></svg>',
    floatMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/><path d="M12 22V8"/></svg>',
    screenCrack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l4 4"/><path d="M10 3l2 5"/><path d="M17 4l-3 6"/><path d="M21 7l-7 3"/><path d="M15 14l6 4"/><path d="M12 13l-3 7"/></svg>',
    phantomMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    windowSnap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
    windowSplitLayout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/></svg>',
    windowShake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l-2 2 2 2"/><path d="M20 10l2 2-2 2"/><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    windowGravity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M8 21l4 3 4-3"/><path d="M6 8l6 6 6-6"/></svg>',
    windowFold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M6 16l6-12 6 12"/></svg>',
    windowAura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/><circle cx="12" cy="12" r="5"/></svg>',
    windowFx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    windowMeditation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    windowMood: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    windowGenealogy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6h4M16 10v4"/></svg>',
    appBadges: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    launchAura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>',
    appWardrobe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6M10 6V4a2 2 0 0 1 4 0v2"/></svg>',
    appDating: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    appBirthday: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    appGraveyard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20l6-10 6 10"/><path d="M8 22l8-2 8 2"/><path d="M4 22h16"/></svg>',
    timeMachine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    timeCapsule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v8c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V6l8-4z"/></svg>',
    smokeTest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    dataExport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    incognito: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    systemUpdate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c-2.21 0-4-4-4-9s1.79-9 4-9m0 18c2.21 0 4-4 4-9s-1.79-9-4-9"/></svg>',
    healthScore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    screenRecorder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
    ocr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    qrCode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    qrScanner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>',
    symbolPanel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    textReplace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    aiAssistant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/><path d="M9 12h6M12 9v6"/></svg>',
    dreamMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    desktopTheater: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 18l-2 4M18 18l2 4"/></svg>',
    appPersonality: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    mxosStory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    starfieldMode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/></svg>',
    countdownWidget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    stickyWall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>'
};

const CATEGORIES = [
    { id: 'all', name: '全部' },
    { id: 'tools', name: '工具' },
    { id: 'life', name: '生命感' },
    { id: 'ambiance', name: '氛围' },
    { id: 'gamification', name: '游戏化' },
    { id: 'creative', name: '创意' },
    { id: 'desktop', name: '桌面效果' },
    { id: 'window', name: '窗口' },
    { id: 'system', name: '系统' },
    { id: 'entertainment', name: '娱乐' }
];

const FEATURES = [
    { id: 'launcher', name: '全局启动器', desc: '快速搜索并启动应用', category: 'tools', shortcut: 'Ctrl+Space', icon: ICONS.launcher },
    { id: 'commandPalette', name: '命令面板', desc: '执行系统命令与快捷操作', category: 'tools', shortcut: 'Ctrl+Shift+P', icon: ICONS.commandPalette },
    { id: 'clipboardHistory', name: '剪贴板历史', desc: '查看并复用最近复制的内容', category: 'tools', shortcut: 'Ctrl+Shift+V', icon: ICONS.clipboardHistory, toggle: true },
    { id: 'focusMode', name: '专注模式', desc: '屏蔽干扰，保持高效', category: 'tools', shortcut: '', icon: ICONS.focusMode, toggle: true },
    { id: 'stickyNotes', name: '桌面便签', desc: '随时记录灵感与待办', category: 'tools', shortcut: '', icon: ICONS.stickyNotes, toggle: true },
    { id: 'colorPicker', name: '屏幕取色器', desc: '拾取屏幕上任意颜色', category: 'tools', shortcut: '', icon: ICONS.colorPicker },
    { id: 'translator', name: '快捷翻译', desc: '划词翻译与多语言转换', category: 'tools', shortcut: '', icon: ICONS.translator, toggle: true },
    { id: 'startSearch', name: '开始菜单搜索', desc: '在开始菜单实时搜索应用与文件', category: 'tools', shortcut: '', icon: ICONS.startSearch },
    { id: 'widgetPanel', name: '桌面小部件', desc: '添加时钟、天气等小组件', category: 'tools', shortcut: '', icon: ICONS.widgetPanel },
    { id: 'quickSettings', name: '快捷设置面板', desc: '一键开关常用系统设置', category: 'tools', shortcut: '', icon: ICONS.quickSettings },
    { id: 'desktopPet', name: '桌面宠物', desc: '会在桌面陪伴你的小可爱', category: 'life', shortcut: '', icon: ICONS.desktopPet, toggle: true },
    { id: 'heartbeat', name: '心跳脉冲', desc: '桌面随时间呼吸律动', category: 'life', shortcut: '', icon: ICONS.heartbeat, toggle: true },
    { id: 'eyeCare', name: '护眼提醒', desc: '定时提醒休息保护视力', category: 'life', shortcut: '', icon: ICONS.eyeCare, toggle: true },
    { id: 'focusStats', name: '专注统计', desc: '记录并分析专注时长', category: 'life', shortcut: '', icon: ICONS.focusStats },
    { id: 'usageReport', name: '使用报告', desc: '查看系统使用数据汇总', category: 'life', shortcut: '', icon: ICONS.usageReport },
    { id: 'appEvolution', name: '应用进化', desc: '常用应用随使用成长', category: 'life', shortcut: '', icon: ICONS.appEvolution, toggle: true },
    { id: 'appDating', name: '应用约会', desc: '推荐今日值得使用的应用', category: 'life', shortcut: '', icon: ICONS.appDating },
    { id: 'appPersonality', name: '应用人格', desc: '赋予应用不同的性格特征', category: 'life', shortcut: '', icon: ICONS.appPersonality, toggle: true },
    { id: 'ambientSound', name: '环境白噪音', desc: '雨声、森林等背景音', category: 'ambiance', shortcut: '', icon: ICONS.ambientSound, toggle: true },
    { id: 'soundThemes', name: '声音主题', desc: '切换系统音效风格', category: 'ambiance', shortcut: '', icon: ICONS.soundThemes },
    { id: 'typingSound', name: '打字音效', desc: '为键盘输入添加反馈音', category: 'ambiance', shortcut: '', icon: ICONS.typingSound, toggle: true },
    { id: 'keyboardMusic', name: '键盘乐器', desc: '让键盘发出乐器声音', category: 'ambiance', shortcut: '', icon: ICONS.keyboardMusic, toggle: true },
    { id: 'seasons', name: '四季主题', desc: '根据日期自动切换季节氛围', category: 'ambiance', shortcut: '', icon: ICONS.seasons, toggle: true },
    { id: 'weatherSystem', name: '拟真天气', desc: '桌面呈现当前天气效果', category: 'ambiance', shortcut: '', icon: ICONS.weatherSystem, toggle: true },
    { id: 'desktopAurora', name: '桌面极光', desc: '动态极光背景效果', category: 'ambiance', shortcut: '', icon: ICONS.desktopAurora, toggle: true },
    { id: 'nightMode', name: '深夜模式', desc: '降低亮度与蓝光', category: 'ambiance', shortcut: '', icon: ICONS.nightMode, toggle: true },
    { id: 'appLeaderboard', name: '应用排行榜', desc: '查看应用使用榜单', category: 'gamification', shortcut: '', icon: ICONS.appLeaderboard },
    { id: 'stamps', name: '成就图章', desc: '收集使用系统获得的成就', category: 'gamification', shortcut: '', icon: ICONS.stamps },
    { id: 'fortune', name: '每日运势', desc: '查看今日运势签文', category: 'gamification', shortcut: '', icon: ICONS.fortune },
    { id: 'easterEggs', name: '彩蛋猎人', desc: '发现系统隐藏彩蛋', category: 'gamification', shortcut: '', icon: ICONS.easterEggs, toggle: true },
    { id: 'terminalAdventure', name: '终端冒险', desc: '在终端中体验文字冒险', category: 'gamification', shortcut: '', icon: ICONS.terminalAdventure },
    { id: 'dailyJoke', name: '每日冷笑话', desc: '随机推送一句冷笑话', category: 'gamification', shortcut: '', icon: ICONS.dailyJoke },
    { id: 'festivalEggs', name: '节日彩蛋', desc: '节假日自动触发惊喜', category: 'gamification', shortcut: '', icon: ICONS.festivalEggs, toggle: true },
    { id: 'doodle', name: '随手涂鸦', desc: '在桌面自由绘画', category: 'creative', shortcut: '', icon: ICONS.doodle, toggle: true },
    { id: 'particleArt', name: '粒子画板', desc: '用粒子创作艺术图案', category: 'creative', shortcut: '', icon: ICONS.particleArt },
    { id: 'vinyl', name: '黑胶唱片', desc: '复古唱片播放动画', category: 'creative', shortcut: '', icon: ICONS.vinyl },
    { id: 'mxosStory', name: 'MXOS 故事', desc: '回顾系统历程故事', category: 'creative', shortcut: '', icon: ICONS.mxosStory },
    { id: 'wallpaperSlideshow', name: '壁纸轮播', desc: '多张壁纸自动切换', category: 'desktop', shortcut: '', icon: ICONS.wallpaperSlideshow, toggle: true },
    { id: 'wallpaperColor', name: '壁纸取色', desc: '从壁纸提取主色调', category: 'desktop', shortcut: '', icon: ICONS.wallpaperColor, toggle: true },
    { id: 'cursorEffects', name: '鼠标拖尾', desc: '光标移动留下特效', category: 'desktop', shortcut: '', icon: ICONS.cursorEffects, toggle: true },
    { id: 'mouseGestures', name: '鼠标手势', desc: '用轨迹执行快捷命令', category: 'desktop', shortcut: '', icon: ICONS.mouseGestures, toggle: true },
    { id: 'desktopFlip', name: '桌面翻转', desc: '翻转桌面查看背面', category: 'desktop', shortcut: '', icon: ICONS.desktopFlip },
    { id: 'floatMode', name: '悬浮模式', desc: '让窗口失去重力漂浮', category: 'desktop', shortcut: '', icon: ICONS.floatMode, toggle: true },
    { id: 'screenCrack', name: '碎屏恶作剧', desc: '假装屏幕碎裂', category: 'desktop', shortcut: '', icon: ICONS.screenCrack },
    { id: 'phantomMode', name: '幻影模式', desc: '窗口半透明幽灵效果', category: 'desktop', shortcut: '', icon: ICONS.phantomMode, toggle: true },
    { id: 'starfieldMode', name: '星空模式', desc: '沉浸式星空背景', category: 'desktop', shortcut: '', icon: ICONS.starfieldMode, toggle: true },
    { id: 'windowSnap', name: '窗口贴靠', desc: '拖拽窗口快速分屏', category: 'window', shortcut: '', icon: ICONS.windowSnap, toggle: true },
    { id: 'windowSplitLayout', name: '分屏布局', desc: '一键排列多个窗口', category: 'window', shortcut: '', icon: ICONS.windowSplitLayout },
    { id: 'windowShake', name: '窗口抖动', desc: '最小化其他窗口', category: 'window', shortcut: '', icon: ICONS.windowShake },
    { id: 'windowGravity', name: '窗口重力', desc: '窗口受重力影响下落', category: 'window', shortcut: '', icon: ICONS.windowGravity, toggle: true },
    { id: 'windowFold', name: '窗口折叠', desc: '将窗口折叠为标题栏', category: 'window', shortcut: '', icon: ICONS.windowFold, toggle: true },
    { id: 'windowAura', name: '窗口光环', desc: '活动窗口发光边框', category: 'window', shortcut: '', icon: ICONS.windowAura, toggle: true },
    { id: 'windowFx', name: '窗口动效', desc: '开关窗口动画特效', category: 'window', shortcut: '', icon: ICONS.windowFx, toggle: true },
    { id: 'windowMeditation', name: '窗口冥想', desc: '窗口缓慢律动放松', category: 'window', shortcut: '', icon: ICONS.windowMeditation, toggle: true },
    { id: 'windowMood', name: '窗口情绪', desc: '根据心情改变窗口颜色', category: 'window', shortcut: '', icon: ICONS.windowMood, toggle: true },
    { id: 'windowGenealogy', name: '窗口族谱', desc: '追踪应用打开关系', category: 'window', shortcut: '', icon: ICONS.windowGenealogy },
    { id: 'appBadges', name: '角标动效', desc: '通知角标弹跳提醒', category: 'window', shortcut: '', icon: ICONS.appBadges, toggle: true },
    { id: 'launchAura', name: '启动光环', desc: '应用打开时扩散光环', category: 'window', shortcut: '', icon: ICONS.launchAura, toggle: true },
    { id: 'smokeTest', name: '冒烟测试', desc: '运行核心功能自检', category: 'system', shortcut: '', icon: ICONS.smokeTest },
    { id: 'dataExport', name: '数据导出', desc: '备份系统数据到文件', category: 'system', shortcut: '', icon: ICONS.dataExport },
    { id: 'incognito', name: '无痕模式', desc: '不保留浏览数据', category: 'system', shortcut: '', icon: ICONS.incognito, toggle: true },
    { id: 'systemUpdate', name: '系统更新', desc: '检查并安装增量更新', category: 'system', shortcut: '', icon: ICONS.systemUpdate },
    { id: 'healthScore', name: '健康评分', desc: '评估系统运行状态', category: 'system', shortcut: '', icon: ICONS.healthScore },
    { id: 'timeMachine', name: '时光机', desc: '回退系统到早前状态', category: 'system', shortcut: '', icon: ICONS.timeMachine },
    { id: 'timeCapsule', name: '时间胶囊', desc: '封存数据未来开启', category: 'system', shortcut: '', icon: ICONS.timeCapsule },
    { id: 'screenRecorder', name: '屏幕录制', desc: '录制桌面并保存视频', category: 'entertainment', shortcut: '', icon: ICONS.screenRecorder },
    { id: 'ocr', name: 'OCR 识图', desc: '识别图片中的文字', category: 'entertainment', shortcut: '', icon: ICONS.ocr },
    { id: 'qrCode', name: '二维码生成', desc: '将文本转为二维码', category: 'entertainment', shortcut: '', icon: ICONS.qrCode },
    { id: 'qrScanner', name: '二维码扫描', desc: '调用摄像头识别二维码', category: 'entertainment', shortcut: '', icon: ICONS.qrScanner },
    { id: 'symbolPanel', name: '符号面板', desc: '快速插入特殊符号', category: 'entertainment', shortcut: '', icon: ICONS.symbolPanel, toggle: true },
    { id: 'textReplace', name: '文本替换', desc: '自定义快捷短语', category: 'entertainment', shortcut: '', icon: ICONS.textReplace, toggle: true },
    { id: 'aiAssistant', name: 'AI 助手', desc: '智能问答与辅助创作', category: 'entertainment', shortcut: '', icon: ICONS.aiAssistant, toggle: true },
    { id: 'dreamMode', name: '梦境模式', desc: '柔和梦幻的视觉效果', category: 'entertainment', shortcut: '', icon: ICONS.dreamMode, toggle: true },
    { id: 'desktopTheater', name: '桌面影院', desc: '沉浸式观影氛围', category: 'entertainment', shortcut: '', icon: ICONS.desktopTheater, toggle: true },
    { id: 'appWardrobe', name: '应用衣柜', desc: '为应用更换图标皮肤', category: 'entertainment', shortcut: '', icon: ICONS.appWardrobe },
    { id: 'appBirthday', name: '应用生日', desc: '庆祝应用安装纪念日', category: 'entertainment', shortcut: '', icon: ICONS.appBirthday, toggle: true },
    { id: 'appGraveyard', name: '应用墓地', desc: '纪念被卸载的应用', category: 'entertainment', shortcut: '', icon: ICONS.appGraveyard },
    { id: 'desktopPiano', name: '桌面钢琴', desc: '在桌面弹奏钢琴', category: 'entertainment', shortcut: '', icon: ICONS.desktopPiano, toggle: true },
    { id: 'desktopDrum', name: '桌面架子鼓', desc: '在桌面敲击鼓点', category: 'entertainment', shortcut: '', icon: ICONS.desktopDrum, toggle: true },
    { id: 'mxosRadio', name: 'MXOS 电台', desc: '在线收听精选音乐', category: 'entertainment', shortcut: '', icon: ICONS.mxosRadio, toggle: true },
    { id: 'moonPhase', name: '月相展示', desc: '桌面显示当前月相', category: 'entertainment', shortcut: '', icon: ICONS.moonPhase, toggle: true },
    { id: 'clockTower', name: '钟楼组件', desc: '整点报时的桌面钟楼', category: 'entertainment', shortcut: '', icon: ICONS.clockTower, toggle: true },
    { id: 'countdownWidget', name: '倒计时组件', desc: '设置重要日期倒计时', category: 'entertainment', shortcut: '', icon: ICONS.countdownWidget },
    { id: 'stickyWall', name: '便签墙', desc: '聚合所有便签的墙面', category: 'entertainment', shortcut: '', icon: ICONS.stickyWall }
];

const LAZY_MODULE_MAP = {
    desktopPet: '../features/desktop-pet.js',
    doodle: '../features/doodle.js',
    desktopPiano: '../features/desktop-piano.js',
    desktopDrum: '../features/desktop-drum.js',
    mxosRadio: '../features/mxos-radio.js',
    moonPhase: '../features/moon-phase.js',
    clockTower: '../features/clock-tower.js',
    heartbeat: '../features/heartbeat.js',
    weatherSystem: '../features/weather-system.js',
    ambientSound: '../features/ambient-sound.js',
    seasons: '../features/seasons.js',
    desktopAurora: '../features/desktop-aurora.js',
    nightMode: '../features/night-mode.js',
    starfieldMode: '../features/starfield-mode.js',
    cursorEffects: '../features/cursor-effects.js',
    mouseGestures: '../features/mouse-gestures.js',
    desktopFlip: '../features/desktop-flip.js',
    floatMode: '../features/float-mode.js',
    screenCrack: '../features/screen-crack.js',
    phantomMode: '../features/phantom-mode.js',
    particleArt: '../features/particle-art.js',
    vinyl: '../features/vinyl.js',
    windowMood: '../features/window-mood.js',
    windowMeditation: '../features/window-meditation.js',
    windowGenealogy: '../features/window-genealogy.js',
    windowFold: '../features/window-fold.js',
    windowAura: '../features/window-aura.js',
    windowFx: '../features/window-fx.js',
    appBadges: '../features/app-badges.js',
    launchAura: '../features/launch-aura.js',
    appWarp: '../features/app-warp.js',
    soundThemes: '../features/sound-themes.js',
    keyboardMusic: '../features/keyboard-music.js',
    typingSound: '../features/typing-sound.js',
    usageReport: '../features/usage-report.js',
    focusStats: '../features/focus-stats.js',
    eyeCare: '../features/eye-care.js',
    stickyWall: '../features/sticky-wall.js',
    countdownWidget: '../features/countdown-widget.js',
    mxosStory: '../features/mxos-story.js',
    festivalEggs: '../features/festival-eggs.js',
    appBirthday: '../features/app-birthday.js',
    dailyJoke: '../features/daily-joke.js',
    dreamMode: '../features/dream-mode.js',
    desktopTheater: '../features/desktop-theater.js',
    appPersonality: '../features/app-personality.js',
    appEvolution: '../features/app-evolution.js',
    appDating: '../features/app-dating.js',
    appWardrobe: '../features/app-wardrobe.js',
    appLeaderboard: '../features/app-leaderboard.js',
    stamps: '../features/stamps.js',
    appGraveyard: '../features/app-graveyard.js',
    fortune: '../features/fortune.js',
    easterEggs: '../features/easter-eggs.js',
    terminalAdventure: '../features/terminal-adventure.js',
    timeMachine: '../features/time-machine.js',
    timeCapsule: '../features/time-capsule.js'
};

async function ensureApi(f) {
    let api = resolveApi(f);
    if (api) return api;
    const modPath = LAZY_MODULE_MAP[f.id];
    if (!modPath) return null;
    try {
        await import(modPath);
    } catch (e) {
        console.error('MXOS lazy load failed:', f.id, e);
        return null;
    }
    return resolveApi(f);
}

const API_RESOLVERS = {
    launcher: () => window.MXOS.Launcher,
    commandPalette: () => window.MXOS.CommandPalette,
    clipboardHistory: () => window.MXOS.Features && window.MXOS.Features.clipboardHistory,
    focusMode: () => window.MXOS.Features && window.MXOS.Features.focusMode,
    stickyNotes: () => window.MXOS.Features && window.MXOS.Features.stickyNotes,
    colorPicker: () => window.MXOS.Features && window.MXOS.Features.colorPicker,
    translator: () => window.MXOS.Features && window.MXOS.Features.translator,
    startSearch: () => window.MXOS.Features && window.MXOS.Features.startSearch,
    widgetPanel: () => window.MXOS.Features && window.MXOS.Features.widgets,
    quickSettings: () => window.MXOS.Features && window.MXOS.Features.quickSettings,
    desktopPet: () => window.MXOS.Pet,
    heartbeat: () => window.MXOS.Features && window.MXOS.Features.heartbeat,
    eyeCare: () => window.MXOS.Features && window.MXOS.Features.eyeCare,
    focusStats: () => window.MXOS.Features && window.MXOS.Features.focusStats,
    usageReport: () => window.MXOS.Features && window.MXOS.Features.usageReport,
    appEvolution: () => window.MXOS.Features && window.MXOS.Features.appEvolution,
    appDating: () => window.MXOS.Features && window.MXOS.Features.appDating,
    appPersonality: () => window.MXOS.Features && window.MXOS.Features.appPersonality,
    ambientSound: () => window.MXOS.Features && window.MXOS.Features.ambientSound,
    soundThemes: () => window.MXOS.Features && window.MXOS.Features.soundThemes,
    typingSound: () => window.MXOS.Features && window.MXOS.Features.typingSound,
    keyboardMusic: () => window.MXOS.Features && window.MXOS.Features.keyboardMusic,
    seasons: () => window.MXOS.Features && window.MXOS.Features.seasons,
    weatherSystem: () => window.MXOS.Features && window.MXOS.Features.weatherSystem,
    desktopAurora: () => window.MXOS.Features && window.MXOS.Features.desktopAurora,
    nightMode: () => window.MXOS.Features && window.MXOS.Features.nightMode,
    appLeaderboard: () => window.MXOS.Features && window.MXOS.Features.leaderboard,
    stamps: () => window.MXOS.Features && window.MXOS.Features.stamps,
    fortune: () => window.MXOS.Features && window.MXOS.Features.fortune,
    easterEggs: () => window.MXOS.Features && window.MXOS.Features.easterEggs,
    terminalAdventure: () => window.MXOS.Features && window.MXOS.Features.adventure,
    dailyJoke: () => window.MXOS.Features && window.MXOS.Features.dailyJoke,
    festivalEggs: () => window.MXOS.Features && window.MXOS.Features.festivalEggs,
    doodle: () => window.MXOS.Features && window.MXOS.Features.doodle,
    particleArt: () => window.MXOS.Features && window.MXOS.Features.particleArt,
    vinyl: () => window.MXOS.Features && window.MXOS.Features.vinyl,
    mxosStory: () => window.MXOS.Features && window.MXOS.Features.mxosStory,
    wallpaperSlideshow: () => window.MXOS.WallpaperSlideshow,
    wallpaperColor: () => window.MXOS.Features && window.MXOS.Features.wallpaperColor,
    cursorEffects: () => window.MXOS.Features && window.MXOS.Features.cursorEffects,
    mouseGestures: () => window.MXOS.Features && window.MXOS.Features.mouseGestures,
    desktopFlip: () => window.MXOS.Features && window.MXOS.Features.desktopFlip,
    floatMode: () => window.MXOS.Features && window.MXOS.Features.floatMode,
    screenCrack: () => window.MXOS.Features && window.MXOS.Features.screenCrack,
    phantomMode: () => window.MXOS.Features && window.MXOS.Features.phantomMode,
    starfieldMode: () => window.MXOS.Features && window.MXOS.Features.starfieldMode,
    windowSnap: () => window.MXOS.Features && window.MXOS.Features.windowSnap,
    windowSplitLayout: () => window.MXOS.Features && window.MXOS.Features.windowSplitLayout,
    windowShake: () => window.MXOS.Features && window.MXOS.Features.windowShake,
    windowGravity: () => window.MXOS.Features && window.MXOS.Features.windowGravity,
    windowFold: () => window.MXOS.Features && window.MXOS.Features.windowFold,
    windowAura: () => window.MXOS.Features && window.MXOS.Features.windowAura,
    windowFx: () => window.MXOS.Features && window.MXOS.Features.windowFx,
    windowMeditation: () => window.MXOS.Features && window.MXOS.Features.windowMeditation,
    windowMood: () => window.MXOS.Features && window.MXOS.Features.windowMood,
    windowGenealogy: () => window.MXOS.Features && window.MXOS.Features.genealogy,
    appBadges: () => window.MXOS.Features && window.MXOS.Features.appBadges,
    launchAura: () => window.MXOS.Features && window.MXOS.Features.launchAura,
    smokeTest: () => window.MXOS.System && window.MXOS.System.smokeTest,
    dataExport: () => window.MXOS.System && window.MXOS.System.dataExport,
    incognito: () => window.MXOS.System && window.MXOS.System.incognito,
    systemUpdate: () => window.MXOS.System && window.MXOS.System.update,
    healthScore: () => window.MXOS.Health,
    timeMachine: () => window.MXOS.Features && window.MXOS.Features.timeMachine,
    timeCapsule: () => window.MXOS.Features && window.MXOS.Features.timeCapsule,
    screenRecorder: () => window.MXOS.Features && window.MXOS.Features.screenRecorder,
    ocr: () => window.MXOS.Features && window.MXOS.Features.ocr,
    qrCode: () => window.MXOS.Features && window.MXOS.Features.qrCode,
    qrScanner: () => window.MXOS.Features && window.MXOS.Features.qrScanner,
    symbolPanel: () => window.MXOS.IME && window.MXOS.IME.symbolPanel,
    textReplace: () => window.MXOS.IME && window.MXOS.IME.textReplace,
    aiAssistant: () => window.MXOS.AI && window.MXOS.AI.chatPanel,
    dreamMode: () => window.MXOS.Features && window.MXOS.Features.dreamMode,
    desktopTheater: () => window.MXOS.Features && window.MXOS.Features.desktopTheater,
    appWardrobe: () => window.MXOS.Features && window.MXOS.Features.wardrobe,
    appBirthday: () => window.MXOS.Features && window.MXOS.Features.appBirthday,
    appGraveyard: () => window.MXOS.Features && window.MXOS.Features.graveyard,
    desktopPiano: () => window.MXOS.Features && window.MXOS.Features.desktopPiano,
    desktopDrum: () => window.MXOS.Features && window.MXOS.Features.desktopDrum,
    mxosRadio: () => window.MXOS.Features && window.MXOS.Features.mxosRadio,
    moonPhase: () => window.MXOS.Features && window.MXOS.Features.moonPhase,
    clockTower: () => window.MXOS.Features && window.MXOS.Features.clockTower,
    countdownWidget: () => window.MXOS.Features && window.MXOS.Features.countdownWidget,
    stickyWall: () => window.MXOS.Features && window.MXOS.Features.stickyWall
};

function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
}

function resolveApi(f) {
    const resolver = API_RESOLVERS[f.id];
    return resolver ? resolver() : null;
}

function readToggleState(f) {
    const api = resolveApi(f);
    if (api) {
        if (typeof api.isEnabled === 'function') return !!api.isEnabled();
        if (typeof api.isRunning === 'function') return !!api.isRunning();
        if (typeof api.getState === 'function') return !!api.getState().enabled;
    }
    return lsGet(LS_PREFIX + f.id + '_enabled') === '1';
}

async function applyToggle(f, enabled) {
    let api = resolveApi(f);
    if (!api && LAZY_MODULE_MAP[f.id]) {
        api = await ensureApi(f);
    }
    let ok = false;
    if (api) {
        if (typeof api.setEnabled === 'function') { api.setEnabled(enabled); ok = true; }
        else if (enabled && typeof api.start === 'function') { api.start(); ok = true; }
        else if (!enabled && typeof api.stop === 'function') { api.stop(); ok = true; }
        else if (typeof api.toggle === 'function') { api.toggle(enabled); ok = true; }
    }
    if (!ok || f.id === 'cursorEffects' || f.id === 'mouseGestures') {
        lsSet(LS_PREFIX + f.id + '_enabled', enabled ? '1' : '0');
    }
}

async function runFeature(f) {
    let api = resolveApi(f);
    if (!api && LAZY_MODULE_MAP[f.id]) {
        api = await ensureApi(f);
    }
    if (!api) {
        if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
            window.MXOS.dialog.toast(`「${f.name}」功能 API 暂未加载`, 'warning');
        }
        return;
    }
    try {
        if (typeof api.open === 'function') api.open();
        else if (typeof api.show === 'function') api.show();
        else if (typeof api.run === 'function') api.run();
        else if (typeof api.toggle === 'function') api.toggle();
        else if (typeof api.start === 'function') api.start();
        else if (typeof api.renderApp === 'function') {
            if (window.MXOS.openApp) window.MXOS.openApp(f.id);
        }
        else if (window.MXOS.openApp) window.MXOS.openApp(f.id);
    } catch (e) {
        if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
            window.MXOS.dialog.toast(`调用「${f.name}」失败`, 'error');
        }
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function supportsReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

registerAppRenderer('feature-center', (contentEl) => {
    let currentCategory = 'all';
    let searchQuery = '';

    const root = document.createElement('div');
    root.className = 'fc-app';
    root.innerHTML = `
        <style>
            .fc-app{height:100%;display:flex;flex-direction:column;color:var(--text-color,#e5e7eb);font-family:'MiSans','Microsoft YaHei',sans-serif;background:rgba(10,10,11,0.45);overflow:hidden}
            .fc-header{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--glass-border,rgba(255,255,255,0.08));background:rgba(10,10,11,0.55);backdrop-filter:blur(40px) saturate(200%)}
            .fc-title{font-size:18px;font-weight:700;letter-spacing:-0.2px;white-space:nowrap}
            .fc-search-wrap{flex:1;min-width:0}
            .fc-search{width:100%;max-width:360px;padding:9px 14px;border-radius:10px;border:1px solid var(--glass-border,rgba(255,255,255,0.1));background:rgba(255,255,255,0.06);color:inherit;font-size:13px;outline:none;transition:border-color 0.2s,background 0.2s}
            .fc-search:focus{border-color:var(--accent-color,#3b82f6);background:rgba(255,255,255,0.09)}
            .fc-search::placeholder{color:rgba(255,255,255,0.35)}
            .fc-body{display:flex;flex:1;min-height:0}
            .fc-sidebar{width:180px;flex-shrink:0;border-right:1px solid var(--glass-border,rgba(255,255,255,0.08));background:rgba(255,255,255,0.03);backdrop-filter:blur(40px) saturate(200%);padding:14px 10px;overflow-y:auto}
            .fc-cat{padding:9px 12px;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;transition:background 0.15s,color 0.15s;margin-bottom:4px;color:rgba(255,255,255,0.75)}
            .fc-cat:hover{background:rgba(255,255,255,0.06);color:#fff}
            .fc-cat.active{background:var(--accent-color,#3b82f6);color:#fff}
            .fc-cat-count{font-size:11px;margin-left:auto;opacity:0.7;background:rgba(0,0,0,0.2);padding:1px 6px;border-radius:8px}
            .fc-main{flex:1;min-width:0;display:flex;flex-direction:column;background:rgba(10,10,11,0.25)}
            .fc-grid-wrap{flex:1;overflow-y:auto;padding:16px 20px}
            .fc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;transition:opacity 0.25s ease,transform 0.25s ease}
            .fc-card{background:rgba(255,255,255,0.04);border:1px solid var(--glass-border,rgba(255,255,255,0.08));border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;transition:transform 0.18s ease,background 0.18s ease,border-color 0.18s ease;position:relative;overflow:hidden}
            .fc-card:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.14);transform:translateY(-2px)}
            .fc-card-icon{width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:var(--accent-color,#3b82f6)}
            .fc-card-icon svg{width:28px;height:28px}
            .fc-card-title{font-size:14px;font-weight:600}
            .fc-card-desc{font-size:12px;color:rgba(255,255,255,0.55);line-height:1.45;flex:1}
            .fc-card-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
            .fc-shortcut{font-size:10px;padding:2px 6px;border-radius:5px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);border:1px solid rgba(255,255,255,0.06)}
            .fc-toggle{width:36px;height:20px;border-radius:10px;background:rgba(255,255,255,0.12);position:relative;cursor:pointer;transition:background 0.2s}
            .fc-toggle::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:2px;left:2px;transition:transform 0.2s}
            .fc-toggle.on{background:var(--accent-color,#3b82f6)}
            .fc-toggle.on::after{transform:translateX(16px)}
            .fc-btn{font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;cursor:pointer;transition:background 0.15s}
            .fc-btn:hover{background:rgba(255,255,255,0.12)}
            .fc-empty{text-align:center;padding:60px 20px;color:rgba(255,255,255,0.4);font-size:14px}
            body.reduce-motion .fc-grid,body.reduce-motion .fc-card,body.reduce-motion .fc-toggle::after{transition:none}
            @media (max-width:700px){.fc-sidebar{display:none}.fc-grid{grid-template-columns:1fr}}
        </style>
        <div class="fc-header">
            <div class="fc-title">功能中心</div>
            <div class="fc-search-wrap"><input type="text" class="fc-search" id="fcSearch" placeholder="搜索功能..."></div>
        </div>
        <div class="fc-body">
            <div class="fc-sidebar" id="fcSidebar"></div>
            <div class="fc-main">
                <div class="fc-grid-wrap">
                    <div class="fc-grid" id="fcGrid"></div>
                </div>
            </div>
        </div>
    `;
    contentEl.innerHTML = '';
    contentEl.appendChild(root);

    const sidebar = root.querySelector('#fcSidebar');
    const grid = root.querySelector('#fcGrid');
    const searchInput = root.querySelector('#fcSearch');

    function categoryCount(catId) {
        if (catId === 'all') return FEATURES.length;
        return FEATURES.filter(f => f.category === catId).length;
    }

    function renderSidebar() {
        sidebar.innerHTML = CATEGORIES.map(c => `
            <div class="fc-cat ${c.id === currentCategory ? 'active' : ''}" data-cat="${c.id}">
                <span>${escapeHtml(c.name)}</span>
                <span class="fc-cat-count">${categoryCount(c.id)}</span>
            </div>
        `).join('');
        sidebar.querySelectorAll('.fc-cat').forEach(el => {
            el.addEventListener('click', () => {
                currentCategory = el.dataset.cat;
                renderSidebar();
                renderGrid();
            });
        });
    }

    function filteredFeatures() {
        const q = searchQuery.trim().toLowerCase();
        return FEATURES.filter(f => {
            const inCat = currentCategory === 'all' || f.category === currentCategory;
            if (!q) return inCat;
            const hit = f.name.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q);
            return hit;
        });
    }

    function renderGrid() {
        const reduceMotion = supportsReducedMotion() || document.body.classList.contains('reduce-motion');
        if (!reduceMotion) {
            grid.style.opacity = '0';
            grid.style.transform = 'translateY(6px)';
        }
        setTimeout(() => {
            const list = filteredFeatures();
            if (!list.length) {
                grid.innerHTML = '<div class="fc-empty">没有找到匹配的功能</div>';
            } else {
                grid.innerHTML = list.map(f => `
                    <div class="fc-card" data-id="${f.id}">
                        <div class="fc-card-icon">${f.icon}</div>
                        <div class="fc-card-title">${escapeHtml(f.name)}</div>
                        <div class="fc-card-desc">${escapeHtml(f.desc)}</div>
                        <div class="fc-card-meta">
                            ${f.shortcut ? `<span class="fc-shortcut">${escapeHtml(f.shortcut)}</span>` : ''}
                            ${f.toggle ? `<div class="fc-toggle ${readToggleState(f) ? 'on' : ''}" data-id="${f.id}"></div>` : ''}
                            <button class="fc-btn" data-id="${f.id}">试试</button>
                        </div>
                    </div>
                `).join('');
                grid.querySelectorAll('.fc-toggle').forEach(t => {
                    t.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const f = FEATURES.find(x => x.id === t.dataset.id);
                        const next = !t.classList.contains('on');
                        t.classList.toggle('on', next);
                        await applyToggle(f, next);
                    });
                });
                grid.querySelectorAll('.fc-btn').forEach(b => {
                    b.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const f = FEATURES.find(x => x.id === b.dataset.id);
                        await runFeature(f);
                    });
                });
                grid.querySelectorAll('.fc-card').forEach(card => {
                    card.addEventListener('click', async () => {
                        const f = FEATURES.find(x => x.id === card.dataset.id);
                        if (f && f.toggle) {
                            const t = card.querySelector('.fc-toggle');
                            const next = !t.classList.contains('on');
                            t.classList.toggle('on', next);
                            await applyToggle(f, next);
                        } else {
                            await runFeature(f);
                        }
                    });
                });
            }
            if (!reduceMotion) {
                grid.style.opacity = '1';
                grid.style.transform = 'translateY(0)';
            }
        }, reduceMotion ? 0 : 80);
    }

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderGrid();
    });

    renderSidebar();
    renderGrid();
});

window.MXOS.Apps.FeatureCenter = {
    FEATURES,
    CATEGORIES,
    runFeature,
    readToggleState,
    applyToggle
};
