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
// TBC — CSS 1:1 showstopper (Cinzel + Cormorant Garamond, all animations)
// ══════════════════════════════════════════════════════════════════════════════
injectStyles('dd-tbc-styles', `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap');

.tbc-skip-button{position:fixed;bottom:clamp(15px,2vw,30px);right:clamp(15px,2vw,30px);z-index:10010;display:flex;align-items:center;gap:clamp(4px,.5vw,8px);padding:clamp(8px,.8vw,12px) clamp(14px,1.5vw,24px);background:rgba(20,20,25,.9);border:1px solid rgba(212,175,55,.4);border-radius:4px;color:rgba(212,175,55,.9);font-family:'Cinzel',serif;font-size:clamp(10px,.9vw,14px);font-weight:600;letter-spacing:clamp(1px,.15vw,2px);text-transform:uppercase;cursor:pointer;opacity:0;transform:translateY(20px);transition:all .4s ease-out;pointer-events:auto;}
.tbc-skip-button.visible{opacity:1;transform:translateY(0);}
.tbc-skip-button:hover{background:rgba(30,30,35,.95);border-color:rgba(212,175,55,.7);color:rgba(212,175,55,1);box-shadow:0 0 20px rgba(212,175,55,.3);}
.tbc-skip-button:active{transform:scale(.98);}

.tbc-credits-container{position:fixed;top:0;left:0;width:100vw;height:100vh;background:linear-gradient(180deg,#0a0a0c 0%,#12121a 50%,#0a0a0c 100%);z-index:10002;opacity:0;display:flex;justify-content:center;align-items:center;font-family:'Cormorant Garamond','Georgia',serif;transition:opacity 1.5s ease-in-out;pointer-events:none;overflow:hidden;}
.tbc-credits-container::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 0%,rgba(139,90,43,.1) 0%,transparent 50%),radial-gradient(ellipse at 50% 100%,rgba(139,90,43,.1) 0%,transparent 50%);pointer-events:none;}
.tbc-credits-container::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at center,transparent 0%,rgba(0,0,0,.4) 100%);pointer-events:none;}

.tbc-credit-slide{display:flex;align-items:center;justify-content:center;width:100%;max-width:1400px;padding:clamp(30px,4vw,60px);position:relative;z-index:1;}
.tbc-credit-slide.layout-left{flex-direction:row;}
.tbc-credit-slide.layout-right{flex-direction:row-reverse;}

.tbc-portrait-wrapper{position:relative;opacity:0;transform:translateY(30px);transition:all 1s cubic-bezier(.34,1.56,.64,1);}
.tbc-portrait-wrapper.visible{opacity:1;transform:translateY(0);}

.tbc-portrait-frame{position:relative;width:clamp(200px,17vw,320px);height:clamp(200px,17vw,320px);padding:clamp(4px,.5vw,8px);background:linear-gradient(135deg,rgba(212,175,55,.3) 0%,rgba(139,90,43,.2) 100%);border:1px solid rgba(212,175,55,.4);}
.tbc-portrait-frame::before{content:'';position:absolute;top:-2px;left:-2px;right:-2px;bottom:-2px;border:1px solid rgba(212,175,55,.2);}
.tbc-portrait-inner{width:100%;height:100%;overflow:hidden;background:#1a1a1a;}
.tbc-portrait-img{width:100%;height:100%;object-fit:cover;object-position:top center;filter:sepia(.15) contrast(1.1) brightness(.95);transition:transform 8s ease-out;}
.tbc-portrait-wrapper.visible .tbc-portrait-img{transform:scale(1.05);}

.tbc-portrait-corner{position:absolute;width:clamp(12px,1.2vw,20px);height:clamp(12px,1.2vw,20px);border-color:rgba(212,175,55,.6);border-style:solid;}
.tbc-portrait-corner.tl{top:-4px;left:-4px;border-width:2px 0 0 2px;}
.tbc-portrait-corner.tr{top:-4px;right:-4px;border-width:2px 2px 0 0;}
.tbc-portrait-corner.bl{bottom:-4px;left:-4px;border-width:0 0 2px 2px;}
.tbc-portrait-corner.br{bottom:-4px;right:-4px;border-width:0 2px 2px 0;}

.tbc-text-section{flex:1;padding:0 clamp(30px,4vw,60px);opacity:0;transform:translateY(30px);transition:all 1s cubic-bezier(.34,1.56,.64,1);transition-delay:.2s;}
.tbc-text-section.visible{opacity:1;transform:translateY(0);}
.layout-left  .tbc-text-section{text-align:left;}
.layout-right .tbc-text-section{text-align:right;}

.tbc-player-name{font-family:'Cinzel',serif;font-size:clamp(1.4rem,1.8vw,2.2rem);font-weight:600;color:rgba(212,175,55,.9);margin:0 0 clamp(12px,1.3vw,20px) 0;letter-spacing:clamp(2px,.3vw,4px);text-transform:uppercase;text-shadow:0 0 30px rgba(212,175,55,.3);}
.tbc-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.5),transparent);margin:clamp(15px,1.6vw,25px) 0;transform:scaleX(0);transition:transform .8s ease-out;transition-delay:.4s;}
.layout-left  .tbc-divider{transform-origin:left;}
.layout-right .tbc-divider{transform-origin:right;}
.tbc-text-section.visible .tbc-divider{transform:scaleX(1);}
.tbc-role-label{font-size:clamp(.8rem,.9vw,1.1rem);font-style:italic;color:rgba(180,160,140,.7);margin:0 0 clamp(10px,1vw,15px) 0;letter-spacing:clamp(1.5px,.2vw,3px);text-transform:uppercase;}
.tbc-character-name{font-family:'Cinzel',serif;font-size:clamp(2rem,2.8vw,3.5rem);font-weight:700;color:#f0e6d3;margin:0;letter-spacing:clamp(1.5px,.2vw,3px);line-height:1.2;text-shadow:0 2px 20px rgba(0,0,0,.5);}

.tbc-gm-slide{display:flex;flex-direction:column;align-items:center;gap:clamp(30px,3.5vw,50px);width:100%;max-width:1400px;padding:clamp(25px,2.5vw,40px);position:relative;z-index:1;}
.tbc-gm-header{text-align:center;opacity:0;transform:translateY(-30px);transition:all 1s cubic-bezier(.34,1.56,.64,1);}
.tbc-gm-header.visible{opacity:1;transform:translateY(0);}
.tbc-gm-crown{font-size:clamp(1.2rem,1.5vw,2rem);color:rgba(212,175,55,.8);margin-bottom:clamp(10px,1vw,15px);text-shadow:0 0 20px rgba(212,175,55,.5);}
.tbc-gm-title{font-family:'Cinzel',serif;font-size:clamp(1rem,1.2vw,1.4rem);font-weight:600;color:rgba(212,175,55,.9);letter-spacing:clamp(3px,.4vw,6px);text-transform:uppercase;margin:0 0 clamp(10px,1vw,15px) 0;}
.tbc-gm-name{font-family:'Cinzel',serif;font-size:clamp(1.8rem,2.5vw,3rem);font-weight:700;color:#f0e6d3;margin:0;letter-spacing:clamp(2px,.3vw,4px);text-shadow:0 2px 30px rgba(0,0,0,.5);}
.tbc-gm-divider{width:clamp(120px,12vw,200px);height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.5),transparent);margin:clamp(12px,1.3vw,20px) auto;transform:scaleX(0);transition:transform .8s ease-out;transition-delay:.3s;}
.tbc-gm-header.visible .tbc-gm-divider{transform:scaleX(1);}
.tbc-gm-subtitle{font-size:clamp(.8rem,.9vw,1.1rem);font-style:italic;color:rgba(180,160,140,.7);letter-spacing:clamp(1.5px,.2vw,3px);}

.tbc-gm-portraits{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(18px,2vw,30px);max-width:1200px;}
.tbc-gm-portrait-item{display:flex;flex-direction:column;align-items:center;opacity:0;transform:translateY(30px);transition:all .8s cubic-bezier(.34,1.56,.64,1);}
.tbc-gm-portrait-item.visible{opacity:1;transform:translateY(0);}
.tbc-gm-portrait-frame{width:clamp(90px,9vw,140px);height:clamp(90px,9vw,140px);padding:clamp(2px,.3vw,4px);background:linear-gradient(135deg,rgba(212,175,55,.25) 0%,rgba(139,90,43,.15) 100%);border:1px solid rgba(212,175,55,.3);border-radius:4px;}
.tbc-gm-portrait-inner{width:100%;height:100%;overflow:hidden;border-radius:2px;background:#1a1a1a;}
.tbc-gm-portrait-img{width:100%;height:100%;object-fit:cover;object-position:top center;filter:sepia(.15) contrast(1.1);}
.tbc-gm-portrait-name{margin-top:clamp(8px,.8vw,12px);font-size:clamp(.7rem,.8vw,.95rem);color:rgba(200,180,160,.8);text-align:center;max-width:clamp(90px,9vw,140px);line-height:1.3;}
.tbc-gm-others{font-size:clamp(.9rem,1vw,1.2rem);font-style:italic;color:rgba(180,160,140,.5);letter-spacing:clamp(1px,.15vw,2px);margin-top:clamp(12px,1.3vw,20px);opacity:0;transform:translateY(20px);transition:all .8s ease-out;}
.tbc-gm-others.visible{opacity:1;transform:translateY(0);}

.tbc-final-slide{display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;z-index:1;}
.tbc-final-decoration{width:clamp(40px,4vw,60px);height:1px;background:rgba(212,175,55,.4);margin-bottom:clamp(18px,2vw,30px);opacity:0;transition:all .8s ease-out;}
.tbc-final-decoration.visible{opacity:1;}
.tbc-final-title{font-family:'Cinzel',serif;font-size:clamp(2.2rem,3.5vw,4rem);font-weight:700;color:rgba(212,175,55,.95);margin:0 0 clamp(18px,2vw,30px) 0;letter-spacing:clamp(3px,.4vw,6px);text-shadow:0 0 60px rgba(212,175,55,.4);opacity:0;transform:scale(.9);transition:all 1s cubic-bezier(.34,1.56,.64,1);}
.tbc-final-title.visible{opacity:1;transform:scale(1);}
.tbc-final-line{width:0;height:2px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.6),transparent);margin:0 auto clamp(18px,2vw,30px);transition:width 1s ease-out;transition-delay:.3s;}
.tbc-final-line.visible{width:clamp(180px,18vw,300px);}
.tbc-final-subtitle{font-size:clamp(1rem,1.2vw,1.5rem);font-style:italic;color:rgba(180,160,140,.6);letter-spacing:clamp(2px,.3vw,4px);opacity:0;transform:translateY(20px);transition:all .8s ease-out;transition-delay:.5s;}
.tbc-final-subtitle.visible{opacity:1;transform:translateY(0);}

.tbc-portrait-wrapper.fade-out,.tbc-text-section.fade-out,.tbc-gm-header.fade-out,
.tbc-gm-portrait-item.fade-out,.tbc-gm-others.fade-out,.tbc-final-decoration.fade-out,
.tbc-final-title.fade-out,.tbc-final-line.fade-out,.tbc-final-subtitle.fade-out{
  opacity:0 !important;transform:translateY(-20px) !important;
}
`);

