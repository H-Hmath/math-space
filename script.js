// 수학 우주 탐험대 — 1단계 (구글 시트 연결 전, 기록은 이 기기에만 저장)

// ---------- 기본 설정 ----------
var GAMES = [
  { id: 'quad', name: '사각형 행성', color: '#7F77DD' },
  { id: 'sim', name: '닮음 행성', color: '#1D9E75' },
  { id: 'pyth', name: '피타고라스 행성', color: '#D85A30' },
  { id: 'mix', name: '종합 은하', color: '#EF9F27' }
];
var TIME_LIMIT = 90;
// 한 판 10문제 구성: [단원, 개념 문제 수, 계산 문제 수]
var GAME_PLAN = {
  quad: [['quad', 6, 4]],
  sim: [['sim', 4, 6]],
  pyth: [['pyth', 2, 7]],   // + 피타고라스 수 암기 1문제
  mix: [['quad', 2, 1], ['sim', 2, 2], ['pyth', 1, 2]]
};

var COLORS = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#378ADD'];
var SHAPES = [
  { id: 'circle', name: '원', price: 0 },
  { id: 'square', name: '정사각형', price: 0 },
  { id: 'triangle', name: '정삼각형', price: 0 },
  { id: 'rhombus', name: '마름모', price: 0 },
  { id: 'cat', name: '고양이', price: 150 },
  { id: 'rabbit', name: '토끼', price: 150 },
  { id: 'penguin', name: '펭귄', price: 200 },
  { id: 'bear', name: '곰', price: 200 },
  { id: 'alien', name: '눈 세 개 외계인', price: 300 },
  { id: 'octopus', name: '문어 외계인', price: 400 }
];
var ACCS = [
  { id: 'ribbon', name: '리본', slot: 'head', price: 30 },
  { id: 'pin', name: '별 머리핀', slot: 'head', price: 40 },
  { id: 'protractor', name: '각도기 모자', slot: 'head', price: 80 },
  { id: 'helmet', name: '우주 헬멧', slot: 'head', price: 150 },
  { id: 'crown', name: '왕관', slot: 'head', price: 300 },
  { id: 'blush', name: '별 볼터치', slot: 'face', price: 30 },
  { id: 'sunglass', name: '선글라스', slot: 'face', price: 50 },
  { id: 'piglass', name: 'π 안경', slot: 'face', price: 100 },
  { id: 'bowtie', name: '나비넥타이', slot: 'body', price: 40 },
  { id: 'cape', name: '수학자 망토', slot: 'body', price: 120 },
  { id: 'rocket', name: '로켓 배낭', slot: 'body', price: 200 },
  { id: 'galaxy', name: '은하 망토', slot: 'body', price: 300 }
];

// ---------- 기기 저장 ----------
var STORE_KEY = 'mathSpace.v1';
var store = loadStore();
var state = null;   // 로그인한 학생의 기록

function loadStore() {
  try { var s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.profiles) return s; } catch (e) {}
  return { profiles: {} };
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* 저장이 막힌 기기에서는 이번 접속 동안만 유지 */ }
}
function newProfile(cls, num, pw, nick) {
  return {
    cls: cls, num: num, pw: pw, nick: nick, money: 0,
    shape: 'circle', color: COLORS[0],
    owned: { circle: 1, square: 1, triangle: 1, rhombus: 1 },
    wear: { head: null, face: null, body: null },
    best: {}, plays: {}, today: { date: '', best: {} }
  };
}
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

// ---------- 구글 시트 연결 (config.js에 주소가 있을 때만) ----------
var ONLINE = typeof SHEET_API_URL === 'string' && SHEET_API_URL.indexOf('https://') === 0;
var QUEUE_KEY = 'mathSpace.queue';

function api(action, data) {
  var body = JSON.stringify(Object.assign({ action: action }, data || {}));
  var timeout = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 15000); });
  // text/plain으로 보내야 구글 앱스 스크립트가 바로 받음
  var req = fetch(SHEET_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
    .then(function (r) { return r.json(); });
  return Promise.race([req, timeout]);
}
function authData() { return { cls: state.cls, num: state.num, pw: state.pw }; }
// 시트에서 받은 학생 정보를 화면용 state에 반영
function applyProfile(p) {
  ['nick', 'money', 'shape', 'color', 'owned', 'wear', 'best', 'plays', 'today'].forEach(function (k) { if (p[k] !== undefined) state[k] = p[k]; });
}
function setBadge(text) { $('net-badge').textContent = text; }

// 못 보낸 결과 보관 → 연결되면 다시 보냄
function loadQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch (e) { return []; } }
function saveQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) {} }
var flushing = false;
function flushQueue() {
  if (!ONLINE || flushing) return;
  var q = loadQueue();
  if (!q.length) return;
  flushing = true;
  var item = q[0];
  api('result', item).then(function (res) {
    flushing = false;
    if (res.ok || res.reject) {           // 받았거나, 시트가 받을 수 없다고 한 기록은 목록에서 뺌
      saveQueue(loadQueue().filter(function (x) { return x.clientId !== item.clientId; }));
      if (res.ok && state && res.profile && item.cls === state.cls && item.num === state.num) { applyProfile(res.profile); refreshMoney(); }
      flushQueue();
    }
  }).catch(function () { flushing = false; });
}
setInterval(flushQueue, 60000);
function refreshMoney() {
  if (!state) return;
  if ($('s-home').classList.contains('active')) renderHome();
  if ($('s-shop').classList.contains('active')) renderShop();
  var n = loadQueue().length;
  setBadge(n ? '보내지 못한 기록 ' + n + '개 · 연결되면 자동으로 보내요' : '구글 시트에 연결됨');
}

// ---------- 유틸 ----------
function $(id) { return document.getElementById(id); }
function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function show(id) {
  var list = document.querySelectorAll('.screen');
  for (var i = 0; i < list.length; i++) list[i].classList.remove('active');
  $('s-' + id).classList.add('active');
  if (id === 'home') renderHome();
  if (id === 'shop') renderShop();
  if (id === 'rank') renderRank();
}
function starStr(n) { var s = ''; for (var i = 0; i < 5; i++) s += i < n ? '★' : '<span class="off">★</span>'; return s; }

// ---------- 배경 별 ----------
(function makeStars() {
  var html = '';
  for (var i = 0; i < 90; i++) {
    html += '<i style="left:' + Math.random() * 100 + '%;top:' + Math.random() * 100 + '%;opacity:' + (0.3 + Math.random() * 0.7).toFixed(2) + '"></i>';
  }
  $('stars').innerHTML = html;
})();

