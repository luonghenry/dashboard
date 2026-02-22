/* ══════════════════════════════════════════════
   Kindle Dashboard — app.js
   ES5 only — NO forEach on NodeList, NO arrow fn,
   NO const/let, NO template literals, NO clamp()
   Kindle 8 / WebKit 531-534 compatible
══════════════════════════════════════════════ */

/* ── Constants ── */
var WEEKDAYS   = ['日','月','火','水','木','金','土'];
var JST_OFFSET = 9 * 60;
var holidayDates = {};

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
function pad(n) {
    return n < 10 ? '0' + n : '' + n;
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

/* ── querySelectorAll safe for ES5 ── */
function qsa(sel) {
    var nl = document.querySelectorAll(sel);
    var arr = [];
    for (var i = 0; i < nl.length; i++) arr.push(nl[i]);
    return arr;
}
function byId(id) { return document.getElementById(id); }
function setHtml(id, html) { var el = byId(id); if (el) el.innerHTML = html; }

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
══════════════════════════════ */
function loadFX() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.exchangerate-api.com/v4/latest/JPY', true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
            var d = JSON.parse(xhr.responseText);
            if (!d.rates || !d.rates.VND) return;
            var rate = Math.round(d.rates.VND * 100) / 100;
            setHtml('fxrate', rate + ' VND');
            var t = getJST();
            setHtml('fxtime', pad(t.getHours()) + ':' + pad(t.getMinutes()));
        } catch(e) {}
    };
    xhr.send();
}

/* ══════════════════════════════
   WEATHER
══════════════════════════════ */
function loadWeather() {
    var url = 'https://api.open-meteo.com/v1/forecast'
            + '?latitude=35.6762&longitude=139.6503'
            + '&current_weather=true'
            + '&hourly=relativehumidity_2m'
            + '&timezone=Asia%2FTokyo';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
            try { renderWeather(JSON.parse(xhr.responseText)); }
            catch(e) { setHtml('wDesc', 'Lỗi parse'); }
        } else {
            setHtml('wDesc', 'Offline');
        }
    };
    xhr.send();
}

function renderWeather(data) {
    var cw  = data.current_weather;
    var wmo = getWMO(cw.weathercode);
    setHtml('wTemp', Math.round(cw.temperature) + '°C');
    setHtml('wIcon', wmo[0]);
    setHtml('wDesc', wmo[1]);
    setHtml('wWind', Math.round(cw.windspeed) + ' km/h');
    var hr  = getJST().getHours();
    var hum = (data.hourly && data.hourly.relativehumidity_2m)
              ? (data.hourly.relativehumidity_2m[hr] || '--')
              : '--';
    setHtml('wHumidity', hum + '%');
}

/* ══════════════════════════════
   HOLIDAYS
══════════════════════════════ */
function loadHolidays() {
    var yr = getJST().getFullYear();

    var x1 = new XMLHttpRequest();
    x1.open('GET', 'https://holidays-jp.github.io/api/v1/' + yr + '/date.json', true);
    x1.onreadystatechange = function() {
        if (x1.readyState === 4 && x1.status === 200) {
            try { dispHolidays(JSON.parse(x1.responseText), 'JP'); } catch(e) {}
        }
    };
    x1.send();

    var x2 = new XMLHttpRequest();
    x2.open('GET', 'https://date.nager.at/api/v3/PublicHolidays/' + yr + '/VN', true);
    x2.onreadystatechange = function() {
        if (x2.readyState === 4 && x2.status === 200) {
            try { dispHolidays(JSON.parse(x2.responseText), 'VN'); } catch(e) {}
        }
    };
    x2.send();
}