// ─── TBC Config (exact from showstopper) ─────────────────────────────────────
const TBC_CONFIG = {
  soundPath:      `modules/${MODULE_ID}/assets/sounds/roundabout-long.ogg`,
  imagePath:      `modules/${MODULE_ID}/assets/tbc.webp`,
  delayMs:        3800,
  effectDuration: 10000,
  slideDuration:  6000,
  fadeTime:       1000,
};

// ─── Collect credits data (mirrors showstopper credits.mjs) ──────────────────
async function getTBCCreditsData() {
  const playerCredits = [];
  let gmCredit = null;

  for (const user of game.users.filter(u => u.active)) {
    if (user.isGM) {
      // GM's tokens = tokens on canvas NOT owned by any non-GM player
      const tokens = (canvas.tokens?.placeables ?? []).filter(t => {
        if (!t.actor || t.document.hidden) return false;
        return !game.users.some(u => !u.isGM && t.actor.testUserPermission(u, 'OWNER'));
      });
      const portraits = tokens.map(t => ({
        name: t.document.name,
        img:  t.actor.img || t.document.texture.src,
      }));
      if (!portraits.length) {
        portraits.push({ name: game.i18n.localize('DRAMADIRECTOR.endings.dungeonMaster'), img: user.avatar || 'icons/svg/mystery-man.svg' });
      }
      gmCredit = { userName: user.name, portraits };
    } else {
      const ch = user.character;
      playerCredits.push({
        userName:      user.name,
        characterName: ch?.name || game.i18n.localize('DRAMADIRECTOR.endings.unknownHero'),
        portrait:      ch?.img  || user.avatar || 'icons/svg/mystery-man.svg',
        role:          game.i18n.localize('DRAMADIRECTOR.endings.asRole'),
      });
    }
  }
  return { playerCredits, gmCredit };
}