// ---------- 효과음: '뾰옹' (직접 합성) ----------
var audioCtx = null;
function tone(setup) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    setup(o, g, audioCtx.currentTime);
    o.connect(g); g.connect(audioCtx.destination);
  } catch (e) { /* 소리를 못 내는 기기는 조용히 넘어감 */ }
}
function playPop() {
  tone(function (o, g, t) {
    o.type = 'square';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.08);
    o.frequency.setValueAtTime(500, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
    g.gain.setValueAtTime(0.15, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.start(t); o.stop(t + 0.4);
  });
}
function playBuzz() {
  tone(function (o, g, t) {
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.linearRampToValueAtTime(140, t + 0.2);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.start(t); o.stop(t + 0.26);
  });
}

// ---------- 캐릭터 그리기 ----------
function charSVG(shape, color, wear, mouthOpen) {
  wear = wear || {};
  var back = '', body = '', face = '', front = '';
  var ey = 48, my = 62;               // 눈·입 높이
  var dark = '#26215C';

  // 몸 뒤에 그리는 액세서리
  if (wear.body === 'cape') back += '<path d="M22,50 L8,96 L92,96 L78,50 Z" fill="#534AB7"/>';
  if (wear.body === 'galaxy') back += '<path d="M22,50 L6,97 L94,97 L78,50 Z" fill="#0C447C"/><circle cx="20" cy="88" r="1.6" fill="#fff"/><circle cx="82" cy="84" r="1.6" fill="#fff"/><circle cx="74" cy="93" r="1.2" fill="#FAC775"/><circle cx="28" cy="78" r="1.2" fill="#FAC775"/>';
  if (wear.body === 'rocket') back += '<rect x="8" y="46" width="14" height="32" rx="5" fill="#B4B2A9"/><rect x="78" y="46" width="14" height="32" rx="5" fill="#B4B2A9"/><path d="M10,78 L15,92 L20,78 Z" fill="#EF9F27"/><path d="M80,78 L85,92 L90,78 Z" fill="#EF9F27"/>';

  // 몸
  if (shape === 'square') body = '<rect x="20" y="24" width="60" height="62" rx="12" fill="' + color + '"/>';
  else if (shape === 'triangle') { body = '<path d="M50,14 L90,88 Q90,90 88,90 L12,90 Q10,90 10,88 Z" fill="' + color + '"/>'; ey = 60; my = 74; }
  else if (shape === 'rhombus') { body = '<path d="M50,12 L90,54 L50,96 L10,54 Z" fill="' + color + '"/>'; ey = 50; my = 64; }
  else if (shape === 'cat') body = '<path d="M24,40 L28,12 L46,28 Z M76,40 L72,12 L54,28 Z" fill="' + color + '"/><circle cx="50" cy="56" r="32" fill="' + color + '"/><path d="M28,58 L14,55 M28,62 L14,64 M72,58 L86,55 M72,62 L86,64" stroke="' + dark + '" stroke-width="1.5"/>';
  else if (shape === 'rabbit') body = '<ellipse cx="38" cy="18" rx="7" ry="18" fill="' + color + '"/><ellipse cx="62" cy="18" rx="7" ry="18" fill="' + color + '"/><ellipse cx="38" cy="18" rx="3" ry="12" fill="#F4C0D1"/><ellipse cx="62" cy="18" rx="3" ry="12" fill="#F4C0D1"/><circle cx="50" cy="58" r="30" fill="' + color + '"/>';
  else if (shape === 'penguin') body = '<ellipse cx="50" cy="56" rx="32" ry="36" fill="' + color + '"/><ellipse cx="50" cy="64" rx="20" ry="24" fill="#ffffff"/><path d="M42,92 L36,98 L48,98 Z M58,92 L52,98 L64,98 Z" fill="#EF9F27"/>';
  else if (shape === 'bear') body = '<circle cx="26" cy="28" r="10" fill="' + color + '"/><circle cx="74" cy="28" r="10" fill="' + color + '"/><circle cx="50" cy="56" r="32" fill="' + color + '"/><ellipse cx="50" cy="68" rx="12" ry="9" fill="#F1EFE8"/>';
  else if (shape === 'alien') body = '<line x1="36" y1="26" x2="28" y2="8" stroke="' + color + '" stroke-width="3"/><line x1="64" y1="26" x2="72" y2="8" stroke="' + color + '" stroke-width="3"/><circle cx="28" cy="8" r="4" fill="#97C459"/><circle cx="72" cy="8" r="4" fill="#97C459"/><ellipse cx="50" cy="56" rx="34" ry="30" fill="' + color + '"/>';
  else if (shape === 'octopus') { body = '<path d="M20,60 Q14,86 22,92 Q28,78 32,74 Q30,92 40,96 Q42,80 46,76 Q48,96 58,96 Q58,80 60,76 Q64,94 74,92 Q70,78 70,74 Q80,90 86,86 Q82,72 80,60 Z" fill="' + color + '"/><ellipse cx="50" cy="46" rx="32" ry="30" fill="' + color + '"/>'; ey = 42; my = 56; }
  else body = '<circle cx="50" cy="56" r="32" fill="' + color + '"/>';

  // 눈
  if (shape === 'alien') {
    face += [34, 50, 66].map(function (x) { return '<circle cx="' + x + '" cy="' + (ey - 2) + '" r="6.5" fill="#fff"/><circle cx="' + (x + 1) + '" cy="' + (ey - 1) + '" r="3.2" fill="' + dark + '"/>'; }).join('');
  } else {
    face += '<circle cx="38" cy="' + ey + '" r="7" fill="#fff"/><circle cx="62" cy="' + ey + '" r="7" fill="#fff"/>';
    face += '<circle cx="39" cy="' + (ey + 1) + '" r="3.5" fill="' + dark + '"/><circle cx="63" cy="' + (ey + 1) + '" r="3.5" fill="' + dark + '"/>';
  }
  // 입 (크게 벌린 입 = 별 먹는 중)
  var mh = mouthOpen ? 22 : 14;
  face += '<path d="M37,' + my + ' Q50,' + (my + mh) + ' 63,' + my + ' Z" fill="' + dark + '"/>';
  face += '<path d="M43,' + (my + 2) + ' Q50,' + (my + mh * 0.55) + ' 57,' + (my + 2) + ' Z" fill="#ED93B1"/>';

  // 얼굴 액세서리
  if (wear.face === 'blush') face += '<circle cx="27" cy="' + (ey + 10) + '" r="4" fill="#ED93B1" opacity=".8"/><circle cx="73" cy="' + (ey + 10) + '" r="4" fill="#ED93B1" opacity=".8"/>';
  if (wear.face === 'sunglass') face += '<rect x="27" y="' + (ey - 7) + '" width="21" height="13" rx="4" fill="#2C2C2A"/><rect x="52" y="' + (ey - 7) + '" width="21" height="13" rx="4" fill="#2C2C2A"/><line x1="48" y1="' + (ey - 2) + '" x2="52" y2="' + (ey - 2) + '" stroke="#2C2C2A" stroke-width="3"/>';
  if (wear.face === 'piglass') face += '<circle cx="38" cy="' + ey + '" r="10" fill="none" stroke="#854F0B" stroke-width="2.5"/><circle cx="62" cy="' + ey + '" r="10" fill="none" stroke="#854F0B" stroke-width="2.5"/><text x="50" y="' + (ey - 9) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#854F0B">π</text><line x1="48" y1="' + ey + '" x2="52" y2="' + ey + '" stroke="#854F0B" stroke-width="2.5"/>';

  // 머리 액세서리
  var top = shape === 'triangle' ? 14 : (shape === 'rhombus' ? 12 : (shape === 'octopus' ? 16 : 24));
  if (wear.head === 'ribbon') front += '<path d="M62,' + (top + 2) + ' L52,' + (top - 6) + ' L52,' + (top + 10) + ' Z M62,' + (top + 2) + ' L72,' + (top - 6) + ' L72,' + (top + 10) + ' Z" fill="#D4537E"/><circle cx="62" cy="' + (top + 2) + '" r="3" fill="#993556"/>';
  if (wear.head === 'pin') front += '<polygon points="' + starPts(33, top + 4, 8, 3.5) + '" fill="#FAC775" stroke="#BA7517" stroke-width="1"/>';
  if (wear.head === 'protractor') front += '<path d="M30,' + (top + 2) + ' A20,20 0 0,1 70,' + (top + 2) + ' Z" fill="#B5D4F4" stroke="#185FA5" stroke-width="1.5"/><path d="M50,' + (top + 2) + ' L50,' + (top - 16) + ' M50,' + (top + 2) + ' L36,' + (top - 11) + ' M50,' + (top + 2) + ' L64,' + (top - 11) + '" stroke="#185FA5" stroke-width="1"/>';
  if (wear.head === 'crown') front += '<path d="M32,' + (top + 4) + ' L34,' + (top - 12) + ' L42,' + (top - 2) + ' L50,' + (top - 16) + ' L58,' + (top - 2) + ' L66,' + (top - 12) + ' L68,' + (top + 4) + ' Z" fill="#FAC775" stroke="#BA7517" stroke-width="1"/>';
  if (wear.head === 'helmet') front += '<circle cx="50" cy="54" r="45" fill="#B5D4F4" fill-opacity=".22" stroke="#85B7EB" stroke-width="2.5"/><path d="M24,30 Q34,18 48,15" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>';
  if (wear.body === 'bowtie') front += '<path d="M50,88 L38,82 L38,94 Z M50,88 L62,82 L62,94 Z" fill="#E24B4A"/><circle cx="50" cy="88" r="3" fill="#A32D2D"/>';

  return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' + back + body + face + front + '</svg>';
}
function starPts(cx, cy, R, r) {
  var p = [];
  for (var i = 0; i < 10; i++) {
    var a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r : R;
    p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
  }
  return p.join(' ');
}
function myChar(mouthOpen) {
  if (!state) return charSVG('circle', COLORS[0], {}, mouthOpen);
  return charSVG(state.shape, state.color, state.wear, mouthOpen);
}

// ---------- 도형 그림 도구 ----------
// 점은 수학 좌표(위가 +y)로 주고, 화면 크기에 맞춰 실제 비율 그대로 줄이거나 늘림
var FIG_W = 460, FIG_H = 300, FIG_PAD = 48;
function Fig(pts) {
  var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, k;
  for (k in pts) { minx = Math.min(minx, pts[k][0]); maxx = Math.max(maxx, pts[k][0]); miny = Math.min(miny, pts[k][1]); maxy = Math.max(maxy, pts[k][1]); }
  var s = Math.min((FIG_W - 2 * FIG_PAD) / ((maxx - minx) || 1), (FIG_H - 2 * FIG_PAD) / ((maxy - miny) || 1));
  var ox = (FIG_W - (maxx - minx) * s) / 2, oy = (FIG_H - (maxy - miny) * s) / 2;
  this.p = {}; var cx = 0, cy = 0, n = 0;
  for (k in pts) {
    this.p[k] = [ox + (pts[k][0] - minx) * s, FIG_H - oy - (pts[k][1] - miny) * s];
    cx += this.p[k][0]; cy += this.p[k][1]; n++;
  }
  this.cen = [cx / n, cy / n];
  this.g = '';
}
Fig.prototype.at = function (a) { return typeof a === 'string' ? this.p[a] : a; };
Fig.prototype.poly = function (names, style) {
  var self = this;
  this.g += '<polygon points="' + names.map(function (n) { return self.at(n).join(','); }).join(' ') + '" ' + (style || LINE) + '/>';
  return this;
};
Fig.prototype.seg = function (a, b, kind) {
  var A = this.at(a), B = this.at(b);
  var st = { hl: 'stroke="#534ab7" stroke-width="2.5"', thin: 'stroke="#5f5e7a" stroke-width="1.5"', dash: 'stroke="#5f5e7a" stroke-width="1.5" stroke-dasharray="6 4"' }[kind] || 'stroke="#1f2140" stroke-width="2.5"';
  this.g += '<line x1="' + A[0] + '" y1="' + A[1] + '" x2="' + B[0] + '" y2="' + B[1] + '" ' + st + '/>';
  return this;
};
// 선분 a→b 위 t 지점에 글자 (ref 점의 반대쪽으로 띄움)
Fig.prototype.lab = function (a, b, t, text, isX, ref, off) {
  var A = this.at(a), B = this.at(b), R = ref ? this.at(ref) : this.cen;
  var M = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  var dx = B[0] - A[0], dy = B[1] - A[1], L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L;
  if ((M[0] - R[0]) * nx + (M[1] - R[1]) * ny < 0) { nx = -nx; ny = -ny; }
  off = off || 18;
  off += Math.abs(nx) * Math.max(0, String(text).length - 2) * 4;   // 긴 식은 옆으로 더 띄움
  return this.text(M[0] + nx * off, M[1] + ny * off, text, isX ? 'x' : '');
};
Fig.prototype.side = function (a, b, text, isX, ref) { return this.lab(a, b, 0.5, text, isX, ref); };
Fig.prototype.text = function (x, y, t, cls) {
  this.g += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle"' + (cls ? ' class="' + cls + '"' : '') + '>' + t + '</text>';
  return this;
};
// 꼭짓점 이름 (도형 바깥쪽으로)
Fig.prototype.name = function (n, text, ref) {
  var P = this.at(n), R = ref ? this.at(ref) : this.cen, dx = P[0] - R[0], dy = P[1] - R[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
  return this.text(P[0] + dx / L * 16, P[1] + dy / L * 16, text || n, 'v');
};
Fig.prototype.names = function (list, ref) { for (var i = 0; i < list.length; i++) this.name(list[i], null, ref); return this; };
// 각 표시: 꼭짓점 v에서 a쪽과 b쪽 사이
Fig.prototype.angle = function (v, a, b, text, isX, r) {
  var V = this.at(v), A = this.at(a), B = this.at(b); r = r || 26;
  var t1 = Math.atan2(A[1] - V[1], A[0] - V[0]), t2 = Math.atan2(B[1] - V[1], B[0] - V[0]);
  var d = t2 - t1; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
  var x1 = V[0] + r * Math.cos(t1), y1 = V[1] + r * Math.sin(t1), x2 = V[0] + r * Math.cos(t2), y2 = V[1] + r * Math.sin(t2);
  this.g += '<path d="M' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 0,' + (d > 0 ? 1 : 0) + ' ' + x2 + ',' + y2 + '" fill="none" stroke="' + (isX ? '#534ab7' : '#5f5e7a') + '" stroke-width="1.8"/>';
  if (text) { var m = t1 + d / 2, rr = r + 20; this.text(V[0] + rr * Math.cos(m), V[1] + rr * Math.sin(m), text, isX ? 'x' : ''); }
  return this;
};
Fig.prototype.right = function (v, a, b) {
  var V = this.at(v), A = this.at(a), B = this.at(b), s = 13;
  var ua = norm([A[0] - V[0], A[1] - V[1]]), ub = norm([B[0] - V[0], B[1] - V[1]]);
  this.g += '<polyline points="' + (V[0] + ua[0] * s) + ',' + (V[1] + ua[1] * s) + ' ' + (V[0] + (ua[0] + ub[0]) * s) + ',' + (V[1] + (ua[1] + ub[1]) * s) + ' ' + (V[0] + ub[0] * s) + ',' + (V[1] + ub[1] * s) + '" fill="none" stroke="#5f5e7a" stroke-width="1.5"/>';
  return this;
};
// 같은 길이 표시 (짧은 눈금 n개)
Fig.prototype.tick = function (a, b, n) {
  var A = this.at(a), B = this.at(b), M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], u = norm([B[0] - A[0], B[1] - A[1]]), nv = [-u[1], u[0]];
  for (var i = 0; i < (n || 1); i++) {
    var o = (i - ((n || 1) - 1) / 2) * 5, c = [M[0] + u[0] * o, M[1] + u[1] * o];
    this.g += '<line x1="' + (c[0] - nv[0] * 6) + '" y1="' + (c[1] - nv[1] * 6) + '" x2="' + (c[0] + nv[0] * 6) + '" y2="' + (c[1] + nv[1] * 6) + '" stroke="#5f5e7a" stroke-width="1.5"/>';
  }
  return this;
};
Fig.prototype.dot = function (n) { var P = this.at(n); this.g += '<circle cx="' + P[0] + '" cy="' + P[1] + '" r="3.5" fill="#1f2140"/>'; return this; };
// 여러 점의 가운데에 글자 (넓이 표시 등)
Fig.prototype.inside = function (list, text, isX) {
  var x = 0, y = 0, self = this;
  list.forEach(function (n) { x += self.at(n)[0]; y += self.at(n)[1]; });
  return this.text(x / list.length, y / list.length, text, isX ? 'x' : 'in');
};
Fig.prototype.svg = function () { return '<svg viewBox="0 0 ' + FIG_W + ' ' + FIG_H + '" width="' + FIG_W + '" height="' + FIG_H + '">' + this.g + '</svg>'; };

var LINE = 'fill="none" stroke="#1f2140" stroke-width="2.5" stroke-linejoin="round"';
function norm(v) { var L = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1; return [v[0] / L, v[1] / L]; }
function rad(d) { return d * Math.PI / 180; }
function lerp(P, Q, t) { return [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]; }
function polar(r, deg) { return [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))]; }

