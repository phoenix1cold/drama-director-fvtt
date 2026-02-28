/**
 * Drama Director - Foundry VTT Module V13
 * @version 4.0.0
 */

import {
  executeSinCityIntro, skipSinCityIntro,
  executeMacheteIntro, skipMacheteIntro,
  executeMacheteBloodIntro, skipMacheteBloodIntro,
  executeSnatchIntro, skipSnatchIntro,
} from './introductions.mjs';
import { executeWBRBEnding, skipWBRBEnding, executeJojoEnding, skipJojoEnding } from './endings.mjs';
import { initVNSystem, DDVNApi } from './visual-novel.mjs';

const MODULE_ID = 'drama-director';
const SOCKET_EVENT = `module.${MODULE_ID}`;

// ── Language override ────────────────────────────────────────────────────────
// Stored as a Promise so _prepareContext can await it before rendering.
let _ddLangPromise = Promise.resolve();

// Export the promise so other modules can await it
export function getLanguagePromise() { return _ddLangPromise; }

function _ddDeepMerge(target, src) {
  for (const key of Object.keys(src)) {
    const val = src[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
      _ddDeepMerge(target[key], val);
    } else {
      target[key] = val;
    }
  }
}

// i18nInit fires after Foundry loads its own lang files — ideal place to inject ours.
// NOTE: Foundry does NOT await async hooks, so we store a Promise instead of using async.
// By this point 'init' has already fired, so game.settings.get() works fine.
Hooks.once('i18nInit', () => {
  let langPref = 'auto';
  try {
    langPref = game.settings.get(MODULE_ID, 'language') ?? 'auto';
  } catch(e) {
    // Fallback: try reading raw localStorage with multiple possible key formats
    langPref = localStorage.getItem(`${MODULE_ID}.language`)
            ?? localStorage.getItem(`client.${MODULE_ID}.language`)
            ?? 'auto';
  }

  if (langPref === 'auto') return;

  _ddLangPromise = fetch(`modules/${MODULE_ID}/lang/${langPref}.json`)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => {
      _ddDeepMerge(game.i18n.translations, data);
      console.log(`Drama Director | Language override applied: ${langPref}`);
    })
    .catch(e => console.warn(`Drama Director | Language load failed (${langPref}):`, e));
});

// ═══════════════════════════════════════════════════════════════════════════
// MAP EFFECTS (DramaDirector)
// ═══════════════════════════════════════════════════════════════════════════

class DramaDirector {
  constructor() {
    this.activeEffects = new Map();
    this.audioContext  = null;
    this._currentAudio = null;
    this._filmRaf      = null;
    this.initialized   = false;
  }

  init() {
    if (this.initialized) return;
    console.log('Drama Director | Initializing v4.0.0...');
    this._registerSettings();
    this._createOverlays();
    this._setupSocketListener();
    this.initialized = true;
    console.log('Drama Director | Ready!');
  }

  _registerSettings() {
    // Note: 'language' setting is registered in the 'init' hook (see bottom of file)
    // to ensure it's available early enough for the i18nInit override below.

    game.settings.register(MODULE_ID, 'vignetteIntensity', {
      name: 'DRAMADIRECTOR.settings.vignetteIntensity',
      hint: 'DRAMADIRECTOR.settings.vignetteIntensityHint',
      scope: 'world', config: true, type: Number,
      range: { min: 0, max: 100, step: 5 }, default: 50,
    });
    game.settings.register(MODULE_ID, 'defaultTextDuration', {
      name: 'DRAMADIRECTOR.settings.textDuration',
      hint: 'DRAMADIRECTOR.settings.textDurationHint',
      scope: 'world', config: true, type: Number,
      range: { min: 1000, max: 15000, step: 500 }, default: 4000,
    });
    game.settings.register(MODULE_ID, 'enableSounds', {
      name: 'DRAMADIRECTOR.settings.enableSounds',
      hint: 'DRAMADIRECTOR.settings.enableSoundsHint',
      scope: 'client', config: true, type: Boolean, default: true,
    });
    game.settings.register(MODULE_ID, 'soundVolume', {
      name: 'DRAMADIRECTOR.settings.soundVolume',
      hint: 'DRAMADIRECTOR.settings.soundVolumeHint',
      scope: 'client', config: true, type: Number,
      range: { min: 0, max: 1, step: 0.1 }, default: 0.7,
    });

    // Text effect presets — stored per-world, GM only
    game.settings.register(MODULE_ID, 'textPresets', {
      scope: 'world', config: false, type: Array, default: [],
    });

  }

  _createOverlays() {
    // Canvas-bound — only covers the map, not the UI
    const canvasEl = document.querySelector('#canvas') ?? document.body;
    const mapContainer = document.createElement('div');
    mapContainer.id = 'dd-map-container';
    mapContainer.innerHTML = `
      <div id="dd-vignette"  class="dd-map-effect hidden"></div>
      <div id="dd-grayscale" class="dd-map-effect hidden"></div>
      <div id="dd-sepia"     class="dd-map-effect hidden"></div>
      <div id="dd-film"      class="dd-map-effect hidden"></div>
      <div id="dd-sketch"    class="dd-map-effect hidden"></div>
      <div id="dd-drunk"     class="dd-map-effect hidden"></div>
      <div id="dd-high"      class="dd-map-effect hidden"></div>
      <div id="dd-glitch"    class="dd-map-effect hidden"></div>
      <div id="dd-particles" class="dd-map-effect"></div>
      <div id="dd-blood"     class="dd-map-effect"></div>
    `;
    canvasEl.appendChild(mapContainer);

    // Full-screen — text, intro, video go here
    const fullContainer = document.createElement('div');
    fullContainer.id = 'drama-director-container';
    fullContainer.innerHTML = `
      <div id="dd-text"  class="dd-effect hidden"></div>
      <div id="dd-intro" class="dd-effect hidden"></div>
      <div id="dd-video" class="dd-effect hidden"></div>
    `;
    document.body.appendChild(fullContainer);

    this.overlays = {
      vignette:  mapContainer.querySelector('#dd-vignette'),
      grayscale: mapContainer.querySelector('#dd-grayscale'),
      sepia:     mapContainer.querySelector('#dd-sepia'),
      film:      mapContainer.querySelector('#dd-film'),
      sketch:    mapContainer.querySelector('#dd-sketch'),
      drunk:     mapContainer.querySelector('#dd-drunk'),
      high:      mapContainer.querySelector('#dd-high'),
      glitch:    mapContainer.querySelector('#dd-glitch'),
      particles: mapContainer.querySelector('#dd-particles'),
      blood:     mapContainer.querySelector('#dd-blood'),
      text:      fullContainer.querySelector('#dd-text'),
      intro:     fullContainer.querySelector('#dd-intro'),
      video:     fullContainer.querySelector('#dd-video'),
    };
  }

  _setupSocketListener() {
    game.socket.on(SOCKET_EVENT, (data) => {
      if (data.targetUser && data.targetUser !== game.user.id) return;
      switch (data.action) {
        case 'effect':          this._applyEffect(data.effect, data.options); break;
        case 'clear':           this._clearEffects(); break;
        case 'sound':           this._playAudioFile(data.url, data.volume ?? 0.7); break;
        case 'stopSound':       this.stopCustomSound(false); break;
        case 'video':           this._showVideo(data.url, data.options); break;
        case 'stopVideo':       this._stopVideo(); break;
        case 'sinCityIntro':     executeSinCityIntro(data.campaignName ?? ''); break;
        case 'snatchIntro':     executeSnatchIntro(data.campaignName ?? ''); break;
        case 'sinCitySkip':     skipSinCityIntro(); break;
        case 'macheteIntro':    executeMacheteIntro(data.campaignName ?? ''); break;
        case 'macheteSkip':     skipMacheteIntro(); break;
        case 'macheteBloodIntro': executeMacheteBloodIntro(data.campaignName ?? ''); break;
        case 'macheteBloodSkip':  skipMacheteBloodIntro(); break;
        case 'snatchSkip':      skipSnatchIntro(); break;
        case 'wbrbEnding':      executeWBRBEnding(); break;
        case 'wbrbSkip':        skipWBRBEnding(); break;
        case 'jojoEnding':      executeJojoEnding(); break;
        case 'jojoSkip':        skipJojoEnding(); break;
      }
    });
  }

