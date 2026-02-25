/**
 * Drama Director - Introductions
 * CSS 1:1 from showstopper: persona-* (hero), villain-* (villain), h-* (genshin)
 * + Gentlemen & Snatch cinematic intros
 */

const MODULE_ID = 'drama-director';

function injectStyles(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style'); s.id = id; s.textContent = css;
  document.head.appendChild(s);
}

// ─── Get actor data: portrait = actor.img (not token) ─────────────────────

export function getSelectedTokenData() {
  const token = canvas?.tokens?.controlled?.[0];
  if (!token?.actor) return null;
  const actor = token.actor;
  const portrait = actor.img;
  let name = (token.document?.name || actor.prototypeToken?.name || actor.name)
    .replace(/\s*\[[^\]]*\]/g, '').split('/')[0].trim();
  let title = actor.getFlag?.(MODULE_ID, 'introTitle') || '';
  if (!title) {
    if (actor.type === 'npc') {
      const ct = actor.system?.details?.type?.value;
      title = ct ? ct.charAt(0).toUpperCase() + ct.slice(1) : '';
    } else {
      const cls = Object.values(actor.classes ?? {});
      title = cls.length ? cls.map(c => c.name).join(' / ') : (actor.system?.details?.race || '');
    }
  }
  const bio = actor.system?.details?.biography?.value || '';
  const description = bio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
  return { portrait, name, title, description };
}

// ─── Collect all active players data for cinematic intros ─────────────────

async function getIntroPlayersData() {
  const players = [];
  for (const user of game.users.filter(u => u.active && !u.isGM)) {
    const ch = user.character;
    let title = '';
    if (ch) {
      title = ch.getFlag?.(MODULE_ID, 'introTitle') || '';
      if (!title) {
        const cls = Object.values(ch.classes ?? {});
        title = cls.length ? cls.map(c => c.name).join(' / ') : (ch.system?.details?.race || ch.system?.details?.type?.value || '');
        if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
      }
    }
    players.push({
      playerName: user.name,
      characterName: ch?.name || user.name,
      portrait: ch?.img || user.avatar || 'icons/svg/mystery-man.svg',
      title,
    });
  }
  // If no players, fall back to GM characters on canvas
  if (!players.length) {
    const tokens = (canvas?.tokens?.placeables ?? []).filter(t => t.actor && !t.document.hidden);
    for (const t of tokens.slice(0, 6)) {
      players.push({
        playerName: 'GM',
        characterName: t.actor.name,
        portrait: t.actor.img || 'icons/svg/mystery-man.svg',
        title: '',
      });
    }
  }
  return players;
}

// ─── Smoke transition engine (SVG displacement filter) ────────────────────