// 도형 좌표 만들기
function paraPts(deg) { var m = 3, L = 5, t = rad(deg); return { A: [0, m * Math.sin(t)], B: [m * Math.cos(t), 0], C: [m * Math.cos(t) + L, 0], D: [L, m * Math.sin(t)] }; }
function rectPts(w, h) { return { A: [0, h], B: [0, 0], C: [w, 0], D: [w, h], O: [w / 2, h / 2] }; }
function rhombusTop(p, q) { return { A: [0, q], B: [-p, 0], C: [0, -q], D: [p, 0], O: [0, 0] }; }        // A가 위
function rhombusLeft(p, q) { return { A: [-p, 0], B: [0, -q], C: [p, 0], D: [0, q], O: [0, 0] }; }       // A가 왼쪽
// 세 각(°)으로 삼각형: B=(0,0), C=(w,0)
function triByAngles(a, b, w, ox) {
  var c = 180 - a - b, ab = w * Math.sin(rad(c)) / Math.sin(rad(a));
  ox = ox || 0;
  return { A: [ox + ab * Math.cos(rad(b)), ab * Math.sin(rad(b))], B: [ox, 0], C: [ox + w, 0] };
}
// 꼭짓점 A를 위에 두고 AB, AC 방향을 각 α만큼 벌린 삼각형
function triFromA(alpha, ab, ac) {
  return { A: [0, 0], B: polar(ab, -90 - alpha / 2), C: polar(ac, -90 + alpha / 2) };
}
function lin(a, b) {     // ax + b 를 글자로
  var s = (a === 1 ? '' : a) + 'x';
  if (b > 0) s += ' + ' + b; else if (b < 0) s += ' − ' + (-b);
  return s;
}
function exprPair() {    // 같은 길이를 나타내는 두 식, 답 x
  var x = rand(2, 9), a1 = rand(1, 3), a2 = pick([1, 2, 3].filter(function (v) { return v !== a1; })), b1 = rand(1, 6);
  return { x: x, e1: lin(a1, b1), e2: lin(a2, a1 * x + b1 - a2 * x) };
}
function C(type, q, fig, ans, unit, hint) { return { kind: 'calc', type: type, q: q, fig: fig, ans: ans, unit: unit || '', hint: hint }; }

// ---------- 계산 문제 34유형 (숫자와 그림이 매번 바뀜) ----------
var TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15]];
var RATIOS = [[1, 2], [2, 3], [3, 4], [2, 5], [3, 5]];
function scaledTriple(maxHyp) {
  var list = [];
  TRIPLES.forEach(function (t) { for (var k = 1; k <= 3; k++) if (t[2] * k <= maxHyp) list.push([t[0] * k, t[1] * k, t[2] * k]); });
  return pick(list);
}
function rightTri(a, b) { return { A: [0, a], B: [0, 0], C: [b, 0] }; }   // 직각은 B

