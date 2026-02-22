/* ══════════════════════════════════════════════
   Kindle Dashboard — app.js  v1.3
   ES5 only — Kindle 8 / WebKit 531-534
   - Offline: AppCache + localStorage fallback
   - Cache version control: đổi CACHE_VERSION để clear
   - Holidays: buffer JP+VN, render 1 lần, no-duplicate
   - Không auto-reload trang (tiết kiệm pin)
   - API chỉ gọi khi online, mỗi 30 phút
══════════════════════════════════════════════ */

/* ══════════════════════════════
   CACHE VERSION
   Đổi số này để clear toàn bộ
   localStorage và fetch lại API
══════════════════════════════ */
var CACHE_VERSION = '1.3';

/* ── Constants ── */
var WEEKDAYS   = ['日','月','火','水','木','金','土'];
var JST_OFFSET = 9 * 60;
var IS_ONLINE  = true;
var holidayDates  = {};
var holidayBuffer = { JP: null, VN: null };

var selectedQuote = (typeof QUOTES !== 'undefined' && QUOTES.length)
    ? QUOTES[Math.floor(Math.random() * QUOTES.length)]
    : ["Hãy bắt đầu từ nơi bạn đang đứng.", "Khuyết danh"];

var WMO = {
    0:  ['☀️','Trời quang'],
    1:  ['🌤️','Ít mây'],
    2:  ['⛅','Có mây'],
    3:  ['☁️','Nhiều mây'],
    45: ['🌫️','Sương mù'],
    48: ['🌫️','Sương đá'],
    51: ['🌦️','Mưa phùn nhẹ'],
    53: ['🌦️','Mưa phùn'],
    55: ['🌧️','Mưa phùn dày'],
    61: ['🌧️','Mưa nhẹ'],
    63: ['🌧️','Mưa vừa'],
    65: ['🌧️','Mưa to'],
    71: ['🌨️','Tuyết nhẹ'],
    73: ['🌨️','Tuyết vừa'],
    75: ['❄️','Tuyết dày'],
    80: ['🌦️','Mưa rào nhẹ'],
    81: ['🌧️','Mưa rào'],
    82: ['⛈️','Mưa rào to'],
    95: ['⛈️','Dông bão'],
    96: ['⛈️','Dông+mưa đá'],
    99: ['⛈️','Dông lớn']
};

/* ══════════════════════════════
   HELPERS
══════════════════════════════ */
function pad(n)        { return n < 10 ? '0' + n : '' + n; }
function byId(id)      { return document.getElementById(id); }
function setHtml(id,h) { var el = byId(id); if (el) el.innerHTML = h; }

function qsa(sel) {
    var nl = document.querySelectorAll(sel), arr = [];
    for (var i = 0; i < nl.length; i++) arr.push(nl[i]);
    return arr;
}

function getJST() {
    var now = new Date();
    return new Date(now.getTime() + (now.getTimezoneOffset() + JST_OFFSET) * 60000);
}

function getWMO(code) {
    if (WMO[code]) return WMO[code];
    if (code <= 3)  return ['⛅','Có mây'];
    if (code <= 55) return ['🌦️','Mưa phùn'];
    if (code <= 65) return ['🌧️','Mưa'];
    if (code <= 77) return ['🌨️','Tuyết'];
    if (code <= 82) return ['🌦️','Mưa rào'];
    return ['⛈️','Dông bão'];
}

/* ══════════════════════════════
   LOCALSTORAGE
══════════════════════════════ */
function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function lsGet(key) {
    try {
        var v = localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
    } catch(e) { return null; }
}

/* ══════════════════════════════
   CACHE VERSION CONTROL
   Xóa data cũ nếu version thay đổi
══════════════════════════════ */
function checkCacheVersion() {
    var saved = lsGet('cache_version');
    if (!saved || saved !== CACHE_VERSION) {
        try {
            localStorage.removeItem('fx_data');
            localStorage.removeItem('weather_data');
            localStorage.removeItem('holiday_data');
        } catch(e) {}
        lsSet('cache_version', CACHE_VERSION);
    }
}

/* ══════════════════════════════
   APPCACHE AUTO-UPDATE
══════════════════════════════ */
function initAppCache() {
    if (!window.applicationCache) return;
    var ac = window.applicationCache;

    ac.addEventListener('updateready', function() {
        if (ac.status === ac.UPDATEREADY) {
            try { ac.swapCache(); } catch(e) {}
            window.location.reload();
        }
    }, false);

    if (IS_ONLINE) {
        try { ac.update(); } catch(e) {}
    }
}