  // ─── Effect dispatcher ────────────────────────────────────────────────────

  applyEffect(effectId, options = {}, targetUser = null) {
    if (targetUser && game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action: 'effect', effect: effectId, options, targetUser });
      return;
    }
    this._applyEffect(effectId, options);
    if (game.user.isGM && !targetUser) {
      game.socket.emit(SOCKET_EVENT, { action: 'effect', effect: effectId, options, targetUser: null });
    }
  }

  _applyEffect(effectId, options = {}) {
    const map = {
      'vignette':  () => this._effectVignette(options),
      'grayscale': () => this._effectGrayscale(options),
      'sepia':     () => this._effectSepia(options),
      'film':      () => this._effectFilm(options),
      'sketch':    () => this._effectSketch(options),
      'drunk':     () => this._effectDrunk(options),
      'high':      () => this._effectHigh(options),
      'glitch':    () => this._effectGlitch(options),
      'blood':     () => this._effectBlood(options),
      'sakura':    () => this._effectSakura(options),
      'hearts':    () => this._effectHearts(options),
      'text':      () => this._effectText(options),
      'intro':     () => this._effectIntro(options),
    };
    map[effectId]?.();
  }

  // ─── Basic ────────────────────────────────────────────────────────────────

  _effectVignette(o = {}) {
    const on = o.active !== false;
    if (on) {
      this.overlays.vignette.style.setProperty('--vignette-intensity', `${o.intensity ?? game.settings.get(MODULE_ID,'vignetteIntensity')}%`);
      this.overlays.vignette.classList.remove('hidden');
      this.activeEffects.set('vignette', true);
    } else {
      this.overlays.vignette.classList.add('hidden');
      this.activeEffects.delete('vignette');
    }
  }

  _effectGrayscale(o = {}) {
    const on = o.active !== false;
    if (on) {
      this.overlays.grayscale.style.setProperty('--grayscale', `${o.intensity ?? 100}%`);
      this.overlays.grayscale.classList.remove('hidden');
      this.activeEffects.set('grayscale', true);
    } else {
      this.overlays.grayscale.classList.add('hidden');
      this.activeEffects.delete('grayscale');
    }
  }

  _effectSepia(o = {}) {
    const on = o.active !== false;
    if (on) {
      this.overlays.sepia.style.setProperty('--sepia', `${o.intensity ?? 90}%`);
      this.overlays.sepia.classList.remove('hidden');
      this.activeEffects.set('sepia', true);
    } else {
      this.overlays.sepia.classList.add('hidden');
      this.activeEffects.delete('sepia');
    }
  }

  _effectFilm(o = {}) {
    const on = o.active !== false;
    if (on) {
      this.overlays.film.classList.remove('hidden');
      this.activeEffects.set('film', true);
      this._startFilmGrain();
    } else {
      this.overlays.film.classList.add('hidden');
      this.activeEffects.delete('film');
      this._stopFilmGrain();
    }
  }

  _startFilmGrain() {
    const canvas = document.createElement('canvas');
    canvas.id = 'dd-film-canvas';
    canvas.width  = Math.ceil(window.innerWidth  / 2);
    canvas.height = Math.ceil(window.innerHeight / 2);
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    this.overlays.film.innerHTML = '';
    this.overlays.film.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const draw = () => {
      if (!this.activeEffects.has('film')) return;
      frame++;
      const img = ctx.createImageData(canvas.width, canvas.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255 | 0;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = Math.random() < 0.3 ? 35 : 0;
      }
      ctx.putImageData(img, 0, 0);
      if (Math.random() < 0.04) {
        const x = Math.random() * canvas.width;
        ctx.strokeStyle = `rgba(255,255,255,${.05+Math.random()*.12})`;
        ctx.lineWidth = .5 + Math.random();
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.random()-.5)*6, canvas.height);
        ctx.stroke();
      }
      if (frame % 3 === 0) this.overlays.film.style.setProperty('--film-brightness', Math.random() < .03 ? '.93' : '1');
      this._filmRaf = requestAnimationFrame(draw);
    };
    this._filmRaf = requestAnimationFrame(draw);
  }

  _stopFilmGrain() {
    if (this._filmRaf) cancelAnimationFrame(this._filmRaf);
    this._filmRaf = null;
    this.overlays.film.innerHTML = '';
  }

  _effectSketch(o = {}) {
    const on = o.active !== false;
    if (on) {
      this.overlays.sketch.classList.remove('hidden');
      this.activeEffects.set('sketch', true);
    } else {
      this.overlays.sketch.classList.add('hidden');
      this.activeEffects.delete('sketch');
    }
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  _effectDrunk(o = {}) {
    const on = o.active !== false;
    if (on) {
      this.overlays.drunk.classList.remove('hidden');
      this.activeEffects.set('drunk', true);
      if (o.temporary) setTimeout(() => this._effectDrunk({ active: false }), o.duration ?? 10000);
    } else {
      this.overlays.drunk.classList.add('hidden');
      this.activeEffects.delete('drunk');
    }
  }

  _effectHigh(o = {}) {
    const on = o.active !== false;
    if (on) {
      this.overlays.high.classList.remove('hidden');
      this.activeEffects.set('high', true);
      if (o.temporary) setTimeout(() => this._effectHigh({ active: false }), o.duration ?? 15000);
    } else {
      this.overlays.high.classList.add('hidden');
      this.activeEffects.delete('high');
    }
  }

  // ─── Special ──────────────────────────────────────────────────────────────

  _effectGlitch(o = {}) {
    const on = o.active !== false;
    if (on) {
      this.overlays.glitch.innerHTML = `
        <div class="dd-glitch-slice" style="--slice-from:5%;  --slice-to:28%; --offset:-14px; --hue:180deg; --delay:0s;"></div>
        <div class="dd-glitch-slice" style="--slice-from:35%; --slice-to:52%; --offset:10px;  --hue:270deg; --delay:.07s;"></div>
        <div class="dd-glitch-slice" style="--slice-from:60%; --slice-to:85%; --offset:-7px;  --hue:90deg;  --delay:.13s;"></div>
        <div class="dd-glitch-aberration"></div>
        <div class="dd-glitch-flash"></div>`;
      this.overlays.glitch.classList.remove('hidden');
      this.activeEffects.set('glitch', true);
      if (o.duration) setTimeout(() => this._effectGlitch({ active: false }), o.duration);
    } else {
      this.overlays.glitch.classList.add('hidden');
      this.overlays.glitch.innerHTML = '';
      this.activeEffects.delete('glitch');
    }
  }

  _effectBlood(o = {}) {
    const count = o.count ?? 18;
    const dur   = o.duration ?? 9000;
    for (let i = 0; i < count; i++) setTimeout(() => this._createBloodDrop(dur), Math.random() * 1500);
  }

  _createBloodDrop(totalDur = 9000) {
    const drop = document.createElement('div');
    drop.className = 'dd-blood-drop';
    drop.style.left = `${Math.random() * window.innerWidth}px`;
    drop.style.setProperty('--drop-height', `${50 + Math.random()*140}px`);
    drop.style.setProperty('--drop-width',  `${3 + Math.random()*7}px`);
    drop.style.animationDuration = `${2500 + Math.random()*4000}ms`;
    this.overlays.blood.appendChild(drop);
    setTimeout(() => drop.remove(), totalDur);
  }

  // ─── Particles ────────────────────────────────────────────────────────────

  _effectSakura(o = {}) {
    for (let i = 0; i < (o.count ?? 40); i++)
      setTimeout(() => this._createParticle('sakura', o.duration ?? 8000), Math.random() * 3000);
  }
  _effectHearts(o = {}) {
    for (let i = 0; i < (o.count ?? 25); i++)
      setTimeout(() => this._createParticle('heart', o.duration ?? 4000), Math.random() * 2000);
  }
  _createParticle(type, duration) {
    const p = document.createElement('div');
    p.className = `dd-particle dd-${type}`;
    p.style.left = `${Math.random() * window.innerWidth}px`;
    p.style.top  = type === 'heart' ? `${window.innerHeight}px` : '-50px';
    this.overlays.particles.appendChild(p);
    setTimeout(() => p.remove(), duration);
  }

  // ─── Text ─────────────────────────────────────────────────────────────────

  _effectText(o = {}) {
    const style     = o.style ?? 'default';
    const animation = o.animation ?? 'fade';
    const duration  = o.duration ?? game.settings.get(MODULE_ID, 'defaultTextDuration');
    const color     = o.color ?? '#ffffff';

    // Character Introduction
    const charIntro = o.charIntro ?? false;
    const tokenId   = o.tokenId ?? '';
    const charAnim  = o.charIntroAnim ?? 'fade';
    const portraitScale = o.portraitScale ?? 1;
    const portraitX     = o.portraitX ?? 0;
    const portraitY     = o.portraitY ?? 0;
    const portraitZ     = o.portraitZ ?? 0;

    const posMap = { 'left-block':'pos-left','right-block':'pos-right','bottom':'pos-bottom' };
    const posClass = posMap[style] ?? 'pos-center';
    this.overlays.text.className = `dd-effect ${posClass}`;
    this.overlays.text.style.color = color;
    this.overlays.text.style.setProperty('--text-duration', `${duration}ms`);
    this.overlays.text.innerHTML = '';

    // ── Multi-image layers ──
    const imageLayers = o.imageLayers ?? (o.image ? [{ url: o.image, scale: o.imageScale ?? 1, x: o.imageX ?? 0, y: o.imageY ?? 0, z: 0, animation: 'fade' }] : []);
    imageLayers.forEach((img, idx) => {
      if (!img.url) return;
      const imgWrap = document.createElement('div');
      imgWrap.className = 'dd-image-layer';
      imgWrap.style.cssText = `
        position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        transform: translate(${img.x ?? 0}%, ${img.y ?? 0}%) scale(${img.scale ?? 1});
        transform-origin: center center;
        z-index: ${10 + (img.z ?? 0)};
        animation: text-${img.animation || 'fade'}-in 0.5s ease-out forwards;
      `;
      const imgEl = document.createElement('img');
      imgEl.src = img.url;
      imgEl.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      imgWrap.appendChild(imgEl);
      this.overlays.text.appendChild(imgWrap);
    });

    // ── Character Introduction overlay ──
    if (charIntro) {
      this._effectCharIntro(tokenId, o.text ?? '', charAnim, duration, this.overlays.text, { scale: portraitScale, x: portraitX, y: portraitY, z: portraitZ });
    }

    // ── Multi-text layers ──
    const textLayers = o.textLayers ?? (o.text ? [{ text: o.text, subtitle: o.subtitle, style: o.style ?? 'default', animation: o.animation ?? 'fade', scale: o.textScale ?? 1, x: o.textX ?? 0, y: o.textY ?? 0, z: 0 }] : []);
    textLayers.forEach((layer) => {
      if (!layer.text) return;
      const layerStyle = layer.style ?? 'default';
      const layerPosMap = { 'left-block':'pos-left','right-block':'pos-right','bottom':'pos-bottom' };
      const layerPosClass = layerPosMap[layerStyle] ?? 'pos-center';
      const subHtml = (layerStyle === 'chapter' && layer.subtitle)
        ? `<div class="dd-dramatic-subtitle">${layer.subtitle}</div>` : '';

      const textWrap = document.createElement('div');
      textWrap.className = 'dd-text-layer-wrap';
      textWrap.style.cssText = `
        position: absolute; inset: 0;
        display: flex;
        align-items: ${layerPosClass === 'pos-bottom' ? 'flex-end' : 'center'};
        justify-content: ${layerPosClass === 'pos-left' ? 'flex-start' : layerPosClass === 'pos-right' ? 'flex-end' : 'center'};
        transform: translate(${layer.x ?? 0}%, ${layer.y ?? 0}%);
        z-index: ${20 + (layer.z ?? 0)};
      `;
      const textEl = document.createElement('div');
      textEl.className = `dd-dramatic-text style-${layerStyle} anim-${layer.animation || 'fade'}`;
      textEl.style.transform = `scale(${layer.scale ?? 1})`;
      textEl.innerHTML = layer.text + subHtml;
      textWrap.appendChild(textEl);
      this.overlays.text.appendChild(textWrap);
    });

    this.overlays.text.classList.remove('hidden');
    setTimeout(() => this.overlays.text.classList.add('hidden'), duration);
  }

  // ─── Character Introduction ───────────────────────────────────────────────

  _effectCharIntro(tokenId, nameText, animStyle, duration, container, posOpts = {}) {
    // Resolve portrait
    let portrait = 'icons/svg/mystery-man.svg';
    let title = '';
    if (tokenId) {
      const token = canvas?.tokens?.placeables?.find(t => t.id === tokenId);
      if (token?.actor) {
        portrait = token.actor.img || portrait;
        const actor = token.actor;
        const cls = Object.values(actor.classes ?? {});
        title = cls.length ? cls.map(c => c.name).join(' / ')
              : (actor.system?.details?.race || actor.system?.details?.type?.value || '');
        if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
      }
    }

    const scale = posOpts.scale ?? 1;
    const px    = posOpts.x ?? 0;
    const py    = posOpts.y ?? 0;
    const pz    = posOpts.z ?? 0;

    // Extended animation set
    const smokeAnim   = animStyle === 'smoke';
    const flipAnim    = animStyle === 'flip';
    const bounceAnim  = animStyle === 'bounce';
    const slideDownA  = animStyle === 'slideDown';

    const overlay = document.createElement('div');
    const extraAnim = (smokeAnim || flipAnim || bounceAnim) ? '' : ` anim-${animStyle}`;
    overlay.className = `dd-char-intro-overlay${extraAnim}`;
    overlay.style.cssText = `
      transform: translate(${px}%, ${py}%) scale(${scale});
      transform-origin: center center;
      z-index: ${10 + pz};
    `;

    overlay.innerHTML = `
      <div class="dd-char-intro-portrait-wrap">
        <div class="dd-char-frame">
          <img src="${portrait}" alt="${nameText}" onerror="this.src='icons/svg/mystery-man.svg'">
        </div>
        ${nameText ? `<div class="dd-char-intro-name">${nameText}</div>` : ''}
        ${title    ? `<div class="dd-char-intro-title">${title}</div>` : ''}
      </div>
    `;

    container.appendChild(overlay);

    // ── Smoke animation via SVG displacement filter ──
    if (smokeAnim) {
      overlay.style.opacity = '0';
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;top:0;left:0;pointer-events:none;';
      const fid = `dd-ci-sf-${Date.now()}`;
      svg.innerHTML = `<defs><filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%">
        <feTurbulence id="${fid}-t" type="fractalNoise" baseFrequency="0.025 0.04" numOctaves="5" seed="${(Math.random()*100)|0}" result="noise"/>
        <feDisplacementMap id="${fid}-d" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/>
      </filter></defs>`;
      document.body.appendChild(svg);
      const turb = svg.querySelector(`#${fid}-t`);
      const disp = svg.querySelector(`#${fid}-d`);
      overlay.style.filter = `url(#${fid})`;
      let start = null;
      const dur = 1000;
      const frame = (ts) => {
        if (!start) start = ts;
        const raw = Math.min((ts - start) / dur, 1);
        const p = 1 - Math.pow(1 - raw, 2);
        const sc = (1 - p) * 220;
        const freq = 0.025 + (1 - p) * 0.1;
        turb.setAttribute('baseFrequency', `${freq.toFixed(4)} ${(freq*1.7).toFixed(4)}`);
        disp.setAttribute('scale', sc.toFixed(1));
        overlay.style.opacity = raw.toString();
        if (raw < 1) requestAnimationFrame(frame);
        else { svg.remove(); overlay.style.filter = ''; }
      };
      requestAnimationFrame(frame);
    }

    // ── Flip animation ──
    if (flipAnim) {
      overlay.style.perspective = '800px';
      overlay.style.animation = 'dd-flip-in 0.7s cubic-bezier(.42,0,.27,1.5) forwards';
    }

    // ── Bounce animation ──
    if (bounceAnim) {
      overlay.style.animation = 'dd-bounce-in 0.8s cubic-bezier(.36,.07,.19,.97) forwards';
    }

    // ── SlideDown animation ──
    if (slideDownA) {
      overlay.style.animation = 'dd-slide-down 0.6s ease-out forwards';
    }
  }

  // ─── Presets ──────────────────────────────────────────────────────────────

  getTextPresets() {
    try { return game.settings.get(MODULE_ID, 'textPresets') ?? []; }
    catch(e) { return []; }
  }

  async saveTextPreset(name, options) {
    if (!name) return;
    const presets = this.getTextPresets().filter(p => p.name !== name);
    presets.push({ name, options });
    await game.settings.set(MODULE_ID, 'textPresets', presets);
    ui.notifications?.info(game.i18n.format('DRAMADIRECTOR.presetSaved', { name }));
    return presets;
  }

  async deleteTextPreset(name) {
    if (!name) return;
    const presets = this.getTextPresets().filter(p => p.name !== name);
    await game.settings.set(MODULE_ID, 'textPresets', presets);
    ui.notifications?.info(game.i18n.localize('DRAMADIRECTOR.presetDeleted'));
    return presets;
  }

  // ─── Macro generation ────────────────────────────────────────────────────

  generateTextMacro(options, targetUser = null) {
    const opts = JSON.stringify(options, null, 2);
    const userArg = targetUser ? `, "${targetUser}"` : '';
    return `// Drama Director — Text Effect Macro
// Generated ${new Date().toLocaleDateString()}
game.dramaDirector.applyEffect('text', ${opts}${userArg});`;
  }

  // ─── Cinematic Intro ──────────────────────────────────────────────────────

  _effectIntro(o = {}) {
    const { title = '', subtitle = '', style = 'epic', animIn = 'reveal', duration = 6000 } = o;
    this.overlays.intro.className = `dd-effect dd-intro-style-${style} dd-intro-anim-${animIn}`;
    this.overlays.intro.innerHTML = `
      <div class="dd-intro-bg"></div>
      <div class="dd-intro-content">
        <div class="dd-intro-line dd-intro-line-top"></div>
        <div class="dd-intro-title">${title}</div>
        ${subtitle ? `<div class="dd-intro-subtitle">${subtitle}</div>` : ''}
        <div class="dd-intro-line dd-intro-line-bottom"></div>
      </div>`;
    const fadeDelay = Math.max(duration - 1000, 500);
    setTimeout(() => {
      this.overlays.intro.classList.add('dd-intro-fadeout');
      setTimeout(() => {
        this.overlays.intro.className = 'dd-effect hidden';
        this.overlays.intro.innerHTML = '';
      }, 1000);
    }, fadeDelay);
  }

  // ─── Video ────────────────────────────────────────────────────────────────

  showVideo(url, options = {}, targetUser = null) {
    if (!url) return;
    if (targetUser && game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action: 'video', url, options, targetUser });
      return;
    }
    this._showVideo(url, options);
    if (game.user.isGM && !targetUser) {
      game.socket.emit(SOCKET_EVENT, { action: 'video', url, options, targetUser: null });
    }
  }

  _showVideo(url, options = {}) {
    const loop   = options.loop   ?? false;
    const volume = options.volume ?? 0.8;
    const autoClose = options.autoClose ?? true;

    this.overlays.video.innerHTML = `
      <div class="dd-video-bg"></div>
      <video id="dd-video-player" class="dd-video-player"
        src="${url}"
        ${loop ? 'loop' : ''}
        autoplay playsinline>
      </video>
      ${game.user.isGM ? `<button class="dd-video-close-btn" id="dd-video-close">
        <i class="fas fa-times"></i>
      </button>` : ''}
    `;
    this.overlays.video.classList.remove('hidden');

    const vid = this.overlays.video.querySelector('#dd-video-player');
    vid.volume = Math.min(1, Math.max(0, volume));
    vid.play().catch(e => console.warn('DD Video | play error', e));

    if (autoClose && !loop) {
      vid.addEventListener('ended', () => this._stopVideo());
    }

    this.overlays.video.querySelector('#dd-video-close')?.addEventListener('click', () => {
      this.stopVideo(null);
    });
  }

  stopVideo(targetUser = null) {
    if (targetUser && game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action: 'stopVideo', targetUser });
      return;
    }
    this._stopVideo();
    if (game.user.isGM && !targetUser) {
      game.socket.emit(SOCKET_EVENT, { action: 'stopVideo', targetUser: null });
    }
  }

  _stopVideo() {
    const vid = document.getElementById('dd-video-player');
    if (vid) { vid.pause(); vid.src = ''; }
    this.overlays.video.classList.add('hidden');
    this.overlays.video.innerHTML = '';
  }

  // ─── Cinematic Intros (all-players) ──────────────────────────────────────

  async triggerSinCityIntro(campaignName = '') {
    executeSinCityIntro(campaignName);
    if (game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action: 'sinCityIntro', campaignName });
    }
  }
  async triggerMacheteBloodIntro(campaignName = '') {
    executeMacheteBloodIntro(campaignName);
    if (game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action: 'macheteBloodIntro', campaignName });
    }
  }

  async triggerMacheteIntro(campaignName = '') {
    executeMacheteIntro(campaignName);
    if (game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action: 'macheteIntro', campaignName });
    }
  }

  async triggerSnatchIntro(campaignName = '') {
    executeSnatchIntro(campaignName);
    if (game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action: 'snatchIntro', campaignName });
    }
  }

  // ─── Endings ──────────────────────────────────────────────────────────────

  async triggerEnding(type, targetUser = null) {
    const action = { wbrb: 'wbrbEnding', jojo: 'jojoEnding' }[type];
    if (!action) return;

    if (type === 'wbrb') executeWBRBEnding();
    if (type === 'jojo') executeJojoEnding();

    if (game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action, targetUser: targetUser || null });
    }
  }

  // Expose emit so endings can broadcast skip
  emit(data) {
    game.socket.emit(SOCKET_EVENT, { ...data });
  }

  // ─── Clear ────────────────────────────────────────────────────────────────

  clearEffects(targetUser = null) {
    if (targetUser && game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action: 'clear', targetUser });
      return;
    }
    this._clearEffects();
    if (game.user.isGM && !targetUser) {
      game.socket.emit(SOCKET_EVENT, { action: 'clear', targetUser: null });
    }
  }

  _clearEffects() {
    // Hide all overlay effects
    ['vignette','grayscale','sepia','sketch','text','intro','drunk','high'].forEach(k =>
      this.overlays[k]?.classList.add('hidden'));
    this.overlays.intro.innerHTML = '';
    // Deactivate toggle effects
    this._effectGlitch({ active: false });
    this._effectFilm({ active: false });
    // Clear particles and blood
    this.overlays.particles.innerHTML = '';
    this.overlays.blood.innerHTML = '';
    // Clear all active effects tracking
    this.activeEffects.clear();
  }

  // ─── Sounds ───────────────────────────────────────────────────────────────

  playSound(id) {
    if (!game.settings.get(MODULE_ID, 'enableSounds')) return;
    const vol = game.settings.get(MODULE_ID, 'soundVolume');
    const ctx = this._getAudioContext();
    ({ chord: () => this._playChord(ctx, vol), impact: () => this._playImpact(ctx, vol), sweep: () => this._playSweep(ctx, vol) })[id]?.();
  }

  playCustomSound(url, options = {}) {
    if (!url) return;
    const volume = options.volume ?? game.settings.get(MODULE_ID, 'soundVolume');
    if (options.targetAll && game.user.isGM)
      game.socket.emit(SOCKET_EVENT, { action: 'sound', url, volume, targetUser: null });
    this._playAudioFile(url, volume);
  }

  stopCustomSound(targetAll = false) {
    if (this._currentAudio) { this._currentAudio.pause(); this._currentAudio.currentTime = 0; this._currentAudio = null; }
    if (targetAll && game.user.isGM)
      game.socket.emit(SOCKET_EVENT, { action: 'stopSound', targetUser: null });
  }

  _playAudioFile(url, volume = 0.7) {
    try {
      if (this._currentAudio) { this._currentAudio.pause(); this._currentAudio = null; }
      const audio = new Audio(url);
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.play().catch(e => console.warn('DD | Audio failed:', e));
      this._currentAudio = audio;
      audio.addEventListener('ended', () => { if (this._currentAudio === audio) this._currentAudio = null; });
    } catch(e) { console.warn('DD | Audio error:', e); }
  }

  _getAudioContext() {
    if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return this.audioContext;
  }

  _playChord(ctx, vol) {
    const now = ctx.currentTime;
    [130.81,164.81,196.00,261.63].forEach((freq,i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol*.25, now+.1);
      gain.gain.exponentialRampToValueAtTime(.001, now+2);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now+i*.05); osc.stop(now+2);
    });
  }

  _playImpact(ctx, vol) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now+.3);
    gain.gain.setValueAtTime(vol*.5, now);
    gain.gain.exponentialRampToValueAtTime(.001, now+.4);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now+.4);
  }

  _playSweep(ctx, vol) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now+1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol*.3, now+.3);
    gain.gain.exponentialRampToValueAtTime(.001, now+1.5);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now+1.5);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL PANEL