// ─── Slide HTML (mirrors showstopper slides.mjs exactly) ─────────────────────
function createPlayerSlide(credit, left) {
  return `<div class="tbc-credit-slide ${left ? 'layout-left' : 'layout-right'}">
    <div class="tbc-portrait-wrapper">
      <div class="tbc-portrait-frame">
        <div class="tbc-portrait-inner">
          <img src="${credit.portrait}" class="tbc-portrait-img" alt="${credit.characterName}" onerror="this.src='icons/svg/mystery-man.svg'">
        </div>
        <div class="tbc-portrait-corner tl"></div><div class="tbc-portrait-corner tr"></div>
        <div class="tbc-portrait-corner bl"></div><div class="tbc-portrait-corner br"></div>
      </div>
    </div>
    <div class="tbc-text-section">
      <h2 class="tbc-player-name">${credit.userName}</h2>
      <div class="tbc-divider"></div>
      <p class="tbc-role-label">${credit.role}</p>
      <h1 class="tbc-character-name">${credit.characterName}</h1>
    </div>
  </div>`;
}

function createGMSlide(gm) {
  const portraits = gm.portraits.map((p, i) => `
    <div class="tbc-gm-portrait-item" data-idx="${i}">
      <div class="tbc-gm-portrait-frame"><div class="tbc-gm-portrait-inner">
        <img src="${p.img}" class="tbc-gm-portrait-img" onerror="this.src='icons/svg/mystery-man.svg'">
      </div></div>
      <p class="tbc-gm-portrait-name">${p.name}</p>
    </div>`).join('');
  return `<div class="tbc-gm-slide">
    <div class="tbc-gm-header">
      <div class="tbc-gm-crown">✦</div>
      <h3 class="tbc-gm-title">${game.i18n.localize('DRAMADIRECTOR.endings.dungeonMaster')}</h3>
      <h1 class="tbc-gm-name">${gm.userName}</h1>
      <div class="tbc-gm-divider"></div>
      <p class="tbc-gm-subtitle">${game.i18n.localize('DRAMADIRECTOR.endings.asRoleDots')}</p>
    </div>
    <div class="tbc-gm-portraits">${portraits}</div>
    <p class="tbc-gm-others">${game.i18n.localize('DRAMADIRECTOR.endings.andOthers')}</p>
  </div>`;
}