/* ══════════════════════════════
   ONLINE / OFFLINE
══════════════════════════════ */
function updateStatusBar() {
    var el = byId('onlineStatus');
    if (!el) return;
    if (IS_ONLINE) {
        el.innerHTML = '🟢 Online';
        el.className = 'status-online';
    } else {
        el.innerHTML = '🔴 Offline';
        el.className = 'status-offline';
    }
}

function pingCheck() {
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', 'https://api.open-meteo.com/favicon.ico?_=' + Date.now(), true);
    xhr.timeout = 5000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        var wasOnline = IS_ONLINE;
        IS_ONLINE = (xhr.status > 0 && xhr.status < 500);
        updateStatusBar();
        if (!wasOnline && IS_ONLINE) {
            loadFX();
            loadWeather();
            loadHolidays();
            if (window.applicationCache) {
                try { window.applicationCache.update(); } catch(e) {}
            }
        }
    };
    xhr.ontimeout = function() { IS_ONLINE = false; updateStatusBar(); };
    xhr.onerror   = function() { IS_ONLINE = false; updateStatusBar(); };
    try { xhr.send(); } catch(e) { IS_ONLINE = false; updateStatusBar(); }
}

/* ══════════════════════════════
   TABS
══════════════════════════════ */
function switchTab(idx) {
    var tabs = qsa('.tab-content');
    var btns = qsa('.tab-btn');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].className = (i === idx) ? 'tab-content active' : 'tab-content';
    }
    for (var i = 0; i < btns.length; i++) {
        btns[i].className = (i === idx) ? 'tab-btn active' : 'tab-btn';
    }
}

/* ══════════════════════════════
   CLOCK
══════════════════════════════ */
function updateClock() {
    var t  = getJST();
    var h  = pad(t.getHours());
    var m  = pad(t.getMinutes());
    var s  = pad(t.getSeconds());
    var yr = t.getFullYear();
    var mo = pad(t.getMonth() + 1);
    var dy = pad(t.getDate());
    var wd = WEEKDAYS[t.getDay()];
    setHtml('time',       h + ':' + m + ':' + s);
    setHtml('date',       yr + '年' + mo + '月' + dy + '日（' + wd + '）');
    setHtml('bigTime',    h + ':' + m);
    setHtml('bigDate',    yr + '年' + mo + '月' + dy + '日（' + wd + '）');
    setHtml('footerTime', '更新 ' + h + ':' + m);
}

/* ══════════════════════════════
   QUOTE
══════════════════════════════ */
function showQuote() {
    var q = '"' + selectedQuote[0] + '"';
    var a = '— ' + selectedQuote[1];
    setHtml('quoteText',      q);
    setHtml('quoteAuthor',    a);
    setHtml('bigQuoteText',   q);
    setHtml('bigQuoteAuthor', a);
}

/* ══════════════════════════════
   FX RATE
   Online  → gọi API, lưu localStorage
   Offline → đọc localStorage
══════════════════════════════ */
function loadFX() {
    var cached = lsGet('fx_data');
    if (cached) {
        setHtml('fxrate', cached.rate + ' VND');
        setHtml('fxtime', cached.time + (IS_ONLINE ? '' : ' ⚡'));
    }
    if (!IS_ONLINE) {
        if (!cached) setHtml('fxrate', '--- (offline)');
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.exchangerate-api.com/v4/latest/JPY', true);
    xhr.timeout = 10000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
            try {
                var d = JSON.parse(xhr.responseText);
                if (!d.rates || !d.rates.VND) return;
                var rate = Math.round(d.rates.VND * 100) / 100;
                var t    = getJST();
                var time = pad(t.getHours()) + ':' + pad(t.getMinutes());
                setHtml('fxrate', rate + ' VND');
                setHtml('fxtime', time);
                lsSet('fx_data', { rate: rate, time: time });
            } catch(e) {}
        } else {
            IS_ONLINE = false; updateStatusBar();
        }
    };
    xhr.onerror   = function() { IS_ONLINE = false; updateStatusBar(); };
    xhr.ontimeout = function() { IS_ONLINE = false; updateStatusBar(); };
    xhr.send();
}

