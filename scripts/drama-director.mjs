/**
 * Drama Director - Foundry VTT Module V13
 * @version 4.0.0
 */

import {
  getSelectedTokenData,
  executeHeroIntro, executeVillainIntro, executeGenshinIntro,
  executeSinCityIntro, skipSinCityIntro,
  executeMacheteIntro, skipMacheteIntro,
  executeMacheteBloodIntro, skipMacheteBloodIntro,
  executeSnatchIntro, skipSnatchIntro,
} from './introductions.mjs';
import { executeTBCEnding, executeDirectedByEnding, skipTBCEnding, skipDirectedByEnding } from './endings.mjs';
import { initCutinSystem, DDCutinAPI, DDCutinPanel } from './cutin.mjs';
import { initVNSystem, DDVNApi } from './visual-novel.mjs';

const MODULE_ID = 'drama-director';
const SOCKET_EVENT = `module.${MODULE_ID}`;

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
    // Language override — must be first so other settings can use it
    game.settings.register(MODULE_ID, 'language', {
      name: 'DRAMADIRECTOR.settings.language',
      hint: 'DRAMADIRECTOR.settings.languageHint',
      scope: 'client', config: true, type: String,
      choices: {
        auto: 'DRAMADIRECTOR.settings.languageAuto',
        en:   'English',
        ru:   'Русский',
      },
      default: 'auto',
      onChange: () => window.location.reload(),
    });

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

    // Apply language override: load the chosen lang file and merge into i18n
    const langPref = game.settings.get(MODULE_ID, 'language');
    if (langPref !== 'auto') {
      fetch(`modules/${MODULE_ID}/lang/${langPref}.json`)
        .then(r => r.json())
        .then(data => foundry.utils.mergeObject(game.i18n.translations, data))
        .catch(e => console.warn(`Drama Director | Failed to load language '${langPref}':`, e));
    }
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
        case 'heroIntro':       executeHeroIntro(data.data); break;
        case 'villainIntro':    executeVillainIntro(data.data); break;
        case 'genshinIntro':    executeGenshinIntro(data.data); break;
        case 'sinCityIntro':     executeSinCityIntro(data.campaignName ?? ''); break;
        case 'snatchIntro':     executeSnatchIntro(data.campaignName ?? ''); break;
        case 'sinCitySkip':     skipSinCityIntro(); break;
        case 'macheteIntro':    executeMacheteIntro(data.campaignName ?? ''); break;
        case 'macheteSkip':     skipMacheteIntro(); break;
        case 'macheteBloodIntro': executeMacheteBloodIntro(data.campaignName ?? ''); break;
        case 'macheteBloodSkip':  skipMacheteBloodIntro(); break;
        case 'snatchSkip':      skipSnatchIntro(); break;
        case 'tbcEnding':       executeTBCEnding(); break;
        case 'dirbyEnding':     executeDirectedByEnding(); break;
        case 'tbcSkip':         skipTBCEnding(); break;
        case 'dirbySkip':       skipDirectedByEnding(); break;
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
    const text     = o.text ?? '';
    const subtitle = o.subtitle ?? '';
    const style    = o.style ?? 'default';
    const animation= o.animation ?? 'fade';
    const duration = o.duration ?? game.settings.get(MODULE_ID, 'defaultTextDuration');
    const color    = o.color ?? '#ffffff';

    const posMap = { 'left-block':'pos-left','right-block':'pos-right','bottom':'pos-bottom' };
    const posClass = posMap[style] ?? 'pos-center';
    this.overlays.text.className = `dd-effect ${posClass}`;

    const subHtml = (style === 'chapter' && subtitle)
      ? `<div class="dd-dramatic-subtitle">${subtitle}</div>` : '';
    this.overlays.text.innerHTML = `<div class="dd-dramatic-text style-${style} anim-${animation}">${text}${subHtml}</div>`;
    this.overlays.text.style.color = color;
    this.overlays.text.style.setProperty('--text-duration', `${duration}ms`);
    setTimeout(() => this.overlays.text.classList.add('hidden'), duration);
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

  // ─── Introductions (token-based) ──────────────────────────────────────────

  async triggerIntroduction(type, targetUser = null) {
    const data = getSelectedTokenData();
    if (!data) {
      ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.noToken'));
      return;
    }

    const action = { hero: 'heroIntro', villain: 'villainIntro', genshin: 'genshinIntro' }[type];
    if (!action) return;

    // GM sends via socket, non-GM runs locally
    if (game.user.isGM) {
      game.socket.emit(SOCKET_EVENT, { action, data, targetUser: targetUser || null });
    } else {
      this._dispatchIntro(type, data);
    }
  }

  _dispatchIntro(type, data) {
    if (type === 'hero')    executeHeroIntro(data);
    if (type === 'villain') executeVillainIntro(data);
    if (type === 'genshin') executeGenshinIntro(data);
  }

  // ─── Endings ──────────────────────────────────────────────────────────────

  async triggerEnding(type, targetUser = null) {
    const action = { tbc: 'tbcEnding', dirby: 'dirbyEnding' }[type];
    if (!action) return;

    // Run locally
    if (type === 'tbc')   executeTBCEnding();
    if (type === 'dirby') executeDirectedByEnding();

    // Emit to others
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
    ['vignette','grayscale','sepia','sketch','text','intro'].forEach(k =>
      this.overlays[k].classList.add('hidden'));
    this.overlays.intro.innerHTML = '';
    this._effectGlitch({ active: false });
    this._effectFilm({ active: false });
    this.overlays.particles.innerHTML = '';
    this.overlays.blood.innerHTML = '';
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

    // ── PRESENTATIONS TAB ─────────────────────────────────────────────────
    html.querySelectorAll('[data-intro-type]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.introType;
        const targetUser = html.querySelector('#dd-target-user')?.value || null;
        game.dramaDirector.triggerIntroduction(type, targetUser);
      });
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

    html.querySelector('[data-action="show-text"]')?.addEventListener('click', () => {
      const text      = html.querySelector('#dd-custom-text')?.value?.trim();
      const subtitle  = html.querySelector('#dd-text-subtitle')?.value?.trim();
      const style     = html.querySelector('#dd-text-style')?.value;
      const animation = html.querySelector('#dd-text-animation')?.value;
      const duration  = parseInt(html.querySelector('#dd-text-duration')?.value) || 4000;
      const targetUser = html.querySelector('#dd-target-user')?.value || null;
      if (text) game.dramaDirector.applyEffect('text', { text, subtitle, style, animation, duration }, targetUser);
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

    // ── CUT-INS TAB ───────────────────────────────────────────────────────
    html.querySelector('[data-action="open-cutin-panel"]')?.addEventListener('click', () => {
      DDCutinAPI.openPanel();
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
  initCutinSystem();
  initVNSystem();
  window.DramaDirector = {
    effect: (id, opts, user) => game.dramaDirector.applyEffect(id, opts, user),
    clear:  (user) => game.dramaDirector.clearEffects(user),
    sound:  (id) => game.dramaDirector.playSound(id),
    audio:  (url, opts) => game.dramaDirector.playCustomSound(url, opts),
    stop:   (all) => game.dramaDirector.stopCustomSound(all),
    video:  (url, opts, user) => game.dramaDirector.showVideo(url, opts, user),
    intro:  (type, user) => game.dramaDirector.triggerIntroduction(type, user),
    sincity:      (name) => game.dramaDirector.triggerSinCityIntro(name),
    machete:      (name) => game.dramaDirector.triggerMacheteIntro(name),
    macheteBlood: (name) => game.dramaDirector.triggerMacheteBloodIntro(name),
    snatch:       (name) => game.dramaDirector.triggerSnatchIntro(name),
    ending:       (type) => game.dramaDirector.triggerEnding(type),
    // Text cut-ins
    cutin:       (data) => DDCutinAPI.play(data),
    cutinPreset: (name) => DDCutinAPI.playPreset(name),
    cutinStop:   ()     => DDCutinAPI.stop(),
    // Group intros
    // Visual Novel
    vn: DDVNApi,
  };
});