var CALC = {
  quad: [
    function paraOpp() {
      var d = rand(10, 16) * 5, f = new Fig(paraPts(d));
      f.poly(['A', 'B', 'C', 'D']).names(['A', 'B', 'C', 'D']).angle('A', 'D', 'B', d + '°').angle('C', 'B', 'D', 'x°', true);
      return C('평행사변형의 대각', '평행사변형 ABCD에서 x의 값은?', f.svg(), d, '°', '평행사변형에서 마주 보는 두 각(대각)의 크기는 같아요.');
    },
    function paraAdj() {
      var d = rand(10, 16) * 5, f = new Fig(paraPts(d));
      f.poly(['A', 'B', 'C', 'D']).names(['A', 'B', 'C', 'D']).angle('A', 'D', 'B', d + '°').angle('B', 'C', 'A', 'x°', true);
      return C('평행사변형의 이웃한 각', '평행사변형 ABCD에서 x의 값은?', f.svg(), 180 - d, '°', '평행사변형에서 이웃하는 두 각의 크기의 합은 180°예요.');
    },
    function paraSide() {
      var e = exprPair(), f = new Fig(paraPts(60));
      f.poly(['A', 'B', 'C', 'D']).names(['A', 'B', 'C', 'D']).side('A', 'B', e.e1).side('D', 'C', e.e2);
      return C('평행사변형의 대변', '평행사변형 ABCD에서 x의 값은?', f.svg(), e.x, '', '평행사변형에서 마주 보는 두 변의 길이는 같아요. 두 식을 같다고 놓아 보세요.');
    },
    function paraDiag() {
      var k = rand(4, 15), p = paraPts(60); p.O = lerp(p.A, p.C, 0.5);
      var f = new Fig(p);
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'thin').seg('B', 'D', 'thin').names(['A', 'B', 'C', 'D']).name('O', 'O', 'D').side('A', 'O', k, false, 'B');
      return C('평행사변형의 대각선', '평행사변형 ABCD에서 AC의 길이는?', f.svg(), 2 * k, '', '평행사변형의 두 대각선은 서로 다른 것을 이등분해요.');
    },
    function rectDiag() {
      var k = rand(4, 15), f = new Fig(rectPts(5, 3));
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'thin').seg('B', 'D', 'thin').names(['A', 'B', 'C', 'D']).name('O', 'O', 'C').side('B', 'O', k, false, 'C').right('B', 'A', 'C');
      return C('직사각형의 대각선', '직사각형 ABCD에서 AC의 길이는?', f.svg(), 2 * k, '', '직사각형의 두 대각선은 길이가 같고 서로 다른 것을 이등분해요.');
    },
    function rhombusPerim() {
      var s = rand(3, 15), f = new Fig(rhombusTop(4, 2.6));
      f.poly(['A', 'B', 'C', 'D']).names(['A', 'B', 'C', 'D']).side('A', 'B', s).tick('A', 'B').tick('B', 'C').tick('C', 'D').tick('D', 'A');
      return C('마름모의 둘레', '마름모 ABCD의 둘레의 길이는?', f.svg(), 4 * s, '', '마름모는 네 변의 길이가 모두 같아요.');
    },
    function rhombusArea() {
      var d1 = rand(3, 8) * 2, d2 = rand(2, 7) * 2;
      if (d1 === d2) d1 += 2;
      var f = new Fig(rhombusTop(d1 / 2, d2 / 2));
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'dash').seg('B', 'D', 'dash').names(['A', 'B', 'C', 'D']).lab('B', 'D', 0.25, 'BD = ' + d1, false, 'A', 14).lab('A', 'C', 0.25, 'AC = ' + d2, false, 'D', 30);
      return C('마름모의 넓이', '마름모 ABCD의 넓이는?', f.svg(), d1 * d2 / 2, '', '마름모의 넓이 = (두 대각선의 곱) ÷ 2');
    },
    function rhombusDiagAngle() {
      var d = rand(5, 13) * 5, f = new Fig(rhombusTop(4, 4 * Math.tan(rad(d))));
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'thin').seg('B', 'D', 'thin').names(['A', 'B', 'C', 'D']).name('O', 'O', 'B').right('O', 'A', 'D').angle('B', 'A', 'O', d + '°').angle('A', 'B', 'O', 'x°', true);
      return C('마름모의 대각선과 각', '마름모 ABCD에서 x의 값은?', f.svg(), 90 - d, '°', '마름모의 두 대각선은 수직으로 만나요. 삼각형 ABO의 세 각의 합을 생각해 보세요.');
    },
    function rhombusHalf() {
      var a = rand(5, 14) * 10, f = new Fig(rhombusLeft(4, 4 * Math.tan(rad(a / 2))));
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'thin').names(['A', 'B', 'C', 'D']).angle('C', 'B', 'D', a + '°').angle('A', 'B', 'C', 'x°', true, 34);
      return C('마름모의 대각선과 내각', '마름모 ABCD에서 x의 값은?', f.svg(), a / 2, '°', '마름모의 마주 보는 각은 같고, 대각선은 그 각을 이등분해요.');
    },
    function rhombusSide() {
      var e = exprPair(), f = new Fig(rhombusTop(4, 2.6));
      f.poly(['A', 'B', 'C', 'D']).names(['A', 'B', 'C', 'D']).side('A', 'B', e.e1).side('B', 'C', e.e2);
      return C('마름모의 변', '마름모 ABCD에서 x의 값은?', f.svg(), e.x, '', '마름모는 네 변의 길이가 모두 같아요. 두 식을 같다고 놓아 보세요.');
    },
    function rectDiagExpr() {
      var e = exprPair(), f = new Fig(rectPts(5, 3));
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'thin').seg('B', 'D', 'thin').names(['A', 'B', 'C', 'D']).right('B', 'A', 'C')
        .lab('A', 'C', 0.22, 'AC = ' + e.e1, false, 'D', 16).lab('B', 'D', 0.22, 'BD = ' + e.e2, false, 'C', 16);
      return C('직사각형의 대각선 (식)', '직사각형 ABCD에서 x의 값은?', f.svg(), e.x, '', '직사각형의 두 대각선의 길이는 같아요.');
    },
    function rectIso() {
      var d = rand(5, 13) * 5, w = 5, f = new Fig(rectPts(w, w * Math.tan(rad(d))));
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'thin').seg('B', 'D', 'thin').seg('B', 'O', 'hl').seg('C', 'O', 'hl').names(['A', 'B', 'C', 'D']).name('O', 'O', 'A')
        .angle('B', 'C', 'O', d + '°', false, 34).angle('O', 'B', 'C', 'x°', true, 20);
      return C('직사각형의 대각선과 이등변삼각형', '직사각형 ABCD에서 x의 값은?', f.svg(), 180 - 2 * d, '°', '직사각형의 대각선은 길이가 같고 서로 이등분해요. 그래서 OB = OC예요.');
    },
    function rectDiagAngle() {
      var d = rand(5, 13) * 5, h = 4, f = new Fig(rectPts(h * Math.tan(rad(d)), h));
      f.poly(['A', 'B', 'C', 'D']).seg('B', 'D').names(['A', 'B', 'C', 'D']).angle('B', 'A', 'D', d + '°', false, 30).angle('B', 'D', 'C', 'x°', true, 48);
      return C('직사각형의 대각선과 각', '직사각형 ABCD에서 x의 값은?', f.svg(), 90 - d, '°', '직사각형의 한 내각은 90°예요.');
    },
    function squareDiag() {
      var k = rand(4, 15), f = new Fig(rectPts(4, 4));
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'thin').seg('B', 'D', 'thin').names(['A', 'B', 'C', 'D']).name('O', 'O', 'B').side('A', 'O', k, false, 'D').right('B', 'A', 'C');
      return C('정사각형의 대각선', '정사각형 ABCD에서 BD의 길이는?', f.svg(), 2 * k, '', '정사각형의 두 대각선은 길이가 같고 서로 이등분해요.');
    },
    function squareArea() {
      var d = rand(2, 10) * 2, f = new Fig(rectPts(4, 4));
      f.poly(['A', 'B', 'C', 'D']).seg('A', 'C', 'thin').names(['A', 'B', 'C', 'D']).lab('A', 'C', 0.5, 'AC = ' + d, false, 'B', 22).right('B', 'A', 'C');
      return C('정사각형의 넓이 (대각선)', '정사각형 ABCD의 넓이는?', f.svg(), d * d / 2, '', '정사각형은 마름모이기도 해요. 넓이 = (두 대각선의 곱) ÷ 2');
    },
    function squareSide() {
      var e = exprPair(), f = new Fig(rectPts(4, 4));
      f.poly(['A', 'B', 'C', 'D']).names(['A', 'B', 'C', 'D']).right('B', 'A', 'C').side('A', 'B', e.e1).side('B', 'C', e.e2);
      return C('정사각형의 변', '정사각형 ABCD에서 x의 값은?', f.svg(), e.x, '', '정사각형은 네 변의 길이가 모두 같아요.');
    }
  ],
  sim: [
    function simSide() {
      var r = pick(RATIOS), k = rand(2, 4), f = simPair(r);
      f.side('B', 'C', r[0] * k).side('E', 'F', 'x', true);
      return C('닮음비로 변의 길이', '△ABC ∽ △DEF이고 닮음비가 ' + r[0] + ' : ' + r[1] + '일 때 x의 값은?', f.svg(), r[1] * k, '', '닮음비가 같으면 대응변의 길이의 비도 같아요.');
    },
    function areaRatio() {
      var r = pick([[1, 2], [2, 3], [3, 4], [2, 5]]), k = rand(1, 4), f = simPair(r);
      f.note('A', '넓이 ' + r[0] * r[0] * k).note('D', '넓이 ?', true);
      return C('넓이의 비', '닮음비가 ' + r[0] + ' : ' + r[1] + '일 때, 큰 삼각형의 넓이는?', f.svg(), r[1] * r[1] * k, '', '넓이의 비 = 닮음비의 제곱');
    },
    function volRatio() {
      var r = pick([[1, 2], [1, 3], [2, 3]]), kmax = Math.floor(300 / (r[1] * r[1] * r[1])), k = rand(1, Math.max(1, kmax));
      return C('부피의 비', '닮음비가 ' + r[0] + ' : ' + r[1] + '인 두 정육면체에서 큰 정육면체의 부피는?', cubesFig(r, '부피 ' + r[0] * r[0] * r[0] * k), r[1] * r[1] * r[1] * k, '', '부피의 비 = 닮음비의 세제곱');
    },
    function parallel() {
      var ad = rand(2, 5), db = rand(2, 6), k = rand(2, 3), p = { A: [5, 7], B: [0, 0], C: [10, 0] }, t = ad / (ad + db);
      p.D = lerp(p.A, p.B, t); p.E = lerp(p.A, p.C, t);
      var f = new Fig(p);
      f.poly(['A', 'B', 'C']).seg('D', 'E', 'hl').names(['A', 'B', 'C']).name('D', 'D', 'E').name('E', 'E', 'D')
        .side('A', 'D', ad).side('D', 'B', db).side('A', 'E', ad * k).side('E', 'C', 'x', true);
      return C('평행선과 선분의 비', 'DE ∥ BC일 때 x의 값은?', f.svg(), db * k, '', 'AD : DB = AE : EC 예요.');
    },
    function midpoint() {
      var k = rand(3, 15), p = { A: [3.5, 6], B: [0, 0], C: [10, 0] };
      p.M = lerp(p.A, p.B, 0.5); p.N = lerp(p.A, p.C, 0.5);
      var f = new Fig(p), askBC = Math.random() < 0.4;
      f.poly(['A', 'B', 'C']).seg('M', 'N', 'hl').names(['A', 'B', 'C']).name('M', 'M', 'N').name('N', 'N', 'M').tick('A', 'M', 1).tick('M', 'B', 1).tick('A', 'N', 2).tick('N', 'C', 2);
      if (askBC) { f.lab('M', 'N', 0.5, k, false, 'A', 16).side('B', 'C', 'x', true); return C('중점연결 정리', '점 M, N이 각각 AB, AC의 중점일 때 x의 값은?', f.svg(), 2 * k, '', '중점을 이은 선분의 길이는 나머지 변의 절반이에요.'); }
      f.lab('M', 'N', 0.5, 'x', true, 'A', 16).side('B', 'C', 2 * k);
      return C('중점연결 정리', '점 M, N이 각각 AB, AC의 중점일 때 x의 값은?', f.svg(), k, '', '중점을 이은 선분의 길이는 나머지 변의 절반이에요.');
    },
    function centroid() {
      var k = rand(2, 10), p = { A: [3, 7], B: [0, 0], C: [10, 0] };
      p.D = lerp(p.B, p.C, 0.5); p.G = lerp(p.A, p.D, 2 / 3);
      var f = new Fig(p), askGD = Math.random() < 0.5;
      f.poly(['A', 'B', 'C']).seg('A', 'D', 'hl').dot('G').names(['A', 'B', 'C']).name('D', 'D', 'A').tick('B', 'D', 1).tick('D', 'C', 1).text(f.p.G[0] - 16, f.p.G[1], 'G', 'v');
      if (askGD) { f.lab('A', 'G', 0.5, 2 * k, false, 'C', 16).lab('G', 'D', 0.5, 'x', true, 'C', 16); return C('무게중심', '점 G가 △ABC의 무게중심일 때 x의 값은?', f.svg(), k, '', '무게중심은 중선을 꼭짓점으로부터 2 : 1로 나눠요.'); }
      f.lab('A', 'G', 0.5, 'x', true, 'C', 16).lab('G', 'D', 0.5, k, false, 'C', 16);
      return C('무게중심', '점 G가 △ABC의 무게중심일 때 x의 값은?', f.svg(), 2 * k, '', '무게중심은 중선을 꼭짓점으로부터 2 : 1로 나눠요.');
    },
    function simAngle() {
      var a = rand(7, 16) * 5, b = rand(7, 16) * 5;
      while (a + b > 145) b -= 10;
      var p = triByAngles(a, b, 4, 0), q = triByAngles(a, b, 6, 5.5);
      var f = new Fig({ A: p.A, B: p.B, C: p.C, D: q.A, E: q.B, F: q.C });
      f.poly(['A', 'B', 'C']).poly(['D', 'E', 'F']).name('A', 'A', 'B').name('B', 'B', 'C').name('C', 'C', 'A').name('D', 'D', 'E').name('E', 'E', 'F').name('F', 'F', 'D')
        .angle('A', 'B', 'C', a + '°', false, 20).angle('E', 'F', 'D', b + '°', false, 24).angle('F', 'D', 'E', 'x°', true, 24);
      return C('닮은 삼각형의 대응각', '△ABC ∽ △DEF일 때 x의 값은?', f.svg(), 180 - a - b, '°', '대응각의 크기는 같아요. ∠D = ∠A예요. 삼각형의 세 각의 합은 180°.');
    },
    function simPerim() {
      var r = pick(RATIOS), k = rand(2, 3), j = rand(3, 8), f = simPair(r);
      f.side('A', 'B', r[0] * k).side('D', 'E', r[1] * k).note('A', '둘레 ' + r[0] * j).note('D', '둘레 ?', true);
      return C('닮은 삼각형의 둘레', '△ABC ∽ △DEF일 때, △DEF의 둘레의 길이는?', f.svg(), r[1] * j, '', '둘레의 비도 닮음비와 같아요. 먼저 AB와 DE로 닮음비를 구해 보세요.');
    },
    function areaToSide() {
      var r = pick([[1, 2], [2, 3], [3, 4], [2, 5]]), k = rand(1, 3), j = rand(2, 4), f = simPair(r);
      f.note('A', '넓이 ' + r[0] * r[0] * k).note('D', '넓이 ' + r[1] * r[1] * k).side('B', 'C', r[0] * j).side('E', 'F', 'x', true);
      return C('넓이의 비로 변의 길이', '△ABC ∽ △DEF일 때 x의 값은?', f.svg(), r[1] * j, '', '넓이의 비가 a² : b²이면 닮음비는 a : b예요.');
    },
    function overlapAA() {
      var ab, ad, ae, ac, tries = 0;
      do {
        ab = rand(6, 12); ad = rand(Math.ceil(ab * 0.35), ab - 2);
        var P = ad * ab, cands = [];
        for (var e = 2; e < 16; e++) if (P % e === 0) { var c = P / e; if (c >= e + 2 && c <= 16 && c !== ab && e >= c * 0.3) cands.push(e); }
        ae = cands.length ? pick(cands) : 0; ac = ae ? P / ae : 0; tries++;
      } while (!ae && tries < 200);
      var alpha = rand(55, 75), p = triFromA(alpha, ab, ac);
      p.D = lerp(p.A, p.B, ad / ab); p.E = lerp(p.A, p.C, ae / ac);
      var f = new Fig(p);
      f.poly(['A', 'B', 'C']).seg('D', 'E', 'hl').names(['A', 'B', 'C']).name('D', 'D', 'E').name('E', 'E', 'D')
        .angle('D', 'A', 'E', '', false, 18).angle('C', 'A', 'B', '', false, 18)
        .side('A', 'D', ad).side('D', 'B', 'x', true).side('A', 'E', ae).side('E', 'C', ac - ae);
      return C('겹친 삼각형 (AA 닮음)', '∠ADE = ∠ACB일 때 x의 값은?', f.svg(), ab - ad, '', '△ADE ∽ △ACB (AA 닮음)이에요. AD : AC = AE : AB');
    },
    function overlapSAS() {
      var r = pick([[1, 2], [2, 3], [1, 3]]), ab, ac, ad, ae, tries = 0;
      do { ab = r[1] * rand(2, 5); ac = r[1] * rand(2, 5); ad = ac / r[1] * r[0]; ae = ab / r[1] * r[0]; tries++; } while ((ab - ad < 2 || ac - ae < 2 || ab === ac) && tries < 500);
      var bc = r[1] * rand(2, 5), alpha = rand(50, 70), p = triFromA(alpha, ab, ac);
      p.D = lerp(p.A, p.B, ad / ab); p.E = lerp(p.A, p.C, ae / ac);
      var f = new Fig(p);
      f.poly(['A', 'B', 'C']).seg('D', 'E', 'hl').names(['A', 'B', 'C']).name('D', 'D', 'E').name('E', 'E', 'D')
        .side('A', 'D', ad).side('D', 'B', ab - ad).side('A', 'E', ae).side('E', 'C', ac - ae).lab('D', 'E', 0.5, bc / r[1] * r[0], false, 'A', 14).side('B', 'C', 'x', true);
      return C('겹친 삼각형 (SAS 닮음)', 'x의 값은?', f.svg(), bc, '', '∠A가 공통이고 AD : AC = AE : AB예요. △ADE ∽ △ACB (SAS 닮음)');
    },
    function rightAltitude() {
      var pr = pick([[1, 4], [4, 9], [2, 8], [3, 12], [4, 16], [9, 16]]), bd = pr[0], dc = pr[1], h = Math.round(Math.sqrt(bd * dc));
      var f = new Fig({ A: [bd, h], B: [0, 0], C: [bd + dc, 0], D: [bd, 0] });
      f.poly(['A', 'B', 'C']).seg('A', 'D', 'hl').names(['A', 'B', 'C']).name('D', 'D', 'A').right('A', 'B', 'C').right('D', 'A', 'C')
        .side('B', 'D', bd, false, 'A').side('D', 'C', dc, false, 'A').lab('A', 'D', 0.5, 'x', true, 'B', 14);
      return C('직각삼각형의 닮음', '∠A = 90°, AD ⊥ BC일 때 x의 값은?', f.svg(), h, '', '△DBA ∽ △DAC예요. 그래서 AD² = BD × DC');
    }
  ],
  pyth: [
    function hyp() {
      var t = scaledTriple(50), a = t[0], b = t[1]; if (Math.random() < 0.5) { a = t[1]; b = t[0]; }
      var f = new Fig(rightTri(a, b));
      f.poly(['A', 'B', 'C']).right('B', 'A', 'C').side('A', 'B', a).side('B', 'C', b).side('A', 'C', 'x', true);
      return C('빗변 구하기', 'x의 값은?', f.svg(), t[2], '', '빗변² = 나머지 두 변의 제곱의 합');
    },
    function leg() {
      var t = scaledTriple(50), a = t[0], b = t[1]; if (Math.random() < 0.5) { a = t[1]; b = t[0]; }
      var f = new Fig(rightTri(a, b));
      f.poly(['A', 'B', 'C']).right('B', 'A', 'C').side('A', 'B', 'x', true).side('B', 'C', b).side('A', 'C', t[2]);
      return C('나머지 변 구하기', 'x의 값은?', f.svg(), a, '', '(나머지 변)² = 빗변² − (아는 변)²');
    },
    function rectDiagPyth() {
      var t = scaledTriple(50), f = new Fig(rectPts(t[1], t[0]));
      f.poly(['A', 'B', 'C', 'D']).seg('B', 'D').names(['A', 'B', 'C', 'D']).right('B', 'A', 'C').side('A', 'B', t[0]).side('B', 'C', t[1]).lab('B', 'D', 0.5, 'x', true, 'C', 16);
      return C('직사각형의 대각선', '직사각형 ABCD에서 대각선 BD의 길이 x는?', f.svg(), t[2], '', '대각선은 가로·세로를 두 변으로 하는 직각삼각형의 빗변이에요.');
    },
    function rightArea() {
      var t = scaledTriple(30), f = new Fig(rightTri(t[0], t[1]));
      f.poly(['A', 'B', 'C']).right('B', 'A', 'C').side('B', 'C', t[1]).side('A', 'C', t[2]).inside(['A', 'B', 'C'], '?', true);
      return C('직각삼각형의 넓이', '직각삼각형의 넓이는?', f.svg(), t[0] * t[1] / 2, '', '먼저 피타고라스 정리로 나머지 한 변을 구해 보세요.');
    },
    function squaresArea() {
      var t = pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]]), a = t[0], b = t[1];
      var p = { A: [0, a], B: [0, 0], C: [b, 0] };
      p.P1 = [-a, a]; p.P2 = [-a, 0];                    // AB 위 정사각형 (왼쪽)
      p.Q1 = [0, -b]; p.Q2 = [b, -b];                    // BC 위 정사각형 (아래)
      var u = norm([a, b]);                              // AC에 수직, 바깥쪽
      var c = t[2]; p.R1 = [b + u[0] * c, u[1] * c]; p.R2 = [u[0] * c, a + u[1] * c];
      var f = new Fig(p), askHyp = Math.random() < 0.6;
      f.poly(['A', 'B', 'P2', 'P1'], 'fill="#eeedfe" stroke="#1f2140" stroke-width="2"').poly(['B', 'C', 'Q2', 'Q1'], 'fill="#eeedfe" stroke="#1f2140" stroke-width="2"')
        .poly(['A', 'C', 'R1', 'R2'], 'fill="#faeeda" stroke="#1f2140" stroke-width="2"').poly(['A', 'B', 'C']).right('B', 'A', 'C');
      if (askHyp) { f.inside(['A', 'B', 'P2', 'P1'], a * a).inside(['B', 'C', 'Q2', 'Q1'], b * b).inside(['A', 'C', 'R1', 'R2'], '?', true); return C('정사각형 넓이로 보기', '빗변 위 정사각형의 넓이는?', f.svg(), c * c, '', '빗변 위 정사각형의 넓이 = 나머지 두 정사각형의 넓이의 합'); }
      f.inside(['A', 'B', 'P2', 'P1'], '?', true).inside(['B', 'C', 'Q2', 'Q1'], b * b).inside(['A', 'C', 'R1', 'R2'], c * c);
      return C('정사각형 넓이로 보기', '?에 알맞은 정사각형의 넓이는?', f.svg(), a * a, '', '빗변 위 정사각형의 넓이 = 나머지 두 정사각형의 넓이의 합');
    }
  ]
};
// 피타고라스 수 암기 (피타고라스 게임에서 판마다 1문제)
function tripleRecall() {
  var t = pick(TRIPLES), miss = rand(0, 2), lab = t.map(function (v, i) { return i === miss ? '?' : v; });
  var f = new Fig(rightTri(t[0], t[1]));
  f.poly(['A', 'B', 'C']).right('B', 'A', 'C').side('A', 'B', lab[0], miss === 0).side('B', 'C', lab[1], miss === 1).side('A', 'C', lab[2], miss === 2);
  return C('피타고라스 수 암기', '?에 알맞은 수는?', f.svg(), t[miss], '', '자주 나오는 피타고라스 수: (3,4,5) (5,12,13) (8,15,17) (7,24,25)');
}
// 닮은 두 삼각형 (같은 모양, 크기만 비율대로)
function simPair(r) {
  var p = triByAngles(62, 58, r[0], 0), q = triByAngles(62, 58, r[1], r[0] + 0.8);
  var f = new Fig({ A: p.A, B: p.B, C: p.C, D: q.A, E: q.B, F: q.C });
  f.poly(['A', 'B', 'C']).poly(['D', 'E', 'F']).name('A', 'A', 'B').name('B', 'B', 'C').name('C', 'C', 'A').name('D', 'D', 'E').name('E', 'E', 'F').name('F', 'F', 'D');
  f.side = function (a, b, text, isX) { return Fig.prototype.side.call(this, a, b, text, isX, third(a, b)); };
  // 넓이·둘레는 삼각형 위쪽에 표시 (작은 삼각형 안에는 글자가 안 들어가서)
  f.note = function (apex, text, isX) { var P = this.p[apex]; return this.text(P[0], P[1] - 38, text, isX ? 'x' : 'in'); };
  return f;
}
function third(a, b) {   // 같은 삼각형의 나머지 꼭짓점 (글자를 바깥쪽으로 보내려고)
  var tri = 'ABC'.indexOf(a) > -1 ? 'ABC' : 'DEF';
  return tri.replace(a, '').replace(b, '');
}
// 정육면체 두 개
function cubesFig(r, smallLabel) {
  var s1 = r[0], s2 = r[1], gap = 0.9, o = 0.38;
  var p = {
    a1: [0, 0], a2: [s1, 0], a3: [s1, s1], a4: [0, s1], a5: [s1 * o, s1 * (1 + o)], a6: [s1 * (1 + o), s1 * (1 + o)], a7: [s1 * (1 + o), s1 * o],
    b1: [s1 * (1 + o) + gap, 0], b2: [s1 * (1 + o) + gap + s2, 0], b3: [s1 * (1 + o) + gap + s2, s2], b4: [s1 * (1 + o) + gap, s2],
    b5: [s1 * (1 + o) + gap + s2 * o, s2 * (1 + o)], b6: [s1 * (1 + o) + gap + s2 * (1 + o), s2 * (1 + o)], b7: [s1 * (1 + o) + gap + s2 * (1 + o), s2 * o],
    l1: [s1 / 2, -0.5], l2: [s1 * (1 + o) + gap + s2 / 2, -0.5]
  };
  var f = new Fig(p), face = 'fill="#eeedfe" stroke="#1f2140" stroke-width="2" stroke-linejoin="round"', top = 'fill="#ffffff" stroke="#1f2140" stroke-width="2" stroke-linejoin="round"';
  f.poly(['a1', 'a2', 'a3', 'a4'], face).poly(['a4', 'a3', 'a6', 'a5'], top).poly(['a2', 'a7', 'a6', 'a3'], top);
  f.poly(['b1', 'b2', 'b3', 'b4'], face).poly(['b4', 'b3', 'b6', 'b5'], top).poly(['b2', 'b7', 'b6', 'b3'], top);
  f.text(f.p.l1[0], f.p.l1[1], smallLabel, 'in').text(f.p.l2[0], f.p.l2[1], '부피 ?', 'x');
  return f.svg();
}