function createFinalSlide() {
  return `<div class="tbc-final-slide">
    <div class="tbc-final-decoration"></div>
    <h1 class="tbc-final-title">${game.i18n.localize('DRAMADIRECTOR.endings.tbc')}</h1>
    <div class="tbc-final-line"></div>
    <p class="tbc-final-subtitle">To Be Continued...</p>
  </div>`;
}

// ─── Credits sequence (mirrors showstopper credits.mjs) ──────────────────────
async function playTBCCredits(container, isSkip) {
  const { playerCredits, gmCredit } = await getTBCCreditsData();
  const { slideDuration, fadeTime } = TBC_CONFIG;

  await game.togglePause(true, true);
  container.style.opacity = '1';

  for (let i = 0; i < playerCredits.length; i++) {
    if (isSkip()) return;
    container.innerHTML = createPlayerSlide(playerCredits[i], i % 2 === 0);
    const portrait = container.querySelector('.tbc-portrait-wrapper');
    const text     = container.querySelector('.tbc-text-section');
    await new Promise(r => setTimeout(r, 100));
    if (isSkip()) return;
    portrait.classList.add('visible');
    text.classList.add('visible');
    if (await waitMs(slideDuration, isSkip)) return;
    portrait.classList.add('fade-out');
    text.classList.add('fade-out');
    if (await waitMs(fadeTime, isSkip)) return;
  }

  if (gmCredit && !isSkip()) {
    container.innerHTML = createGMSlide(gmCredit);
    const header   = container.querySelector('.tbc-gm-header');
    const items    = container.querySelectorAll('.tbc-gm-portrait-item');
    const others   = container.querySelector('.tbc-gm-others');
    await new Promise(r => setTimeout(r, 100));
    if (isSkip()) return;
    header.classList.add('visible');
    items.forEach((p, i) => setTimeout(() => { if (!isSkip()) p.classList.add('visible'); }, 400 + i * 150));
    setTimeout(() => { if (!isSkip()) others.classList.add('visible'); }, 400 + items.length * 150 + 300);
    if (await waitMs(slideDuration + items.length * 500, isSkip)) return;
    header.classList.add('fade-out');
    items.forEach(p => p.classList.add('fade-out'));
    others.classList.add('fade-out');
    if (await waitMs(fadeTime, isSkip)) return;
  }

  if (isSkip()) return;
  container.innerHTML = createFinalSlide();
  await new Promise(r => setTimeout(r, 100));
  if (isSkip()) return;
  ['tbc-final-decoration','tbc-final-title','tbc-final-line','tbc-final-subtitle'].forEach(cls => {
    container.querySelector(`.${cls}`)?.classList.add('visible');
  });
  if (await waitMs(slideDuration + 2000, isSkip)) return;
  ['tbc-final-decoration','tbc-final-title','tbc-final-line','tbc-final-subtitle'].forEach(cls => {
    container.querySelector(`.${cls}`)?.classList.add('fade-out');
  });
  if (await waitMs(fadeTime, isSkip)) return;
  container.style.transition = 'opacity 1.5s ease-out';
  container.style.opacity    = '0';
  await waitMs(1500, isSkip);
}