/* ══════════════════════════════
   WEATHER
   Online  → gọi API, lưu localStorage
   Offline → đọc localStorage
══════════════════════════════ */
function loadWeather() {
    var cached = lsGet('weather_data');
    if (cached) {
        setHtml('wTemp',     cached.temp);
        setHtml('wIcon',     cached.icon);
        setHtml('wDesc',     cached.desc + (IS_ONLINE ? '' : ' ⚡'));
        setHtml('wWind',     cached.wind);
        setHtml('wHumidity', cached.hum);
    }
    if (!IS_ONLINE) {
        if (!cached) setHtml('wDesc', 'Offline');
        return;
    }
    var url = 'https://api.open-meteo.com/v1/forecast'
            + '?latitude=35.6762&longitude=139.6503'
            + '&current_weather=true'
            + '&hourly=relativehumidity_2m'
            + '&timezone=Asia%2FTokyo';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 10000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
            try { renderWeather(JSON.parse(xhr.responseText)); } catch(e) {}
        } else {
            IS_ONLINE = false; updateStatusBar();
        }
    };
    xhr.onerror   = function() { IS_ONLINE = false; updateStatusBar(); };
    xhr.ontimeout = function() { IS_ONLINE = false; updateStatusBar(); };
    xhr.send();
}

function renderWeather(data) {
    var cw   = data.current_weather;
    var wmo  = getWMO(cw.weathercode);
    var temp = Math.round(cw.temperature) + '°C';
    var wind = Math.round(cw.windspeed) + ' km/h';
    var hr   = getJST().getHours();
    var hum  = (data.hourly && data.hourly.relativehumidity_2m)
               ? (data.hourly.relativehumidity_2m[hr] || '--') + '%'
               : '--%';
    setHtml('wTemp',     temp);
    setHtml('wIcon',     wmo[0]);
    setHtml('wDesc',     wmo[1]);
    setHtml('wWind',     wind);
    setHtml('wHumidity', hum);
    lsSet('weather_data', { temp: temp, icon: wmo[0], desc: wmo[1], wind: wind, hum: hum });
}

/* ══════════════════════════════
   HOLIDAYS
   Buffer JP + VN → render 1 lần
   Không append → không duplicate
══════════════════════════════ */
function loadHolidays() {
    /* Reset hoàn toàn mỗi lần gọi */
    holidayBuffer = { JP: null, VN: null };
    holidayDates  = {};

    /* Hiện cache ngay nếu có */
    var cached = lsGet('holiday_data');
    if (cached) {
        setHtml('holidayList',    cached.html || '');
        setHtml('bigHolidayList', cached.html || '');
        if (cached.dates) {
            for (var d in cached.dates) holidayDates[d] = true;
        }
        buildCal('calendar');
        buildCal('bigCalendar');
    }

    if (!IS_ONLINE) {
        if (!cached) setHtml('holidayList', 'Offline');
        return;
    }

    var yr = getJST().getFullYear();

    var x1 = new XMLHttpRequest();
    x1.open('GET', 'https://holidays-jp.github.io/api/v1/' + yr + '/date.json', true);
    x1.timeout = 10000;
    x1.onreadystatechange = function() {
        if (x1.readyState !== 4) return;
        holidayBuffer.JP = (x1.status === 200)
            ? (function() { try { return parseHolidaysJP(JSON.parse(x1.responseText)); } catch(e) { return []; } })()
            : [];
        tryRenderHolidays();
    };
    x1.onerror   = function() { holidayBuffer.JP = []; tryRenderHolidays(); };
    x1.ontimeout = function() { holidayBuffer.JP = []; tryRenderHolidays(); };
    x1.send();

    var x2 = new XMLHttpRequest();
    x2.open('GET', 'https://date.nager.at/api/v3/PublicHolidays/' + yr + '/VN', true);
    x2.timeout = 10000;
    x2.onreadystatechange = function() {
        if (x2.readyState !== 4) return;
        holidayBuffer.VN = (x2.status === 200)
            ? (function() { try { return parseHolidaysVN(JSON.parse(x2.responseText)); } catch(e) { return []; } })()
            : [];
        tryRenderHolidays();
    };
    x2.onerror   = function() { holidayBuffer.VN = []; tryRenderHolidays(); };
    x2.ontimeout = function() { holidayBuffer.VN = []; tryRenderHolidays(); };
    x2.send();
}