// ---------- 개념 문제 (문제은행) ----------
function conceptFrom(row) {
  var ox = row[1] === 'O/X';
  var p = { kind: ox ? 'ox' : 'mc', type: row[0], q: row[2], hint: row[8] };
  if (ox) p.ans = row[7];
  else { p.options = [row[3], row[4], row[5], row[6]]; p.ans = row[3]; p.shown = shuffle(p.options); }
  return p;
}

// 한 판 10문제 만들기
function buildSet(gameId) {
  var list = [];
  GAME_PLAN[gameId].forEach(function (part) {
    var unit = part[0];
    shuffle(CONCEPT_BANK[unit]).slice(0, part[1]).forEach(function (row) { var p = conceptFrom(row); p.area = unit; list.push(p); });
    var gens = [];
    while (gens.length < part[2]) gens = gens.concat(shuffle(CALC[unit]));   // 유형이 겹치지 않게, 모자라면 한 바퀴 더
    gens.slice(0, part[2]).forEach(function (g) { var p = g(); p.area = unit; list.push(p); });
  });
  if (gameId === 'pyth') { var t = tripleRecall(); t.area = 'pyth'; list.push(t); }
  return shuffle(list);
}

// ---------- 게임 진행 ----------
var game = null, tick = null;

function startGame(gameId, reviewList) {
  game = {
    id: gameId, review: !!reviewList,
    list: reviewList ? reviewList.map(function (p) { return Object.assign({}, p, { shown: p.options ? shuffle(p.options) : null }); }) : buildSet(gameId),
    i: 0, score: 0, stars: 0, wrong: [], results: [], left: TIME_LIMIT, ended: false
  };
  show('play');
  $('p-time').parentNode.style.visibility = game.review ? 'hidden' : 'visible';
  $('p-tbar').parentNode.style.visibility = game.review ? 'hidden' : 'visible';
  clearInterval(tick);
  if (!game.review) {
    var start = Date.now();
    tick = setInterval(function () {
      game.left = Math.max(0, TIME_LIMIT - (Date.now() - start) / 1000);
      $('p-time').textContent = Math.ceil(game.left);
      $('p-tbar').style.width = (game.left / TIME_LIMIT * 100) + '%';
      $('p-tbar').classList.toggle('low', game.left < 15);
      if (game.left <= 0) { clearInterval(tick); endGame(true); }
    }, 100);
  }
  showQuestion();
}