async function fadeOutSound(sound, duration, isSkip) {
  if (!sound) return;
  const steps = 20, stepTime = duration / steps, volStep = sound.volume / steps;
  for (let i = 0; i < steps; i++) {
    if (isSkip?.()) { sound.stop?.(); return; }
    await new Promise(r => setTimeout(r, stepTime));
    sound.volume = Math.max(0, sound.volume - volStep);
  }
  sound.stop?.();
}

// ─── State ───────────────────────────────────────────────────────────────────
let tbcPlaying = false, tbcSkipFlag = false, tbcSound = null;

// ─── Main TBC executor ───────────────────────────────────────────────────────
export async function executeTBCEnding() {
  if (tbcPlaying) return;
  tbcPlaying  = true;
  tbcSkipFlag = false;
  const isSkip = () => tbcSkipFlag;

  const { soundPath, imagePath, delayMs, effectDuration } = TBC_CONFIG;

  tbcSound = await foundry.audio.AudioHelper.play({
    src: soundPath, volume: 0.8, autoplay: true, loop: false
  }, false);

  // Sepia rgba overlay (same as showstopper — mix-blend-mode: multiply)
  const overlay = document.createElement('div');
  overlay.id = 'tbc-sepia-overlay';
  overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(112,66,20,.4);mix-blend-mode:multiply;pointer-events:none;z-index:9998;opacity:0;transition:opacity .5s ease-in-out;`;
  document.body.appendChild(overlay);

  // TBC image (bottom-right, same as showstopper)
  const img = document.createElement('img');
  img.id = 'tbc-image'; img.src = imagePath;
  img.style.cssText = `position:fixed;bottom:50px;right:50px;max-width:1050px;max-height:300px;z-index:10001;opacity:0;transition:opacity .5s ease-in-out;filter:drop-shadow(4px 4px 8px rgba(0,0,0,.8));`;
  document.body.appendChild(img);

  // Credits container
  const credits = document.createElement('div');
  credits.id = 'tbc-credits'; credits.className = 'tbc-credits-container';
  document.body.appendChild(credits);

  // GM skip button
  if (game.user.isGM) {
    const btn = document.createElement('button');
    btn.id = 'tbc-skip-btn'; btn.className = 'tbc-skip-button';
    btn.innerHTML = `<i class="fa-solid fa-forward"></i> ${game.i18n.localize('DRAMADIRECTOR.intro.skip')}`;
    btn.addEventListener('click', () => {
      tbcSkipFlag = true;
      // Broadcast skip to players
      game.socket.emit(`module.${MODULE_ID}`, { action: 'tbcSkip' });
      tbcCleanup();
    });
    document.body.appendChild(btn);
    setTimeout(() => btn.classList.add('visible'), 100);
  }

  window.clearTBC = tbcCleanup;

  // ─ delayMs: music plays, then canvas freezes ─
  if (await waitMs(delayMs, isSkip)) { tbcCleanup(); return; }

  canvas.app?.ticker?.stop?.();

  const board = document.getElementById('board');
  if (board) { board.style.transition = 'filter .5s ease-in-out'; board.style.filter = 'sepia(.9) saturate(1.2) brightness(.95)'; }
  overlay.style.opacity = '1';
  img.style.opacity     = '1';

  // ─ effectDuration: sepia + TBC image visible ─
  if (await waitMs(effectDuration, isSkip)) { tbcCleanup(); return; }

  // ─ Fade image out ─
  img.style.transition = 'opacity 1.5s ease-in-out'; img.style.opacity = '0';
  if (await waitMs(800, isSkip)) { tbcCleanup(); return; }

  // ─ Transition overlay to black ─
  overlay.style.transition  = 'all 2s ease-in-out';
  overlay.style.background  = 'rgba(0,0,0,1)';
  overlay.style.mixBlendMode = 'normal';
  if (board) { board.style.transition = 'filter 2s ease-in-out'; board.style.filter = 'sepia(.9) saturate(1.2) brightness(0)'; }
  if (await waitMs(2500, isSkip)) { tbcCleanup(); return; }

  img.remove();

  // ─ Credits sequence ─
  await playTBCCredits(credits, isSkip);

  if (!tbcSkipFlag) await fadeOutSound(tbcSound, 2000, isSkip);
  tbcCleanup();
}

function tbcCleanup() {
  document.getElementById('tbc-sepia-overlay')?.remove();
  document.getElementById('tbc-image')?.remove();
  document.getElementById('tbc-credits')?.remove();
  document.getElementById('tbc-skip-btn')?.remove();
  const board = document.getElementById('board');
  if (board) board.style.filter = '';
  canvas.app?.ticker?.start?.();
  if (tbcSound) { tbcSound.stop?.(); tbcSound = null; }
  tbcPlaying  = false;
  tbcSkipFlag = false;
  game.togglePause(false, true);
}

export function skipTBCEnding() {
  tbcSkipFlag = true;
  tbcCleanup();
}

// ══════════════════════════════════════════════════════════════════════════════
// DIRECTED BY ENDING
// ══════════════════════════════════════════════════════════════════════════════
injectStyles('dd-dirby-styles', `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap');

.dirby-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;z-index:10000;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity 1s ease-in-out;font-family:'Cinzel',serif;}
.dirby-overlay.visible{opacity:1;}

