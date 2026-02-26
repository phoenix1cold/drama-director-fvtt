/**
 * Drama Director – Endings
 * Socket via game.dramaDirector.emit()
 */

const MODULE_ID = 'drama-director';

function injectStyles(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style'); s.id = id; s.textContent = css;
  document.head.appendChild(s);
}

async function waitMs(ms, isSkip) {
  const step = 100; let elapsed = 0;
  while (elapsed < ms) {
    if (isSkip?.()) return true;
    await new Promise(r => setTimeout(r, step));
    elapsed += step;
  }
  return isSkip?.() ?? false;
}
// ══════════════════════════════════════════════════════════════════════════════
// WE'LL BE RIGHT BACK ENDING
// ══════════════════════════════════════════════════════════════════════════════
injectStyles('dd-wbrb-styles', `

/* ── Затемнение поверх канваса ─────────────────────────────────────────── */
.wbrb-tint {
  position: fixed; top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,.22);
  mix-blend-mode: multiply;
  z-index: 10001;
  pointer-events: none;
  opacity: 0;
  transition: opacity .15s;
}
.wbrb-tint.visible { opacity: 1; }

/* ── Враппер текста — верхний левый угол ───────────────────────────────── */
#wbrb-wrap {
  position: fixed;
  top: clamp(30px, 4.5vw, 72px);
  left: clamp(30px, 4.5vw, 72px);
  z-index: 10003;
  pointer-events: none;
  line-height: 1.0;
  font-family: 'Helvetica Neue', 'Arial Black', 'Helvetica', Arial, sans-serif;
  font-weight: 900;
  font-size: clamp(60px, 7.8vw, 128px);
  color: #fff;
  text-transform: uppercase;
  letter-spacing: -.02em;
  user-select: none;
  /* Общий fade-out */
  transition: opacity .5s ease-in-out;
}
#wbrb-wrap.wbrb-fadeout { opacity: 0; }

/* ── Строки ────────────────────────────────────────────────────────────── */
.wbrb-row {
  display: flex;
  align-items: baseline;
  overflow: hidden; /* клипирует slide анимацию внутри строки */
  line-height: 1.05;
}

/* ── Базовый стиль слова: белый + чёрная обводка ──────────────────────── */
.wbrb-word {
  display: inline-block;
  color: #fff;
  text-shadow:
    -4px -4px 0 #000,
     4px -4px 0 #000,
    -4px  4px 0 #000,
     4px  4px 0 #000,
     0    0  12px rgba(0,0,0,.8);
  /* Переход к «чисто белому» — обводка исчезает */
  transition: text-shadow .35s ease-out;
}
/* Состояние «полностью белый» — outline уходит */
#wbrb-wrap.wbrb-white .wbrb-word {
  text-shadow: none;
}

/* ── Анимации въезда ────────────────────────────────────────────────────── */
@keyframes wbrb-from-left {
  from { transform: translateX(-110vw); }
  to   { transform: translateX(0); }
}
@keyframes wbrb-from-right {
  from { transform: translateX(110vw); }
  to   { transform: translateX(0); }
}
@keyframes wbrb-from-below {
  from { transform: translateY(120%); }
  to   { transform: translateY(0); }
}
@keyframes wbrb-from-above {
  from { transform: translateY(-120%); }
  to   { transform: translateY(0); }
}

/* Easing — резкое начало, мягкое завершение (как деселерация) */
.wbrb-we    { animation: wbrb-from-left  .42s cubic-bezier(.15,.8,.35,1) both; }
.wbrb-ll    { animation: wbrb-from-right .42s cubic-bezier(.15,.8,.35,1) both; }
.wbrb-be    { animation: wbrb-from-below .38s cubic-bezier(.15,.8,.35,1) .55s both; }
.wbrb-right { animation: wbrb-from-above .38s cubic-bezier(.15,.8,.35,1) 1.05s both; }
.wbrb-back  { animation: wbrb-from-right .38s cubic-bezier(.15,.8,.35,1) 1.55s both; }

/* ── Кнопка скипа ──────────────────────────────────────────────────────── */
.wbrb-skip-button {
  position: fixed;
  bottom: clamp(15px, 2vw, 30px);
  right:  clamp(15px, 2vw, 30px);
  z-index: 10010;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 18px;
  background: rgba(20,20,20,.88);
  border: 1px solid rgba(255,255,255,.25);
  border-radius: 4px;
  color: rgba(255,255,255,.8);
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px; font-weight: 700;
  letter-spacing: 2px; text-transform: uppercase;
  cursor: pointer;
  opacity: 0; transform: translateY(20px);
  transition: all .35s ease-out;
  pointer-events: auto;
}
.wbrb-skip-button.visible { opacity: 1; transform: translateY(0); }
.wbrb-skip-button:hover {
  background: rgba(40,40,40,.95);
  border-color: rgba(255,255,255,.5);
  color: #fff;
}
`);