function parseHolidaysJP(data) {
    var mo = getJST().getMonth() + 1, results = [];
    for (var ds in data) {
        var p  = ds.split('-');
        var m2 = parseInt(p[1], 10);
        var d2 = parseInt(p[2], 10);
        if (m2 === mo) {
            results.push({ day: d2, label: '祝日　' + m2 + '/' + d2 + ' ' + data[ds] });
            holidayDates[d2] = true;
        }
    }
    return results;
}

function parseHolidaysVN(data) {
    var mo = getJST().getMonth() + 1, results = [];
    for (var i = 0; i < data.length; i++) {
        var p  = data[i].date.split('-');
        var m2 = parseInt(p[1], 10);
        var d2 = parseInt(p[2], 10);
        if (m2 === mo) {
            results.push({ day: d2, label: '🇻🇳 ' + m2 + '/' + d2 + ' ' + data[i].localName });
        }
    }
    return results;
}

/* Chỉ render khi cả 2 API xong */
function tryRenderHolidays() {
    if (holidayBuffer.JP === null || holidayBuffer.VN === null) return;

    var all = [], i;
    for (i = 0; i < holidayBuffer.JP.length; i++) all.push(holidayBuffer.JP[i]);
    for (i = 0; i < holidayBuffer.VN.length; i++) all.push(holidayBuffer.VN[i]);
    all.sort(function(a, b) { return a.day - b.day; });

    var html = '';
    for (i = 0; i < all.length; i++) {
        html += '<div class="holiday-item">' + all[i].label + '</div>';
    }
    if (!html) html = '<div class="holiday-item">Không có ngày lễ</div>';

    /* SET — không append */
    setHtml('holidayList',    html);
    setHtml('bigHolidayList', html);

    buildCal('calendar');
    buildCal('bigCalendar');

    lsSet('holiday_data', { html: html, dates: holidayDates });
}

/* ══════════════════════════════
   CALENDAR
══════════════════════════════ */
function buildCal(tableId) {
    var t     = getJST();
    var yr    = t.getFullYear();
    var mo    = t.getMonth();
    var today = t.getDate();
    var tbl   = byId(tableId);
    if (!tbl) return;
    tbl.innerHTML = '';

    if (tableId === 'calendar') {
        setHtml('calTitle', yr + '年 ' + (mo + 1) + '月');
    }

    var thead = document.createElement('thead');
    var hrow  = document.createElement('tr');
    for (var i = 0; i < 7; i++) {
        var th = document.createElement('th');
        th.innerHTML = WEEKDAYS[i];
        hrow.appendChild(th);
    }
    thead.appendChild(hrow);
    tbl.appendChild(thead);

    var tbody = document.createElement('tbody');
    var fd    = new Date(yr, mo, 1).getDay();
    var total = new Date(yr, mo + 1, 0).getDate();
    var row   = document.createElement('tr');

    for (var i = 0; i < fd; i++) row.appendChild(document.createElement('td'));
    for (var d = 1; d <= total; d++) {
        if ((fd + d - 1) % 7 === 0 && d !== 1) {
            tbody.appendChild(row);
            row = document.createElement('tr');
        }
        var cell = document.createElement('td');
        cell.innerHTML = d;
        var cls = [];
        if (d === today)              cls.push('today');
        if (holidayDates[d])          cls.push('holiday');
        if ((fd + d - 1) % 7 === 6)  cls.push('sat');
        if (cls.length) cell.className = cls.join(' ');
        row.appendChild(cell);
    }
    tbody.appendChild(row);
    tbl.appendChild(tbody);
}

/* ══════════════════════════════
   STOPWATCH
══════════════════════════════ */
var swRunning = false, swStart = 0, swElapsed = 0, swTimer = null, swLaps = [];

