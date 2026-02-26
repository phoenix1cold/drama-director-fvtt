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

  // ── Ещё 0.5s до полных 3s ───────────────────────────────────────────────
  if (await waitMs(500, isSkip)) { wbrbCleanup(); return; }

  // ── Висим 2 секунды ─────────────────────────────────────────────────────
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