let wbrbPlaying = false, wbrbSkipFlag = false, wbrbSound = null;

export async function executeWBRBEnding() {
  if (wbrbPlaying) return;
  wbrbPlaying  = true;
  wbrbSkipFlag = false;
  const isSkip = () => wbrbSkipFlag;

  // ── Звук ────────────────────────────────────────────────────────────────
  wbrbSound = await foundry.audio.AudioHelper.play(
    { src: `modules/${MODULE_ID}/assets/sounds/wbrb.ogg`, volume: 0.9, autoplay: true, loop: false },
    false
  );

  // ── Затемнение ──────────────────────────────────────────────────────────
  const tint = document.createElement('div');
  tint.className = 'wbrb-tint';
  document.body.appendChild(tint);

  // ── Кнопка скипа (GM) ───────────────────────────────────────────────────
  if (game.user.isGM) {
    const btn = document.createElement('button');
    btn.id = 'wbrb-skip-btn';
    btn.className = 'wbrb-skip-button';
    btn.innerHTML = `<i class="fa-solid fa-forward"></i> ${game.i18n.localize('DRAMADIRECTOR.intro.skip')}`;
    btn.addEventListener('click', () => {
      wbrbSkipFlag = true;
      game.socket.emit(`module.${MODULE_ID}`, { action: 'wbrbSkip' });
      wbrbCleanup();
    });
    document.body.appendChild(btn);
    setTimeout(() => btn.classList.add('visible'), 150);
  }

  // ── Небольшая пауза перед заморозкой ────────────────────────────────────
  if (await waitMs(200, isSkip)) { wbrbCleanup(); return; }

  // ── Замораживаем канвас + десатурация ───────────────────────────────────
  canvas.app?.ticker?.stop?.();
  const board = document.getElementById('board');
  if (board) {
    board.style.transition = 'filter .1s ease-out';
    board.style.filter = 'saturate(.5) brightness(.9)';
  }
  tint.classList.add('visible');

  // ── Враппер с текстом — CSS анимации стартуют сразу при добавлении ──────
  // Структура:
  //   [WE]['LL]   ← We с левой, 'll с правой
  //   [BE]        ← снизу
  //   [RIGHT]     ← сверху
  //   [BACK]      ← справа
  const wrap = document.createElement('div');
  wrap.id = 'wbrb-wrap';
  wrap.innerHTML = `
    <div class="wbrb-row">
      <span class="wbrb-word wbrb-we">WE</span><span class="wbrb-word wbrb-ll">'LL</span>
    </div>
    <div class="wbrb-row">
      <span class="wbrb-word wbrb-be">BE</span>
    </div>
    <div class="wbrb-row">
      <span class="wbrb-word wbrb-right">RIGHT</span>
    </div>
    <div class="wbrb-row">
      <span class="wbrb-word wbrb-back">BACK</span>
    </div>`;
  document.body.appendChild(wrap);

  // ── Ждём окончания всех въездов (~1.93s), потом переходим в «белый» ──────
  // Back заканчивает в ~1.55 + 0.38 = 1.93s
  // Небольшой буфер до 2.5s, потом за 0.35s белеет → итого ~2.85s ≈ 3s
  if (await waitMs(2500, isSkip)) { wbrbCleanup(); return; }

  wrap.classList.add('wbrb-white'); // text-shadow → none за .35s

  // ── Ждём пока обводка уйдёт ─────────────────────────────────────────────
  if (await waitMs(450, isSkip)) { wbrbCleanup(); return; }

  // ── Возвращаем чёрную обводку ────────────────────────────────────────────
  wrap.classList.remove('wbrb-white');

  // ── Висим 2 секунды с вернувшейся обводкой ──────────────────────────────
  if (await waitMs(2000, isSkip)) { wbrbCleanup(); return; }

  // ── Плавный fade-out (0.5s) ─────────────────────────────────────────────
  wrap.classList.add('wbrb-fadeout');
  if (await waitMs(500, isSkip)) { wbrbCleanup(); return; }

  wbrbCleanup();
}