// ═══════════════════════════════════════════════════════════════════════════

const { HandlebarsApplicationMixin } = foundry.applications.api;

class DramaDirectorPanel extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'drama-director-panel',
    classes: ['drama-director'],
    tag: 'div',
    window: { title: 'Drama Director', icon: 'fas fa-theater-masks', resizable: true },
    position: { width: 510, height: 'auto' }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/panel.hbs` } };

  async _prepareContext() {
    // Wait for language override to finish loading before localizing
    await _ddLangPromise;
    const loc = k => game.i18n.localize(k);
    return {
      users: game.users.map(u => ({ id: u.id, name: u.name, color: u.color })),
      effects: {
        basic:  [{ id:'vignette', name:loc('DRAMADIRECTOR.vignette'),  icon:'fas fa-circle-notch'},
                 { id:'grayscale',name:loc('DRAMADIRECTOR.grayscale'), icon:'fas fa-adjust'}],
        filter: [{ id:'sepia',    name:loc('DRAMADIRECTOR.sepia'),     icon:'fas fa-sun'},
                 { id:'film',     name:loc('DRAMADIRECTOR.film'),      icon:'fas fa-film'},
                 { id:'sketch',   name:loc('DRAMADIRECTOR.sketch'),    icon:'fas fa-pencil-alt'}],
        anime:  [{ id:'sakura',   name:loc('DRAMADIRECTOR.sakura'),    icon:'fas fa-spa'},
                 { id:'hearts',   name:loc('DRAMADIRECTOR.hearts'),    icon:'fas fa-heart'}],
        status: [{ id:'drunk',    name:loc('DRAMADIRECTOR.drunk'),     icon:'fas fa-wine-bottle'},
                 { id:'high',     name:loc('DRAMADIRECTOR.high'),      icon:'fas fa-cannabis'}],
      },
      sounds: [
        { id:'chord',  name:loc('DRAMADIRECTOR.soundChord'),  icon:'fas fa-music' },
        { id:'impact', name:loc('DRAMADIRECTOR.soundImpact'), icon:'fas fa-gavel' },
        { id:'sweep',  name:loc('DRAMADIRECTOR.soundSweep'),  icon:'fas fa-wave-square' },
      ],
      introStyles: [
        { id:'epic',    name:loc('DRAMADIRECTOR.intro.styleEpic')    },
        { id:'horror',  name:loc('DRAMADIRECTOR.intro.styleHorror')  },
        { id:'royal',   name:loc('DRAMADIRECTOR.intro.styleRoyal')   },
        { id:'minimal', name:loc('DRAMADIRECTOR.intro.styleMinimal') },
        { id:'war',     name:loc('DRAMADIRECTOR.intro.styleWar')     },
      ],
    };
  }

  _onRender(context, options) {
    const html = this.element;

    // ── Tabs ──────────────────────────────────────────────────────────────
    html.querySelectorAll('.dd-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.tab;
        html.querySelectorAll('.dd-tab').forEach(t => t.classList.remove('active'));
        html.querySelectorAll('.dd-tab-content').forEach(c => c.classList.add('hidden'));
        e.currentTarget.classList.add('active');
        html.querySelector(`[data-content="${id}"]`)?.classList.remove('hidden');
      });
    });

    // ── INTRO TAB ─────────────────────────────────────────────────────────
    html.querySelector('[data-action="show-intro"]')?.addEventListener('click', () => {
      const title    = html.querySelector('#dd-intro-title')?.value?.trim();
      const subtitle = html.querySelector('#dd-intro-subtitle')?.value?.trim();
      const style    = html.querySelector('#dd-intro-style')?.value;
      const animIn   = html.querySelector('#dd-intro-anim')?.value;
      const duration = parseInt(html.querySelector('#dd-intro-duration')?.value) || 6000;
      const targetUser = html.querySelector('#dd-target-user')?.value || null;
      if (title) game.dramaDirector.applyEffect('intro', { title, subtitle, style, animIn, duration }, targetUser);
    });

    // ── INTRO TAB — Gentlemen & Snatch ────────────────────────────────────
    html.querySelector('[data-action="run-sincity"]')?.addEventListener('click', () => {
      const name = html.querySelector('#dd-campaign-name')?.value?.trim() ?? '';
      game.dramaDirector.triggerSinCityIntro(name);
    });
    html.querySelector('[data-action="run-machete"]')?.addEventListener('click', () => {
      const name = html.querySelector('#dd-campaign-name')?.value?.trim() ?? '';
      game.dramaDirector.triggerMacheteIntro(name);
    });
    html.querySelector('[data-action="run-machete-blood"]')?.addEventListener('click', () => {
      const name = html.querySelector('#dd-campaign-name')?.value?.trim() ?? '';
      game.dramaDirector.triggerMacheteBloodIntro(name);
    });
    html.querySelector('[data-action="run-snatch"]')?.addEventListener('click', () => {
      const name = html.querySelector('#dd-campaign-name')?.value?.trim() ?? '';
      game.dramaDirector.triggerSnatchIntro(name);
    });

    // ── ENDINGS TAB ───────────────────────────────────────────────────────
    html.querySelectorAll('[data-ending-type]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        game.dramaDirector.triggerEnding(e.currentTarget.dataset.endingType);
      });
    });

    // ── EFFECTS TAB ───────────────────────────────────────────────────────
    html.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const effectId = e.currentTarget.dataset.toggle;
        const isActive = game.dramaDirector.activeEffects.has(effectId);
        const targetUser = html.querySelector('#dd-target-user')?.value || null;
        game.dramaDirector.applyEffect(effectId, { active: !isActive }, targetUser);
        e.currentTarget.classList.toggle('active', !isActive);
      });
    });

    html.querySelectorAll('[data-effect]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const effectId = e.currentTarget.dataset.effect;
        const targetUser = html.querySelector('#dd-target-user')?.value || null;
        game.dramaDirector.applyEffect(effectId, {}, targetUser);
      });
    });

    html.querySelectorAll('[data-sound]').forEach(btn => {
      btn.addEventListener('click', (e) => game.dramaDirector.playSound(e.currentTarget.dataset.sound));
    });

    html.querySelector('[data-action="browse-sound"]')?.addEventListener('click', () => {
      new FilePicker({ type:'audio', callback: (path) => {
        const input = html.querySelector('#dd-custom-sound');
        if (input) input.value = path;
      }}).render(true);
    });

    html.querySelector('[data-action="stop-custom-sound"]')?.addEventListener('click', () => {
      const targetAll = html.querySelector('#dd-sound-broadcast')?.checked ?? false;
      game.dramaDirector.stopCustomSound(targetAll);
    });

    html.querySelector('[data-action="play-custom-sound"]')?.addEventListener('click', () => {
      const url = html.querySelector('#dd-custom-sound')?.value?.trim();
      const targetAll = html.querySelector('#dd-sound-broadcast')?.checked ?? false;
      if (url) game.dramaDirector.playCustomSound(url, { targetAll });
    });

    // Text subtitle visibility
    const textStyleSelect = html.querySelector('#dd-text-style');
    const subtitleRow = html.querySelector('#dd-subtitle-row');
    const updateSub = () => {
      if (subtitleRow) subtitleRow.style.display = textStyleSelect?.value === 'chapter' ? '' : 'none';
    };
    textStyleSelect?.addEventListener('change', updateSub);
    updateSub();

    // Image file picker
    html.querySelector('[data-action="browse-image"]')?.addEventListener('click', () => {
      new FilePicker({ type: 'image', callback: (path) => {
        const input = html.querySelector('#dd-image-url');
        if (input) input.value = path;
      }}).render(true);
    });

    // ── TEXT AND PICTURES TAB ─────────────────────────────────────────────
    const _textLayers  = [];
    const _imageLayers = [];

    const _updateLayerCounts = () => {
      const tc = html.querySelector('#dd-text-layer-count');
      const ic = html.querySelector('#dd-image-layer-count');
      if (tc) tc.textContent = `${_textLayers.length}/10`;
      if (ic) ic.textContent = `${_imageLayers.length}/10`;
    };

    const _textAnimOptions = [
      { v:'fade',      l:'Fade' },
      { v:'zoom',      l:'Zoom In' },
      { v:'zoom-out',  l:'Zoom Out' },
      { v:'shake',     l:'Shake' },
      { v:'impact',    l:'Impact' },
      { v:'slideUp',   l:'Slide Up' },
      { v:'slideDown', l:'Slide Down' },
      { v:'slideLeft', l:'Slide Left' },
      { v:'slideRight',l:'Slide Right' },
      { v:'bounce',    l:'Bounce' },
      { v:'flip',      l:'Flip' },
    ];
    const _textStyleOptions = [
      { v:'default',    l:'Center' },
      { v:'left-block', l:'Left Block' },
      { v:'right-block',l:'Right Block' },
      { v:'bottom',     l:'Bottom' },
      { v:'chapter',    l:'Chapter Title' },
      { v:'horror',     l:'Horror' },
      { v:'anime',      l:'Anime' },
    ];
    const _animSelectHtml = _textAnimOptions.map(o => `<option value="${o.v}">${o.l}</option>`).join('');
    const _styleSelectHtml = _textStyleOptions.map(o => `<option value="${o.v}">${o.l}</option>`).join('');

    const _renderTextLayer = (idx) => {
      const layer = _textLayers[idx];
      const row = document.createElement('div');
      row.className = 'dd-layer-row';
      row.dataset.layerIdx = idx;
      row.innerHTML = `
        <div class="dd-layer-row-header">
          <span class="dd-layer-index">#${idx + 1}</span>
          <span style="font-size:11px;color:#aaa;flex:1">Text Layer</span>
          <button type="button" class="dd-layer-remove-btn" data-remove-text="${idx}" title="Remove layer"><i class="fas fa-times"></i></button>
        </div>
        <textarea class="dd-layer-text-input" placeholder="Enter text..." rows="2">${layer.text || ''}</textarea>
        <div class="dd-layer-controls">
          <div>
            <span class="dd-layer-label">Style</span>
            <select class="dd-layer-select" data-field="style">${_styleSelectHtml}</select>
          </div>
          <div>
            <span class="dd-layer-label">Animation</span>
            <select class="dd-layer-select" data-field="animation">${_animSelectHtml}</select>
          </div>
        </div>
        <div class="dd-layer-transform">
          <div class="dd-layer-transform-item">
            <label>Scale</label>
            <input type="number" class="dd-input dd-layer-num" data-field="scale" value="${layer.scale ?? 1}" min="0.1" max="10" step="0.1">
          </div>
          <div class="dd-layer-transform-item">
            <label>X %</label>
            <input type="number" class="dd-input dd-layer-num" data-field="x" value="${layer.x ?? 0}" min="-100" max="100" step="1">
          </div>
          <div class="dd-layer-transform-item">
            <label>Y %</label>
            <input type="number" class="dd-input dd-layer-num" data-field="y" value="${layer.y ?? 0}" min="-100" max="100" step="1">
          </div>
          <div class="dd-layer-transform-item">
            <label>Z-Index</label>
            <input type="number" class="dd-input dd-layer-num" data-field="z" value="${layer.z ?? 0}" min="-20" max="20" step="1">
          </div>
        </div>
      `;
      // Restore select values
      row.querySelector('[data-field="style"]').value = layer.style ?? 'default';
      row.querySelector('[data-field="animation"]').value = layer.animation ?? 'fade';

      // Sync changes back to layer object
      row.querySelector('textarea').addEventListener('input', e => { _textLayers[idx].text = e.target.value; });
      row.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('change', e => {
          const f = e.target.dataset.field;
          _textLayers[idx][f] = el.tagName === 'SELECT' ? el.value : parseFloat(el.value) || 0;
        });
      });
      row.querySelector(`[data-remove-text="${idx}"]`).addEventListener('click', () => {
        _textLayers.splice(idx, 1);
        _rebuildTextLayers();
      });
      return row;
    };

    const _renderImageLayer = (idx) => {
      const layer = _imageLayers[idx];
      const row = document.createElement('div');
      row.className = 'dd-layer-row';
      row.dataset.layerIdx = idx;
      row.innerHTML = `
        <div class="dd-layer-row-header">
          <span class="dd-layer-index">#${idx + 1}</span>
          <span style="font-size:11px;color:#aaa;flex:1">Image Layer</span>
          <button type="button" class="dd-layer-remove-btn" data-remove-image="${idx}" title="Remove layer"><i class="fas fa-times"></i></button>
        </div>
        <div class="dd-layer-url-row">
          <input type="text" class="dd-input" data-field="url" value="${layer.url || ''}" placeholder="Image path...">
          <button type="button" class="dd-icon-btn dd-browse-img-layer" title="Browse"><i class="fas fa-folder-open"></i></button>
        </div>
        <div class="dd-layer-controls">
          <div class="dd-layer-controls-full">
            <span class="dd-layer-label">Animation</span>
            <select class="dd-layer-select" data-field="animation">${_animSelectHtml}</select>
          </div>
        </div>
        <div class="dd-layer-transform">
          <div class="dd-layer-transform-item">
            <label>Scale</label>
            <input type="number" class="dd-input dd-layer-num" data-field="scale" value="${layer.scale ?? 1}" min="0.1" max="10" step="0.1">
          </div>
          <div class="dd-layer-transform-item">
            <label>X %</label>
            <input type="number" class="dd-input dd-layer-num" data-field="x" value="${layer.x ?? 0}" min="-100" max="100" step="1">
          </div>
          <div class="dd-layer-transform-item">
            <label>Y %</label>
            <input type="number" class="dd-input dd-layer-num" data-field="y" value="${layer.y ?? 0}" min="-100" max="100" step="1">
          </div>
          <div class="dd-layer-transform-item">
            <label>Z-Index</label>
            <input type="number" class="dd-input dd-layer-num" data-field="z" value="${layer.z ?? 0}" min="-20" max="20" step="1">
          </div>
        </div>
      `;
      row.querySelector('[data-field="animation"]').value = layer.animation ?? 'fade';

      row.querySelector('[data-field="url"]').addEventListener('input', e => { _imageLayers[idx].url = e.target.value; });
      row.querySelectorAll('[data-field]:not([type="text"])').forEach(el => {
        el.addEventListener('change', e => {
          const f = e.target.dataset.field;
          _imageLayers[idx][f] = el.tagName === 'SELECT' ? el.value : parseFloat(el.value) || 0;
        });
      });
      row.querySelector('.dd-browse-img-layer').addEventListener('click', () => {
        new FilePicker({ type: 'image', callback: (path) => {
          _imageLayers[idx].url = path;
          row.querySelector('[data-field="url"]').value = path;
        }}).render(true);
      });
      row.querySelector(`[data-remove-image="${idx}"]`).addEventListener('click', () => {
        _imageLayers.splice(idx, 1);
        _rebuildImageLayers();
      });
      return row;
    };

    const _rebuildTextLayers = () => {
      const cont = html.querySelector('#dd-text-layers-container');
      if (!cont) return;
      cont.innerHTML = '';
      if (_textLayers.length === 0) {
        cont.innerHTML = '<div class="dd-layers-empty">No text layers. Click + Add to create one.</div>';
      } else {
        _textLayers.forEach((_, i) => cont.appendChild(_renderTextLayer(i)));
      }
      _updateLayerCounts();
    };

    const _rebuildImageLayers = () => {
      const cont = html.querySelector('#dd-image-layers-container');
      if (!cont) return;
      cont.innerHTML = '';
      if (_imageLayers.length === 0) {
        cont.innerHTML = '<div class="dd-layers-empty">No image layers. Click + Add to create one.</div>';
      } else {
        _imageLayers.forEach((_, i) => cont.appendChild(_renderImageLayer(i)));
      }
      _updateLayerCounts();
    };

    // Initialize empty state
    _rebuildTextLayers();
    _rebuildImageLayers();

    html.querySelector('[data-action="add-text-layer"]')?.addEventListener('click', () => {
      if (_textLayers.length >= 10) { ui.notifications?.warn('Maximum 10 text layers'); return; }
      _textLayers.push({ text: '', style: 'default', animation: 'fade', scale: 1, x: 0, y: 0, z: 0 });
      _rebuildTextLayers();
    });

    html.querySelector('[data-action="add-image-layer"]')?.addEventListener('click', () => {
      if (_imageLayers.length >= 10) { ui.notifications?.warn('Maximum 10 image layers'); return; }
      _imageLayers.push({ url: '', animation: 'fade', scale: 1, x: 0, y: 0, z: 0 });
      _rebuildImageLayers();
    });

    // Character Introduction toggle (Text and Pictures tab)
    const charIntroCheck = html.querySelector('#dd-char-intro-enabled');
    const charIntroPanel = html.querySelector('#dd-char-intro-panel');
    const tokenSelect    = html.querySelector('#dd-char-intro-token');
    const previewFrame   = html.querySelector('#dd-char-preview-frame');
    const previewImg     = html.querySelector('#dd-char-preview-img');

    const populateTokens = () => {
      if (!tokenSelect) return;
      tokenSelect.innerHTML = '<option value="">— ' + game.i18n.localize('DRAMADIRECTOR.charIntroToken') + ' —</option>';
      const tokens = canvas?.tokens?.placeables ?? [];
      tokens.forEach(t => {
        if (!t.actor) return;
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.document?.name || t.actor.name;
        tokenSelect.appendChild(opt);
      });
    };

    charIntroCheck?.addEventListener('change', (e) => {
      charIntroPanel?.classList.toggle('hidden', !e.target.checked);
      if (e.target.checked) populateTokens();
    });

    // Token preview update
    tokenSelect?.addEventListener('change', (e) => {
      const tokenId = e.target.value;
      const token = canvas?.tokens?.placeables?.find(t => t.id === tokenId);
      if (token?.actor?.img && previewImg && previewFrame) {
        previewImg.style.backgroundImage = `url('${token.actor.img}')`;
        previewFrame.classList.add('has-portrait');
        const lbl = previewFrame.querySelector('.dd-char-preview-label');
        if (lbl) lbl.textContent = token.document?.name || token.actor.name;
      } else if (previewImg && previewFrame) {
        previewImg.style.backgroundImage = '';
        previewFrame.classList.remove('has-portrait');
        const lbl = previewFrame.querySelector('.dd-char-preview-label');
        if (lbl) lbl.textContent = game.i18n.localize('DRAMADIRECTOR.charIntroToken');
      }
    });

    // ── Preset helpers ─────────────────────────────────────────────────────
    const presetSelect = html.querySelector('#dd-preset-select');

    const collectOptions = () => {
      const duration   = parseInt(html.querySelector('#dd-text-duration')?.value) || 4000;
      const charIntro  = html.querySelector('#dd-char-intro-enabled')?.checked ?? false;
      const tokenId    = html.querySelector('#dd-char-intro-token')?.value ?? '';
      const charIntroAnim = html.querySelector('#dd-char-intro-anim')?.value ?? 'fade';
      const portraitScale = parseFloat(html.querySelector('#dd-portrait-scale')?.value) || 1;
      const portraitX     = parseFloat(html.querySelector('#dd-portrait-x')?.value) || 0;
      const portraitY     = parseFloat(html.querySelector('#dd-portrait-y')?.value) || 0;
      const portraitZ     = parseFloat(html.querySelector('#dd-portrait-z')?.value) || 0;

      const opts = {
        duration,
        textLayers:  _textLayers.filter(l => l.text),
        imageLayers: _imageLayers.filter(l => l.url),
      };
      if (charIntro) {
        opts.charIntro = true;
        opts.charIntroAnim = charIntroAnim;
        opts.portraitScale = portraitScale;
        opts.portraitX = portraitX;
        opts.portraitY = portraitY;
        opts.portraitZ = portraitZ;
        if (tokenId) opts.tokenId = tokenId;
      }
      return opts;
    };

    const applyOptionsToPanel = (opts) => {
      const set = (sel, val) => { const el = html.querySelector(sel); if (el) el.value = val ?? ''; };
      const setCheck = (sel, val) => { const el = html.querySelector(sel); if (el) el.checked = !!val; };
      set('#dd-text-duration',   opts.duration ?? 4000);
      setCheck('#dd-char-intro-enabled', opts.charIntro);
      if (opts.charIntro) {
        charIntroPanel?.classList.remove('hidden');
        populateTokens();
        setTimeout(() => {
          set('#dd-char-intro-token', opts.tokenId ?? '');
          set('#dd-char-intro-anim',  opts.charIntroAnim ?? 'fade');
          set('#dd-portrait-scale',   opts.portraitScale ?? 1);
          set('#dd-portrait-x',       opts.portraitX ?? 0);
          set('#dd-portrait-y',       opts.portraitY ?? 0);
          set('#dd-portrait-z',       opts.portraitZ ?? 0);
          tokenSelect?.dispatchEvent(new Event('change'));
        }, 50);
      } else {
        charIntroPanel?.classList.add('hidden');
      }
      // Restore text layers
      _textLayers.length = 0;
      (opts.textLayers ?? []).forEach(l => _textLayers.push({ ...l }));
      _rebuildTextLayers();
      // Restore image layers
      _imageLayers.length = 0;
      (opts.imageLayers ?? []).forEach(l => _imageLayers.push({ ...l }));
      _rebuildImageLayers();
    };

    const refreshPresetDropdown = (presets) => {
      if (!presetSelect) return;
      const cur = presetSelect.value;
      presetSelect.innerHTML = `<option value="">— ${game.i18n.localize('DRAMADIRECTOR.presetLoad')} —</option>`;
      (presets || game.dramaDirector.getTextPresets()).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        presetSelect.appendChild(opt);
      });
      if (cur) presetSelect.value = cur;
    };

    refreshPresetDropdown();

    // Save preset
    html.querySelector('[data-action="preset-save"]')?.addEventListener('click', async () => {
      const name = html.querySelector('#dd-preset-name')?.value?.trim();
      if (!name) return;
      const opts = collectOptions();
      const presets = await game.dramaDirector.saveTextPreset(name, opts);
      refreshPresetDropdown(presets);
      if (presetSelect) presetSelect.value = name;
    });

    // Load preset
    html.querySelector('[data-action="preset-load"]')?.addEventListener('click', () => {
      const name = presetSelect?.value;
      if (!name) return;
      const preset = game.dramaDirector.getTextPresets().find(p => p.name === name);
      if (!preset) return;
      applyOptionsToPanel(preset.options);
      ui.notifications?.info(game.i18n.format('DRAMADIRECTOR.presetLoaded', { name }));
    });

    // Delete preset
    html.querySelector('[data-action="preset-delete"]')?.addEventListener('click', async () => {
      const name = presetSelect?.value;
      if (!name) return;
      const presets = await game.dramaDirector.deleteTextPreset(name);
      refreshPresetDropdown(presets);
    });

    // Show text
    html.querySelector('[data-action="show-text"]')?.addEventListener('click', () => {
      const opts = collectOptions();
      const targetUser = html.querySelector('#dd-target-user')?.value || null;
      if (opts.text || opts.charIntro) game.dramaDirector.applyEffect('text', opts, targetUser);
    });

    // Copy as macro
    html.querySelector('[data-action="copy-macro"]')?.addEventListener('click', () => {
      const opts = collectOptions();
      const targetUser = html.querySelector('#dd-target-user')?.value || null;
      const macro = game.dramaDirector.generateTextMacro(opts, targetUser);
      navigator.clipboard?.writeText(macro).then(() => {
        ui.notifications?.info(game.i18n.localize('DRAMADIRECTOR.macroCopied'));
      }).catch(() => {
        // Fallback: show in dialog
        new Dialog({
          title: game.i18n.localize('DRAMADIRECTOR.copyMacro'),
          content: `<textarea style="width:100%;height:200px;font-family:monospace;font-size:11px">${macro}</textarea>`,
          buttons: { ok: { label: 'OK' } }
        }).render(true);
      });
    });

    html.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
      const targetUser = html.querySelector('#dd-target-user')?.value || null;
      game.dramaDirector.clearEffects(targetUser);
      html.querySelectorAll('[data-toggle]').forEach(b => b.classList.remove('active'));
    });

    // ── VIDEO TAB ─────────────────────────────────────────────────────────
    html.querySelector('[data-action="browse-video"]')?.addEventListener('click', () => {
      new FilePicker({ type:'video', callback: (path) => {
        const input = html.querySelector('#dd-video-url');
        if (input) input.value = path;
      }}).render(true);
    });

    html.querySelector('[data-action="play-video"]')?.addEventListener('click', () => {
      const url  = html.querySelector('#dd-video-url')?.value?.trim();
      const loop = html.querySelector('#dd-video-loop')?.checked ?? false;
      const vol  = parseFloat(html.querySelector('#dd-video-volume')?.value ?? '.8');
      const targetUser = html.querySelector('#dd-target-user')?.value || null;
      if (url) game.dramaDirector.showVideo(url, { loop, volume: vol, autoClose: !loop }, targetUser);
    });

    html.querySelector('[data-action="stop-video"]')?.addEventListener('click', () => {
      const targetUser = html.querySelector('#dd-target-user')?.value || null;
      game.dramaDirector.stopVideo(targetUser);
    });

    // ── ГРУППОВОЕ ИНТРО TAB ───────────────────────────────────────────────

    // ── VISUAL NOVEL TAB ──────────────────────────────────────────────────
    html.querySelector('[data-action="open-vn-panel"]')?.addEventListener('click', () => {
      DDVNApi.openPanel();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

Hooks.once('init', () => {
  game.dramaDirector = new DramaDirector();
  // Helpers for VN templates
  Handlebars.registerHelper('isVideo', src => /\.(webm|mp4|ogv)$/i.test(src || ''));
  Handlebars.registerHelper('add', (a, b) => (Number(a) + Number(b)));

  // Register the language setting early (during init) so it's available for the override
  game.settings.register(MODULE_ID, 'language', {
    name: 'DRAMADIRECTOR.settings.language',
    hint: 'DRAMADIRECTOR.settings.languageHint',
    scope: 'client', config: true, type: String,
    choices: {
      auto: 'DRAMADIRECTOR.settings.languageAuto',
      en:   'English',
      ru:   'Русский',
      fr:   'Français',
    },
    default: 'auto',
    onChange: () => window.location.reload(),
  });
});

Hooks.on('getSceneControlButtons', (controls) => {
  if (!controls.tokens?.tools) return;
  controls.tokens.tools['drama-director'] = {
    name:'drama-director', title:'Drama Director',
    icon:'fas fa-theater-masks',
    order: Object.keys(controls.tokens.tools).length,
    button: true, visible: game.user.isGM,
    onChange: () => {
      const existing = foundry.applications.instances.get('drama-director-panel');
      if (existing) existing.close();
      else new DramaDirectorPanel().render({ force: true });
    }
  };
});

Hooks.once('ready', () => {
  game.dramaDirector.init();
  initVNSystem();
  window.DramaDirector = {
    effect: (id, opts, user) => game.dramaDirector.applyEffect(id, opts, user),
    clear:  (user) => game.dramaDirector.clearEffects(user),
    sound:  (id) => game.dramaDirector.playSound(id),
    audio:  (url, opts) => game.dramaDirector.playCustomSound(url, opts),
    stop:   (all) => game.dramaDirector.stopCustomSound(all),
    video:  (url, opts, user) => game.dramaDirector.showVideo(url, opts, user),
    sincity:      (name) => game.dramaDirector.triggerSinCityIntro(name),
    machete:      (name) => game.dramaDirector.triggerMacheteIntro(name),
    macheteBlood: (name) => game.dramaDirector.triggerMacheteBloodIntro(name),
    snatch:       (name) => game.dramaDirector.triggerSnatchIntro(name),
    ending:       (type) => game.dramaDirector.triggerEnding(type),
    jojo:         ()     => game.dramaDirector.triggerEnding('jojo'),
    // Group intros
    // Visual Novel
    vn: DDVNApi,
  };
});