function dispHolidays(data, country) {
    var mo   = getJST().getMonth() + 1;
    var html = '';

    if (country === 'JP') {
        for (var ds in data) {
            var p  = ds.split('-');
            var m2 = parseInt(p[1], 10);
            var d2 = parseInt(p[2], 10);
            if (m2 === mo) {
                html += '<div class="holiday-item">🇯🇵 ' + m2 + '/' + d2 + ' ' + data[ds] + '</div>';
                holidayDates[d2] = true;
            }
        }
    } else {
        for (var i = 0; i < data.length; i++) {
            var p  = data[i].date.split('-');
            var m2 = parseInt(p[1], 10);
            var d2 = parseInt(p[2], 10);
            if (m2 === mo) {
                html += '<div class="holiday-item">🇻🇳 ' + m2 + '/' + d2 + ' ' + data[i].localName + '</div>';
            }
        }
    }

    var el = byId('holidayList');
    if (!el) return;
    if (html) {
        el.innerHTML = (el.innerHTML === 'Đang tải...') ? html : el.innerHTML + html;
    } else if (el.innerHTML === 'Đang tải...') {
        el.innerHTML = 'Không có ngày lễ';
    }

    buildCal('calendar');
    buildCal('bigCalendar');

    var src = byId('holidayList');
    var big = byId('bigHolidayList');
    if (src && big) {
        big.innerHTML = (src.innerHTML === 'Đang tải...') ? '' : src.innerHTML;
    }
}

/* ══════════════════════════════
   CALENDAR
══════════════════════════════ */
function buildCal(tableId) {
    var t   = getJST();
    var yr  = t.getFullYear();
    var mo  = t.getMonth();
    var td  = t.getDate();
    var tbl = byId(tableId);
    if (!tbl) return;
    tbl.innerHTML = '';

    if (tableId === 'calendar') {
        setHtml('calTitle', yr + '年 ' + (mo + 1) + '月');
    }

    /* thead */
    var thead = document.createElement('thead');
    var hrow  = document.createElement('tr');
    for (var i = 0; i < 7; i++) {
        var th      = document.createElement('th');
        th.innerHTML = WEEKDAYS[i];
        hrow.appendChild(th);
    }
    thead.appendChild(hrow);
    tbl.appendChild(thead);

    /* tbody */
    var tbody    = document.createElement('tbody');
    var fd       = new Date(yr, mo, 1).getDay();
    var total    = new Date(yr, mo + 1, 0).getDate();
    var row      = document.createElement('tr');

    for (var i = 0; i < fd; i++) {
        row.appendChild(document.createElement('td'));
    }
    for (var d = 1; d <= total; d++) {
        if ((fd + d - 1) % 7 === 0 && d !== 1) {
            tbody.appendChild(row);
            row = document.createElement('tr');
        }
        var cell      = document.createElement('td');
        cell.innerHTML = d;
        var cls       = [];
        if (d === td)          cls.push('today');
        if (holidayDates[d])   cls.push('holiday');
        if ((fd + d - 1) % 7 === 6) cls.push('sat');
        if (cls.length) cell.className = cls.join(' ');
        row.appendChild(cell);
    }
    tbody.appendChild(row);
    tbl.appendChild(tbody);
}

/* ══════════════════════════════
   STOPWATCH
══════════════════════════════ */
var swRunning = false;
var swStart   = 0;
var swElapsed = 0;
var swTimer   = null;
var swLaps    = [];

function swToggle() {
    if (!swRunning) {
        swStart  = Date.now() - swElapsed;
        swTimer  = setInterval(swTick, 100);
        swRunning = true;
        byId('swStartBtn').innerHTML  = 'STOP';
        byId('swStartBtn').className  = 'tbtn tbtn-main running';
    } else {
        clearInterval(swTimer);
        swElapsed = Date.now() - swStart;
        swRunning = false;
        byId('swStartBtn').innerHTML  = 'START';
        byId('swStartBtn').className  = 'tbtn tbtn-main';
    }
}

function swTick() {
    swElapsed = Date.now() - swStart;
    setHtml('swDisplay', swFmt(swElapsed));
}

function swReset() {
    clearInterval(swTimer);
    swRunning = false;
    swElapsed = 0;
    swLaps    = [];
    setHtml('swDisplay',  '00:00.0');
    setHtml('lapList',    '');
    byId('swStartBtn').innerHTML = 'START';
    byId('swStartBtn').className = 'tbtn tbtn-main';
}