function swToggle() {
    if (!swRunning) {
        swStart   = Date.now() - swElapsed;
        swTimer   = setInterval(swTick, 100);
        swRunning = true;
        byId('swStartBtn').innerHTML = 'STOP';
        byId('swStartBtn').className = 'tbtn tbtn-main running';
    } else {
        clearInterval(swTimer);
        swElapsed = Date.now() - swStart;
        swRunning = false;
        byId('swStartBtn').innerHTML = 'START';
        byId('swStartBtn').className = 'tbtn tbtn-main';
    }
}
function swTick()  { swElapsed = Date.now() - swStart; setHtml('swDisplay', swFmt(swElapsed)); }
function swReset() {
    clearInterval(swTimer); swRunning = false; swElapsed = 0; swLaps = [];
    setHtml('swDisplay', '00:00.0');
    setHtml('lapList',   '');
    byId('swStartBtn').innerHTML = 'START';
    byId('swStartBtn').className = 'tbtn tbtn-main';
}
function swLap() { if (!swRunning && swElapsed === 0) return; swLaps.push(swElapsed); renderLaps(); }
function swFmt(ms) {
    var t = Math.floor(ms / 100);
    return pad(Math.floor(t / 600)) + ':' + pad(Math.floor(t / 10) % 60) + '.' + (t % 10);
}
function renderLaps() {
    var sp = [], mn, mx, html = '', i, c;
    for (i = 0; i < swLaps.length; i++) sp.push(i === 0 ? swLaps[i] : swLaps[i] - swLaps[i-1]);
    mn = sp[0]; mx = sp[0];
    for (i = 1; i < sp.length; i++) { if (sp[i] < mn) mn = sp[i]; if (sp[i] > mx) mx = sp[i]; }
    for (i = swLaps.length - 1; i >= 0; i--) {
        c = sp.length > 1 ? (sp[i] === mn ? ' fastest' : sp[i] === mx ? ' slowest' : '') : '';
        html += '<div class="lap-item' + c + '">'
              + '<span>Lap ' + (i+1) + '</span>'
              + '<span>' + swFmt(sp[i]) + '</span>'
              + '<span>' + swFmt(swLaps[i]) + '</span>'
              + '</div>';
    }
    setHtml('lapList', html);
}

/* ══════════════════════════════
   COUNTDOWN
══════════════════════════════ */
var cdRunning = false, cdTimer = null;
var cdMinutes = 5, cdSeconds = 0, cdRemain = 0, cdEnd = 0;

function cdAdj(u, v) {
    if (cdRunning) return;
    if (u === 'm') cdMinutes = Math.max(0, Math.min(99, cdMinutes + v));
    else           cdSeconds = Math.max(0, Math.min(50, cdSeconds + v));
    setHtml('cdMin', pad(cdMinutes));
    setHtml('cdSec', pad(cdSeconds));
    cdRemain = (cdMinutes * 60 + cdSeconds) * 1000;
    cdRefresh();
    byId('cdAlert').innerHTML = '';
    byId('cdAlert').className = 'cd-alert';
}
function cdToggle() {
    if (!cdRunning) {
        if (cdRemain <= 0) cdRemain = (cdMinutes * 60 + cdSeconds) * 1000;
        if (cdRemain <= 0) return;
        byId('cdAlert').innerHTML   = '';
        byId('cdDisplay').className = 'cd-display';
        cdEnd     = Date.now() + cdRemain;
        cdTimer   = setInterval(cdTick, 250);
        cdRunning = true;
        byId('cdStartBtn').innerHTML = 'PAUSE';
        byId('cdStartBtn').className = 'tbtn tbtn-main running';
    } else {
        clearInterval(cdTimer);
        cdRemain  = cdEnd - Date.now();
        cdRunning = false;
        byId('cdStartBtn').innerHTML = 'START';
        byId('cdStartBtn').className = 'tbtn tbtn-main';
    }
}
function cdTick() {
    cdRemain = cdEnd - Date.now();
    if (cdRemain <= 0) {
        cdRemain = 0; clearInterval(cdTimer); cdRunning = false;
        setHtml('cdDisplay', '00:00');
        byId('cdDisplay').className  = 'cd-display alert';
        byId('cdStartBtn').innerHTML = 'START';
        byId('cdStartBtn').className = 'tbtn tbtn-main';
        byId('cdAlert').innerHTML    = '🔔 Hết giờ!';
        byId('cdAlert').className    = 'cd-alert show';
        return;
    }
    cdRefresh();
}
function cdRefresh() {
    var t = Math.ceil(cdRemain / 1000);
    setHtml('cdDisplay', pad(Math.floor(t / 60)) + ':' + pad(t % 60));
}
function cdReset() {
    clearInterval(cdTimer); cdRunning = false;
    cdRemain = (cdMinutes * 60 + cdSeconds) * 1000;
    setHtml('cdDisplay', pad(cdMinutes) + ':' + pad(cdSeconds));
    byId('cdDisplay').className  = 'cd-display';
    byId('cdStartBtn').innerHTML = 'START';
    byId('cdStartBtn').className = 'tbtn tbtn-main';
    byId('cdAlert').innerHTML    = '';
    byId('cdAlert').className    = 'cd-alert';
}