function showQuestion() {
  var p = game.list[game.i];
  game.tries = 0; game.qStart = Date.now(); game.locked = false; game.input = '';
  $('p-count').textContent = (game.i + 1) + ' / ' + game.list.length + (game.review ? ' · 다시 풀기' : '');
  $('p-score').textContent = game.score;
  $('p-type').textContent = p.type + (p.kind === 'ox' ? ' · O/X (기회 1번)' : '');
  $('p-q').textContent = p.q;
  $('p-fig').innerHTML = p.fig || '';
  $('p-fig').style.display = p.fig ? 'flex' : 'none';
  $('p-hint').textContent = ''; $('p-hint').classList.remove('show');
  updateQStars();

  var box = $('p-answer');
  if (p.kind === 'calc') {
    var v = p.q.indexOf('x') > -1 ? 'x' : (p.q.indexOf('?에') === 0 ? '?' : '답');
    box.innerHTML = '<div class="ans-line">' + v + ' = <span class="ans-box" id="ans-box"></span>' + (p.unit ? '<span>' + p.unit + '</span>' : '') + '</div>' +
      '<div class="keypad" id="keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button data-k="' + n + '">' + n + '</button>'; }).join('') +
      '<button data-k="del">지움</button><button data-k="0">0</button><button data-k="ok" class="ok">확인</button></div>';
  } else if (p.kind === 'mc') {
    box.innerHTML = '<div class="choices" id="choices"></div>';
    p.shown.forEach(function (o) { var b = document.createElement('button'); b.textContent = o; b.dataset.c = o; $('choices').appendChild(b); });
  } else {
    box.innerHTML = '<div class="choices ox" id="choices"><button data-c="O" style="color:#1d9e75">O</button><button data-c="X" style="color:#e24b4a">X</button></div>';
  }
}

function currentStars() { return 5 - game.tries; }   // 1번째 5개, 2번째 4개, 3번째 3개
function updateQStars() {
  var p = game.list[game.i];
  $('p-stars').innerHTML = game.review ? '' : starStr(p.kind === 'ox' ? 5 : currentStars()) + (game.tries ? ' <small style="font-size:14px;color:#5f5e7a">' + (game.tries + 1) + '번째 도전</small>' : '');
}

$('p-answer').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b || game.locked) return;
  var p = game.list[game.i];
  if (b.dataset.k) {
    pressKey(b.dataset.k, b);
  } else if (b.dataset.c) {
    if (b.classList.contains('dim')) return;
    judge(b.dataset.c === String(p.ans), b);
  }
});

// 숫자 입력 (화면 키패드와 키보드가 같이 씀)
function pressKey(k, btn) {
  var p = game.list[game.i];
  if (k === 'del') game.input = game.input.slice(0, -1);
  else if (k === 'ok') { if (game.input) judge(String(Number(game.input)) === String(p.ans), btn); }
  else if (game.input.length < 4) game.input += k;
  if ($('ans-box')) $('ans-box').textContent = game.input;
}
// 키보드: 숫자 키, Backspace(지움), Enter(확인)
document.addEventListener('keydown', function (e) {
  if (!game || game.ended || game.locked || !$('s-play').classList.contains('active')) return;
  if (game.list[game.i].kind !== 'calc') return;
  var k = null;
  if (/^[0-9]$/.test(e.key)) k = e.key;
  else if (e.key === 'Backspace' || e.key === 'Delete') k = 'del';
  else if (e.key === 'Enter') k = 'ok';
  if (k === null) return;
  e.preventDefault();
  pressKey(k, document.querySelector('[data-k="' + k + '"]'));
});