function wbrbCleanup() {
  document.getElementById('wbrb-wrap')?.remove();
  document.querySelector('.wbrb-tint')?.remove();
  document.getElementById('wbrb-skip-btn')?.remove();
  const board = document.getElementById('board');
  if (board) { board.style.filter = ''; board.style.transition = ''; }
  canvas.app?.ticker?.start?.();
  if (wbrbSound) { wbrbSound.stop?.(); wbrbSound = null; }
  wbrbPlaying  = false;
  wbrbSkipFlag = false;
}

export function skipWBRBEnding() {
  wbrbSkipFlag = true;
  wbrbCleanup();
}

// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// JOJO ENDING — Roundabout + TBC + Time Freeze + Anime Rolling Credits
// ══════════════════════════════════════════════════════════════════════════════

injectStyles('dd-jojo-styles', `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&family=Noto+Sans+JP:wght@100;300;400;700&display=swap');

/* ── Base overlay ──────────────────────────────────────────────────────── */
.jojo-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 10000; overflow: hidden; pointer-events: none;
  opacity: 0; transition: opacity 1.8s ease-out;
}
.jojo-overlay.fadeout { opacity: 0 !important; transition: opacity 1.8s ease-out; }

/* ── Yellow time-freeze tint over canvas ──────────────────────────────── */
.jojo-freeze-layer {
  position: fixed; inset: 0; z-index: 9999; pointer-events: none;
  background: rgba(255, 215, 40, 0.15);
  mix-blend-mode: multiply;
  opacity: 0; transition: opacity 0.55s ease-out;
}
.jojo-freeze-layer.on  { opacity: 1; }
.jojo-freeze-layer.off { opacity: 0; transition: opacity 1.8s ease-out; }

/* ── Single portrait slot — full screen, semi-transparent, drifting ───── */
.jojo-portrait-slot {
  position: absolute; inset: 0;
  opacity: 0;
  transition: opacity 0.9s ease-in-out;
}
.jojo-portrait-slot.visible {
  opacity: 1;
}
.jojo-portrait-slot img {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; object-position: center top;
  filter: sepia(0.55) saturate(0.65) brightness(0.48) contrast(1.1);
  opacity: 0.55;
}
/* Drift left-to-right */
.jojo-portrait-slot.drift-ltr img {
  animation: jojo-drift-ltr var(--drift-dur, 3.6s) linear forwards;
}
/* Drift right-to-left */
.jojo-portrait-slot.drift-rtl img {
  animation: jojo-drift-rtl var(--drift-dur, 3.6s) linear forwards;
}
@keyframes jojo-drift-ltr {
  0%   { transform: translateX(-3%) scale(1.06); }
  100% { transform: translateX(3%)  scale(1.06); }
}
@keyframes jojo-drift-rtl {
  0%   { transform: translateX(3%)  scale(1.06); }
  100% { transform: translateX(-3%) scale(1.06); }
}
/* Vignette over portrait */
.jojo-portrait-slot::after {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 40% 50%,
    transparent 25%, rgba(8,5,0,0.35) 65%, rgba(5,3,0,0.72) 100%);
  pointer-events: none;
}

/* ── TBC image ─────────────────────────────────────────────────────────── */
.jojo-tbc-wrap {
  position: absolute;
  bottom: clamp(26px, 4.5vh, 64px);
  right: -38vw;
  z-index: 20;
  pointer-events: none;
  transition: right 0.88s cubic-bezier(0.12, 0.82, 0.22, 1.0);
}
.jojo-tbc-wrap.flying {
  right: calc(100vw - clamp(250px, 36vw, 520px) - clamp(16px, 2.5vw, 36px));
}
.jojo-tbc-wrap img {
  display: block;
  width: clamp(250px, 36vw, 520px);
  height: auto;
  filter: drop-shadow(0 4px 28px rgba(0,0,0,0.75));
}

/* ── Credits panel — top right ─────────────────────────────────────────── */
.jojo-credits {
  position: absolute;
  top: 0; right: 0;
  width: clamp(240px, 34vw, 500px);
  z-index: 30;
  padding: clamp(22px, 3.8vh, 56px) clamp(18px, 2.8vw, 44px) clamp(22px, 3.8vh, 56px) 0;
  display: flex; flex-direction: column; gap: 0;
  pointer-events: none;
}
.jojo-credits-header {
  font-family: 'Noto Serif JP', serif;
  font-size: clamp(0.5rem, 0.8vw, 1rem);
  font-weight: 400;
  color: rgba(255, 238, 160, 0.55);
  letter-spacing: 0.48em;
  text-transform: uppercase;
  margin-bottom: clamp(10px, 1.8vh, 20px);
  text-align: right;
  border-bottom: 1px solid rgba(255, 215, 60, 0.2);
  padding-bottom: 6px;
  opacity: 0; transform: translateX(20px);
  transition: opacity 0.55s ease-out, transform 0.55s cubic-bezier(0.12,0.95,0.22,1);
}
.jojo-credits-header.on { opacity: 1; transform: translateX(0); }

/* Single credit entry — transitions in/out */
.jojo-credit-entry {
  display: flex; flex-direction: column; align-items: flex-end;
  opacity: 0; transform: translateX(28px);
  transition: opacity 0.55s ease-out, transform 0.55s cubic-bezier(0.12,0.95,0.22,1);
  pointer-events: none;
}
.jojo-credit-entry.on {
  opacity: 1; transform: translateX(0);
}
.jojo-cred-char {
  font-family: 'Noto Serif JP', serif;
  font-size: clamp(1.1rem, 2.1vw, 2.6rem);
  font-weight: 900;
  color: #ffffff;
  line-height: 1.0; text-align: right;
  text-shadow: 0 2px 20px rgba(0,0,0,0.95), 0 0 44px rgba(255,215,50,0.2);
  letter-spacing: 0.04em; word-break: break-word;
}
.jojo-cred-role-label {
  font-family: 'Noto Sans JP', sans-serif;
  font-size: clamp(0.42rem, 0.6vw, 0.7rem);
  font-weight: 300;
  color: rgba(255, 228, 110, 0.5);
  letter-spacing: 0.52em; text-transform: uppercase;
  margin-top: 2px; text-align: right;
}
.jojo-cred-player {
  font-family: 'Noto Sans JP', sans-serif;
  font-size: clamp(0.65rem, 1.05vw, 1.25rem);
  font-weight: 100;
  color: rgba(255, 238, 195, 0.82);
  letter-spacing: 0.24em; text-align: right;
  margin-top: 2px;
}
.jojo-cred-divider {
  width: 50%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,215,60,0.28));
  margin: clamp(6px, 1vh, 12px) 0 0 auto;
}

/* ── Production line — top center, white ──────────────────────────────── */
.jojo-production {
  position: absolute;
  top: clamp(14px, 2.2vh, 32px);
  left: 0; right: 0; z-index: 30;
  text-align: center; pointer-events: none;
  opacity: 0; transition: opacity 0.9s ease-out;
}
.jojo-production.on { opacity: 1; }
.jojo-prod-label {
  font-family: 'Noto Sans JP', sans-serif;
  font-size: clamp(0.48rem, 0.68vw, 0.82rem);
  font-weight: 300;
  color: rgba(255,255,255,0.42);
  letter-spacing: 0.62em; text-transform: uppercase;
  display: block; margin-bottom: 4px;
}
.jojo-prod-name {
  font-family: 'Noto Serif JP', serif;
  font-size: clamp(1rem, 1.7vw, 2.1rem);
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.22em; text-transform: uppercase;
  text-shadow: 0 2px 22px rgba(0,0,0,0.9), 0 0 60px rgba(255,215,50,0.14);
}

/* ── Film grain ────────────────────────────────────────────────────────── */
.jojo-grain {
  position: absolute; inset: 0; z-index: 40; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.048; mix-blend-mode: overlay;
  animation: jojo-grain-shift 0.12s steps(3) infinite;
}
@keyframes jojo-grain-shift {
  0%   { background-position: 0 0; }
  33%  { background-position: 9px -7px; }
  66%  { background-position: -6px 11px; }
}

/* ── Skip button ───────────────────────────────────────────────────────── */
.jojo-skip-btn {
  position: fixed; bottom: 22px; right: 22px; z-index: 10020;
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; background: rgba(10,8,0,0.92);
  border: 1px solid rgba(255,200,50,0.35); border-radius: 2px;
  color: rgba(255,218,70,0.85);
  font-family: 'Noto Sans JP', sans-serif; font-size: 12px;
  letter-spacing: 3px; text-transform: uppercase;
  cursor: pointer; opacity: 0; transform: translateY(12px);
  transition: opacity 0.35s, transform 0.35s; pointer-events: auto;
}
.jojo-skip-btn.on  { opacity: 1; transform: translateY(0); }
.jojo-skip-btn:hover { border-color: rgba(255,200,50,0.7); }
`);