.dirby-block{display:flex;flex-direction:column;align-items:center;gap:.6rem;opacity:0;transform:translateY(20px);transition:all .8s ease-out;}
.dirby-block.visible{opacity:1;transform:translateY(0);}

.dirby-label{font-size:clamp(.8rem,.9vw,1.1rem);letter-spacing:clamp(4px,.5vw,8px);text-transform:uppercase;color:rgba(180,160,140,.6);font-style:italic;}
.dirby-name{font-size:clamp(2rem,3.5vw,4.5rem);font-weight:700;color:#f0e6d3;letter-spacing:clamp(2px,.3vw,4px);text-transform:uppercase;text-shadow:0 2px 40px rgba(0,0,0,.6);}
.dirby-line{width:0;height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.5),transparent);margin:.5rem 0;transition:width 1s ease-out .3s;}
.dirby-block.visible .dirby-line{width:clamp(120px,12vw,200px);}

.dirby-starring-grid{display:flex;flex-direction:column;align-items:center;gap:clamp(20px,2.5vw,35px);opacity:0;transform:translateY(20px);transition:all .8s ease-out;}
.dirby-starring-grid.visible{opacity:1;transform:translateY(0);}
.dirby-starring-title{font-size:clamp(.75rem,.85vw,1rem);letter-spacing:clamp(4px,.5vw,8px);text-transform:uppercase;color:rgba(180,160,140,.6);font-style:italic;margin-bottom:.5rem;}
.dirby-starring-item{display:flex;align-items:center;gap:clamp(20px,2vw,30px);opacity:0;transform:translateX(-20px);transition:all .6s ease-out;}
.dirby-starring-item.visible{opacity:1;transform:translateX(0);}
.dirby-starring-player{font-size:clamp(1.4rem,1.8vw,2.2rem);font-weight:600;color:rgba(212,175,55,.9);text-transform:uppercase;letter-spacing:2px;}
.dirby-starring-as{font-size:clamp(.75rem,.85vw,1rem);color:rgba(180,160,140,.5);font-style:italic;}
.dirby-starring-char{font-size:clamp(1.6rem,2.2vw,2.8rem);font-weight:700;color:#f0e6d3;text-transform:uppercase;letter-spacing:2px;}

.dirby-thanks{display:flex;flex-direction:column;align-items:center;text-align:center;gap:1rem;opacity:0;transform:scale(.9);transition:all 1s cubic-bezier(.34,1.56,.64,1);}
.dirby-thanks.visible{opacity:1;transform:scale(1);}
.dirby-thanks-title{font-size:clamp(2rem,3.5vw,4rem);font-weight:700;color:rgba(212,175,55,.9);letter-spacing:clamp(3px,.4vw,6px);}
.dirby-thanks-line{width:0;height:2px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.5),transparent);transition:width 1.2s ease-out .4s;}
.dirby-thanks.visible .dirby-thanks-line{width:clamp(160px,16vw,260px);}
.dirby-thanks-sub{font-size:clamp(.9rem,1.1vw,1.4rem);color:rgba(180,160,140,.6);font-style:italic;letter-spacing:2px;}