/* ══════════════════════════════
   CALCULATOR
══════════════════════════════ */
var cCur = '0', cPrev = '', cOp = '', cNew = true, cRes = false;

function calcDisp() {
    var el = byId('calcNum');
    el.innerHTML = cCur;
    var l = cCur.replace('-', '').length;
    el.className = 'calc-num' + (l > 9 ? ' xsmall' : l > 6 ? ' small' : '');
}
function calcNum(v) {
    if (cRes && v !== '.') { cCur = '0'; cRes = false; }
    if (v === '.') {
        if (cNew) { cCur = '0.'; cNew = false; calcDisp(); return; }
        if (cCur.indexOf('.') !== -1) return;
        cCur += '.'; calcDisp(); return;
    }
    if (cNew) { cCur = v; cNew = false; }
    else      { cCur = (cCur === '0') ? v : cCur + v; }
    if (cCur.replace('-', '').length > 12) return;
    calcDisp();
}
function calcOp(op) {
    if (cOp && !cNew) calcEqual(true);
    cPrev = cCur; cOp = op; cNew = true; cRes = false;
    var ids = { '÷': 'op-div', '×': 'op-mul', '−': 'op-sub', '+': 'op-add' };
    var ops = qsa('.cb-op');
    for (var i = 0; i < ops.length; i++) ops[i].className = 'cb cb-op';
    if (ids[op]) byId(ids[op]).className = 'cb cb-op active';
    setHtml('calcExpr', cPrev + ' ' + op);
}
function calcEqual(chain) {
    if (!cOp) return;
    var a = parseFloat(cPrev), b = parseFloat(cCur), r;
    if (cOp === '÷') r = (b !== 0) ? a / b : 'Error';
    if (cOp === '×') r = a * b;
    if (cOp === '−') r = a - b;
    if (cOp === '+') r = a + b;
    if (!chain) {
        setHtml('calcExpr', cPrev + ' ' + cOp + ' ' + cCur + ' =');
        cOp = '';
        var ops = qsa('.cb-op');
        for (var i = 0; i < ops.length; i++) ops[i].className = 'cb cb-op';
    }
    cCur = r === 'Error' ? 'Error' : (function() {
        var s = parseFloat(r.toFixed(10)).toString();
        return s.length > 12 ? parseFloat(r.toPrecision(8)).toString() : s;
    })();
    cPrev = cCur; cNew = true; cRes = !chain;
    calcDisp();
}
function calcFn(fn) {
    var n = parseFloat(cCur);
    if (fn === 'AC') {
        cCur = '0'; cPrev = ''; cOp = ''; cNew = true; cRes = false;
        setHtml('calcExpr', '');
        var ops = qsa('.cb-op');
        for (var i = 0; i < ops.length; i++) ops[i].className = 'cb cb-op';
    }
    if (fn === '+/-') { cCur = (n * -1).toString(); cRes = false; }
    if (fn === '%')   { cCur = (n / 100).toString(); cRes = false; }
    calcDisp();
}

/* ══════════════════════════════
   POMODORO
══════════════════════════════ */
var PS = { work: 25, short: 5, long: 15 };
var PL = { work: 'Focus', short: 'Short Break', long: 'Long Break' };
var pMode = 'work', pRun = false, pTimer = null;
var pRemain = 0, pTotal = 0, pEnd = 0, pCount = 0;
var PC = 2 * Math.PI * 88;