function swLap() {
    if (!swRunning && swElapsed === 0) return;
    swLaps.push(swElapsed);
    renderLaps();
}

function swFmt(ms) {
    var t = Math.floor(ms / 100);
    return pad(Math.floor(t / 600)) + ':' + pad(Math.floor(t / 10) % 60) + '.' + (t % 10);
}

function renderLaps() {
    var sp   = [];
    for (var i = 0; i < swLaps.length; i++) {
        sp.push(i === 0 ? swLaps[i] : swLaps[i] - swLaps[i - 1]);
    }
    var mn   = sp[0];
    var mx   = sp[0];
    for (var i = 1; i < sp.length; i++) {
        if (sp[i] < mn) mn = sp[i];
        if (sp[i] > mx) mx = sp[i];
    }
    var html = '';
    for (var i = swLaps.length - 1; i >= 0; i--) {
        var c = (sp.length > 1)
            ? (sp[i] === mn ? ' fastest' : sp[i] === mx ? ' slowest' : '')
            : '';
        html += '<div class="lap-item' + c + '">'
              + '<span>Lap ' + (i + 1) + '</span>'
              + '<span>' + swFmt(sp[i]) + '</span>'
              + '<span>' + swFmt(swLaps[i]) + '</span>'
              + '</div>';
    }
    setHtml('lapList', html);
}

/* ══════════════════════════════
   COUNTDOWN
══════════════════════════════ */
var cdRunning = false;
var cdTimer   = null;
var cdMinutes = 5;
var cdSeconds = 0;
var cdRemain  = 0;
var cdEnd     = 0;

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
        byId('cdAlert').innerHTML    = '';
        byId('cdDisplay').className  = 'cd-display';
        cdEnd    = Date.now() + cdRemain;
        cdTimer  = setInterval(cdTick, 250);
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
        cdRemain = 0;
        clearInterval(cdTimer);
        cdRunning = false;
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
    clearInterval(cdTimer);
    cdRunning = false;
    cdRemain  = (cdMinutes * 60 + cdSeconds) * 1000;
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
var cCur  = '0';
var cPrev = '';
var cOp   = '';
var cNew  = true;
var cRes  = false;

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
        cCur += '.';
        calcDisp(); return;
    }
    if (cNew) { cCur = v; cNew = false; }
    else      { cCur = (cCur === '0') ? v : cCur + v; }
    if (cCur.replace('-', '').length > 12) return;
    calcDisp();
}

function calcOp(op) {
    if (cOp && !cNew) calcEqual(true);
    cPrev = cCur; cOp = op; cNew = true; cRes = false;
    /* highlight active op button */
    var ids = { '÷': 'op-div', '×': 'op-mul', '−': 'op-sub', '+': 'op-add' };
    var ops = qsa('.cb-op');
    for (var i = 0; i < ops.length; i++) ops[i].className = 'cb cb-op';
    if (ids[op]) byId(ids[op]).className = 'cb cb-op active';
    setHtml('calcExpr', cPrev + ' ' + op);
}