// ── helpers ───────────────────────────────────────────────────────────────────

async function jojoWait(ms, isSkip) {
  const step = 40; let elapsed = 0;
  while (elapsed < ms) {
    if (isSkip?.()) return true;
    await new Promise(r => setTimeout(r, step));
    elapsed += step;
  }
  return false;
}

async function jojoGetPlayers() {
  const players = [];
  for (const user of game.users.filter(u => u.active && !u.isGM)) {
    const ch = user.character;
    players.push({
      playerName:    user.name,
      characterName: ch?.name || user.name,
      portrait:      ch?.img || user.avatar || 'icons/svg/mystery-man.svg',
    });
  }
  if (!players.length) {
    const tokens = (canvas?.tokens?.placeables ?? []).filter(t => t.actor && !t.document.hidden);
    for (const t of tokens.slice(0, 6)) {
      players.push({
        playerName:    game.i18n.localize('DRAMADIRECTOR.endings.dungeonMaster') || 'GM',
        characterName: t.actor.name,
        portrait:      t.actor.img || 'icons/svg/mystery-man.svg',
      });
    }
  }
  return players;
}

// ── state ─────────────────────────────────────────────────────────────────────

let jojoPlaying = false, jojoSkipFlag = false, jojoAudio = null;

// ── main ──────────────────────────────────────────────────────────────────────