function pomoSetMode(m) {
    if (pRun) return;
    pMode = m; pTotal = PS[m] * 60 * 1000; pRemain = pTotal;
    var mmap  = { work: 'modeWork', short: 'modeShort', long: 'modeLong' };
    var mbtns = qsa('.pomo-mode-btn');
    for (var i = 0; i < mbtns.length; i++) mbtns[i].className = 'pomo-mode-btn';
    byId(mmap[m]).className      = 'pomo-mode-btn active';
    byId('pomoRingFg').className = 'pomo-ring-fg' + (m === 'work' ? '' : ' break');
    setHtml('pomoLabel', PL[m]);
    pomoRefresh();
}
function pomoToggle() {
    if (!pRun) {
        pEnd = Date.now() + pRemain;
        pTimer = setInterval(pomoTick, 500);
        pRun = true;
        byId('pomoStartBtn').innerHTML = 'PAUSE';
        byId('pomoStartBtn').className = 'pomo-btn pomo-start running';
    } else {
        clearInterval(pTimer); pRemain = pEnd - Date.now(); pRun = false;
        byId('pomoStartBtn').innerHTML = 'START';
        byId('pomoStartBtn').className = 'pomo-btn pomo-start';
    }
}
function pomoTick() {
    pRemain = pEnd - Date.now();
    if (pRemain <= 0) {
        pRemain = 0; clearInterval(pTimer); pRun = false;
        byId('pomoStartBtn').innerHTML = 'START';
        byId('pomoStartBtn').className = 'pomo-btn pomo-start';
        pomoRefresh(); pomoDone(); return;
    }
    pomoRefresh();
}
function pomoRefresh() {
    var t   = Math.ceil(pRemain / 1000);
    setHtml('pomoTime', pad(Math.floor(t / 60)) + ':' + pad(t % 60));
    var fg  = byId('pomoRingFg');
    var pct = pTotal > 0 ? pRemain / pTotal : 0;
    fg.style.strokeDasharray  = PC;
    fg.style.strokeDashoffset = PC * (1 - pct);
}
function pomoReset() {
    clearInterval(pTimer); pRun = false;
    pRemain = PS[pMode] * 60 * 1000; pTotal = pRemain;
    byId('pomoStartBtn').innerHTML = 'START';
    byId('pomoStartBtn').className = 'pomo-btn pomo-start';
    pomoRefresh();
}
function pomoAdjSet(m, v) {
    if (pRun) return;
    PS[m] = Math.max(1, Math.min(60, PS[m] + v));
    var vmap = { work: 'setWork', short: 'setShort', long: 'setLong' };
    setHtml(vmap[m], PS[m]);
    if (m === pMode) { pTotal = PS[m] * 60 * 1000; pRemain = pTotal; pomoRefresh(); }
}
function pomoDone() {
    var now  = getJST();
    var time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var icon = pMode === 'work' ? '🍅' : pMode === 'short' ? '☕' : '🛋️';
    var log  = byId('pomoLog');
    var empty = log.querySelector('.pomo-log-empty');
    if (empty) empty.parentNode.removeChild(empty);
    log.innerHTML = '<div class="pomo-log-item">'
                  + '<span>' + icon + ' ' + PL[pMode] + '</span>'
                  + '<span>' + time + '</span>'
                  + '</div>' + log.innerHTML;
    if (pMode === 'work') {
        pCount++; setHtml('pomoCount', pCount);
        pomoSetMode(pCount % 4 === 0 ? 'long' : 'short');
    } else {
        pomoSetMode('work');
    }
}

/* ══════════════════════════════
   INIT
══════════════════════════════ */
function init() {
    /* 1. Clear cache nếu version thay đổi */
    checkCacheVersion();

    /* 2. AppCache auto-update */
    initAppCache();

    /* 3. Detect online/offline */
    if (typeof navigator.onLine !== 'undefined') IS_ONLINE = navigator.onLine;
    updateStatusBar();

    /* 4. Khởi tạo UI */
    cdRemain = (cdMinutes * 60 + cdSeconds) * 1000;
    updateClock();
    buildCal('calendar');
    buildCal('bigCalendar');
    showQuote();

    /* 5. Load data API */
    loadFX();
    loadWeather();
    loadHolidays();
    pomoRefresh();

    /* 6. Timers */
    setInterval(updateClock, 1000);
    setInterval(pingCheck,   2 * 60 * 1000);
    setInterval(function() {
        if (IS_ONLINE) { loadFX(); loadWeather(); }
    }, 30 * 60 * 1000);

    /* 7. Native online/offline events */
    if (window.addEventListener) {
        window.addEventListener('online', function() {
            IS_ONLINE = true;
            updateStatusBar();
            loadFX();
            loadWeather();
            loadHolidays();
            if (window.applicationCache) {
                try { window.applicationCache.update(); } catch(e) {}
            }
        });
        window.addEventListener('offline', function() {
            IS_ONLINE = false;
            updateStatusBar();
        });
    }
}

/* Chờ DOM load xong */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