function judge(ok, btn) {
  var p = game.list[game.i];
  // 교사용 시트: 첫 도전에 맞혔는지만 기록
  if (game.tries === 0 && !game.review) game.results.push({ t: p.type, u: p.area, ok: ok ? 1 : 0 });
  if (ok) {
    var sec = (Date.now() - game.qStart) / 1000;
    var mult = sec <= 2 ? 4 : (sec <= 3 ? 2 : 1);
    var st = p.kind === 'ox' ? 5 : currentStars();
    if (game.review) { mult = 1; st = 0; }
    game.stars += st; game.score += st * mult;
    playPop();
    if (btn && btn.dataset.c) btn.classList.add('right');
    popup(true, st, mult, sec);
    return;
  }
  // 틀림
  playBuzz();
  game.tries++;
  var maxTries = p.kind === 'ox' ? 1 : 3;
  if (btn && btn.dataset.c) { btn.classList.add('wrong', 'dim'); }
  else { $('keypad').classList.remove('wrong'); void $('keypad').offsetWidth; $('keypad').classList.add('wrong'); game.input = ''; $('ans-box').textContent = ''; }
  if (game.tries >= maxTries) {
    if (!game.review) game.wrong.push(p);
    popup(false);
    return;
  }
  if (game.tries >= 2 && p.hint) { $('p-hint').textContent = '힌트: ' + p.hint; $('p-hint').classList.add('show'); }
  updateQStars();
}

function popup(ok, st, mult, sec) {
  var p = game.list[game.i];
  game.locked = true;
  var pop = $('p-pop');
  if (ok) {
    pop.innerHTML = '<div class="bubble"><div class="eat">' + myChar(true) + '<span class="flystar">★</span></div>' +
      '<div class="big">' + (game.review ? '정답!' : '+★' + st) + '</div>' +
      (game.review ? '' : '<div class="mult">' + sec.toFixed(1) + '초' + (mult > 1 ? ' · 점수 ' + mult + '배!' : '') + ' → +' + (st * mult) + '점</div>') + '</div>';
  } else {
    pop.innerHTML = '<div class="bubble bad"><div class="big"></div><div class="mult" style="color:#f7c1c1">별 0개 · 다음 문제로!</div></div>';
    pop.querySelector('.big').textContent = '정답은 ' + p.ans + (p.unit || '');
  }
  pop.classList.add('show');
  var g = game;
  setTimeout(function () {
    if (g !== game || g.ended) return;   // 그사이 판이 끝났거나 새 판이 시작됨
    pop.classList.remove('show');
    game.i++;
    if (game.i >= game.list.length) endGame(false); else showQuestion();
  }, ok ? 1100 : 1600);
}

function endGame(timeUp) {
  if (game.ended) return;
  game.ended = true;
  clearInterval(tick);
  $('p-pop').classList.remove('show');
  if (game.review) { show('home'); return; }
  // 시간이 끝나 못 푼 문제는 오답 다시 풀기에 포함
  for (var j = game.i; j < game.list.length; j++) game.wrong.push(game.list[j]);

  var id = game.id;
  var prevBest = state.best[id] || 0, newBest = game.score > prevBest;
  if (!state.today || state.today.date !== todayStr()) state.today = { date: todayStr(), best: {} };   // 날이 바뀌면 오늘 기준 초기화
  var prevToday = state.today.best[id] || 0;
  var earn = Math.max(0, game.stars - prevToday);

  $('r-char').innerHTML = myChar(earn > 0);
  $('r-title').textContent = timeUp ? '시간 끝!' : '판 끝!';
  $('r-score').textContent = game.score;
  $('r-stars').textContent = game.stars;
  $('r-best').textContent = newBest ? '🎉 최고 기록 갱신! (이전 ' + prevBest + '점)' : '내 최고 기록: ' + prevBest + '점';
  $('btn-review').style.display = game.wrong.length ? '' : 'none';
  $('btn-review').textContent = '틀린 문제 다시 풀기 (' + game.wrong.length + ')';
  show('result');

  if (ONLINE) { sendResult(prevToday); return; }

  state.today.best[id] = Math.max(prevToday, game.stars);
  state.money += earn;
  state.plays[id] = (state.plays[id] || 0) + 1;
  if (newBest) state.best[id] = game.score;
  saveStore();
  showEarn(earn, prevToday);
}
function showEarn(earn, prevToday) {
  $('r-earn').textContent = '+' + earn;
  $('r-earn-note').textContent = prevToday === 0 ? '오늘 이 행성 첫 판이라 받은 별이 전부 돈이 됐어요.' :
    (earn > 0 ? '오늘 최고 ' + prevToday + '개보다 ' + earn + '개 늘어서 그만큼 돈이 됐어요.' : '오늘 최고 ' + prevToday + '개를 넘어야 돈이 늘어요.');
}
// 시트로 결과 보내기 (번 별은 시트가 계산해서 알려 줌)
function sendResult(prevToday) {
  var item = Object.assign(authData(), {
    game: game.id, score: game.score, stars: game.stars, details: game.results,
    playedAt: Date.now(), clientId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  });
  $('r-earn').textContent = '…';
  $('r-earn-note').textContent = '구글 시트에 기록하는 중이에요.';
  api('result', item).then(function (res) {
    if (!res.ok) {
      $('r-earn').textContent = '+0';
      $('r-earn-note').textContent = '이 기록은 저장되지 않았어요: ' + (res.error || '');
      return;
    }
    applyProfile(res.profile);
    showEarn(res.earn, prevToday);
    refreshMoney();
    flushQueue();
  }).catch(function () {
    var q = loadQueue(); q.push(item); saveQueue(q);
    $('r-earn').textContent = '보관';
    $('r-earn-note').textContent = '인터넷이 끊겨서 기록을 기기에 잠시 보관했어요. 연결되면 자동으로 보내고 별도 그때 들어와요.';
    refreshMoney();
  });
}
$('btn-review').addEventListener('click', function () { startGame(game.id, game.wrong); });
$('btn-again').addEventListener('click', function () { startGame(game.id); });

// ---------- 로그인 ----------
function fillClassNum(classes, maxNum) {
  var c = '', n = '';
  classes.forEach(function (i) { c += '<option value="' + i + '">2학년 ' + i + '반</option>'; });
  for (var j = 1; j <= maxNum; j++) n += '<option value="' + j + '">' + j + '번</option>';
  $('in-class').innerHTML = c; $('in-num').innerHTML = n;
}
(function initLogin() {
  fillClassNum([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 30);
  $('login-char').innerHTML = myChar(false);
  if (!ONLINE) return;
  setBadge('구글 시트에 연결하는 중…');
  // 시트 설정(반 목록)과 문제은행 불러오기. 실패하면 게임 안 문제로 진행
  api('config').then(function (res) { if (res.ok) fillClassNum(res.classes, res.maxNum); setBadge(res.ok ? '구글 시트에 연결됨' : '시트 연결 오류'); })
    .catch(function () { setBadge('인터넷 연결을 확인하세요'); });
  api('bank').then(function (res) {
    if (!res.ok) return;
    Object.keys(res.bank).forEach(function (u) { if (res.bank[u].length >= 5) CONCEPT_BANK[u] = res.bank[u]; });
  }).catch(function () {});
  flushQueue();
})();
$('btn-login').addEventListener('click', function () {
  var pw = $('in-pw').value, nick = $('in-nick').value.trim();
  var cls = Number($('in-class').value), num = Number($('in-num').value), key = cls + '-' + num;
  if (!/^\d{4}$/.test(pw)) { $('login-err').textContent = '비밀번호를 숫자 4자리로 입력하세요.'; return; }
  if (!nick) { $('login-err').textContent = '닉네임을 입력하세요.'; return; }
  if (ONLINE) {
    var btn = $('btn-login'); btn.disabled = true; $('login-err').textContent = '확인하는 중…';
    api('login', { cls: cls, num: num, pw: pw, nick: nick }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { $('login-err').textContent = res.error; return; }
      state = { cls: cls, num: num, pw: pw };
      applyProfile(res.profile);
      $('login-err').textContent = '';
      refreshMoney();
      show('home');
      flushQueue();
    }).catch(function () { btn.disabled = false; $('login-err').textContent = '인터넷 연결을 확인하고 다시 눌러 주세요.'; });
    return;
  }
  var prof = store.profiles[key];
  if (prof && prof.pw !== pw) { $('login-err').textContent = '비밀번호가 달라요. 잊었으면 선생님께 말씀드리세요.'; return; }
  if (!prof) prof = store.profiles[key] = newProfile(cls, num, pw, nick);
  prof.nick = nick;
  state = prof; saveStore();
  $('login-err').textContent = '';
  show('home');
});
document.addEventListener('input', function (e) { if (e.target.id === 'in-pw' || e.target.id === 'in-nick') $('login-err').textContent = ''; });

// ---------- 게임 선택 ----------
function renderHome() {
  $('home-nick').textContent = state.nick + ' · ' + state.cls + '반';
  $('home-money').textContent = state.money;
  $('home-char').innerHTML = myChar(false);
  $('home-big-char').innerHTML = myChar(false);
  $('planets').innerHTML = GAMES.map(function (g) {
    var b = state.best[g.id];
    return '<button class="planet' + (g.id === 'mix' ? ' mix' : '') + '" data-game="' + g.id + '"><span class="orb" style="background:' + g.color + '"></span><b>' + g.name + '</b><small>' + (b != null ? '최고 ' + b + '점' : '미도전') + '</small></button>';
  }).join('');
}
$('planets').addEventListener('click', function (e) { var b = e.target.closest('[data-game]'); if (b) startGame(b.dataset.game); });
document.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) show(b.dataset.go); });