function animateSmokeFilter(element, direction, duration) {
  return new Promise(resolve => {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;top:0;left:0;';
    const id = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    svg.innerHTML = `<defs>
      <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
        <feTurbulence id="${id}-t" type="fractalNoise" baseFrequency="0.025 0.04"
          numOctaves="5" seed="${(Math.random() * 100) | 0}" result="noise"/>
        <feDisplacementMap id="${id}-d" in="SourceGraphic" in2="noise"
          scale="0" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>`;
    document.body.appendChild(svg);

    const turb = svg.querySelector(`#${id}-t`);
    const disp = svg.querySelector(`#${id}-d`);

    element.style.filter = `url(#${id})`;
    element.style.opacity = direction === 'out' ? '1' : '0';

    let start = null;
    const frame = (ts) => {
      if (!start) start = ts;
      const raw = Math.min((ts - start) / duration, 1);
      const p = direction === 'out' ? raw * raw : 1 - Math.pow(1 - raw, 2);
      const maxScale = 220;
      const scale = direction === 'out' ? p * maxScale : (1 - p) * maxScale;
      const freq = 0.025 + (direction === 'out' ? p : (1 - p)) * 0.1;

      turb.setAttribute('baseFrequency', `${freq.toFixed(4)} ${(freq * 1.7).toFixed(4)}`);
      disp.setAttribute('scale', scale.toFixed(1));
      element.style.opacity = (direction === 'out' ? 1 - raw : raw).toString();

      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        svg.remove();
        element.style.filter = '';
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

function smokeMaterialize(el, dur = 1000) { return animateSmokeFilter(el, 'in', dur); }
function smokeDissolve(el, dur = 1000)    { return animateSmokeFilter(el, 'out', dur); }

// ─── Helpers ──────────────────────────────────────────────────────────────

function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitSkippable(ms, isSkip) {
  return new Promise(resolve => {
    const step = 50; let elapsed = 0;
    const tick = () => {
      if (isSkip()) { resolve(true); return; }
      elapsed += step;
      if (elapsed >= ms) { resolve(false); return; }
      setTimeout(tick, step);
    };
    setTimeout(tick, step);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SIN CITY INTRO — Frank Miller / Robert Rodriguez style
// ═══════════════════════════════════════════════════════════════════════════

injectStyles('dd-sincity-styles', `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Special+Elite&display=swap');

/* ── overlay (always black) ── */
.sc-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 10000; overflow: hidden; pointer-events: auto; background: #000;
}

/* ── black curtain sits on TOP of everything — fades in/out ── */
.sc-curtain {
  position: absolute; inset: 0; z-index: 80;
  background: #000; pointer-events: none;
  opacity: 1; transition: opacity 0.32s ease-in-out;
}
.sc-curtain.sc-open { opacity: 0; }

/* ── film grain ── */
.sc-grain {
  position: absolute; inset: 0; z-index: 70; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.08; mix-blend-mode: overlay;
  animation: sc-grain 0.09s steps(3) infinite;
}
@keyframes sc-grain {
  0%   { background-position: 0 0; }
  33%  { background-position: 12px -9px; }
  66%  { background-position: -8px 15px; }
}

/* ══ TITLE CARD — like the screenshot ══
   • Small cream italic "GM's" top-left
   • Massive dark red title, rotated -3deg, bottom-anchored, fills screen
*/
.sc-title-card { position: absolute; inset: 0; z-index: 10; }

.sc-gm-byline {
  position: absolute;
  top: clamp(20px, 4vh, 60px);
  left: clamp(28px, 4vw, 70px);
  font-family: 'Special Elite', 'Georgia', serif;
  font-size: clamp(1rem, 2vw, 2.4rem);
  color: #f0ead6; font-style: italic; letter-spacing: 0.08em;
  text-shadow: 0 2px 12px rgba(0,0,0,0.8);
}

.sc-campaign-title {
  position: absolute;
  top: 50%; left: 50%;
  width: 90vw;
  font-family: 'Anton', 'Impact', sans-serif;
  font-size: clamp(5rem, 17vw, 22rem);
  color: #7a0000;
  line-height: 0.82; text-transform: uppercase; letter-spacing: -0.02em;
  text-align: center;
  /* centered, then rotated -3deg on its center — exactly like the poster */
  transform: translate(-50%, -50%) rotate(-3deg);
  text-shadow: 4px 4px 0 #420000, 9px 9px 0 #1a0000, 0 0 100px rgba(80,0,0,0.6);
}

/* ══ CHARACTER CARDS ══ */
.sc-char-card { position: absolute; inset: 0; z-index: 10; }

/* Portrait — occupies right or left half, slides in and STAYS */
.sc-portrait-wrap {
  position: absolute; top: 0; bottom: 0; width: 55vw; overflow: hidden;
  display: flex; align-items: flex-end; justify-content: center;
}
.sc-portrait-wrap.sc-right { right: 0; }
.sc-portrait-wrap.sc-left  { left: 0; }

.sc-portrait-img {
  display: block; width: 100%; height: 100%;
  object-fit: cover; object-position: center top;
  filter: grayscale(1) contrast(6) brightness(1.1);
  opacity: 0;
  transition: opacity 1.2s ease-out;
}
/* Continuous drift — portrait never stops, moves from edge toward and past center */
.sc-portrait-wrap.sc-right .sc-portrait-img {
  animation: sc-port-drift-right 60s linear forwards;
}
.sc-portrait-wrap.sc-left .sc-portrait-img {
  animation: sc-port-drift-left 60s linear forwards;
}
@keyframes sc-port-drift-right {
  0%   { transform: translateX(0vw);   opacity: 0; }
  8%   { opacity: 1; }
  100% { transform: translateX(-30vw); opacity: 1; }
}
@keyframes sc-port-drift-left {
  0%   { transform: translateX(0vw);  opacity: 0; }
  8%   { opacity: 1; }
  100% { transform: translateX(30vw); opacity: 1; }
}
/* Fade out together */
.sc-portrait-img.sc-out {
  opacity: 0 !important;
  transition: opacity 1s ease-in !important;
  animation-play-state: paused !important;
}

/* Name text — drifts slowly from its edge into resting position, then fades out */
.sc-char-name-wrap {
  position: absolute; z-index: 25;
  top: 50%;
  display: flex; flex-direction: column;
  pointer-events: none; opacity: 0;
}
/* Portrait RIGHT → name occupies LEFT half */
.sc-char-name-wrap.sc-txt-left {
  left: clamp(20px, 3vw, 50px); right: 55vw; text-align: left;
}
/* Portrait LEFT → name occupies RIGHT half */
.sc-char-name-wrap.sc-txt-right {
  left: 55vw; right: clamp(20px, 3vw, 50px); text-align: left;
}
/* Continuous drift — name never stops, moves from its edge toward center */
@keyframes sc-name-drift-left {
  0%   { transform: translateY(-50%) translateX(0vw);   opacity: 0; }
  10%  { opacity: 1; }
  100% { transform: translateY(-50%) translateX(25vw);  opacity: 1; }
}
@keyframes sc-name-drift-right {
  0%   { transform: translateY(-50%) translateX(0vw);   opacity: 0; }
  10%  { opacity: 1; }
  100% { transform: translateY(-50%) translateX(-25vw); opacity: 1; }
}
.sc-char-card.sc-on .sc-char-name-wrap.sc-txt-left  { animation: sc-name-drift-left  60s linear forwards; }
.sc-char-card.sc-on .sc-char-name-wrap.sc-txt-right { animation: sc-name-drift-right 60s linear forwards; }
/* Fade out together */
.sc-char-name-wrap.sc-out {
  opacity: 0 !important;
  transition: opacity 1s ease-in !important;
  animation-play-state: paused !important;
}

.sc-char-name {
  font-family: 'Anton', 'Impact', sans-serif;
  font-size: clamp(2.8rem, 7.5vw, 10rem);
  color: #8b0000; line-height: 0.85;
  text-transform: uppercase; letter-spacing: 0.01em;
  -webkit-text-stroke: clamp(2px, 0.3vw, 4px) #ffffff;
  paint-order: stroke fill;
  text-shadow: 3px 3px 0 #3d0000, 6px 6px 0 #1a0000;
  word-break: break-word;
}
.sc-player-name {
  font-family: 'Special Elite', serif; font-style: italic;
  font-size: clamp(0.7rem, 1vw, 1.2rem);
  color: rgba(240,234,214,0.5); letter-spacing: 0.3em;
  margin-top: clamp(8px, 1vh, 16px); text-transform: uppercase;
}

/* ── directed-by card ── */
.sc-dirby-card {
  position: absolute; inset: 0; z-index: 10;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.sc-dirby-label {
  font-family: 'Special Elite', serif; font-style: italic;
  font-size: clamp(0.8rem, 1.3vw, 1.6rem);
  color: rgba(240,234,214,0.38); letter-spacing: 0.55em; text-transform: uppercase;
  margin-bottom: clamp(10px, 1.5vh, 22px);
}
.sc-dirby-name {
  font-family: 'Anton', 'Impact', sans-serif;
  font-size: clamp(2.8rem, 7vw, 9rem);
  color: #8b0000; text-transform: uppercase; letter-spacing: 0.03em;
  text-shadow: 3px 3px 0 #3a0000, 6px 6px 0 #1a0000;
}

/* ── skip button ── */
.sc-skip-btn {
  position: fixed; bottom: 22px; right: 22px; z-index: 10020;
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; background: rgba(0,0,0,0.92);
  border: 1px solid rgba(139,0,0,0.5); border-radius: 1px; color: #8b0000;
  font-family: 'Anton', sans-serif; font-size: 13px;
  letter-spacing: 3px; text-transform: uppercase;
  cursor: pointer; opacity: 0; transform: translateY(12px);
  transition: opacity 0.35s, transform 0.35s; pointer-events: auto;
}
.sc-skip-btn.sc-on { opacity: 1; transform: translateY(0); }
.sc-skip-btn:hover { border-color: #8b0000; }
`);

// ─── Player data ───────────────────────────────────────────────────────────
async function getSinCityPlayersData() {
  const players = [];
  for (const user of game.users.filter(u => u.active && !u.isGM)) {
    const ch = user.character;
    if (!ch) continue;
    players.push({
      playerName:    user.name,
      characterName: ch.name.toUpperCase(),
      portrait:      ch.img || user.avatar || 'icons/svg/mystery-man.svg',
    });
  }
  return players;
}

// ─── Curtain helpers — curtain starts OPAQUE (dark), we open/close it ─────
// "open" = scene visible, "close" = black
async function curtainOpen(el) {
  el.classList.add('sc-open');
  await waitMs(350);
}
async function curtainClose(el) {
  el.classList.remove('sc-open');
  await waitMs(350);
}

let scPlaying = false, scSkipFlag = false, scAudio = null;

export async function executeSinCityIntro(campaignName = '') {
  if (scPlaying) return;
  scPlaying  = true;
  scSkipFlag = false;
  const isSkip = () => scSkipFlag;

  const players = await getSinCityPlayersData();
  const gmUser  = game.users.find(u => u.isGM && u.active) || game.users.find(u => u.isGM);
  const gmName  = gmUser?.name || 'Game Master';

  // Audio
  scAudio = new Audio(`modules/${MODULE_ID}/assets/sounds/sin.ogg`);
  scAudio.volume = 0.85;
  scAudio.play().catch(() => {});

  // Build overlay — curtain starts OPAQUE (everything hidden behind it)
  const overlay = document.createElement('div');
  overlay.className = 'sc-overlay';
  overlay.innerHTML = `
    <div class="sc-grain"></div>
    <div class="sc-curtain" id="sc-curtain"></div>
  `;
  document.body.appendChild(overlay);

  // Skip button
  if (game.user?.isGM) {
    const skipBtn = document.createElement('button');
    skipBtn.className = 'sc-skip-btn';
    skipBtn.innerHTML = '<i class="fa-solid fa-forward"></i> Пропустить';
    document.body.appendChild(skipBtn);
    setTimeout(() => skipBtn?.classList.add('sc-on'), 1400);
    skipBtn.addEventListener('click', () => {
      scSkipFlag = true;
      game.socket?.emit(`module.${MODULE_ID}`, { action: 'sinCitySkip' });
      scCleanup();
    });
  }

  const curtain = overlay.querySelector('#sc-curtain');

  // ── PHASE 1: Title card ───────────────────────────────────────────────
  const titleText = (campaignName?.trim() || 'Наша Кампания').toUpperCase();
  const titleCard = document.createElement('div');
  titleCard.className = 'sc-title-card';
  titleCard.innerHTML = `
    <div class="sc-gm-byline">${gmName.toUpperCase()}'s</div>
    <div class="sc-campaign-title">${titleText}</div>
  `;
  overlay.insertBefore(titleCard, curtain);

  await waitMs(200);
  if (isSkip()) { scCleanup(); return; }

  // Reveal title from black
  await curtainOpen(curtain);
  if (isSkip()) { scCleanup(); return; }

  if (await waitSkippable(2500, isSkip)) { scCleanup(); return; }

  // Close to black, remove title
  await curtainClose(curtain);
  titleCard.remove();
  if (isSkip()) { scCleanup(); return; }
  await waitMs(200);

  // ── PHASE 2: Character cards ──────────────────────────────────────────
  for (let i = 0; i < players.length; i++) {
    if (isSkip()) break;
    const p = players[i];
    const portraitRight = (i % 2 === 0);

    // Build card — IMMEDIATELY add sc-on so transitions are primed
    const card = document.createElement('div');
    card.className = 'sc-char-card';

    const pw = document.createElement('div');
    pw.className = `sc-portrait-wrap ${portraitRight ? 'sc-right' : 'sc-left'}`;
    const pImg = document.createElement('img');
    pImg.className = 'sc-portrait-img';
    pImg.src = p.portrait;
    pImg.onerror = () => { pImg.src = 'icons/svg/mystery-man.svg'; };
    pw.appendChild(pImg);

    const words = p.characterName.split(/\s+/).filter(Boolean);
    const nameHtml = words.map(w => `<div>${w}</div>`).join('');
    const nw = document.createElement('div');
    nw.className = `sc-char-name-wrap ${portraitRight ? 'sc-txt-left' : 'sc-txt-right'}`;
    nw.innerHTML = `
      <div class="sc-char-name">${nameHtml}</div>
      <div class="sc-player-name">— ${p.playerName} —</div>
    `;

    card.appendChild(pw);
    card.appendChild(nw);
    overlay.insertBefore(card, curtain);

    // Force reflow — ensure animation start positions are applied
    card.offsetHeight;

    // Open curtain
    await curtainOpen(curtain);
    if (isSkip()) { card.remove(); break; }

    // Start continuous drift animations (portrait and name drift simultaneously)
    card.classList.add('sc-on');

    // Hold — they keep drifting continuously
    const skipped = await waitSkippable(3500, isSkip);

    // Close curtain while they're still in motion (no fade-out)
    await curtainClose(curtain);
    card.remove();
    if (isSkip() || skipped) break;
    await waitMs(60);
  }

  if (isSkip()) { scCleanup(); return; }

  // ── PHASE 3: Directed by ─────────────────────────────────────────────
  const dirCard = document.createElement('div');
  dirCard.className = 'sc-dirby-card';
  dirCard.innerHTML = `
    <div class="sc-dirby-label">D I R E C T E D &nbsp; B Y</div>
    <div class="sc-dirby-name">${gmName.toUpperCase()}</div>
  `;
  overlay.insertBefore(dirCard, curtain);

  await curtainOpen(curtain);
  if (isSkip()) { scCleanup(); return; }

  if (await waitSkippable(2500, isSkip)) { scCleanup(); return; }

  // Final fade: close curtain + fade audio
  await curtainClose(curtain);
  if (scAudio) {
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      await waitMs(80);
      if (scAudio) scAudio.volume = Math.max(0, scAudio.volume - 0.85 / steps);
    }
  }
  scCleanup();
}

function scCleanup() {
  document.querySelector('.sc-overlay')?.remove();
  document.querySelector('.sc-skip-btn')?.remove();
  if (scAudio) { scAudio.pause(); scAudio = null; }
  scPlaying  = false;
  scSkipFlag = false;
}

export function skipSinCityIntro() {
  scSkipFlag = true;
  scCleanup();
}

// ═══════════════════════════════════════════════════════════════════════════
// SNATCH INTRO — Guy Ritchie "Snatch" — poster / duotone / namecard style
// ═══════════════════════════════════════════════════════════════════════════

injectStyles('dd-snatch-styles', `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

/* ── overlay ── */
.snatch-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 10000; overflow: hidden; pointer-events: auto;
  background: #000;
  opacity: 0; transition: opacity 0.5s ease-out;
}
.snatch-overlay.sn-on { opacity: 1; }

/* ── film grain ── */
.sn-grain {
  position: absolute; inset: 0; z-index: 30; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.09; mix-blend-mode: overlay;
  animation: sn-grain-shift 0.1s steps(2) infinite;
}
@keyframes sn-grain-shift {
  0%   { background-position: 0   0; }
  50%  { background-position: 8px 10px; }
  100% { background-position: -5px -7px; }
}

/* ── portrait section (hidden until phase 2) ── */
.sn-portrait-section {
  position: absolute; inset: 0; z-index: 5;
  display: flex; align-items: stretch; justify-content: flex-end;
  overflow: hidden;
  opacity: 0; transition: opacity 0.5s ease-out;
}
.sn-portrait-section.sn-on { opacity: 1; }
.sn-portrait-img-wrap {
  position: relative; width: 65vw; height: 100%; overflow: hidden;
}
/* Phase A: portrait on black, no filter, base scale */
.sn-portrait-img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: center top; display: block;
  filter: none; mix-blend-mode: normal;
  transform: scale(1.0);
  transition: filter 0s, mix-blend-mode 0s, transform 0.3s cubic-bezier(0.22,1,0.36,1);
}
/* Phase B: duotone + snap zoom 15% + then slow drift via animation */
.sn-portrait-img.sn-duotone {
  filter: grayscale(1) contrast(1.75) brightness(0.72);
  mix-blend-mode: multiply;
  transform: scale(1.15);
}
/* Slow drift continues after snap — applied via JS after transition ends */
@keyframes sn-zoom-drift-slow {
  from { transform: scale(1.15); }
  to   { transform: scale(1.32); }
}
.sn-portrait-img.sn-drifting {
  animation: sn-zoom-drift-slow 20s linear forwards;
  transition: none;
}
/* Olive background behind portrait (shown only in phase B) */
.sn-olive-bg {
  position: absolute; inset: 0; z-index: 4;
  background: var(--sn-bg-color, #6c5a28);
  opacity: 0; transition: opacity 0.5s ease-out;
}
.sn-olive-bg.sn-on { opacity: 1; }

/* ── left black fade ── */
.sn-left-fade {
  position: absolute; inset: 0; z-index: 7; pointer-events: none;
  background: linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.3) 40%, transparent 64%);
}

/* ── namecard — left-aligned (character cards) ── */
.sn-namecard {
  position: absolute;
  left: clamp(30px,5vw,80px);
  top: 50%;
  transform: translateY(-50%) translateX(-60px);
  z-index: 20; opacity: 0;
  transition: opacity 0.25s ease-out, transform 0.35s cubic-bezier(0.22,1,0.36,1);
}
.sn-namecard.sn-on {
  opacity: 1; transform: translateY(-50%) translateX(0);
}

/* ── namecard — CENTER (title card + directed-by) ── */
.sn-namecard-center {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%,-50%) scale(0.88);
  z-index: 20; opacity: 0;
  transition: opacity 0.3s ease-out, transform 0.4s cubic-bezier(0.22,1,0.36,1);
}
.sn-namecard-center.sn-on {
  opacity: 1; transform: translate(-50%,-50%) scale(1);
}

/* black box shared */
.sn-namecard-box {
  background: #000;
  display: inline-flex; flex-direction: column; align-items: stretch;
  padding: clamp(6px,1vh,12px) clamp(14px,2vw,28px);
  min-width: clamp(180px,28vw,460px);
}
.sn-namecard-box.sn-wide {
  min-width: clamp(220px,38vw,600px);
}
.sn-namecard-hline { width: 100%; height: 2px; background: #fff; flex-shrink: 0; }
.sn-namecard-row {
  display: flex; align-items: center; justify-content: center;
  gap: clamp(8px,1.2vw,18px); padding: clamp(2px,0.5vh,6px) 0;
}
.sn-namecard-star {
  color: #fff; font-size: clamp(0.9rem,1.6vw,2rem); line-height: 1;
  font-family: serif; flex-shrink: 0;
}
.sn-namecard-name {
  font-family: 'Bebas Neue', 'Impact', 'Arial Black', sans-serif;
  font-size: clamp(2.2rem,5vw,7rem); color: #fff;
  letter-spacing: 0.10em; line-height: 1;
  text-transform: uppercase; white-space: nowrap;
}
.sn-namecard-name.sn-big {
  font-size: clamp(2.8rem,7vw,10rem);
}
.sn-namecard-name.sn-small {
  font-size: clamp(1.2rem,2.2vw,3rem); letter-spacing: 0.25em;
}

/* ── sublabel under namecard ── */
.sn-sublabel {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(0.7rem,1vw,1.1rem); letter-spacing: 0.35em;
  color: rgba(255,255,255,0.45); text-transform: uppercase;
  text-align: center;
  margin-top: clamp(6px,0.8vh,12px);
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.35s ease 0.25s, transform 0.35s ease 0.25s;
}
.sn-namecard.sn-on      .sn-sublabel { opacity: 1; transform: translateY(0); }
.sn-namecard-center.sn-on .sn-sublabel { opacity: 1; transform: translateY(0); }

/* ── flash (cut) ── */
.sn-flash {
  position: absolute; inset: 0; z-index: 50;
  background: #fff; opacity: 0; pointer-events: none;
}

/* ── skip button ── */
.sn-skip-btn {
  position: fixed; bottom: 22px; right: 22px; z-index: 10020;
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; background: rgba(0,0,0,0.88);
  border: 1px solid rgba(255,255,255,0.25); border-radius: 1px;
  color: rgba(255,255,255,0.75);
  font-family: 'Bebas Neue', sans-serif;
  font-size: 13px; letter-spacing: 3px; text-transform: uppercase;
  cursor: pointer; opacity: 0; transform: translateY(12px);
  transition: opacity 0.35s, transform 0.35s; pointer-events: auto;
}
.sn-skip-btn.sn-on { opacity: 1; transform: translateY(0); }
.sn-skip-btn:hover { border-color: rgba(255,255,255,0.7); }
`);

let snatchPlaying = false, snatchSkipFlag = false, snatchAudio = null;

// ─── Only real player characters, no GM fallback ──────────────────────────
async function getSnatchPlayersData() {
  const players = [];
  for (const user of game.users.filter(u => u.active && !u.isGM)) {
    const ch = user.character;
    if (!ch) continue;
    let title = ch.getFlag?.(MODULE_ID, 'introTitle') || '';
    if (!title) {
      const cls = Object.values(ch.classes ?? {});
      title = cls.length ? cls.map(c => c.name).join(' / ')
                         : (ch.system?.details?.race || ch.system?.details?.type?.value || '');
      if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
    }
    players.push({
      playerName:    user.name,
      characterName: ch.name,
      portrait:      ch.img || user.avatar || 'icons/svg/mystery-man.svg',
      title,
    });
  }
  return players;
}

// ─── Build a namecard element ─────────────────────────────────────────────
function makeNamecard(text, sublabel = '', center = false, big = false, small = false) {
  const el = document.createElement('div');
  el.className = center ? 'sn-namecard-center' : 'sn-namecard';
  const nameClass = big ? 'sn-namecard-name sn-big' : small ? 'sn-namecard-name sn-small' : 'sn-namecard-name';
  const boxClass  = (center && big) ? 'sn-namecard-box sn-wide' : 'sn-namecard-box';
  el.innerHTML = `
    <div class="${boxClass}">
      <div class="sn-namecard-hline"></div>
      <div class="sn-namecard-row">
        <span class="sn-namecard-star">&#9733;</span>
        <span class="${nameClass}">${text}</span>
        <span class="sn-namecard-star">&#9733;</span>
      </div>
      <div class="sn-namecard-hline"></div>
    </div>
    ${sublabel ? `<div class="sn-sublabel">${sublabel}</div>` : ''}
  `;
  return el;
}

export async function executeSnatchIntro(campaignName = '') {
  if (snatchPlaying) return;
  snatchPlaying  = true;
  snatchSkipFlag = false;
  const isSkip = () => snatchSkipFlag;

  const players = await getSnatchPlayersData();
  const gmUser  = game.users.find(u => u.isGM && u.active) || game.users.find(u => u.isGM);
  const gmName  = gmUser?.name || 'Мастер';

  // Audio at 0:50
  snatchAudio = new Audio(`modules/${MODULE_ID}/assets/sounds/snatch.ogg`);
  snatchAudio.volume = 0.85;
  snatchAudio.currentTime = 50;
  snatchAudio.play().catch(() => {});

  // Build overlay
  const overlay = document.createElement('div');
  overlay.className = 'snatch-overlay';
  overlay.innerHTML = `
    <div class="sn-grain"></div>
    <div class="sn-olive-bg" id="sn-olive"></div>
    <div class="sn-portrait-section" id="sn-ps">
      <div class="sn-portrait-img-wrap">
        <img class="sn-portrait-img" id="sn-img" src="" alt="">
      </div>
    </div>
    <div class="sn-left-fade" id="sn-lf" style="opacity:0;transition:opacity 0.5s"></div>
    <div class="sn-flash" id="sn-fl"></div>
  `;
  document.body.appendChild(overlay);

  // Skip button (GM only)
  let skipBtn = null;
  if (game.user?.isGM) {
    skipBtn = document.createElement('button');
    skipBtn.className = 'sn-skip-btn';
    skipBtn.innerHTML = '<i class="fa-solid fa-forward"></i> Пропустить';
    document.body.appendChild(skipBtn);
    setTimeout(() => skipBtn?.classList.add('sn-on'), 800);
    skipBtn.addEventListener('click', () => {
      snatchSkipFlag = true;
      game.socket?.emit(`module.${MODULE_ID}`, { action: 'snatchSkip' });
      snatchCleanup();
    });
  }

  const img     = overlay.querySelector('#sn-img');
  const olive   = overlay.querySelector('#sn-olive');
  const portSec = overlay.querySelector('#sn-ps');
  const leftFade= overlay.querySelector('#sn-lf');
  const flash   = overlay.querySelector('#sn-fl');

  const doFlash = async (dur = 90) => {
    flash.style.transition = `opacity ${Math.round(dur*0.3)}ms ease`;
    flash.style.opacity = '0.75';
    await waitMs(dur);
    flash.style.transition = `opacity ${Math.round(dur*0.7)}ms ease`;
    flash.style.opacity = '0';
    await waitMs(Math.round(dur * 0.7));
  };

  const showCard = async (card, holdMs, isSkip) => {
    overlay.appendChild(card);
    await waitMs(40);
    card.classList.add('sn-on');
    const skipped = await waitSkippable(holdMs, isSkip);
    card.classList.remove('sn-on');
    await waitMs(250);
    card.remove();
    return skipped;
  };

  // ── PHASE 1: Campaign title card (centered, black bg) ────────────────────
  overlay.classList.add('sn-on'); // fade in overlay (black bg)
  await waitMs(300);
  if (isSkip()) { snatchCleanup(); return; }

  const titleText = (campaignName?.trim() || 'Наша Кампания').toUpperCase();
  const titleCard = makeNamecard(titleText, '', true, true, false);
  if (await showCard(titleCard, 2000, isSkip)) { snatchCleanup(); return; }

  await doFlash(120);
  if (isSkip()) { snatchCleanup(); return; }

  // ── PHASE 2: Character portraits + namecards ──────────────────────────────
  const SN_BG_COLORS = ['#8b1a1a','#1a3a8b','#a07800','#1a6b2a','#6c5a28','#5a1a8b'];

  for (let i = 0; i < players.length; i++) {
    if (isSkip()) break;
    const p = players[i];
    // Pick a random background color for this character
    const bgColor = SN_BG_COLORS[Math.floor(Math.random() * SN_BG_COLORS.length)];
    overlay.style.setProperty('--sn-bg-color', bgColor);

    // Set portrait (full color, black bg first)
    img.src = p.portrait;
    img.className = 'sn-portrait-img';         // reset duotone
    img.style.animation = 'none';
    img.classList.remove('sn-duotone', 'sn-drifting');
    img.style.transform = '';                    // reset to CSS default scale(1.0)
    img.style.transition = '';
    img.offsetHeight;

    olive.classList.remove('sn-on');
    leftFade.style.opacity = '0';
    portSec.classList.add('sn-on');

    await waitMs(1300);                         // viewer sees normal portrait on black
    if (isSkip()) break;

    // Instant bg + duotone; zoom snaps via CSS transition (0.3s)
    olive.style.transition = 'none';
    olive.classList.add('sn-on');
    img.classList.add('sn-duotone');   // triggers transform: scale(1.15) w/ 0.3s ease
    leftFade.style.opacity = '1';
    // After snap completes, switch to slow drift animation
    setTimeout(() => {
      if (!img.classList.contains('sn-duotone')) return;
      img.classList.add('sn-drifting');
    }, 320);

    await waitMs(200);
    if (isSkip()) break;

    // Namecard slams in from left
    const charCard = makeNamecard(p.characterName.toUpperCase(), '— ' + p.playerName + ' —', false, false, false);
    overlay.appendChild(charCard);
    await waitMs(40);
    charCard.classList.add('sn-on');

    if (await waitSkippable(2000, isSkip)) {
      charCard.remove();
      break;
    }

    // Namecard out
    charCard.classList.remove('sn-on');
    await waitMs(250);
    charCard.remove();
    if (isSkip()) break;

    // Flash between characters
    portSec.classList.remove('sn-on');
    await doFlash(100);
    if (isSkip()) break;
    await waitMs(80);
  }

  if (isSkip()) { snatchCleanup(); return; }

  // ── PHASE 3: Directed by GM (centered, black bg) ─────────────────────────
  portSec.classList.remove('sn-on');
  olive.classList.remove('sn-on');
  leftFade.style.opacity = '0';
  overlay.style.background = '#000';

  await waitMs(200);
  if (isSkip()) { snatchCleanup(); return; }

  // "Directed by" small label + GM name
  const dirCard = document.createElement('div');
  dirCard.className = 'sn-namecard-center';
  dirCard.innerHTML = `
    <div class="sn-namecard-box sn-wide">
      <div class="sn-namecard-hline"></div>
      <div class="sn-namecard-row" style="flex-direction:column; gap:0; padding: clamp(4px,0.8vh,10px) 0;">
        <span class="sn-namecard-name sn-small">D I R E C T E D &nbsp; B Y</span>
        <div style="width:100%;height:1px;background:rgba(255,255,255,0.25);margin:clamp(3px,0.5vh,7px) 0;"></div>
        <div style="display:flex;align-items:center;justify-content:center;gap:clamp(8px,1.2vw,18px);">
          <span class="sn-namecard-star">&#9733;</span>
          <span class="sn-namecard-name">${gmName.toUpperCase()}</span>
          <span class="sn-namecard-star">&#9733;</span>
        </div>
      </div>
      <div class="sn-namecard-hline"></div>
    </div>
  `;
  overlay.appendChild(dirCard);
  await waitMs(40);
  dirCard.classList.add('sn-on');

  if (await waitSkippable(2500, isSkip)) { snatchCleanup(); return; }

  // Fade out everything
  overlay.style.transition = 'opacity 1.5s ease-out';
  overlay.style.opacity = '0';
  if (snatchAudio) {
    const steps = 15;
    for (let i = 0; i < steps && !isSkip(); i++) {
      await waitMs(100);
      if (snatchAudio) snatchAudio.volume = Math.max(0, snatchAudio.volume - 0.85 / steps);
    }
  }
  await waitMs(1500);
  snatchCleanup();
}

function snatchCleanup() {
  document.querySelector('.snatch-overlay')?.remove();
  document.querySelector('.sn-skip-btn')?.remove();
  if (snatchAudio) { snatchAudio.pause(); snatchAudio = null; }
  snatchPlaying  = false;
  snatchSkipFlag = false;
}

export function skipSnatchIntro() {
  snatchSkipFlag = true;
  snatchCleanup();
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO INTRO — CSS 1:1 showstopper persona-*
// ═══════════════════════════════════════════════════════════════════════════
injectStyles('dd-hero-styles', `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@700&display=swap');

.persona-intro-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10000;overflow:hidden;cursor:pointer;font-family:'Bebas Neue','Oswald',sans-serif;pointer-events:auto;}
.persona-intro-overlay .persona-band{position:absolute;top:50%;left:0;width:100%;height:22%;transform:translateY(-50%) skewY(-3deg);display:flex;align-items:stretch;z-index:1;}
.persona-intro-overlay .persona-band-white{flex:1;background:linear-gradient(180deg,rgba(245,245,240,.97) 0%,rgba(255,255,255,.99) 50%,rgba(245,245,240,.97) 100%);box-shadow:0 0 60px rgba(255,255,255,.4);transform:translateX(-100%);animation:persona-band-white-in .6s cubic-bezier(.22,1,.36,1) .1s forwards;}
@keyframes persona-band-white-in{0%{transform:translateX(-100%)}100%{transform:translateX(0)}}
.persona-intro-overlay .persona-band-divider{width:clamp(8px,.8vw,12px);background:linear-gradient(180deg,#ff1744 0%,#d50000 50%,#ff1744 100%);box-shadow:0 0 40px rgba(255,23,68,.7),0 0 80px rgba(255,23,68,.4);transform:scaleY(0);animation:persona-divider-in .4s cubic-bezier(.22,1,.36,1) .5s forwards;z-index:2;}
@keyframes persona-divider-in{0%{transform:scaleY(0)}100%{transform:scaleY(1)}}
.persona-intro-overlay .persona-band-black{flex:1;background:linear-gradient(180deg,rgba(15,15,20,.97) 0%,rgba(10,10,12,.99) 50%,rgba(15,15,20,.97) 100%);box-shadow:0 0 60px rgba(0,0,0,.5);transform:translateX(100%);animation:persona-band-black-in .6s cubic-bezier(.22,1,.36,1) .1s forwards;}
@keyframes persona-band-black-in{0%{transform:translateX(100%)}100%{transform:translateX(0)}}
.persona-intro-overlay .persona-portrait-section{position:absolute;bottom:0;left:5%;width:45%;height:100%;display:flex;align-items:flex-end;justify-content:center;z-index:5;pointer-events:none;}
.persona-intro-overlay .persona-portrait-container{position:relative;width:100%;height:95%;display:flex;align-items:flex-end;justify-content:center;opacity:0;transform:translateX(-120px);animation:persona-portrait-in .8s cubic-bezier(.22,1,.36,1) .3s forwards;}
@keyframes persona-portrait-in{0%{opacity:0;transform:translateX(-120px);filter:brightness(.5) saturate(0)}50%{opacity:1;filter:brightness(1.2) saturate(.8)}100%{opacity:1;transform:translateX(0);filter:brightness(1) saturate(1)}}
.persona-intro-overlay .persona-portrait-img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;object-position:center bottom;filter:contrast(1.1) saturate(1.05) drop-shadow(0 10px 40px rgba(0,0,0,.5)) drop-shadow(0 5px 20px rgba(0,0,0,.3));}
.persona-intro-overlay .persona-text-section{position:absolute;top:50%;right:6%;transform:translateY(-50%);text-align:right;z-index:10;}
.persona-intro-overlay .persona-title-line{overflow:hidden;margin-bottom:clamp(8px,.8vw,12px);}
.persona-intro-overlay .persona-title{display:inline-block;font-size:clamp(1rem,1.2vw,1.5rem);font-weight:400;letter-spacing:clamp(5px,.7vw,10px);text-transform:uppercase;color:#ff1744;text-shadow:0 0 30px rgba(255,23,68,.6),0 0 60px rgba(255,23,68,.3);opacity:0;transform:translateX(80px);animation:persona-text-in .7s cubic-bezier(.22,1,.36,1) .6s forwards;}
@keyframes persona-text-in{0%{opacity:0;transform:translateX(80px)}100%{opacity:1;transform:translateX(0)}}
.persona-intro-overlay .persona-name-wrapper{position:relative;overflow:hidden;}
.persona-intro-overlay .persona-name{font-family:'Bebas Neue',sans-serif;font-size:clamp(4rem,7vw,8rem);font-weight:400;color:#fff;margin:0;line-height:.85;letter-spacing:clamp(4px,.6vw,8px);text-transform:uppercase;text-shadow:5px 5px 0 rgba(10,10,10,.9),-3px -3px 0 rgba(10,10,10,.5),0 0 60px rgba(255,255,255,.4),0 0 100px rgba(255,255,255,.2);opacity:0;transform:translateX(100px);animation:persona-text-in .8s cubic-bezier(.22,1,.36,1) .75s forwards;}
.persona-intro-overlay .persona-name-strike{position:absolute;bottom:clamp(8px,.8vw,12px);right:0;width:100%;height:clamp(3px,.35vw,5px);background:linear-gradient(90deg,transparent 0%,#ff1744 30%,#ff1744 100%);transform:scaleX(0);transform-origin:right;animation:persona-strike-in .6s cubic-bezier(.22,1,.36,1) 1s forwards;box-shadow:0 0 20px rgba(255,23,68,.7),0 0 40px rgba(255,23,68,.4);}
@keyframes persona-strike-in{0%{transform:scaleX(0);opacity:0}100%{transform:scaleX(1);opacity:1}}
.persona-intro-overlay.persona-closing .persona-band-white{animation:persona-band-white-out .6s cubic-bezier(.55,0,1,.45) forwards;}
@keyframes persona-band-white-out{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}
.persona-intro-overlay.persona-closing .persona-band-black{animation:persona-band-black-out .6s cubic-bezier(.55,0,1,.45) forwards;}
@keyframes persona-band-black-out{0%{transform:translateX(0)}100%{transform:translateX(100%)}}
.persona-intro-overlay.persona-closing .persona-band-divider{animation:persona-divider-out .4s cubic-bezier(.55,0,1,.45) forwards;}
@keyframes persona-divider-out{0%{transform:scaleY(1);opacity:1}100%{transform:scaleY(0);opacity:0}}
.persona-intro-overlay.persona-closing .persona-portrait-container{animation:persona-portrait-out .6s cubic-bezier(.55,0,1,.45) forwards;}
@keyframes persona-portrait-out{0%{opacity:1;transform:translateX(0);filter:brightness(1) saturate(1)}100%{opacity:0;transform:translateX(-100px);filter:brightness(.5) saturate(0)}}
.persona-intro-overlay.persona-closing .persona-title{animation:persona-text-out .5s cubic-bezier(.55,0,1,.45) forwards;}
.persona-intro-overlay.persona-closing .persona-name{animation:persona-text-out .6s cubic-bezier(.55,0,1,.45) .05s forwards;}
@keyframes persona-text-out{0%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(60px)}}
.persona-intro-overlay.persona-closing .persona-name-strike{animation:persona-strike-out .4s cubic-bezier(.55,0,1,.45) forwards;}
@keyframes persona-strike-out{0%{transform:scaleX(1);opacity:1}100%{transform:scaleX(0);opacity:0}}
`);

export function executeHeroIntro(data) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.innerHTML = `<div class="persona-intro-overlay">
      <div class="persona-band">
        <div class="persona-band-white"></div>
        <div class="persona-band-divider"></div>
        <div class="persona-band-black"></div>
      </div>
      <div class="persona-portrait-section">
        <div class="persona-portrait-container">
          <img src="${data.portrait}" class="persona-portrait-img" alt="${data.name}">
        </div>
      </div>
      <div class="persona-text-section">
        <div class="persona-title-line"><span class="persona-title">${data.title||''}</span></div>
        <div class="persona-name-wrapper">
          <h1 class="persona-name">${data.name}</h1>
          <div class="persona-name-strike"></div>
        </div>
      </div>
    </div>`;
    const overlay = el.firstElementChild;
    document.body.appendChild(overlay);
    let closed = false, canClick = false;
    const close = () => {
      if (closed) return; closed = true;
      overlay.classList.add('persona-closing');
      document.removeEventListener('keydown', esc);
      setTimeout(() => { overlay.remove(); resolve(); }, 800);
    };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', (e) => { if (!canClick) { e.preventDefault(); e.stopPropagation(); return; } close(); });
    document.addEventListener('keydown', esc);
    setTimeout(() => { canClick = true; }, 1500);
    setTimeout(close, 6000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// VILLAIN INTRO — CSS 1:1 showstopper villain-*
// ═══════════════════════════════════════════════════════════════════════════
injectStyles('dd-villain-styles', `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap');

.villain-intro-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10000;overflow:hidden;cursor:pointer;font-family:'Cinzel',serif;}
.villain-intro-overlay .villain-darkness{position:absolute;inset:0;background:radial-gradient(ellipse at center,#1a0a10 0%,#0a0208 50%,#000 100%);opacity:0;animation:villain-darkness-in .5s ease-out forwards;}
@keyframes villain-darkness-in{0%{opacity:0}100%{opacity:1}}
.villain-intro-overlay .villain-blood-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 30%,rgba(80,0,0,.4) 70%,rgba(40,0,0,.8) 100%);opacity:0;animation:villain-vignette-in 1s ease-out .3s forwards,villain-vignette-pulse 4s ease-in-out 1.5s infinite;}
@keyframes villain-vignette-in{0%{opacity:0}100%{opacity:1}}
@keyframes villain-vignette-pulse{0%,100%{opacity:1}50%{opacity:.7}}
.villain-intro-overlay .villain-static-noise{position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");opacity:0;mix-blend-mode:overlay;animation:villain-noise-in .5s ease-out .2s forwards;pointer-events:none;}
@keyframes villain-noise-in{0%{opacity:0}100%{opacity:.08}}
.villain-intro-overlay .villain-slash-container{position:absolute;inset:0;pointer-events:none;z-index:3;}
.villain-intro-overlay .villain-slash{position:absolute;background:linear-gradient(90deg,transparent,rgba(200,0,30,.8),transparent);height:3px;width:150%;left:-25%;box-shadow:0 0 30px rgba(200,0,30,.8),0 0 60px rgba(200,0,30,.4);opacity:0;}
.villain-intro-overlay .villain-slash.s1{top:30%;transform:rotate(-5deg) scaleX(0);animation:villain-slash-in .3s ease-out .4s forwards;}
.villain-intro-overlay .villain-slash.s2{top:50%;transform:rotate(3deg) scaleX(0);animation:villain-slash-in .3s ease-out .5s forwards;}
.villain-intro-overlay .villain-slash.s3{top:70%;transform:rotate(-2deg) scaleX(0);animation:villain-slash-in .3s ease-out .6s forwards;}
@keyframes villain-slash-in{0%{opacity:0}50%{opacity:1}100%{opacity:.3}}
.villain-intro-overlay .villain-lightning-flash{position:absolute;inset:0;background:rgba(200,0,30,.6);opacity:0;pointer-events:none;z-index:100;animation:villain-flash .15s ease-out .3s forwards,villain-flash-repeat 5s ease-out 2s infinite;}
@keyframes villain-flash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
@keyframes villain-flash-repeat{0%,100%{opacity:0}2%{opacity:.5}4%{opacity:0}6%{opacity:.3}8%{opacity:0}}
.villain-intro-overlay .villain-portrait-section{position:absolute;bottom:0;left:8%;width:50%;height:100%;display:flex;align-items:flex-end;justify-content:center;z-index:10;pointer-events:none;}
.villain-intro-overlay .villain-portrait-aura{position:absolute;bottom:10%;left:50%;transform:translateX(-50%);width:120%;height:80%;background:radial-gradient(ellipse at 50% 100%,rgba(150,0,30,.4) 0%,rgba(80,0,20,.2) 40%,transparent 70%);opacity:0;animation:villain-aura-in 1s ease-out .5s forwards,villain-aura-pulse 3s ease-in-out 1.5s infinite;}
@keyframes villain-aura-in{0%{opacity:0;transform:translateX(-50%) scale(.5)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes villain-aura-pulse{0%,100%{opacity:1;transform:translateX(-50%) scale(1)}50%{opacity:.7;transform:translateX(-50%) scale(1.1)}}
.villain-intro-overlay .villain-portrait-container{position:relative;width:100%;height:95%;display:flex;align-items:flex-end;justify-content:center;opacity:0;transform:scale(1.1) translateY(50px);animation:villain-portrait-in .8s cubic-bezier(.16,1,.3,1) .4s forwards;}
@keyframes villain-portrait-in{0%{opacity:0;transform:scale(1.1) translateY(50px);filter:brightness(0) contrast(2)}40%{filter:brightness(1.5) contrast(1.5) saturate(.5)}100%{opacity:1;transform:scale(1) translateY(0);filter:brightness(.95) contrast(1.2) saturate(.9)}}
.villain-intro-overlay .villain-portrait-img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;object-position:center bottom;filter:contrast(1.2) saturate(.9) brightness(.95) drop-shadow(0 0 60px rgba(150,0,30,.6)) drop-shadow(0 20px 40px rgba(0,0,0,.8));animation:villain-img-glitch 6s steps(1) 1.5s infinite;}
@keyframes villain-img-glitch{0%,100%{transform:translate(0,0)}92%{transform:translate(0,0)}93%{transform:translate(-5px,2px);filter:hue-rotate(90deg)}94%{transform:translate(5px,-2px)}95%{transform:translate(-3px,-3px);filter:hue-rotate(-90deg)}96%{transform:translate(3px,3px)}97%{transform:translate(0,0);filter:none}}
.villain-intro-overlay .villain-portrait-glitch{position:absolute;inset:0;background:linear-gradient(transparent 0%,rgba(200,0,30,.1) 50%,transparent 100%);opacity:0;animation:villain-glitch-scan 3s linear 1s infinite;}
@keyframes villain-glitch-scan{0%{opacity:0;transform:translateY(-100%)}10%{opacity:1}90%{opacity:1}100%{opacity:0;transform:translateY(100%)}}
.villain-intro-overlay .villain-shadow-tendrils{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:200%;height:30%;background:linear-gradient(to top,rgba(0,0,0,.9) 0%,transparent 100%);opacity:0;animation:villain-tendrils-in 1s ease-out .6s forwards;}
@keyframes villain-tendrils-in{0%{opacity:0;transform:translateX(-50%) scaleY(0)}100%{opacity:1;transform:translateX(-50%) scaleY(1)}}
.villain-intro-overlay .villain-text-section{position:absolute;top:50%;right:5%;transform:translateY(-50%);text-align:right;z-index:20;max-width:45%;}
.villain-intro-overlay .villain-threat-text{font-size:clamp(.65rem,.8vw,.9rem);font-weight:700;letter-spacing:clamp(4px,.5vw,8px);text-transform:uppercase;color:rgba(200,50,50,.9);text-shadow:0 0 30px rgba(200,0,30,.8);margin-bottom:clamp(12px,1.3vw,20px);opacity:0;transform:translateX(50px);animation:villain-text-in .6s ease-out .8s forwards,villain-threat-pulse 3s ease-in-out 1.5s infinite;}
@keyframes villain-text-in{0%{opacity:0;transform:translateX(50px)}100%{opacity:1;transform:translateX(0)}}
@keyframes villain-threat-pulse{0%,100%{opacity:1}50%{opacity:.6}}
.villain-intro-overlay .villain-title-wrapper{margin-bottom:clamp(10px,1vw,15px);overflow:hidden;}
.villain-intro-overlay .villain-title{display:inline-block;font-size:clamp(.9rem,1.1vw,1.3rem);font-weight:700;letter-spacing:clamp(3px,.4vw,6px);text-transform:uppercase;color:rgba(180,120,120,.9);opacity:0;transform:translateX(60px);animation:villain-text-in .7s ease-out 1s forwards;}
.villain-intro-overlay .villain-name-wrapper{position:relative;margin-bottom:clamp(12px,1.3vw,20px);}
.villain-intro-overlay .villain-name{font-size:clamp(2.5rem,4.5vw,5.5rem);font-weight:900;color:#f0e6e6;margin:0;line-height:.9;letter-spacing:clamp(3px,.4vw,6px);text-transform:uppercase;text-shadow:0 0 60px rgba(200,0,30,.8),0 0 120px rgba(200,0,30,.4),4px 4px 0 rgba(100,0,20,.8),-2px -2px 0 rgba(0,0,0,.5);opacity:0;transform:translateX(80px) scale(.95);animation:villain-name-in .8s cubic-bezier(.16,1,.3,1) 1.1s forwards;}
@keyframes villain-name-in{0%{opacity:0;transform:translateX(80px) scale(.95);filter:blur(10px)}60%{filter:blur(2px)}100%{opacity:1;transform:translateX(0) scale(1);filter:blur(0)}}
.villain-intro-overlay .villain-name-glow{position:absolute;inset:-20px;background:radial-gradient(ellipse at center,rgba(200,0,30,.3) 0%,transparent 70%);opacity:0;animation:villain-glow-in 1s ease-out 1.3s forwards,villain-glow-pulse 2s ease-in-out 2.5s infinite;z-index:-1;}
@keyframes villain-glow-in{0%{opacity:0}100%{opacity:1}}
@keyframes villain-glow-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.1)}}
.villain-intro-overlay .villain-underline{height:clamp(2px,.25vw,4px);background:linear-gradient(90deg,transparent 0%,rgba(200,0,30,.9) 50%,transparent 100%);transform:scaleX(0);animation:villain-underline-in .6s ease-out 1.4s forwards;box-shadow:0 0 20px rgba(200,0,30,.8);}
@keyframes villain-underline-in{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
.villain-intro-overlay .villain-particles{position:absolute;inset:0;pointer-events:none;z-index:5;}
.villain-intro-overlay .villain-particle{position:absolute;background:radial-gradient(circle,rgba(200,50,50,1) 0%,rgba(150,0,30,.5) 50%,transparent 100%);border-radius:50%;opacity:0;animation:villain-particle-float var(--duration) ease-in-out var(--delay) infinite;}
@keyframes villain-particle-float{0%,100%{opacity:0;transform:translate(0,0) scale(0)}20%{opacity:.8;transform:translate(calc(var(--drift-x)*.2),calc(var(--drift-y)*.2)) scale(1)}80%{opacity:.4}100%{opacity:0;transform:translate(var(--drift-x),var(--drift-y)) scale(0)}}
.villain-intro-overlay .villain-frame{position:absolute;inset:clamp(20px,2.5vw,40px);pointer-events:none;z-index:25;}
.villain-intro-overlay .villain-frame-corner{position:absolute;width:clamp(50px,5vw,80px);height:clamp(50px,5vw,80px);opacity:0;}
.villain-intro-overlay .villain-frame-corner::before,.villain-intro-overlay .villain-frame-corner::after{content:'';position:absolute;background:linear-gradient(90deg,rgba(200,0,30,.8),transparent);}
.villain-intro-overlay .villain-frame-corner::before{width:100%;height:3px;}
.villain-intro-overlay .villain-frame-corner::after{width:3px;height:100%;}
.villain-intro-overlay .villain-frame-corner.tl{top:0;left:0;animation:villain-corner-in .5s ease-out 1s forwards;}
.villain-intro-overlay .villain-frame-corner.tl::before{top:0;left:0;}
.villain-intro-overlay .villain-frame-corner.tl::after{top:0;left:0;}
.villain-intro-overlay .villain-frame-corner.tr{top:0;right:0;animation:villain-corner-in .5s ease-out 1.1s forwards;}
.villain-intro-overlay .villain-frame-corner.tr::before{top:0;right:0;background:linear-gradient(-90deg,rgba(200,0,30,.8),transparent);}
.villain-intro-overlay .villain-frame-corner.tr::after{top:0;right:0;}
.villain-intro-overlay .villain-frame-corner.bl{bottom:0;left:0;animation:villain-corner-in .5s ease-out 1.2s forwards;}
.villain-intro-overlay .villain-frame-corner.bl::before{bottom:0;left:0;}
.villain-intro-overlay .villain-frame-corner.bl::after{bottom:0;left:0;}
.villain-intro-overlay .villain-frame-corner.br{bottom:0;right:0;animation:villain-corner-in .5s ease-out 1.3s forwards;}
.villain-intro-overlay .villain-frame-corner.br::before{bottom:0;right:0;background:linear-gradient(-90deg,rgba(200,0,30,.8),transparent);}
.villain-intro-overlay .villain-frame-corner.br::after{bottom:0;right:0;}
@keyframes villain-corner-in{0%{opacity:0;transform:scale(.5)}100%{opacity:1;transform:scale(1)}}
.villain-intro-overlay.villain-closing .villain-darkness{animation:villain-darkness-out .6s ease-in forwards;}
@keyframes villain-darkness-out{0%{opacity:1}100%{opacity:0}}
.villain-intro-overlay.villain-closing .villain-portrait-container{animation:villain-portrait-out .5s ease-in forwards;}
@keyframes villain-portrait-out{0%{opacity:1;transform:scale(1) translateY(0)}100%{opacity:0;transform:scale(.9) translateY(50px);filter:brightness(0)}}
.villain-intro-overlay.villain-closing .villain-threat-text,.villain-intro-overlay.villain-closing .villain-title,.villain-intro-overlay.villain-closing .villain-name{animation:villain-text-out .4s ease-in forwards;}
@keyframes villain-text-out{0%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(30px)}}
.villain-intro-overlay.villain-closing .villain-underline,.villain-intro-overlay.villain-closing .villain-frame-corner,.villain-intro-overlay.villain-closing .villain-blood-vignette,.villain-intro-overlay.villain-closing .villain-slash,.villain-intro-overlay.villain-closing .villain-portrait-aura{animation:villain-fade-out .4s ease-in forwards;}
@keyframes villain-fade-out{0%{opacity:1}100%{opacity:0}}
`);

export function executeVillainIntro(data) {
  return new Promise((resolve) => {
    const pid = `vp-${Date.now()}`;
    const el = document.createElement('div');
    el.innerHTML = `<div class="villain-intro-overlay">
      <div class="villain-darkness"></div>
      <div class="villain-blood-vignette"></div>
      <div class="villain-static-noise"></div>
      <div class="villain-slash-container">
        <div class="villain-slash s1"></div><div class="villain-slash s2"></div><div class="villain-slash s3"></div>
      </div>
      <div class="villain-lightning-flash"></div>
      <div class="villain-portrait-section">
        <div class="villain-portrait-aura"></div>
        <div class="villain-portrait-container">
          <img src="${data.portrait}" class="villain-portrait-img" alt="${data.name}">
          <div class="villain-portrait-glitch"></div>
        </div>
        <div class="villain-shadow-tendrils"></div>
      </div>
      <div class="villain-text-section">
        <div class="villain-threat-text">— УГРОЗА ПРИБЛИЖАЕТСЯ —</div>
        <div class="villain-title-wrapper"><span class="villain-title">${data.title||''}</span></div>
        <div class="villain-name-wrapper">
          <h1 class="villain-name">${data.name}</h1>
          <div class="villain-name-glow"></div>
        </div>
        <div class="villain-underline"></div>
      </div>
      <div class="villain-particles" id="${pid}"></div>
      <div class="villain-frame">
        <div class="villain-frame-corner tl"></div><div class="villain-frame-corner tr"></div>
        <div class="villain-frame-corner bl"></div><div class="villain-frame-corner br"></div>
      </div>
    </div>`;
    const overlay = el.firstElementChild;
    document.body.appendChild(overlay);
    const pc = overlay.querySelector(`#${pid}`);
    for (let i = 0; i < 35; i++) {
      const p = document.createElement('div'); p.className = 'villain-particle';
      const sz = 2 + Math.random() * 4;
      p.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${sz}px;height:${sz}px;--delay:${Math.random()*3}s;--duration:${3+Math.random()*4}s;--drift-x:${(Math.random()-.5)*100}px;--drift-y:${-50-Math.random()*100}px;`;
      pc.appendChild(p);
    }
    let closed = false, canClick = false;
    const close = () => {
      if (closed) return; closed = true;
      overlay.classList.add('villain-closing');
      document.removeEventListener('keydown', esc);
      setTimeout(() => { overlay.remove(); resolve(); }, 800);
    };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', (e) => { if (!canClick) { e.preventDefault(); e.stopPropagation(); return; } close(); });
    document.addEventListener('keydown', esc);
    setTimeout(() => { canClick = true; }, 1500);
    setTimeout(close, 7000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GENSHIN INTRO — CSS 1:1 showstopper h-*
// ═══════════════════════════════════════════════════════════════════════════
injectStyles('dd-genshin-styles', `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Roboto:wght@400;500&display=swap');

.genshin-intro-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10000;display:flex;align-items:center;justify-content:center;font-family:'Roboto',sans-serif;cursor:pointer;overflow:hidden;pointer-events:auto;}
.genshin-intro-overlay .h-backdrop{position:absolute;width:100%;height:100%;background:rgba(20,20,25,.4);backdrop-filter:blur(8px);opacity:0;animation:h-fadeIn .5s ease-out forwards;}
.genshin-intro-overlay .h-banner-container{position:relative;width:100%;height:clamp(220px,18vw,350px);background:linear-gradient(90deg,#F2F1EC 0%,#FDFCF8 50%,#F2F1EC 100%);display:flex;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.3);clip-path:inset(0 100% 0 0);animation:h-wipeIn .8s cubic-bezier(.16,1,.3,1) forwards .1s;}
.genshin-intro-overlay .h-portrait-section{position:absolute;left:15%;width:clamp(180px,15vw,280px);height:clamp(180px,15vw,280px);z-index:10;display:flex;justify-content:center;align-items:center;opacity:0;transform:translateX(-50px);animation:h-slideRight .8s cubic-bezier(.34,1.56,.64,1) forwards .4s;}
.genshin-intro-overlay .h-ring-outer{position:absolute;width:clamp(200px,17vw,320px);height:clamp(200px,17vw,320px);border:1px solid rgba(150,150,150,.3);border-radius:50%;animation:h-spin 20s linear infinite;}
.genshin-intro-overlay .h-ring-inner{position:absolute;width:clamp(170px,14vw,270px);height:clamp(170px,14vw,270px);border:2px dashed #D4AF37;border-radius:50%;opacity:.6;animation:h-spinReverse 30s linear infinite;}
.genshin-intro-overlay .h-portrait-mask{width:clamp(150px,12.5vw,240px);height:clamp(150px,12.5vw,240px);border-radius:50%;overflow:hidden;border:clamp(2px,.2vw,4px) solid #fff;box-shadow:0 0 15px rgba(0,0,0,.2);z-index:2;background:#e0e0e0;}
.genshin-intro-overlay .h-portrait-img{width:100%;height:100%;object-fit:cover;object-position:top center;animation:h-zoomOut 5s ease-out forwards;}
.genshin-intro-overlay .h-dec-point{position:absolute;width:clamp(5px,.4vw,8px);height:clamp(5px,.4vw,8px);background:#D4AF37;transform:rotate(45deg);z-index:5;}
.genshin-intro-overlay .p-top{top:clamp(-12px,-1vw,-20px);}
.genshin-intro-overlay .p-bottom{bottom:clamp(-12px,-1vw,-20px);}
.genshin-intro-overlay .p-left{left:clamp(-12px,-1vw,-20px);}
.genshin-intro-overlay .p-right{right:clamp(-12px,-1vw,-20px);}
.genshin-intro-overlay .h-content-section{margin-left:35%;width:50%;max-height:clamp(180px,15vw,280px);position:relative;z-index:5;padding-right:clamp(25px,3vw,50px);display:flex;flex-direction:column;}
.genshin-intro-overlay .h-watermark{position:absolute;right:0;top:clamp(-30px,-2.5vw,-50px);font-size:clamp(100px,10vw,200px);color:rgba(0,0,0,.03);pointer-events:none;z-index:-1;line-height:1;}
.genshin-intro-overlay .h-name{font-family:'Oswald',sans-serif;font-size:clamp(2rem,3.5vw,4rem);color:#3B4255;margin:0;line-height:1;text-transform:uppercase;letter-spacing:clamp(.5px,.1vw,1px);flex-shrink:0;opacity:0;transform:translateX(30px);animation:h-slideLeft .6s ease-out forwards .5s;}
.genshin-intro-overlay .h-title-box{display:inline-block;background:#E6D5A8;color:#5A4A32;padding:clamp(2px,.2vw,4px) clamp(8px,.8vw,12px);font-size:clamp(.7rem,.8vw,1rem);font-weight:700;margin:clamp(6px,.6vw,10px) 0 clamp(10px,1vw,15px) 0;text-transform:uppercase;flex-shrink:0;align-self:flex-start;opacity:0;transform:translateX(30px);animation:h-slideLeft .6s ease-out forwards .6s;}
.genshin-intro-overlay .h-description{font-size:clamp(.8rem,.9vw,1.1rem);color:#555;line-height:1.6;max-width:700px;max-height:clamp(80px,7vw,120px);overflow-y:auto;border-left:3px solid rgba(0,0,0,.1);padding-left:clamp(10px,1vw,15px);padding-right:10px;opacity:0;transform:translateX(30px);animation:h-slideLeft .6s ease-out forwards .7s;}
.genshin-intro-overlay .h-footer-strip{position:absolute;bottom:0;left:0;width:100%;height:clamp(28px,2.5vw,40px);background:rgba(59,66,85,.9);z-index:20;display:flex;align-items:center;justify-content:center;opacity:0;animation:h-footerIn .6s ease-out forwards .9s;}
.genshin-intro-overlay .h-footer-text{color:#CCC;font-size:clamp(.65rem,.7vw,.9rem);text-transform:uppercase;letter-spacing:clamp(1px,.15vw,2px);opacity:0;animation:h-fadeIn .5s ease-out forwards 1.1s;}
@keyframes h-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes h-wipeIn{0%{clip-path:inset(0 100% 0 0)}100%{clip-path:inset(0 0 0 0)}}
@keyframes h-slideRight{from{opacity:0;transform:translateX(-50px)}to{opacity:1;transform:translateX(0)}}
@keyframes h-slideLeft{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
@keyframes h-footerIn{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
@keyframes h-zoomOut{0%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes h-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes h-spinReverse{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
.genshin-intro-overlay.h-closing .h-backdrop{animation:h-fadeOut .5s ease-in forwards;}
.genshin-intro-overlay.h-closing .h-banner-container{animation:h-wipeOut .5s ease-in forwards;}
.genshin-intro-overlay.h-closing .h-portrait-section{animation:h-slideOutLeft .4s ease-in forwards;}
.genshin-intro-overlay.h-closing .h-name,.genshin-intro-overlay.h-closing .h-title-box,.genshin-intro-overlay.h-closing .h-description{animation:h-slideOutRight .3s ease-in forwards;}
.genshin-intro-overlay.h-closing .h-footer-strip{animation:h-footerOut .3s ease-in forwards;}
@keyframes h-fadeOut{from{opacity:1}to{opacity:0}}
@keyframes h-wipeOut{0%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 0 100%)}}
@keyframes h-slideOutLeft{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-80px)}}
@keyframes h-slideOutRight{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(50px)}}
@keyframes h-footerOut{from{opacity:1;transform:scaleX(1)}to{opacity:0;transform:scaleX(0)}}
`);

const ELEMENTS = { pyro:'🔥', hydro:'💧', electro:'⚡', cryo:'❄️', anemo:'🌀', geo:'🪨', dendro:'🌿', none:'✦' };

function detectElement(name, items) {
  const c = (name + ' ' + items).toLowerCase();
  if (/fire|flame|burn|pyro/.test(c))           return 'pyro';
  if (/water|hydro|ocean|sea/.test(c))           return 'hydro';
  if (/lightning|thunder|shock|electro/.test(c)) return 'electro';
  if (/ice|cold|frozen|frost|cryo/.test(c))      return 'cryo';
  if (/wind|air|storm|anemo/.test(c))            return 'anemo';
  if (/earth|stone|rock|geo/.test(c))            return 'geo';
  if (/nature|plant|leaf|dendro/.test(c))        return 'dendro';
  return 'none';
}

export function executeGenshinIntro(data) {
  return new Promise((resolve) => {
    const token = canvas?.tokens?.controlled?.[0];
    const elem = token?.actor ? detectElement(token.actor.name, token.actor.items?.map(i=>i.name).join(' ')||'') : 'none';
    const icon = ELEMENTS[elem] ?? '✦';
    const el = document.createElement('div');
    el.innerHTML = `<div class="genshin-intro-overlay">
      <div class="h-backdrop"></div>
      <div class="h-banner-container">
        <div class="h-portrait-section">
          <div class="h-ring-outer"></div><div class="h-ring-inner"></div>
          <div class="h-portrait-mask">
            <img src="${data.portrait}" class="h-portrait-img" alt="${data.name}">
          </div>
          <div class="h-dec-point p-top"></div><div class="h-dec-point p-bottom"></div>
          <div class="h-dec-point p-left"></div><div class="h-dec-point p-right"></div>
        </div>
        <div class="h-content-section">
          <div class="h-watermark">${icon}</div>
          <h1 class="h-name">${data.name}</h1>
          <div class="h-title-box">${data.title||''}</div>
          ${data.description ? `<div class="h-description">${data.description.slice(0,120)}</div>` : ''}
        </div>
        <div class="h-footer-strip"><span class="h-footer-text">Нажмите, чтобы продолжить</span></div>
      </div>
    </div>`;
    const overlay = el.firstElementChild;
    document.body.appendChild(overlay);
    let closed = false, canClick = false;
    const close = () => {
      if (closed) return; closed = true;
      overlay.classList.add('h-closing');
      document.removeEventListener('keydown', esc);
      setTimeout(() => { overlay.remove(); resolve(); }, 600);
    };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', () => { if (canClick) close(); });
    document.addEventListener('keydown', esc);
    setTimeout(() => { canClick = true; }, 1500);
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// MACHETE INTRO — Robert Rodriguez / Grindhouse / Mexploitation style
// ═══════════════════════════════════════════════════════════════════════════

injectStyles('dd-machete-styles', `
@import url('https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Oswald:wght@700&display=swap');

/* ── base overlay ── */
.mch-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 10000; overflow: hidden; pointer-events: auto;
  background: #0a0600;
}

/* ── vignette ── */
.mch-vignette {
  position: absolute; inset: 0; z-index: 60; pointer-events: none;
  background: radial-gradient(ellipse at center,
    transparent 40%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.92) 100%);
}

/* ── film grain (heavy) ── */
.mch-grain {
  position: absolute; inset: 0; z-index: 61; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  opacity: 0.18; mix-blend-mode: overlay;
  animation: mch-grain-shift 0.07s steps(4) infinite;
}
@keyframes mch-grain-shift {
  0%   { background-position: 0 0; }
  25%  { background-position: 15px -12px; }
  50%  { background-position: -9px 18px; }
  75%  { background-position: 6px -6px; }
}

/* ── horizontal film scratches ── */
.mch-scratches {
  position: absolute; inset: 0; z-index: 62; pointer-events: none;
  opacity: 0;
  animation: mch-scratch-appear 4s steps(1) infinite;
}
.mch-scratch-line {
  position: absolute; left: 0; width: 100%;
  height: 1px; background: rgba(255,240,180,0.6);
}
@keyframes mch-scratch-appear {
  0%   { opacity: 0; }
  5%   { opacity: 1; }
  8%   { opacity: 0; }
  45%  { opacity: 0; }
  47%  { opacity: 1; }
  50%  { opacity: 0; }
  80%  { opacity: 0; }
  82%  { opacity: 1; }
  84%  { opacity: 0; }
}

/* ── cigarette burn (reel change marker — top right circle) ── */
.mch-burn {
  position: absolute; top: clamp(12px, 2vh, 28px); right: clamp(12px, 2vw, 28px);
  z-index: 65; width: clamp(20px,2.5vw,36px); height: clamp(20px,2.5vw,36px);
  border-radius: 50%; background: rgba(255,240,160,0.9);
  box-shadow: 0 0 18px 6px rgba(255,200,80,0.7);
  opacity: 0; pointer-events: none;
  animation: mch-burn-flicker 0.18s steps(2) 2;
}
@keyframes mch-burn-flicker { 0%{opacity:0;} 50%{opacity:1;} 100%{opacity:0;} }

/* ── black curtain for cuts ── */
.mch-curtain {
  position: absolute; inset: 0; z-index: 70;
  background: #000; opacity: 1; pointer-events: none;
  transition: opacity 0.25s ease-in-out;
}
.mch-curtain.mch-open { opacity: 0; }

/* ── warm amber color grade applied to content layer ── */
.mch-content {
  position: absolute; inset: 0; z-index: 10;
  /* warm orange tint via CSS filter — classic 70s exploitation look */
  filter: sepia(0.55) saturate(1.9) hue-rotate(-8deg) contrast(1.15) brightness(1.05);
}

/* ══ FILM LEADER COUNTDOWN ══ */
.mch-leader {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: #e8d89a;
}
.mch-leader-circle {
  width: clamp(180px, 28vw, 380px); height: clamp(180px, 28vw, 380px);
  border-radius: 50%; border: clamp(6px, 1vw, 14px) solid #8a6a10;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.mch-leader-circle::before {
  content: ''; position: absolute; inset: clamp(14px,2vw,22px);
  border-radius: 50%; border: clamp(3px, 0.5vw, 6px) solid #8a6a10;
}
/* Crosshair lines */
.mch-leader-circle::after {
  content: ''; position: absolute;
  width: 100%; height: clamp(2px,0.3vw,4px); background: #8a6a10;
  box-shadow: 0 calc(clamp(180px,28vw,380px)/2) 0 #8a6a10,
              0 calc(-1 * clamp(180px,28vw,380px)/2) 0 #8a6a10;
}
.mch-leader-num {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(5rem, 15vw, 18rem);
  color: #8a6a10; line-height: 1;
  position: relative; z-index: 2;
}
/* Vertical crosshair */
.mch-leader-vert {
  position: absolute; top: 0; bottom: 0;
  left: 50%; width: clamp(2px,0.3vw,4px);
  background: #8a6a10; transform: translateX(-50%);
}

/* ══ TITLE CARD ══ */
.mch-title-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: #1a0e00;
}
.mch-presents {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(0.8rem, 1.4vw, 1.7rem);
  color: #c8920a; letter-spacing: 0.5em; text-transform: uppercase;
  margin-bottom: clamp(8px, 1.5vh, 22px);
  text-shadow: 0 0 30px rgba(200,146,10,0.4);
}
.mch-title {
  font-family: 'Alfa Slab One', serif;
  font-size: clamp(3.5rem, 11vw, 15rem);
  color: #d4821e;
  text-transform: uppercase; text-align: center;
  line-height: 0.88; letter-spacing: 0.03em;
  text-shadow:
    3px 3px 0 #7a3a00,
    6px 6px 0 #3a1800,
    0 0 80px rgba(212,130,30,0.5);
  position: relative;
}
/* Extrusion effect — like the actual Machete logo */
.mch-title::after {
  content: attr(data-text);
  position: absolute; top: 5px; left: 5px; z-index: -1;
  color: #7a3a00;
  font-family: inherit; font-size: inherit; text-transform: inherit;
  line-height: inherit; letter-spacing: inherit;
  white-space: pre-wrap;
}

/* ══ LOBBY CARD (character card) ══ */
.mch-lobby-card {
  position: absolute; inset: 0;
  display: flex; align-items: stretch;
  background: #1a0e00;
}
/* Portrait half */
.mch-port-half {
  position: relative; overflow: hidden;
  flex: 0 0 52%;
  display: flex; align-items: flex-end;
}
.mch-port-half.mch-right { order: 2; }
.mch-port-half.mch-left  { order: 1; }

.mch-port-img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: center top;
  /* Warm exploitation look: sepia + high contrast + slightly overexposed */
  filter: sepia(0.45) saturate(1.6) contrast(1.2) brightness(1.08);
  display: block;
}

/* Lobby card damage texture over portrait */
.mch-port-damage {
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 3px,
      rgba(0,0,0,0.04) 3px,
      rgba(0,0,0,0.04) 4px
    ),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 6px,
      rgba(0,0,0,0.03) 6px,
      rgba(0,0,0,0.03) 7px
    );
  pointer-events: none;
}
/* Framed border on portrait like a real lobby card */
.mch-port-border {
  position: absolute; inset: clamp(4px, 0.8vw, 10px);
  border: clamp(2px, 0.3vw, 4px) solid rgba(200,146,10,0.3);
  pointer-events: none;
}

/* Text half */
.mch-text-half {
  flex: 1; display: flex; flex-direction: column;
  justify-content: center; padding: clamp(16px, 3vw, 50px);
  background: #120900;
  position: relative;
}
.mch-text-half.mch-right { order: 1; align-items: flex-end; text-align: right; }
.mch-text-half.mch-left  { order: 2; align-items: flex-start; text-align: left; }

/* Decorative horizontal rule */
.mch-rule {
  width: clamp(40px, 8vw, 100px); height: clamp(2px, 0.3vw, 4px);
  background: linear-gradient(90deg, #c8920a, #7a3a00);
  margin: clamp(8px, 1.5vh, 18px) 0;
}
.mch-text-half.mch-right .mch-rule {
  background: linear-gradient(90deg, #7a3a00, #c8920a);
}

.mch-char-number {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(0.6rem, 1vw, 1.1rem);
  color: rgba(200,146,10,0.5); letter-spacing: 0.4em; text-transform: uppercase;
  margin-bottom: clamp(4px, 0.6vh, 8px);
}
.mch-char-name {
  font-family: 'Alfa Slab One', serif;
  font-size: clamp(2rem, 5.5vw, 7.5rem);
  color: #d4821e; text-transform: uppercase;
  line-height: 0.85; letter-spacing: 0.02em;
  text-shadow: 3px 3px 0 #7a3a00, 5px 5px 0 #2a1000;
  word-break: break-word;
}
.mch-player-name {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(0.65rem, 0.9vw, 1.1rem);
  color: rgba(200,146,10,0.45); letter-spacing: 0.35em;
  text-transform: uppercase; margin-top: clamp(6px, 1vh, 14px);
}

/* Slide-in animations — triggered by .mch-on class */
.mch-port-half { transform: translateX(0); opacity: 1; }
.mch-port-half.mch-left  { transform: translateX(-60px); opacity: 0;
  transition: transform 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease-out; }
.mch-port-half.mch-right { transform: translateX(60px); opacity: 0;
  transition: transform 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease-out; }
.mch-text-half { opacity: 0;
  transition: opacity 0.4s ease-out 0.15s; }

.mch-lobby-card.mch-on .mch-port-half { transform: translateX(0); opacity: 1; }
.mch-lobby-card.mch-on .mch-text-half { opacity: 1; }

/* ── directed-by card ── */
.mch-dirby-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: #1a0e00;
}
.mch-dirby-label {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(0.7rem, 1.1vw, 1.3rem);
  color: rgba(200,146,10,0.4); letter-spacing: 0.55em; text-transform: uppercase;
  margin-bottom: clamp(8px, 1.2vh, 18px);
}
.mch-dirby-rule {
  width: clamp(60px, 12vw, 160px); height: 2px;
  background: linear-gradient(90deg, transparent, #c8920a, transparent);
  margin-bottom: clamp(8px, 1.2vh, 18px);
}
.mch-dirby-name {
  font-family: 'Alfa Slab One', serif;
  font-size: clamp(2.5rem, 6.5vw, 9rem);
  color: #d4821e; text-transform: uppercase; letter-spacing: 0.03em;
  text-shadow: 3px 3px 0 #7a3a00, 5px 5px 0 #2a1000;
}

/* ── skip button ── */
.mch-skip-btn {
  position: fixed; bottom: 22px; right: 22px; z-index: 10020;
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; background: rgba(10,6,0,0.95);
  border: 1px solid rgba(200,146,10,0.5); border-radius: 2px;
  color: #c8920a;
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: 13px; letter-spacing: 3px; text-transform: uppercase;
  cursor: pointer; opacity: 0; transform: translateY(12px);
  transition: opacity 0.35s, transform 0.35s; pointer-events: auto;
}
.mch-skip-btn.mch-on { opacity: 1; transform: translateY(0); }
.mch-skip-btn:hover { border-color: #d4821e; }
`);

// ─── Player data ───────────────────────────────────────────────────────────
async function getMachetePlayersData() {
  const players = [];
  for (const user of game.users.filter(u => u.active && !u.isGM)) {
    const ch = user.character;
    if (!ch) continue;
    players.push({
      playerName:    user.name,
      characterName: ch.name.toUpperCase(),
      portrait:      ch.img || user.avatar || 'icons/svg/mystery-man.svg',
    });
  }
  return players;
}

// ─── Cigarette burn then hard cut ─────────────────────────────────────────
async function mchBurnCut(overlay, curtain) {
  // Burn circle flickers in top-right
  const burn = document.createElement('div');
  burn.className = 'mch-burn';
  overlay.appendChild(burn);
  await waitMs(380);
  burn.remove();
  // Hard cut: curtain instantly opaque
  curtain.style.transition = 'none';
  curtain.classList.remove('mch-open');
  await waitMs(80);
  // Restore transition for next open
  curtain.style.transition = 'opacity 0.25s ease-in-out';
}

// ─── Add random scratch lines ──────────────────────────────────────────────
function mchAddScratches(scratchEl) {
  scratchEl.innerHTML = '';
  const count = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < count; i++) {
    const line = document.createElement('div');
    line.className = 'mch-scratch-line';
    line.style.top = `${Math.random() * 100}%`;
    line.style.opacity = (Math.random() * 0.5 + 0.3).toString();
    scratchEl.appendChild(line);
  }
}

let mchPlaying = false, mchSkipFlag = false, mchAudio = null;

export async function executeMacheteIntro(campaignName = '') {
  if (mchPlaying) return;
  mchPlaying  = true;
  mchSkipFlag = false;
  const isSkip = () => mchSkipFlag;

  const players = await getMachetePlayersData();
  const gmUser  = game.users.find(u => u.isGM && u.active) || game.users.find(u => u.isGM);
  const gmName  = gmUser?.name || 'Game Master';

  // Audio
  mchAudio = new Audio(`modules/${MODULE_ID}/assets/sounds/kinoprokat.ogg`);
  mchAudio.volume = 0.85;
  mchAudio.play().catch(() => {});

  // Build overlay
  const overlay = document.createElement('div');
  overlay.className = 'mch-overlay';
  overlay.innerHTML = `
    <div class="mch-content" id="mch-content"></div>
    <div class="mch-vignette"></div>
    <div class="mch-grain"></div>
    <div class="mch-scratches" id="mch-scratches"></div>
    <div class="mch-curtain" id="mch-curtain"></div>
  `;
  document.body.appendChild(overlay);

  const content   = overlay.querySelector('#mch-content');
  const curtain   = overlay.querySelector('#mch-curtain');
  const scratches = overlay.querySelector('#mch-scratches');

  // Randomise scratch positions periodically
  const scratchTimer = setInterval(() => mchAddScratches(scratches), 1800);

  // Skip button
  if (game.user?.isGM) {
    const skipBtn = document.createElement('button');
    skipBtn.className = 'mch-skip-btn';
    skipBtn.innerHTML = '<i class="fa-solid fa-forward"></i> Пропустить';
    document.body.appendChild(skipBtn);
    setTimeout(() => skipBtn?.classList.add('mch-on'), 1200);
    skipBtn.addEventListener('click', () => {
      mchSkipFlag = true;
      game.socket?.emit(`module.${MODULE_ID}`, { action: 'macheteSkip' });
      mchCleanup(scratchTimer);
    });
  }

  // ── PHASE 1: Film leader countdown (4 → 3 → 2 → 1) ─────────────────────
  for (const num of [4, 3, 2, 1]) {
    if (isSkip()) { mchCleanup(scratchTimer); return; }

    const leader = document.createElement('div');
    leader.className = 'mch-leader';
    leader.innerHTML = `
      <div class="mch-leader-circle">
        <div class="mch-leader-vert"></div>
        <div class="mch-leader-num">${num}</div>
      </div>
    `;
    content.appendChild(leader);

    // Hard-cut reveal (no transition)
    curtain.style.transition = 'none';
    curtain.classList.remove('mch-open');
    await waitMs(16);
    curtain.classList.add('mch-open');
    curtain.style.transition = 'opacity 0.25s ease-in-out';

    if (await waitSkippable(260, isSkip)) { mchCleanup(scratchTimer); return; }

    // Hard cut out
    curtain.style.transition = 'none';
    curtain.classList.remove('mch-open');
    await waitMs(60);
    leader.remove();
    await waitMs(60);
  }

  if (isSkip()) { mchCleanup(scratchTimer); return; }
  await waitMs(120);

  // ── PHASE 2: Title card ───────────────────────────────────────────────
  const titleText = (campaignName?.trim() || 'Наша Кампания').toUpperCase();
  const titleCard = document.createElement('div');
  titleCard.className = 'mch-title-card';
  titleCard.innerHTML = `
    <div class="mch-presents">${gmName.toUpperCase()} PRESENTS</div>
    <div class="mch-title" data-text="${titleText}">${titleText}</div>
  `;
  content.appendChild(titleCard);

  // Fade in
  curtain.style.transition = 'opacity 0.3s ease-in-out';
  curtain.classList.add('mch-open');
  await waitMs(320);

  if (await waitSkippable(3000, isSkip)) { mchCleanup(scratchTimer); return; }

  // Cigarette burn → hard cut out
  await mchBurnCut(overlay, curtain);
  titleCard.remove();
  await waitMs(100);

  // ── PHASE 3: Character lobby cards ───────────────────────────────────
  for (let i = 0; i < players.length; i++) {
    if (isSkip()) break;
    const p = players[i];
    const portraitLeft = (i % 2 === 0); // even → portrait left, text right

    const card = document.createElement('div');
    card.className = 'mch-lobby-card';

    // Portrait half
    const portHalf = document.createElement('div');
    portHalf.className = `mch-port-half ${portraitLeft ? 'mch-left' : 'mch-right'}`;
    const img = document.createElement('img');
    img.className = 'mch-port-img';
    img.src = p.portrait;
    img.onerror = () => { img.src = 'icons/svg/mystery-man.svg'; };
    const dmg = document.createElement('div');
    dmg.className = 'mch-port-damage';
    const brd = document.createElement('div');
    brd.className = 'mch-port-border';
    portHalf.appendChild(img);
    portHalf.appendChild(dmg);
    portHalf.appendChild(brd);

    // Text half
    const textHalf = document.createElement('div');
    textHalf.className = `mch-text-half ${portraitLeft ? 'mch-left' : 'mch-right'}`;
    const words = p.characterName.split(/\s+/).filter(Boolean);
    const nameLines = words.map(w => `<div>${w}</div>`).join('');
    textHalf.innerHTML = `
      <div class="mch-char-number">LOBBY CARD No.${String(i+1).padStart(2,'0')}</div>
      <div class="mch-rule"></div>
      <div class="mch-char-name">${nameLines}</div>
      <div class="mch-player-name">— ${p.playerName} —</div>
      <div class="mch-rule" style="margin-top: clamp(8px,1.5vh,18px);"></div>
    `;

    card.appendChild(portHalf);
    card.appendChild(textHalf);
    content.appendChild(card);

    // Hard cut in
    curtain.style.transition = 'none';
    curtain.classList.remove('mch-open');
    await waitMs(16);
    card.offsetHeight; // reflow
    curtain.classList.add('mch-open');
    curtain.style.transition = 'opacity 0.25s ease-in-out';
    await waitMs(100);

    // Trigger slide animations
    card.classList.add('mch-on');

    if (await waitSkippable(3500, isSkip)) {
      await mchBurnCut(overlay, curtain);
      card.remove(); break;
    }

    await mchBurnCut(overlay, curtain);
    card.remove();
    if (isSkip()) break;
    await waitMs(80);
  }

  if (isSkip()) { mchCleanup(scratchTimer); return; }

  // ── PHASE 4: Directed by ─────────────────────────────────────────────
  const dirCard = document.createElement('div');
  dirCard.className = 'mch-dirby-card';
  dirCard.innerHTML = `
    <div class="mch-dirby-label">D I R E C T E D &nbsp; B Y</div>
    <div class="mch-dirby-rule"></div>
    <div class="mch-dirby-name">${gmName.toUpperCase()}</div>
  `;
  content.appendChild(dirCard);

  curtain.style.transition = 'opacity 0.3s ease-in-out';
  curtain.classList.add('mch-open');
  await waitMs(320);

  if (await waitSkippable(3000, isSkip)) { mchCleanup(scratchTimer); return; }

  // Final fade + audio ramp
  curtain.style.transition = 'opacity 1.2s ease-in';
  curtain.classList.remove('mch-open');
  if (mchAudio) {
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      await waitMs(80);
      if (mchAudio) mchAudio.volume = Math.max(0, mchAudio.volume - 0.85 / steps);
    }
  }
  await waitMs(800);
  mchCleanup(scratchTimer);
}

function mchCleanup(scratchTimer) {
  clearInterval(scratchTimer);
  document.querySelector('.mch-overlay')?.remove();
  document.querySelector('.mch-skip-btn')?.remove();
  if (mchAudio) { mchAudio.pause(); mchAudio = null; }
  mchPlaying  = false;
  mchSkipFlag = false;
}

export function skipMacheteIntro() {
  mchSkipFlag = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// MACHETE BLOOD — экран заливает кровью сверху вниз, злой смех
// ═══════════════════════════════════════════════════════════════════════════

injectStyles('dd-machete-blood-styles', `
@font-face {
  font-family: 'Crackhouse';
  src: url('modules/drama-director/assets/fonts/Crackhouse.otf') format('opentype');
}
@font-face {
  font-family: 'DynarShadow';
  src: url('modules/drama-director/assets/fonts/dynarshadowc.otf') format('opentype');
}

/* ── overlay ── */
.mchb-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 10000; overflow: hidden; pointer-events: auto; background: transparent;
}

/* ── blood streaks — неровные кровяные подтёки ── */
.mchb-streak {
  position: absolute; top: 0; z-index: 1;
  transform: translateY(-110vh);
  animation: mchb-drip var(--dur) var(--ease) var(--delay) forwards;
  will-change: transform;
  /* clip-path делает неровные рваные края вместо прямоугольника */
  clip-path: polygon(
    var(--cl0,2%) 0%,
    var(--cr0,98%) 0%,
    var(--cr1,100%) 8%,
    var(--cr2,96%) 20%,
    var(--cr3,102%) 35%,
    var(--cr4,98%) 50%,
    var(--cr5,104%) 65%,
    var(--cr6,97%) 78%,
    var(--crb,85%) 92%,
    var(--ctip,50%) 100%,
    var(--clb,15%) 92%,
    var(--cl6,3%) 78%,
    var(--cl5,−4%) 65%,
    var(--cl4,2%) 50%,
    var(--cl3,−2%) 35%,
    var(--cl2,4%) 20%,
    var(--cl1,0%) 8%
  );
  background: linear-gradient(
    180deg,
    #6a0000 0%,
    #9b0000 15%,
    #cc0000 40%,
    #aa0000 65%,
    #880000 82%,
    #660000 93%,
    #330000 100%
  );
}
@keyframes mchb-drip { 0%{transform:translateY(-110vh);}100%{transform:translateY(0);} }

/* каждый потёк — отдельный div без blob, форма задаётся clip-path через JS */


/* ── flood ── */
.mchb-flood {
  position: absolute; inset: 0; z-index: 2;
  background: radial-gradient(ellipse at 50% 30%,rgba(160,0,0,.97) 0%,rgba(100,0,0,1) 50%,rgba(40,0,0,1) 100%);
  opacity: 0; pointer-events: none; transition: opacity 1.5s ease-in;
}
.mchb-flood.mchb-on { opacity: 1; }

/* ── white flash layer ── */
.mchb-flash {
  position: absolute; inset: 0; z-index: 50;
  background: #fff; opacity: 0; pointer-events: none;
}

/* ── transition animations for slide/zoom ── */
@keyframes mchb-slide-in-left  { from{transform:translateX(-100vw);}to{transform:translateX(0);} }
@keyframes mchb-slide-in-right { from{transform:translateX(100vw);}to{transform:translateX(0);} }
@keyframes mchb-slide-in-top   { from{transform:translateY(-100vh);}to{transform:translateY(0);} }
@keyframes mchb-zoom-in-enter  { from{transform:scale(1.5);opacity:0;}to{transform:scale(1);opacity:1;} }
@keyframes mchb-zoom-out-enter { from{transform:scale(0.55);opacity:0;}to{transform:scale(1);opacity:1;} }
@keyframes mchb-slide-out-left { from{transform:translateX(0);}to{transform:translateX(-100vw);} }
@keyframes mchb-slide-out-right{ from{transform:translateX(0);}to{transform:translateX(100vw);} }

.mchb-trans-in  { animation: var(--ta-in)  .32s cubic-bezier(.22,0,.36,1) both; }
.mchb-trans-out { animation: var(--ta-out) .28s cubic-bezier(.55,0,1,.45) both; }

/* ── video background (blood_background.webm) ── */
.mchb-video-bg {
  position: absolute; inset: 0; z-index: 3; pointer-events: none;
  overflow: hidden; opacity: 0; transition: opacity .4s ease-out;
}
.mchb-video-bg.mchb-on { opacity: 1; }
.mchb-video-bg video {
  width: 100%; height: 100%; object-fit: cover; display: block;
}

/* ── bg layer ── */
.mchb-bg-layer {
  position: absolute; inset: -15%; z-index: 3;
  background-size: cover; background-position: center 50%; background-repeat: no-repeat;
  opacity: 1; pointer-events: none;
  /* campaign: 130% scale + slow drift up + mild shake */
  animation: mchb-bg-drift 18s linear forwards, mchb-bg-shake .55s steps(2) infinite;
  transform-origin: center center;
}
/* base: invisible until needed */
.mchb-bg-layer { opacity: 0; animation: none; }
.mchb-bg-layer.mchb-campaign-on {
  opacity: 1;
  animation: mchb-bg-drift 12s linear forwards, mchb-bg-shake .55s steps(2) infinite;
}
@keyframes mchb-bg-drift {
  0%   { transform: scale(1.30) translateY(0); }
  100% { transform: scale(1.25) translateY(-6%); }
}
@keyframes mchb-bg-shake {
  0%  { margin-left: 0;    margin-top: 0; }
  25% { margin-left: -3px; margin-top: 2px; }
  50% { margin-left: 3px;  margin-top: -2px; }
  75% { margin-left: -2px; margin-top: 3px; }
}

/* ── stage ── */
.mchb-stage { position: absolute; inset: 0; z-index: 4; overflow: hidden; }

/* ── shake — интенсивность вдвое меньше ── */
@keyframes mchb-shake {
  0%,100%{transform:translate(0,0) rotate(0);}
  10%{transform:translate(-1.5px,1px) rotate(-.2deg);}
  25%{transform:translate(2px,-1px) rotate(.25deg);}
  40%{transform:translate(-2px,1.5px) rotate(-.18deg);}
  55%{transform:translate(1.5px,-1.5px) rotate(.2deg);}
  70%{transform:translate(-1px,2px) rotate(-.25deg);}
  85%{transform:translate(2px,-.5px) rotate(.15deg);}
}
@keyframes mchb-shake-hard {
  0%,100%{transform:translate(0,0) rotate(0);}
  12%{transform:translate(-3.5px,2.5px) rotate(-.55deg);}
  28%{transform:translate(4px,-3px) rotate(.65deg);}
  44%{transform:translate(-4.5px,-2px) rotate(-.45deg);}
  60%{transform:translate(3.5px,3.5px) rotate(.5deg);}
  76%{transform:translate(-4px,-2.5px) rotate(-.55deg);}
  92%{transform:translate(4.5px,1.5px) rotate(.4deg);}
}

/* ── «GM представляет» ── */
.mchb-presents {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  animation: mchb-shake .6s steps(2) infinite;
}
.mchb-gm-name {
  font-family: 'Crackhouse', fantasy;
  font-size: clamp(3rem,9vw,12rem); color: #fff;
  text-align: center; line-height: .88;
  text-shadow: 3px 3px 0 #8b0000, 7px 7px 0 #3a0000, 0 0 60px rgba(200,0,0,.4);
  padding: 0 4vw; word-break: break-word;
}
.mchb-presents-word {
  font-family: 'Crackhouse', fantasy;
  font-size: clamp(1.5rem,4vw,5.5rem); color: rgba(255,255,255,.82);
  text-align: center; letter-spacing: .12em;
  text-shadow: 2px 2px 0 #8b0000;
  margin-top: clamp(8px,1.5vh,22px);
}

/* ── campaign title ── */
/* ── campaign title container — НЕ трясётся, только bg под ней ── */
.mchb-campaign {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  /* без animation — title стоит неподвижно */
}
.mchb-campaign-title {
  font-family: 'DynarShadow', fantasy;
  font-size: clamp(3.5rem,11vw,16rem); color: #fff;
  text-align: center; line-height: .86; letter-spacing: .02em;
  text-shadow: 4px 4px 0 rgba(0,0,0,.75), 0 0 80px rgba(180,0,0,.5);
  padding: 0 5vw; word-break: break-word;
  position: relative; z-index: 1;
}

/* ── preset image wrapper ── */
.mchb-preset-wrap {
  position: absolute; inset: 0; overflow: hidden;
  animation: mchb-shake .4s steps(3) infinite;
}
.mchb-preset-bg {
  position: absolute; inset: 0;
  background-size: cover; background-position: center; background-repeat: no-repeat;
  transform-origin: center center;
}
/* первый кадр N.png — зум 130 -> 100 */
.mchb-preset-bg.mchb-zoom-in {
  animation: mchb-zoom-in 1.5s cubic-bezier(.25,0,.35,1) forwards;
}
@keyframes mchb-zoom-in { 0%{transform:scale(1.30);}100%{transform:scale(1.00);} }
/* второй кадр N-2.png — нормальный размер */
.mchb-preset-bg.mchb-zoom-normal { transform: scale(1.0); }

/* призрак портрета под machete3-2.png */
.mchb-portrait-ghost {
  position: absolute; inset: 0; z-index: 0;
  display: flex; align-items: center; justify-content: center;
}
.mchb-portrait-ghost img {
  width: 50%; height: auto; max-height: 90vh; object-fit: contain;
  filter: grayscale(1) sepia(1) hue-rotate(-20deg) contrast(1.5) saturate(6) brightness(.75);
  opacity: .55;
}

/* ── player card ── */
.mchb-card {
  position: absolute; inset: 0; display: flex; align-items: stretch;
  animation: mchb-card-zoom 2.5s cubic-bezier(.22,0,.36,1) forwards;
  transform-origin: center center;
}
/* Тряска на внутреннем слое — чуть-чуть */
.mchb-card-inner {
  display: contents;
  animation: mchb-shake-micro .5s steps(2) infinite;
}
@keyframes mchb-shake-micro {
  0%,100%{ transform: translate(0,0) rotate(0); }
  33%    { transform: translate(-.7px,.5px) rotate(-.08deg); }
  66%    { transform: translate(.8px,-.4px) rotate(.07deg); }
}
@keyframes mchb-card-zoom {
  0%   { transform: scale(1.30); }
  50%  { transform: scale(1.30); }
  100% { transform: scale(1.00); }
}
.mchb-card-portrait {
  flex: 0 0 55%; position: relative; overflow: hidden;
}
.mchb-card-portrait > img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: center top; display: block;
  /* чёрно-красный */
  filter: grayscale(1) sepia(1) hue-rotate(-20deg) contrast(1.6) saturate(7) brightness(.72);
  position: relative; z-index: 0;
}
.mchb-card-names {
  flex: 1; display: flex; flex-direction: column; justify-content: center;
  padding: clamp(18px,3.5vw,55px); background: rgba(0,0,0,.58);
}
.mchb-card-char {
  font-family: 'Crackhouse', fantasy;
  font-size: clamp(2rem,6vw,8rem); color: #fff; text-transform: uppercase;
  line-height: .86; word-break: break-word;
  text-shadow: 3px 3px 0 #8b0000, 6px 6px 0 #3a0000;
}
.mchb-card-player {
  font-family: 'Crackhouse', fantasy;
  font-size: clamp(.9rem,2.2vw,2.8rem); color: rgba(255,255,255,.55);
  text-transform: uppercase; letter-spacing: .08em;
  margin-top: clamp(8px,1.5vh,20px); text-shadow: 1px 1px 0 #8b0000;
}

/* ── кровяные пятна + потёки на фоне портрета ── */
.mchb-bloodstains {
  position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden;
}
.mchb-bloodstain {
  position: absolute; border-radius: 50%;
  background: radial-gradient(circle,rgba(140,0,0,.92) 0%,rgba(80,0,0,.62) 40%,transparent 75%);
  transform: scale(0); transform-origin: center;
  animation: mchb-stain-spread var(--sd) cubic-bezier(.15,0,.35,1) var(--sdelay) forwards;
}
@keyframes mchb-stain-spread {
  0%  { transform: scale(0); opacity: .9; }
  65% { opacity: .78; }
  100%{ transform: scale(1); opacity: .55; }
}
.mchb-drip-line {
  position: absolute; width: var(--dw,6px); border-radius: 3px;
  background: linear-gradient(180deg,rgba(140,0,0,.95) 0%,rgba(80,0,0,.4) 80%,transparent 100%);
  top: var(--dt,0%); left: var(--dl,50%);
  height: 0;
  animation: mchb-drip-line-grow var(--dd,1.2s) ease-in var(--ddelay,0ms) forwards;
}
@keyframes mchb-drip-line-grow {
  0%  { height: 0; opacity: 1; }
  85% { opacity: .8; }
  100%{ height: var(--dh,120px); opacity: .4; }
}

/* ── splatters ── */
.mchb-splatters { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden; }
.mchb-splat {
  position: absolute; border-radius: 50%;
  background: radial-gradient(circle,rgba(200,0,0,.95) 0%,rgba(90,0,0,.55) 55%,transparent 100%);
  animation: mchb-splat-pop .18s ease-out forwards;
}
@keyframes mchb-splat-pop { 0%{transform:scale(0);opacity:1;}100%{transform:scale(1);opacity:.72;} }

/* ── particles — изогнутые полоски как повреждённая плёнка ── */
.mchb-particles { position: absolute; inset: 0; z-index: 6; pointer-events: none; overflow: hidden; }
.mchb-ptcl {
  position: absolute;
  border-radius: var(--pr, 2px);
  animation: mchb-ptcl-fly var(--pd) ease-out var(--pdelay,0ms) forwards;
}
@keyframes mchb-ptcl-fly {
  0%  { opacity: .9;  transform: translate(0,0) rotate(var(--prot)) scaleX(1); }
  60% { opacity: .75; }
  100%{ opacity: 0;   transform: translate(var(--pdx),var(--pdy)) rotate(calc(var(--prot) + var(--prspin))) scaleX(var(--psx,.4)); }
}

/* ── grain ── */
.mchb-grain {
  position: absolute; inset: 0; z-index: 7; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: .12; mix-blend-mode: overlay;
  animation: mchb-grain-shift .07s steps(4) infinite;
}
@keyframes mchb-grain-shift {
  0%{background-position:0 0;}25%{background-position:15px -12px;}
  50%{background-position:-9px 18px;}75%{background-position:6px -6px;}
}

/* ── vignette ── */
.mchb-vignette {
  position: absolute; inset: 0; z-index: 8; pointer-events: none;
  background: radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,.55) 72%,rgba(0,0,0,.92) 100%);
}

/* ── end titles ── */
.mchb-titles {
  position: absolute; inset: 0; background: #000;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: clamp(10px,2vh,30px);
  /* без тряски */
}
.mchb-title-line {
  font-family: 'Crackhouse', fantasy;
  font-size: clamp(1.4rem,3.2vw,4.5rem); color: #fff;
  text-align: center; line-height: 1.1; padding: 0 5vw;
  text-shadow: 2px 2px 0 #8b0000, 0 0 35px rgba(200,0,0,.45);
  opacity: 0; transform: scaleX(.75);
  transition: opacity .1s ease-out, transform .1s ease-out;
}
.mchb-title-line.mchb-on { opacity: 1; transform: scaleX(1); }

/* ── skip ── */
.mchb-skip-btn {
  position: fixed; bottom: 22px; right: 22px; z-index: 10020;
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; background: rgba(30,0,0,.95);
  border: 1px solid rgba(180,0,0,.6); border-radius: 2px; color: #cc2222;
  font-family: 'Crackhouse', fantasy; font-size: 13px;
  letter-spacing: 3px; text-transform: uppercase;
  cursor: pointer; opacity: 0; transform: translateY(12px);
  transition: opacity .35s, transform .35s; pointer-events: auto;
}
.mchb-skip-btn.mchb-on { opacity: 1; transform: translateY(0); }
.mchb-skip-btn:hover { border-color: #cc0000; color: #ff3333; }
`);

// ─── Потёки ────────────────────────────────────────────────────────────────
function _mchbGenerateStreaks() {
  const streaks = [];
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Функция генерирует случайные переменные для clip-path — рваные края
  const irregClip = () => {
    // left edge points (0%=левый край, могут уходить немного за)
    const cl = Array.from({length:7}, () => `${rnd(-5,8).toFixed(1)}%`);
    // right edge points
    const cr = Array.from({length:7}, () => `${rnd(92,107).toFixed(1)}%`);
    // tip — нижний кончик капли, случайно смещён от центра
    const tip = `${rnd(35,65).toFixed(1)}%`;
    // shoulder — ширина чуть выше кончика
    const clb = `${rnd(8,25).toFixed(1)}%`;
    const crb = `${rnd(75,92).toFixed(1)}%`;
    return { cl, cr, tip, clb, crb };
  };

  // 16 широких — покрывают всю ширину
  for (let i = 0; i < 16; i++) {
    const w    = 4 + rnd(0, 6);          // 4–10vw
    const left = (100 / 16) * i + rnd(-1.5, 1.5);
    const ic   = irregClip();
    streaks.push({
      left: Math.max(0, Math.min(95, left)), width: w,
      delay: rnd(0, 700), dur: rnd(1500, 2300),
      ease: Math.random() > 0.5 ? 'cubic-bezier(0.2,0,0.4,1)' : 'cubic-bezier(0.35,0.05,0.6,0.95)',
      clip: ic,
    });
  }
  // 20 тонких — хаотичные
  for (let i = 0; i < 20; i++) {
    const w  = 1 + rnd(0, 5);
    const ic = irregClip();
    streaks.push({
      left: rnd(0, 97), width: w,
      delay: rnd(100, 1100), dur: rnd(1300, 2300),
      ease: 'cubic-bezier(0.3,0,0.8,0.8)',
      clip: ic,
    });
  }
  return streaks;
}

// ─── Частицы — изогнутые полоски как плёночные царапины ──────────────────
function _mchbSpawnParticles(container, intervalMs = 160) {
  const colors = ['#ff0000','#cc0000','#ff2200','#ff5500','#dd0000','#ff3300','#ee1100'];
  let active = true;
  const spawn = () => {
    if (!active || !container.isConnected) return;
    const p = document.createElement('div');
    p.className = 'mchb-ptcl';
    // полоска: узкая и длинная, с небольшим border-radius — как царапина
    const w   = 3  + Math.random() * 6;          // 3–9px ширина
    const h   = 35 + Math.random() * 90;          // 35–125px длина
    const rot = (Math.random() - 0.5) * 80;       // угол -40..+40 deg
    const spin= (Math.random() - 0.5) * 120;      // доп. вращение за полёт
    const sx  = Math.random() * window.innerWidth;
    const sy  = 20 + Math.random() * (window.innerHeight * 0.9);
    const dx  = (Math.random() - 0.5) * 260;
    const dy  = -(50 + Math.random() * 280);
    const dur = 550 + Math.random() * 700;
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.cssText = [
      `left:${sx.toFixed(0)}px`, `top:${sy.toFixed(0)}px`,
      `width:${w.toFixed(1)}px`, `height:${h.toFixed(0)}px`,
      `background:linear-gradient(180deg,transparent 0%,${color} 20%,${color} 80%,transparent 100%)`,
      `--pr:${(1 + Math.random() * 2).toFixed(1)}px`,
      `--prot:${rot.toFixed(1)}deg`, `--prspin:${spin.toFixed(1)}deg`,
      `--psx:${(.2 + Math.random() * .5).toFixed(2)}`,
      `--pd:${Math.round(dur)}ms`, `--pdx:${Math.round(dx)}px`, `--pdy:${Math.round(dy)}px`,
    ].join(';');
    container.appendChild(p);
    setTimeout(() => p.remove(), dur + 100);
    setTimeout(spawn, intervalMs + Math.random() * intervalMs * 0.6);
  };
  spawn();
  return () => { active = false; };
}

// ─── Брызги крови ──────────────────────────────────────────────────────────
function _mchbSpawnSplatters(container) {
  let active = true;
  const spawn = () => {
    if (!active || !container.isConnected) return;
    const s = document.createElement('div');
    s.className = 'mchb-splat';
    const size = 30 + Math.random() * 100;
    s.style.cssText = `left:${Math.random()*91}%;top:${Math.random()*91}%;width:${size}px;height:${size}px;`;
    container.appendChild(s);
    setTimeout(() => s.remove(), 1600 + Math.random() * 2400);
    setTimeout(spawn, 220 + Math.random() * 320);
  };
  spawn();
  return () => { active = false; };
}

// ─── Кровяные пятна + потёки на портрете ──────────────────────────────────
function _mchbAddBloodStains(container) {
  // Максимум 2 большие пятна
  const count = 1 + Math.floor(Math.random() * 2); // 1 или 2
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'mchb-bloodstain';
    const size = 200 + Math.random() * 220; // 200–420px — большие
    el.style.cssText = `left:${(Math.random()*55).toFixed(1)}%;top:${(Math.random()*55).toFixed(1)}%;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;--sd:${Math.round(1100+Math.random()*700)}ms;--sdelay:${Math.round(Math.random()*600)}ms;`;
    container.appendChild(el);
  }
  // Потёки — оставляем
  const dripCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < dripCount; i++) {
    const el = document.createElement('div');
    el.className = 'mchb-drip-line';
    const w = 4 + Math.random() * 8;
    const h = 60 + Math.random() * 160;
    el.style.cssText = `--dw:${w.toFixed(1)}px;--dl:${(Math.random()*90).toFixed(1)}%;--dt:${(Math.random()*40).toFixed(1)}%;--dh:${Math.round(h)}px;--dd:${Math.round(800+Math.random()*600)}ms;--ddelay:${Math.round(Math.random()*1500)}ms;`;
    container.appendChild(el);
  }
}

// ─── Переход — всегда белая вспышка ──────────────────────────────────────
async function _mchbTransition(flashEl, stage, oldEl, newEl) {
  flashEl.style.transition = 'none';
  flashEl.style.opacity    = '1';
  await waitMs(16);
  if (oldEl) oldEl.remove();
  if (newEl) stage.appendChild(newEl);
  flashEl.style.transition = 'opacity 250ms ease-in';
  flashEl.style.opacity    = '0';
  await waitMs(260);
}

// ─── State ─────────────────────────────────────────────────────────────────
let mchbPlaying = false, mchbSkipFlag = false, mchbAudio = null, mchbAudio2 = null;
let _mchbStopFns = [];

// ─── Предзагрузка изображений ─────────────────────────────────────────────
function _mchbPreload(urls) {
  return Promise.all(urls.map(src => new Promise(resolve => {
    if (!src) return resolve();
    const img = new Image();
    img.onload  = resolve;
    img.onerror = resolve; // не блокируем если нет файла
    img.src = src;
  })));
}

export async function executeMacheteBloodIntro(campaignName = '') {
  if (mchbPlaying) return;
  mchbPlaying  = true;
  mchbSkipFlag = false;
  _mchbStopFns = [];
  const isSkip = () => mchbSkipFlag;

  // ── Собираем список всего что нужно загрузить заранее ──────────────────
  const base = `modules/${MODULE_ID}/assets/`;
  const preloadUrls = [
    `${base}machete_background.png`,
    `${base}machete1.png`,   `${base}machete1-2.png`,
    `${base}machete2.png`,   `${base}machete2-2.png`,
    `${base}machete3.png`,   `${base}machete3-2.png`,
  ];
  // Портреты активных игроков
  for (const user of game.users.filter(u => u.active && !u.isGM)) {
    const ch = user.character;
    if (ch?.img) preloadUrls.push(ch.img);
  }
  // Грузим параллельно — не ждём бесконечно (таймаут 8с)
  await Promise.race([
    _mchbPreload(preloadUrls),
    new Promise(r => setTimeout(r, 8000)),
  ]);

  // ── Строим DOM ──────────────────────────────────────────────────────────
  const overlay     = document.createElement('div'); overlay.className     = 'mchb-overlay';
  const flood       = document.createElement('div'); flood.className       = 'mchb-flood';
  const videoBg     = document.createElement('div'); videoBg.className     = 'mchb-video-bg';
  const bgLayer     = document.createElement('div'); bgLayer.className     = 'mchb-bg-layer';
  const stage       = document.createElement('div'); stage.className       = 'mchb-stage';
  const splattersEl = document.createElement('div'); splattersEl.className = 'mchb-splatters';
  const particlesEl = document.createElement('div'); particlesEl.className = 'mchb-particles';
  const grain       = document.createElement('div'); grain.className       = 'mchb-grain';
  const vignette    = document.createElement('div'); vignette.className    = 'mchb-vignette';
  const flashEl     = document.createElement('div'); flashEl.className     = 'mchb-flash';
  [flood, videoBg, bgLayer, stage, splattersEl, particlesEl, grain, vignette, flashEl]
    .forEach(el => overlay.appendChild(el));
  document.body.appendChild(overlay);

  if (game.user?.isGM) {
    const skipBtn = document.createElement('button');
    skipBtn.className = 'mchb-skip-btn';
    skipBtn.innerHTML = '<i class="fa-solid fa-forward"></i> Пропустить';
    document.body.appendChild(skipBtn);
    setTimeout(() => skipBtn?.classList.add('mchb-on'), 800);
    skipBtn.addEventListener('click', () => {
      mchbSkipFlag = true;
      game.socket?.emit(`module.${MODULE_ID}`, { action: 'macheteBloodSkip' });
      mchbCleanup();
    });
  }

  if (isSkip()) { mchbCleanup(); return; }

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1 — Кровь стекает.
  //   Оба звука стартуют вместе: evil_laugh громко, machete.ogg тихо и нарастает.
  //   Когда экран залит — evil_laugh затухает, machete.ogg уже на полную.
  // ═══════════════════════════════════════════════════════════════════════
  mchbAudio = new Audio(`modules/${MODULE_ID}/assets/sounds/evil_laugh.ogg`);
  mchbAudio.volume = 0.88;
  mchbAudio.play().catch(() => {});

  mchbAudio2 = new Audio(`modules/${MODULE_ID}/assets/sounds/machete.ogg`);
  mchbAudio2.volume = 0.0;
  mchbAudio2.loop   = true;
  mchbAudio2.play().catch(() => {});

  // Нарастание machete.ogg за 2.4с
  let macheteRampDone = false;
  (async () => {
    const steps = 20, stepMs = 2400 / steps;
    for (let i = 0; i < steps; i++) {
      await waitMs(stepMs);
      if (!mchbAudio2 || macheteRampDone) break;
      mchbAudio2.volume = Math.min(0.85, (i + 1) * (0.85 / steps));
    }
    macheteRampDone = true;
    if (mchbAudio2) mchbAudio2.volume = 0.85;
  })();

  // Строим потёки
  const streaks  = _mchbGenerateStreaks();
  const maxDelay = Math.max(...streaks.map(s => s.delay + s.dur));
  for (const s of streaks) {
    const el = document.createElement('div');
    el.className = 'mchb-streak';
    const ic = s.clip;
    // Задаём рваные края через CSS custom properties
    el.style.cssText = [
      `left:${s.left.toFixed(2)}vw`,
      `width:${s.width.toFixed(2)}vw`,
      `height:${(105 + Math.random()*15).toFixed(0)}vh`,
      `--dur:${Math.round(s.dur)}ms`,
      `--delay:${Math.round(s.delay)}ms`,
      `--ease:${s.ease}`,
      `--cl0:${ic.cl[0]}`, `--cr0:${ic.cr[0]}`,
      `--cl1:${ic.cl[1]}`, `--cr1:${ic.cr[1]}`,
      `--cl2:${ic.cl[2]}`, `--cr2:${ic.cr[2]}`,
      `--cl3:${ic.cl[3]}`, `--cr3:${ic.cr[3]}`,
      `--cl4:${ic.cl[4]}`, `--cr4:${ic.cr[4]}`,
      `--cl5:${ic.cl[5]}`, `--cr5:${ic.cr[5]}`,
      `--cl6:${ic.cl[6]}`, `--cr6:${ic.cr[6]}`,
      `--ctip:${ic.tip}`,
      `--clb:${ic.clb}`, `--crb:${ic.crb}`,
    ].join(';');
    overlay.insertBefore(el, flood);
  }

  if (await waitSkippable(Math.round(maxDelay * 0.58), isSkip)) { mchbCleanup(); return; }
  flood.classList.add('mchb-on');

  // Глушим evil_laugh — machete.ogg уже на полную
  macheteRampDone = true;
  if (mchbAudio2) mchbAudio2.volume = 0.85;
  if (mchbAudio) {
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      await waitMs(70);
      if (mchbAudio) mchbAudio.volume = Math.max(0, mchbAudio.volume - 0.88 / steps);
    }
    mchbAudio.pause(); mchbAudio = null;
  }

  if (await waitSkippable(900, isSkip)) { mchbCleanup(); return; }

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2 — «ИМЯ ГМ» / «ПРЕДСТАВЛЯЕТ» на красном
  // ═══════════════════════════════════════════════════════════════════════
  const gmUser = game.users.find(u => u.isGM && u.active) || game.users.find(u => u.isGM);
  const gmName = gmUser?.name || 'Game Master';
  const title  = (campaignName?.trim() || game.world?.title || 'Наша Кампания').toUpperCase();

  const presentsEl = document.createElement('div');
  presentsEl.className = 'mchb-presents';
  presentsEl.innerHTML = `
    <div class="mchb-gm-name">${gmName.toUpperCase()}</div>
    <div class="mchb-presents-word">ПРЕДСТАВЛЯЕТ</div>
  `;
  stage.appendChild(presentsEl);

  if (await waitSkippable(1500, isSkip)) { mchbCleanup(); return; }
  presentsEl.remove();
  if (isSkip()) { mchbCleanup(); return; }

  // ═══════════════════════════════════════════════════════════════════════
  // Вспомогательная обёртка — переход с рандомным типом
  // ═══════════════════════════════════════════════════════════════════════
  const trans = (oldEl, newEl) => _mchbTransition(flashEl, stage, oldEl, newEl);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3 — machete_background.png + название кампании
  // ═══════════════════════════════════════════════════════════════════════
  bgLayer.style.backgroundImage = `url('modules/${MODULE_ID}/assets/machete_background.png')`;

  // Первый переход — всегда вспышка (для drama)
  flashEl.style.transition = 'none';
  flashEl.style.opacity    = '1';
  await waitMs(16);
  flood.style.transition = 'none';
  flood.style.opacity    = '0';
  bgLayer.classList.add('mchb-campaign-on');
  flashEl.style.transition = 'opacity 250ms ease-in';
  flashEl.style.opacity    = '0';
  await waitMs(260);
  if (isSkip()) { mchbCleanup(); return; }

  const campaignEl = document.createElement('div');
  campaignEl.className = 'mchb-campaign';
  campaignEl.innerHTML = `<div class="mchb-campaign-title">${title}</div>`;
  stage.appendChild(campaignEl);

  if (await waitSkippable(2500, isSkip)) { mchbCleanup(); return; }

  // Переход из кампании в карточки — всегда вспышка (скрываем bg)
  flashEl.style.transition = 'none';
  flashEl.style.opacity    = '1';
  await waitMs(16);
  campaignEl.remove();
  bgLayer.classList.remove('mchb-campaign-on');
  bgLayer.style.opacity   = '0';
  bgLayer.style.animation = 'none';
  flashEl.style.transition = 'opacity 250ms ease-in';
  flashEl.style.opacity    = '0';
  await waitMs(260);
  if (isSkip()) { mchbCleanup(); return; }

  // Частицы и брызги — работают через все карточки
  _mchbStopFns.push(_mchbSpawnParticles(particlesEl, 110));
  _mchbStopFns.push(_mchbSpawnSplatters(splattersEl));

  // Запускаем видео-фон blood_background.webm
  const vid = document.createElement('video');
  vid.src    = `modules/${MODULE_ID}/assets/blood_background.webm`;
  vid.loop   = true;
  vid.muted  = true;
  vid.autoplay = true;
  vid.playsInline = true;
  videoBg.appendChild(vid);
  vid.play().catch(() => {});
  videoBg.classList.add('mchb-on');

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4 — Карточки игроков (пресеты 1/2/3 по кругу)
  // ═══════════════════════════════════════════════════════════════════════
  const players = [];
  for (const user of game.users.filter(u => u.active && !u.isGM)) {
    const ch = user.character;
    if (!ch) continue;
    players.push({
      playerName:    user.name,
      characterName: ch.name,
      portrait:      ch.img || user.avatar || 'icons/svg/mystery-man.svg',
    });
  }

  let prevWrap = null;

  for (let i = 0; i < players.length; i++) {
    if (isSkip()) break;
    const p      = players[i];
    const preset = (i % 3) + 1;

    // ── macheteN.png — зум 130 → 100 ────────────────────────────────────
    const wrap1 = document.createElement('div');
    wrap1.className = 'mchb-preset-wrap';
    const bg1 = document.createElement('div');
    bg1.className = 'mchb-preset-bg mchb-zoom-in';
    bg1.style.backgroundImage = `url('modules/${MODULE_ID}/assets/machete${preset}.png')`;
    wrap1.appendChild(bg1);

    await trans(prevWrap, wrap1);
    prevWrap = wrap1;
    if (isSkip()) break;

    if (await waitSkippable(1500, isSkip)) { mchbCleanup(); return; }
    if (isSkip()) break;

    // ── macheteN-2.png ───────────────────────────────────────────────────
    const wrap2 = document.createElement('div');
    wrap2.className = 'mchb-preset-wrap';

    if (preset === 3) {
      const ghost = document.createElement('div');
      ghost.className = 'mchb-portrait-ghost';
      ghost.style.zIndex = '0';
      const gImg = document.createElement('img');
      gImg.src = p.portrait;
      gImg.onerror = () => { gImg.src = 'icons/svg/mystery-man.svg'; };
      ghost.appendChild(gImg);
      wrap2.appendChild(ghost);
    }
    const bg2 = document.createElement('div');
    bg2.className = 'mchb-preset-bg mchb-zoom-normal';
    bg2.style.cssText = `background-image:url('modules/${MODULE_ID}/assets/machete${preset}-2.png');z-index:1;`;
    wrap2.appendChild(bg2);

    await trans(prevWrap, wrap2);
    prevWrap = wrap2;
    if (isSkip()) break;

    if (await waitSkippable(1500, isSkip)) { mchbCleanup(); return; }
    if (isSkip()) break;

    // ── Портрет + имена ──────────────────────────────────────────────────
    const card = document.createElement('div');
    card.className = 'mchb-card';

    const cardInner = document.createElement('div');
    cardInner.className = 'mchb-card-inner';
    cardInner.style.cssText = 'display:flex;width:100%;height:100%;align-items:stretch;animation:mchb-shake-micro .5s steps(2) infinite;';

    const words    = p.characterName.toUpperCase().split(/\s+/).filter(Boolean);
    const nameHtml = words.map(w => `<div>${w}</div>`).join('');

    const portWrap = document.createElement('div');
    portWrap.className = 'mchb-card-portrait';

    const pImg = document.createElement('img');
    pImg.src = p.portrait;
    pImg.onerror = () => { pImg.src = 'icons/svg/mystery-man.svg'; };

    const stains = document.createElement('div');
    stains.className = 'mchb-bloodstains';
    _mchbAddBloodStains(stains);

    portWrap.appendChild(pImg);
    portWrap.appendChild(stains);

    const namesDiv = document.createElement('div');
    namesDiv.className = 'mchb-card-names';
    namesDiv.innerHTML = `
      <div class="mchb-card-char">${nameHtml}</div>
      <div class="mchb-card-player">— ${p.playerName} —</div>
    `;

    cardInner.appendChild(portWrap);
    cardInner.appendChild(namesDiv);
    card.appendChild(cardInner);

    await trans(prevWrap, card);
    prevWrap = card;
    if (isSkip()) break;

    if (await waitSkippable(2500, isSkip)) { mchbCleanup(); return; }
    if (isSkip()) break;
  }

  _mchbStopFns.forEach(fn => fn());
  _mchbStopFns = [];
  if (isSkip()) { mchbCleanup(); return; }

  // Гасим видео-фон
  videoBg.style.opacity = '0';
  setTimeout(() => { vid.pause(); vid.src = ''; }, 450);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 5 — Титры на чёрном
  // ═══════════════════════════════════════════════════════════════════════
  const titlesEl = document.createElement('div');
  titlesEl.className = 'mchb-titles';
  [
    'основано на нереальных событиях',
    'сессия содержит концентрированный трэш',
    'нецензурная лексика в полном объёме',
    `производство "${gmName}"`,
  ].forEach(t => {
    const line = document.createElement('div');
    line.className = 'mchb-title-line';
    line.textContent = t;
    titlesEl.appendChild(line);
  });

  await trans(prevWrap, titlesEl);
  if (isSkip()) { mchbCleanup(); return; }

  _mchbStopFns.push(_mchbSpawnParticles(particlesEl, 65));

  await waitMs(80);
  const lines = titlesEl.querySelectorAll('.mchb-title-line');
  for (let i = 0; i < lines.length; i++) {
    if (isSkip()) break;
    if (i > 0) { lines[i - 1].classList.remove('mchb-on'); await waitMs(90); }
    lines[i].classList.add('mchb-on');
    if (await waitSkippable(i === lines.length - 1 ? 3200 : 1700, isSkip)) break;
  }

  overlay.style.transition = 'opacity 1.2s ease-out';
  overlay.style.opacity    = '0';
  if (mchbAudio2) {
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      await waitMs(100);
      if (mchbAudio2) mchbAudio2.volume = Math.max(0, mchbAudio2.volume - 0.85 / steps);
    }
  }
  await waitMs(1200);
  mchbCleanup();
}

function mchbCleanup() {
  _mchbStopFns.forEach(fn => fn?.());
  _mchbStopFns = [];
  document.querySelector('.mchb-overlay')?.remove();
  document.querySelector('.mchb-skip-btn')?.remove();
  if (mchbAudio)  { mchbAudio.pause();  mchbAudio  = null; }
  if (mchbAudio2) { mchbAudio2.pause(); mchbAudio2 = null; }
  mchbPlaying  = false;
  mchbSkipFlag = false;
}

export function skipMacheteBloodIntro() {
  mchbSkipFlag = true;
  mchbCleanup();
}