.dirby-skip-button{position:fixed;bottom:clamp(15px,2vw,30px);right:clamp(15px,2vw,30px);z-index:10011;display:flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(20,20,25,.9);border:1px solid rgba(212,175,55,.4);border-radius:4px;color:rgba(212,175,55,.9);font-family:'Cinzel',serif;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;cursor:pointer;opacity:0;transform:translateY(20px);transition:all .4s ease-out;pointer-events:auto;}
.dirby-skip-button.visible{opacity:1;transform:translateY(0);}
.dirby-skip-button:hover{background:rgba(30,30,35,.95);border-color:rgba(212,175,55,.7);box-shadow:0 0 20px rgba(212,175,55,.3);}
`);

let dirbyPlaying = false, dirbySkipFlag = false, dirbySound = null;

async function getDirbyData() {
  const gm = game.users.find(u => u.isGM && u.active);
  const players = game.users.filter(u => u.active && !u.isGM).map(u => ({
    playerName:    u.name,
    characterName: u.character?.name || '—',
  }));
  return { gmName: gm?.name || game.i18n.localize('DRAMADIRECTOR.endings.dungeonMaster'), players };
}

export async function executeDirectedByEnding() {
  if (dirbyPlaying) return;
  dirbyPlaying  = true;
  dirbySkipFlag = false;
  const isSkip = () => dirbySkipFlag;

  const soundPath = `modules/${MODULE_ID}/assets/sounds/directed-by.ogg`;
  dirbySound = await foundry.audio.AudioHelper.play({ src: soundPath, volume: 0.8, autoplay: true, loop: false }, false);

  const overlay = document.createElement('div');
  overlay.id = 'dirby-overlay'; overlay.className = 'dirby-overlay';
  document.body.appendChild(overlay);

  if (game.user.isGM) {
    const btn = document.createElement('button');
    btn.id = 'dirby-skip-btn'; btn.className = 'dirby-skip-button';
    btn.innerHTML = `<i class="fa-solid fa-forward"></i> ${game.i18n.localize('DRAMADIRECTOR.intro.skip')}`;
    btn.addEventListener('click', () => {
      dirbySkipFlag = true;
      game.socket.emit(`module.${MODULE_ID}`, { action: 'dirbySkip' });
      dirbyCleanup();
    });
    document.body.appendChild(btn);
    setTimeout(() => btn.classList.add('visible'), 100);
  }

  await waitMs(400, isSkip);
  overlay.classList.add('visible');
  if (await waitMs(800, isSkip)) { dirbyCleanup(); return; }

  const { gmName, players } = await getDirbyData();

  // Three GM slides
  const gmSlides = [
    { label: game.i18n.localize('DRAMADIRECTOR.endings.credDirector'), name: gmName },
    { label: game.i18n.localize('DRAMADIRECTOR.endings.credExecProd'), name: gmName },
    { label: game.i18n.localize('DRAMADIRECTOR.endings.credProducer'), name: gmName },
  ];

  for (const slide of gmSlides) {
    if (isSkip()) { dirbyCleanup(); return; }
    const block = document.createElement('div');
    block.className = 'dirby-block';
    block.innerHTML = `<div class="dirby-label">${slide.label}</div><div class="dirby-line"></div><div class="dirby-name">${slide.name}</div>`;
    overlay.innerHTML = ''; overlay.appendChild(block);
    await new Promise(r => setTimeout(r, 100));
    if (isSkip()) { dirbyCleanup(); return; }
    block.classList.add('visible');
    if (await waitMs(3000, isSkip)) { dirbyCleanup(); return; }
    block.style.transition = 'opacity .6s ease-out'; block.style.opacity = '0';
    if (await waitMs(700, isSkip)) { dirbyCleanup(); return; }
  }

  // Starring
  if (!isSkip() && players.length) {
    const grid = document.createElement('div');
    grid.className = 'dirby-starring-grid';
    grid.innerHTML = `<div class="dirby-starring-title">${game.i18n.localize('DRAMADIRECTOR.endings.starring')}</div>` +
      players.map(p => `<div class="dirby-starring-item">
        <span class="dirby-starring-player">${p.playerName}</span>
        <span class="dirby-starring-as">${game.i18n.localize('DRAMADIRECTOR.endings.asRole')}</span>
        <span class="dirby-starring-char">${p.characterName}</span>
      </div>`).join('');
    overlay.innerHTML = ''; overlay.appendChild(grid);
    await new Promise(r => setTimeout(r, 100));
    if (isSkip()) { dirbyCleanup(); return; }
    grid.classList.add('visible');
    const items = grid.querySelectorAll('.dirby-starring-item');
    items.forEach((item, i) => setTimeout(() => { if (!isSkip()) item.classList.add('visible'); }, 300 + i * 200));
    if (await waitMs(4000 + players.length * 300, isSkip)) { dirbyCleanup(); return; }
    grid.style.transition = 'opacity .8s ease-out'; grid.style.opacity = '0';
    if (await waitMs(900, isSkip)) { dirbyCleanup(); return; }
  }

  // Thanks
  if (!isSkip()) {
    const thanks = document.createElement('div');
    thanks.className = 'dirby-thanks';
    thanks.innerHTML = `<div class="dirby-thanks-title">${game.i18n.localize('DRAMADIRECTOR.endings.thanks')}</div><div class="dirby-thanks-line"></div><div class="dirby-thanks-sub">${game.i18n.localize('DRAMADIRECTOR.endings.untilNext')}</div>`;
    overlay.innerHTML = ''; overlay.appendChild(thanks);
    await new Promise(r => setTimeout(r, 100));
    if (isSkip()) { dirbyCleanup(); return; }
    thanks.classList.add('visible');
    if (await waitMs(5000, isSkip)) { dirbyCleanup(); return; }
  }

  // Fade out
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    if (isSkip()) break;
    await new Promise(r => setTimeout(r, 100));
    if (dirbySound) dirbySound.volume = Math.max(0, dirbySound.volume - dirbySound.volume / steps);
  }
  dirbyCleanup();
}

function dirbyCleanup() {
  document.getElementById('dirby-overlay')?.remove();
  document.getElementById('dirby-skip-btn')?.remove();
  if (dirbySound) { dirbySound.stop?.(); dirbySound = null; }
  dirbyPlaying  = false;
  dirbySkipFlag = false;
}

export function skipDirectedByEnding() {
  dirbySkipFlag = true;
  dirbyCleanup();
}