function calcEqual(chain) {
    if (!cOp) return;
    var a = parseFloat(cPrev);
    var b = parseFloat(cCur);
    var r;
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
    if (r === 'Error') {
        cCur = 'Error';
    } else {
        var s = parseFloat(r.toFixed(10)).toString();
        cCur  = (s.length > 12) ? parseFloat(r.toPrecision(8)).toString() : s;
    }
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
var pMode  = 'work';
var pRun   = false;
var pTimer = null;
var pRemain = 0;
var pTotal  = 0;
var pEnd    = 0;
var pCount  = 0;
var PC      = 2 * Math.PI * 88; /* circumference ≈ 553 */

function pomoSetMode(m) {
    if (pRun) return;
    pMode  = m;
    pTotal  = PS[m] * 60 * 1000;
    pRemain = pTotal;

    var mmap = { work: 'modeWork', short: 'modeShort', long: 'modeLong' };
    var mbtns = qsa('.pomo-mode-btn');
    for (var i = 0; i < mbtns.length; i++) mbtns[i].className = 'pomo-mode-btn';
    byId(mmap[m]).className = 'pomo-mode-btn active';

    byId('pomoRingFg').className = 'pomo-ring-fg' + (m === 'work' ? '' : ' break');
    setHtml('pomoLabel', PL[m]);
    pomoRefresh();
}

function pomoToggle() {
    if (!pRun) {
        pEnd   = Date.now() + pRemain;
        pTimer = setInterval(pomoTick, 500);
        pRun   = true;
        byId('pomoStartBtn').innerHTML = 'PAUSE';
        byId('pomoStartBtn').className = 'pomo-btn pomo-start running';
    } else {
        clearInterval(pTimer);
        pRemain = pEnd - Date.now();
        pRun    = false;
        byId('pomoStartBtn').innerHTML = 'START';
        byId('pomoStartBtn').className = 'pomo-btn pomo-start';
    }
}

function pomoTick() {
    pRemain = pEnd - Date.now();
    if (pRemain <= 0) {
        pRemain = 0;
        clearInterval(pTimer);
        pRun = false;
        byId('pomoStartBtn').innerHTML = 'START';
        byId('pomoStartBtn').className = 'pomo-btn pomo-start';
        pomoRefresh();
        pomoDone();
        return;
    }
    pomoRefresh();
}

function pomoRefresh() {
    var t  = Math.ceil(pRemain / 1000);
    setHtml('pomoTime', pad(Math.floor(t / 60)) + ':' + pad(t % 60));
    var fg  = byId('pomoRingFg');
    var pct = (pTotal > 0) ? pRemain / pTotal : 0;
    fg.style.strokeDasharray  = PC;
    fg.style.strokeDashoffset = PC * (1 - pct);
}

function pomoReset() {
    clearInterval(pTimer);
    pRun    = false;
    pRemain = PS[pMode] * 60 * 1000;
    pTotal  = pRemain;
    byId('pomoStartBtn').innerHTML = 'START';
    byId('pomoStartBtn').className = 'pomo-btn pomo-start';
    pomoRefresh();
}

function pomoAdjSet(m, v) {
    if (pRun) return;
    PS[m] = Math.max(1, Math.min(60, PS[m] + v));
    var vmap = { work: 'setWork', short: 'setShort', long: 'setLong' };
    setHtml(vmap[m], PS[m]);
    if (m === pMode) {
        pTotal  = PS[m] * 60 * 1000;
        pRemain = pTotal;
        pomoRefresh();
    }
}

function pomoDone() {
    var now  = getJST();
    var time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var icon = (pMode === 'work') ? '🍅' : (pMode === 'short') ? '☕' : '🛋️';
    var log  = byId('pomoLog');
    var empty = log.querySelector('.pomo-log-empty');
    if (empty) empty.parentNode.removeChild(empty);
    log.innerHTML = '<div class="pomo-log-item">'
                  + '<span>' + icon + ' ' + PL[pMode] + '</span>'
                  + '<span>' + time + '</span>'
                  + '</div>' + log.innerHTML;
    if (pMode === 'work') {
        pCount++;
        setHtml('pomoCount', pCount);
        pomoSetMode(pCount % 4 === 0 ? 'long' : 'short');
    } else {
        pomoSetMode('work');
    }
}

/* ══════════════════════════════
   INIT — chạy sau khi DOM sẵn sàng
══════════════════════════════ */
function init() {
    cdRemain = (cdMinutes * 60 + cdSeconds) * 1000;

    updateClock();
    buildCal('calendar');
    buildCal('bigCalendar');
    showQuote();
    loadFX();
    loadWeather();
    loadHolidays();
    pomoRefresh();

    setInterval(updateClock, 1000);
    setInterval(loadFX,      15 * 60 * 1000);
    setInterval(loadWeather, 30 * 60 * 1000);

    /* Bypass cache reload mỗi 10 phút */
    setInterval(function() {
        window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
    }, 10 * 60 * 1000);
}

/* Chờ DOM load xong */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