export async function executeJojoEnding() {
  if (jojoPlaying) return;
  jojoPlaying  = true;
  jojoSkipFlag = false;
  const isSkip = () => jojoSkipFlag;

  const players = await jojoGetPlayers();
  const gmUser  = game.users.find(u => u.isGM && u.active) || game.users.find(u => u.isGM);
  const gmName  = gmUser?.name || 'Game Master';

  // ── Audio: roundabout.ogg — starts immediately ─────────────────────────
  jojoAudio = new Audio(`modules/${MODULE_ID}/assets/sounds/roundabout.ogg`);
  jojoAudio.volume = 0.88;
  jojoAudio.play().catch(() => {});

  // ── Skip button ────────────────────────────────────────────────────────
  const skipBtn = document.createElement('button');
  skipBtn.className = 'jojo-skip-btn';
  skipBtn.innerHTML = `<i class="fa-solid fa-forward"></i> ${game.i18n.localize('DRAMADIRECTOR.intro.skip')}`;
  document.body.appendChild(skipBtn);
  setTimeout(() => skipBtn?.classList.add('on'), 1400);
  if (game.user?.isGM) {
    skipBtn.style.pointerEvents = 'auto';
    skipBtn.addEventListener('click', () => {
      jojoSkipFlag = true;
      game.socket?.emit(`module.${MODULE_ID}`, { action: 'jojoSkip' });
      jojoCleanup();
    });
  } else {
    skipBtn.style.display = 'none';
  }

  // ── PHASE 1 (0 – 3s): Roundabout plays, canvas still running ──────────
  if (await jojoWait(3000, isSkip)) { jojoCleanup(); return; }

  // ── Build DOM ──────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'jojo-overlay';

  // Portrait container (one slot, reused)
  const portContainer = document.createElement('div');
  portContainer.style.cssText = 'position:absolute;inset:0;z-index:2;';

  // TBC image
  const tbcWrap = document.createElement('div');
  tbcWrap.className = 'jojo-tbc-wrap';
  const tbcImg  = document.createElement('img');
  tbcImg.src = `modules/${MODULE_ID}/assets/tbc.webp`;
  tbcImg.alt = 'To Be Continued';
  tbcWrap.appendChild(tbcImg);

  // Credits panel (top-right)
  const creditsPanel = document.createElement('div');
  creditsPanel.className = 'jojo-credits';
  const credHeader = document.createElement('div');
  credHeader.className = 'jojo-credits-header';
  credHeader.textContent = '出演 · ' + (game.i18n.localize('DRAMADIRECTOR.endings.starring') || 'STARRING');
  creditsPanel.appendChild(credHeader);
  // Single reusable entry element
  const credEntry = document.createElement('div');
  credEntry.className = 'jojo-credit-entry';
  creditsPanel.appendChild(credEntry);

  // Production (top-center, white)
  const production = document.createElement('div');
  production.className = 'jojo-production';
  production.innerHTML = `
    <span class="jojo-prod-label">${game.i18n.localize('DRAMADIRECTOR.endings.jojoProduction') || 'PRODUCTION'}</span>
    <div class="jojo-prod-name">${gmName}</div>
  `;

  const grain = document.createElement('div');
  grain.className = 'jojo-grain';

  overlay.appendChild(portContainer);
  overlay.appendChild(tbcWrap);
  overlay.appendChild(creditsPanel);
  overlay.appendChild(production);
  overlay.appendChild(grain);
  document.body.appendChild(overlay);

  // Yellow freeze layer (behind overlay, over canvas)
  const freezeLayer = document.createElement('div');
  freezeLayer.className = 'jojo-freeze-layer';
  document.body.appendChild(freezeLayer);

  // ── PHASE 2 (3 – 4s): TBC flies from right → stops near left edge ─────
  overlay.offsetHeight; // reflow
  overlay.style.opacity = '1'; // make overlay visible

  // Start TBC flight
  requestAnimationFrame(() => requestAnimationFrame(() => {
    tbcWrap.classList.add('flying');
  }));

  if (await jojoWait(920, isSkip)) { jojoCleanup(); return; }

  // ── PHASE 3: Time Freeze ───────────────────────────────────────────────
  // Stop canvas ticker
  canvas?.app?.ticker?.stop?.();
  // Sepia+dim the board
  const board = document.getElementById('board');
  if (board) {
    board.style.transition = 'filter 0.45s ease-out';
    board.style.filter = 'sepia(0.28) saturate(0.6) brightness(0.78)';
  }
  // Activate yellow tint
  freezeLayer.classList.add('on');

  if (await jojoWait(450, isSkip)) { jojoCleanup(); return; }

  // ── Show credits header ────────────────────────────────────────────────
  credHeader.classList.add('on');

  if (await jojoWait(300, isSkip)) { jojoCleanup(); return; }

  // ── PHASE 4: Portraits one by one, each 3 seconds ─────────────────────
  const PORTRAIT_HOLD  = 3000; // ms visible (total slot lifetime)
  const FADE_DURATION  =  900; // ms CSS transition

  for (let i = 0; i < players.length; i++) {
    if (isSkip()) break;
    const p = players[i];
    const driftDir = (i % 2 === 0) ? 'drift-ltr' : 'drift-rtl';

    // Build portrait slot
    const slot = document.createElement('div');
    slot.className = 'jojo-portrait-slot';
    slot.style.setProperty('--drift-dur', `${PORTRAIT_HOLD + FADE_DURATION * 2}ms`);
    const img = document.createElement('img');
    img.src = p.portrait;
    img.onerror = () => { img.src = 'icons/svg/mystery-man.svg'; };
    slot.appendChild(img);
    portContainer.appendChild(slot);

    // Update credit entry
    credEntry.classList.remove('on');
    await new Promise(r => setTimeout(r, 60)); // brief gap for transition reset
    credEntry.innerHTML = `
      <div class="jojo-cred-char">${p.characterName}</div>
      <div class="jojo-cred-role-label">― ${game.i18n.localize('DRAMADIRECTOR.endings.asRole') || 'played by'} ―</div>
      <div class="jojo-cred-player">${p.playerName}</div>
      <div class="jojo-cred-divider"></div>
    `;

    // Fade in portrait + start drift
    slot.offsetHeight;
    slot.classList.add('visible');
    slot.classList.add(driftDir);
    // Fade in credit entry shortly after
    setTimeout(() => credEntry.classList.add('on'), 150);

    // Hold
    if (await jojoWait(PORTRAIT_HOLD, isSkip)) {
      jojoCleanup(); return;
    }

    // Fade out portrait + credit
    slot.classList.remove('visible');
    credEntry.classList.remove('on');

    // Wait for fade-out transition, then remove slot
    await jojoWait(FADE_DURATION, isSkip);
    slot.remove();

    if (isSkip()) { jojoCleanup(); return; }

    // Small gap between portraits
    if (i < players.length - 1) {
      if (await jojoWait(200, isSkip)) { jojoCleanup(); return; }
    }
  }

  if (isSkip()) { jojoCleanup(); return; }

  // ── PHASE 5: Production for 3 seconds ─────────────────────────────────
  // Hide credits, show production (top-center, white)
  credHeader.classList.remove('on');
  credEntry.classList.remove('on');

  production.classList.add('on');

  if (await jojoWait(3000, isSkip)) { jojoCleanup(); return; }

  // ── PHASE 6: Fade audio + fade everything out ──────────────────────────
  overlay.classList.add('fadeout');
  freezeLayer.classList.add('off');

  if (jojoAudio) {
    const steps = 18;
    for (let i = 0; i < steps; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (jojoAudio) jojoAudio.volume = Math.max(0, jojoAudio.volume - 0.88 / steps);
    }
  }

  await new Promise(r => setTimeout(r, 1800));
  jojoCleanup();
}

function jojoCleanup() {
  document.querySelector('.jojo-overlay')?.remove();
  document.querySelector('.jojo-freeze-layer')?.remove();
  document.querySelector('.jojo-skip-btn')?.remove();
  const board = document.getElementById('board');
  if (board) { board.style.filter = ''; board.style.transition = ''; }
  canvas?.app?.ticker?.start?.();
  if (jojoAudio) { jojoAudio.pause(); jojoAudio = null; }
  jojoPlaying  = false;
  jojoSkipFlag = false;
}

export function skipJojoEnding() {
  jojoSkipFlag = true;
  jojoCleanup();
}