// ---------- 상점 ----------
function renderShop() {
  $('shop-money').textContent = state.money;
  $('shop-char').innerHTML = myChar(false);
  $('shop-nick').textContent = state.nick;
  $('shop-shapes').innerHTML = SHAPES.map(function (s) {
    var own = state.owned[s.id];
    return '<button class="item' + (state.shape === s.id ? ' sel' : '') + (!own && state.money < s.price ? ' poor' : '') + '" data-shape="' + s.id + '"><span class="thumb">' + charSVG(s.id, state.color, {}) + '</span>' + s.name +
      (own ? (s.price ? '<span class="owned">보유</span>' : '<span class="owned">무료</span>') : '<span class="price">★ ' + s.price + '</span>') + '</button>';
  }).join('');
  $('shop-colors').innerHTML = COLORS.map(function (c) { return '<button style="background:' + c + '" class="' + (state.color === c ? 'sel' : '') + '" data-color="' + c + '" aria-label="색"></button>'; }).join('');
  $('shop-accs').innerHTML = ACCS.map(function (a) {
    var own = state.owned[a.id], on = state.wear[a.slot] === a.id, w = {}; w[a.slot] = a.id;
    var slotName = { head: '머리', face: '얼굴', body: '몸' }[a.slot];
    return '<button class="item' + (on ? ' sel' : '') + (!own && state.money < a.price ? ' poor' : '') + '" data-acc="' + a.id + '"><span class="thumb">' + charSVG('circle', '#534AB7', w) + '</span>' + a.name +
      (on ? '<span class="owned">착용 중</span>' : own ? '<span class="owned">보유 · ' + slotName + '</span>' : '<span class="price">★ ' + a.price + (state.money < a.price ? ' · 별 부족' : '') + '</span>') + '</button>';
  }).join('');
}
$('s-shop').addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  if (ONLINE) { shopOnline(b); return; }
  if (b.dataset.color) state.color = b.dataset.color;
  if (b.dataset.shape) {
    var s = SHAPES.filter(function (x) { return x.id === b.dataset.shape; })[0];
    if (!state.owned[s.id]) { if (state.money < s.price) return; if (!confirm(s.name + ' 모양을 별 ' + s.price + '개로 살까요?')) return; state.money -= s.price; state.owned[s.id] = 1; }
    state.shape = s.id;
  }
  if (b.dataset.acc) {
    var a = ACCS.filter(function (x) { return x.id === b.dataset.acc; })[0];
    if (!state.owned[a.id]) { if (state.money < a.price) return; if (!confirm(a.name + '을(를) 별 ' + a.price + '개로 살까요?')) return; state.money -= a.price; state.owned[a.id] = 1; }
    state.wear[a.slot] = state.wear[a.slot] === a.id ? null : a.id;   // 다시 누르면 벗기
  }
  saveStore();
  renderShop();
});
// 시트 연결 시: 사기·입기는 시트가 확인하고 저장
var shopBusy = false;
function shopOnline(b) {
  if (shopBusy || !(b.dataset.color || b.dataset.shape || b.dataset.acc)) return;
  var req = Object.assign(authData(), { shape: state.shape, color: state.color, wear: Object.assign({}, state.wear), buy: [] });
  if (b.dataset.color) req.color = b.dataset.color;
  if (b.dataset.shape) {
    var s = SHAPES.filter(function (x) { return x.id === b.dataset.shape; })[0];
    if (!state.owned[s.id]) { if (state.money < s.price) return; if (!confirm(s.name + ' 모양을 별 ' + s.price + '개로 살까요?')) return; req.buy.push(s.id); }
    req.shape = s.id;
  }
  if (b.dataset.acc) {
    var a = ACCS.filter(function (x) { return x.id === b.dataset.acc; })[0];
    if (!state.owned[a.id]) { if (state.money < a.price) return; if (!confirm(a.name + '을(를) 별 ' + a.price + '개로 살까요?')) return; req.buy.push(a.id); }
    req.wear[a.slot] = state.wear[a.slot] === a.id ? null : a.id;
  }
  shopBusy = true;
  api('save', req).then(function (res) {
    shopBusy = false;
    if (!res.ok) { alert(res.error || '저장하지 못했어요.'); return; }
    applyProfile(res.profile); renderShop();
  }).catch(function () { shopBusy = false; alert('인터넷 연결을 확인하세요. 상점은 연결되어 있을 때만 쓸 수 있어요.'); });
}

// ---------- 순위표 (1단계: 이 기기에서 한 기록만) ----------
var rankTab = 'class', rankGame = 'quad';
function renderRank() {
  $('rank-games').innerHTML = GAMES.map(function (g) { return '<button data-rg="' + g.id + '" class="' + (rankGame === g.id ? 'on' : '') + '">' + g.name + '</button>'; }).join('');
  if (ONLINE) { renderRankOnline(); return; }
  var all = Object.keys(store.profiles).map(function (k) { return store.profiles[k]; });
  var sc = function (r) { return r.best[rankGame] || 0; };
  var note = '<p class="r-note">지금은 이 기기에서 한 기록만 보여요. 구글 시트를 연결하면 반·학교 전체 순위가 보여요.</p>';
  var html = '';
  if (rankTab === 'vs') {
    var by = {};
    all.forEach(function (r) { (by[r.cls] = by[r.cls] || []).push(sc(r)); });
    var avg = Object.keys(by).map(function (c) { return { cls: Number(c), v: Math.round(by[c].reduce(function (s, v) { return s + v; }, 0) / by[c].length) }; });
    avg.sort(function (a, b) { return b.v - a.v; });
    var max = Math.max(1, avg.length ? avg[0].v : 1);
    html = avg.map(function (a, i) {
      return '<div class="rrow' + (i === 0 ? ' top1' : '') + '" style="' + (a.cls === state.cls ? 'border:1px solid #fac775' : '') + '"><span class="no">' + (i + 1) + '</span><span>' + a.cls + '반</span><span class="bar" style="width:' + (a.v / max * 100) + '%"></span><span class="sc">평균 ' + a.v + '</span></div>';
    }).join('');
    var mine = avg.filter(function (a) { return a.cls === state.cls; })[0];
    $('rank-me').innerHTML = '우리 반(' + state.cls + '반)은 ' + (avg.indexOf(mine) + 1) + '등 · 평균 ' + mine.v + '점';
  } else {
    var pool = all.filter(function (r) { return rankTab === 'school' || r.cls === state.cls; });
    pool.sort(function (a, b) { return sc(b) - sc(a); });
    html = pool.slice(0, 10).map(function (r, i) {
      var row = document.createElement('div'); row.textContent = r.nick;
      return '<div class="rrow' + (i === 0 ? ' top1' : '') + '"><span class="no">' + (i + 1) + '</span><span class="mini-char">' + charSVG(r.shape, r.color, r.wear) + '</span><span>' + row.innerHTML + (r === state ? ' (나)' : '') + '</span><span class="sc">' + sc(r) + '점</span></div>';
    }).join('');
    $('rank-me').innerHTML = '내 순위: <b>' + (pool.indexOf(state) + 1) + '등</b> / ' + pool.length + '명 · 최고 ' + sc(state) + '점' + (sc(state) ? '' : ' (아직 이 행성에 도전 안 함)');
  }
  $('rank-list').innerHTML = note + html;
}
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
var rankReq = 0;
function renderRankOnline() {
  var my = ++rankReq, tab = rankTab, gid = rankGame;
  $('rank-list').innerHTML = '<p class="r-note">순위를 불러오는 중…</p>'; $('rank-me').innerHTML = '';
  api('rank', { game: gid, scope: tab, cls: state.cls, num: state.num }).then(function (res) {
    if (my !== rankReq) return;   // 그사이 다른 탭을 누름
    if (!res.ok) { $('rank-list').innerHTML = '<p class="r-note">' + esc(res.error || '불러오지 못했어요.') + '</p>'; return; }
    if (tab === 'vs') {
      var max = Math.max(1, res.vs.length ? res.vs[0].v : 1);
      $('rank-list').innerHTML = res.vs.length ? res.vs.map(function (a, i) {
        return '<div class="rrow' + (i === 0 ? ' top1' : '') + '" style="' + (a.cls === state.cls ? 'border:1px solid #fac775' : '') + '"><span class="no">' + (i + 1) + '</span><span>' + a.cls + '반</span><span class="bar" style="width:' + (a.v / max * 100) + '%"></span><span class="sc">평균 ' + a.v + '</span></div>';
      }).join('') : '<p class="r-note">아직 이 행성 기록이 없어요.</p>';
      var mine = res.vs.filter(function (a) { return a.cls === state.cls; })[0];
      $('rank-me').innerHTML = mine ? '우리 반(' + state.cls + '반)은 ' + (res.vs.indexOf(mine) + 1) + '등 · 평균 ' + mine.v + '점 · ' + mine.n + '명 참여' : '우리 반은 아직 이 행성 기록이 없어요.';
      return;
    }
    $('rank-list').innerHTML = res.top.map(function (r, i) {
      return '<div class="rrow' + (i === 0 ? ' top1' : '') + '"><span class="no">' + (i + 1) + '</span><span class="mini-char">' + charSVG(r.shape, r.color, r.wear) + '</span><span>' + esc(r.nick) + (r.me ? ' (나)' : '') + '</span><span class="sc">' + r.score + '점</span></div>';
    }).join('');
    $('rank-me').innerHTML = '내 순위: <b>' + res.myRank + '등</b> / ' + res.total + '명 · 최고 ' + res.myScore + '점' + (res.myScore ? '' : ' (아직 이 행성에 도전 안 함)');
  }).catch(function () { if (my === rankReq) $('rank-list').innerHTML = '<p class="r-note">인터넷 연결을 확인하세요.</p>'; });
}
$('rank-tabs').addEventListener('click', function (e) {
  var b = e.target.closest('[data-tab]'); if (!b) return;
  rankTab = b.dataset.tab;
  var bs = $('rank-tabs').querySelectorAll('button');
  for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i] === b);
  renderRank();
});
$('rank-games').addEventListener('click', function (e) { var b = e.target.closest('[data-rg]'); if (b) { rankGame = b.dataset.rg; renderRank(); } });
