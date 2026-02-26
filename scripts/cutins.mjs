/**
 * Drama Director — Cut-in Text/Presentation System
 * 
 */

const MODULE_ID = 'drama-director';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ─── Theme definitions ─────────────────────────────────────────────────────
const DD_THEME_LIST = [
  { id: 'brush',      label: 'Brush (Original)' },
  { id: 'cyber',      label: 'Cyber (Sci-Fi)' },
  { id: 'cinematic',  label: 'Cinematic (Movie)' },
  { id: 'royal',      label: 'Royal (Gold)' },
  { id: 'saga',       label: 'Saga (Texture)' },
  { id: 'tribal',     label: 'Tribal (Dragon)' },
  { id: 'impact',     label: 'Impact (Action)' },
  { id: 'phantom',    label: 'Phantom' },
  { id: 'arcane',     label: 'Arcane (Magic)' },
  { id: 'voltage',    label: 'Voltage (Electric)' },
  { id: 'scope',      label: 'Scope (Tactical)' },
  { id: 'blitz',      label: 'Blitz (Right)' },
  { id: 'blitz_left', label: 'Blitz (Left)' },
  { id: 'blossom',    label: 'Blossom (Soft)' },
  { id: 'slash',      label: 'Slash' },
  { id: 'burst',      label: 'Burst' },
  { id: 'glitch',     label: 'Glitch' },
  { id: 'dash',       label: 'Dash' },
  { id: 'runes',      label: 'Runes' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'yakuza',     label: 'Yakuza' },
];

const DD_THEME_DEFAULTS = {
  brush:      { main: '#ffffff', sub: '#000000' },
  cyber:      { main: '#ffffff', sub: '#ffffff' },
  cinematic:  { main: '#ffffff', sub: '#ffffff' },
  royal:      { main: '#fcf6ba', sub: '#fcf6ba' },
  saga:       { main: '#2b1b17', sub: '#4a3b32' },
  tribal:     { main: '#ffffff', sub: '#000000' },
  impact:     { main: '#ffffff', sub: '#ffff00' },
  phantom:    { main: '#ffffff', sub: '#ffffff' },
  arcane:     { main: '#ffffff', sub: '#ffffff' },
  voltage:    { main: '#ffffff', sub: '#000000' },
  scope:      { main: '#ffffff', sub: '#ffffff' },
  blitz:      { main: '#ffffff', sub: '#ffffff' },
  blitz_left: { main: '#ffffff', sub: '#ffffff' },
  blossom:    { main: '#ffcdd2', sub: '#ffffff' },
  slash:      { main: '#ffffff', sub: '#000000' },
  burst:      { main: '#ffffff', sub: '#000000' },
  glitch:     { main: '#00ff00', sub: '#ff00ff' },
  dash:       { main: '#ffffff', sub: '#000000' },
  runes:      { main: '#00ffff', sub: '#2c3e50' },
  typewriter: { main: '#00ff00', sub: '#00cc00' },
  yakuza:     { main: '#ffffff', sub: '#888888' },
};

const DD_SFX = {
  brush:      `modules/${MODULE_ID}/assets/cutin-sounds/sfx_brush.mp3`,
  cyber:      `modules/${MODULE_ID}/assets/cutin-sounds/sfx_cyber.mp3`,
  cinematic:  `modules/${MODULE_ID}/assets/cutin-sounds/sfx_cinematic.mp3`,
  royal:      `modules/${MODULE_ID}/assets/cutin-sounds/sfx_royal.mp3`,
  saga:       `modules/${MODULE_ID}/assets/cutin-sounds/sfx_saga.mp3`,
  tribal:     `modules/${MODULE_ID}/assets/cutin-sounds/sfx_tribal.mp3`,
  impact:     `modules/${MODULE_ID}/assets/cutin-sounds/sfx_impact.mp3`,
  phantom:    `modules/${MODULE_ID}/assets/cutin-sounds/sfx_phantom.mp3`,
  arcane:     `modules/${MODULE_ID}/assets/cutin-sounds/sfx_arcane.mp3`,
  voltage:    `modules/${MODULE_ID}/assets/cutin-sounds/sfx_voltage.mp3`,
  scope:      `modules/${MODULE_ID}/assets/cutin-sounds/sfx_cinematic.mp3`,
  blitz:      `modules/${MODULE_ID}/assets/cutin-sounds/finish_urban.mp3`,
  blitz_left: `modules/${MODULE_ID}/assets/cutin-sounds/finish_urban.mp3`,
  blossom:    `modules/${MODULE_ID}/assets/cutin-sounds/sfx_cinematic.mp3`,
  slash:      `modules/${MODULE_ID}/assets/cutin-sounds/finish_urban.mp3`,
  burst:      `modules/${MODULE_ID}/assets/cutin-sounds/char_urban.mp3`,
  glitch:     `modules/${MODULE_ID}/assets/cutin-sounds/sfx_voltage.mp3`,
  dash:       `modules/${MODULE_ID}/assets/cutin-sounds/sfx_dash.mp3`,
  runes:      `modules/${MODULE_ID}/assets/cutin-sounds/sfx_impact.mp3`,
  typewriter: `modules/${MODULE_ID}/assets/cutin-sounds/sfx_typewriter.mp3`,
  yakuza:     `modules/${MODULE_ID}/assets/cutin-sounds/sfx_yakuza.mp3`,
};

const DD_FONT_LIST = [
  { id: 'Teko',              label: 'Teko (Default)' },
  { id: 'Arial',             label: 'Arial' },
  { id: 'Georgia',           label: 'Georgia' },
  { id: 'Times New Roman',   label: 'Times New Roman' },
  { id: 'Courier New',       label: 'Courier New' },
  { id: 'Impact',            label: 'Impact' },
  { id: 'Sigmar One',        label: 'Sigmar One' },
  { id: 'Cinzel',            label: 'Cinzel' },
  { id: 'Oswald',            label: 'Oswald' },
];

const DD_THEME_FORMAT_LOCK = {
  slash:      'popout',
  blitz:      'popout',
  blitz_left: 'popout',
};

// ─── DDCutinManager ────────────────────────────────────────────────────────
export class DDCutinManager {
  static get OVERLAY_ID() { return 'dd-cutin-overlay'; }

  static _queue = [];
  static _isPlaying = false;
  static _activeSounds = new Map();
  static _timer = null;
  static _typewriterTimerMap = new Map();

  // ── Init ────────────────────────────────────────────────────────────────
  static initialize() {
    if (document.getElementById(this.OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = this.OVERLAY_ID;
    overlay.innerHTML = `
      <div class="cinematic-aspect-stage" id="dd-cutin-stage">
        <div class="cinematic-wrapper">
          <div class="cinematic-custom-layers"></div>
          <div class="cinematic-bg-layer"><div class="cinematic-paint"></div></div>
          <div class="cinematic-deco-line"></div>
          <div class="cinematic-border-layer">
            <svg class="cinematic-border-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="royal-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stop-color="#bf953f"/>
                  <stop offset="25%"  stop-color="#fcf6ba"/>
                  <stop offset="50%"  stop-color="#b38728"/>
                  <stop offset="75%"  stop-color="#fbf5b7"/>
                  <stop offset="100%" stop-color="#aa771c"/>
                </linearGradient>
              </defs>
              <polygon class="border-poly-royal" points="0,50 5,0 95,0 100,50 95,100 5,100" vector-effect="non-scaling-stroke"/>
            </svg>
          </div>
          <div class="char-mask" id="dd-cutin-media"></div>
          <div class="cinematic-content">
            <div class="cinematic-text-main"></div>
            <div class="cinematic-text-sub"></div>
          </div>
        </div>
      </div>`;

    document.getElementById('interface').appendChild(overlay);
    window.addEventListener('resize', () => this._fitScreen());
    this._fitScreen();
  }

  static _fitScreen() {
    const stage = document.getElementById('dd-cutin-stage');
    if (!stage) return;
    const winW = window.innerWidth, winH = window.innerHeight;
    const scale = Math.min(winW / 1920, winH / 1080);
    stage.style.width = '1920px';
    stage.style.height = '1080px';
    stage.style.transform = `scale(${scale})`;
    stage.classList.add('mode-letterbox');
    stage.style.boxShadow = '0 0 0 10000px #000';
  }

  // ── Public play API ──────────────────────────────────────────────────────
  static play(data) {
    if (!data) return;
    this._queue.push(data);
    this._processQueue();
  }

  static _processQueue() {
    if (this._isPlaying || this._queue.length === 0) return;
    this._isPlaying = true;

    if (this._queue.length >= 2) this._showSkipButton(true);

    const current = this._queue.shift();
    this.playSingle(current).then(() => {
      setTimeout(() => {
        this._isPlaying = false;
        if (this._queue.length === 0) this._showSkipButton(false);
        this._processQueue();
      }, (Number(current.customDuration ?? 3.5) * 1000) + 300);
    });
  }

  static async playSingle(data) {
    const overlay = document.getElementById(this.OVERLAY_ID);
    if (!overlay) return;

    const wrapper = overlay.querySelector('.cinematic-wrapper');
    if (!wrapper) return;

    const stage   = document.getElementById('dd-cutin-stage');
    const final   = this._prepareData(data);

    this._updateText(wrapper, final);
    this._updateMedia(wrapper, final);
    this._applyStyles(overlay, wrapper, stage, final);
    this._startAnim(overlay, wrapper, stage, final);
  }

  // ── Data prep ────────────────────────────────────────────────────────────
  static _prepareData(data) {
    const d = { ...data };
    if (!d.theme)          d.theme = 'brush';
    if (!d.format)         d.format = DD_THEME_FORMAT_LOCK[d.theme] ?? 'popout';
    d.customDuration = Number(d.customDuration ?? 3.5);

    // Resolve sound: if sfx not set, use theme default
    if (!d.sfx && DD_SFX[d.theme]) d.sfx = DD_SFX[d.theme];

    // Pick random from semicolon-delimited lists
    const pick = v => {
      if (!v || typeof v !== 'string') return v;
      const opts = v.split(';');
      return opts.length > 1 ? opts[Math.floor(Math.random() * opts.length)].trim() : v;
    };
    d.text    = pick(d.text);
    d.subText = pick(d.subText);
    d.sound   = pick(d.sound);
    d.sfx     = pick(d.sfx);

    return d;
  }

  // ── Text update ──────────────────────────────────────────────────────────
  static _updateText(wrapper, data) {
    const mainEl = wrapper.querySelector('.cinematic-text-main');
    const subEl  = wrapper.querySelector('.cinematic-text-sub');
    const isTW   = data.theme === 'typewriter';

    if (isTW) {
      if (mainEl) mainEl.innerHTML = '';
      if (subEl)  subEl.innerHTML  = '';
    } else {
      if (mainEl) {
        mainEl.innerHTML = data.text || '';
        mainEl.style.removeProperty('opacity');
        mainEl.style.removeProperty('display');
        mainEl.style.removeProperty('transform');
        mainEl.style.removeProperty('transition');
      }
      if (subEl) {
        subEl.innerHTML = data.subText || '';
        subEl.style.removeProperty('opacity');
        subEl.style.removeProperty('display');
        subEl.style.removeProperty('transform');
        subEl.style.removeProperty('transition');
      }
    }
  }

  // ── Media update ─────────────────────────────────────────────────────────
  static _updateMedia(wrapper, data) {
    const container = wrapper.querySelector('#dd-cutin-media') || wrapper.querySelector('.char-mask');
    if (!container) return;

    if (!data.img || !data.img.trim()) { container.innerHTML = ''; return; }

    const isVid = /\.(webm|mp4|m4v|ogg|ogv)$/i.test(data.img);
    const tag   = isVid ? 'VIDEO' : 'IMG';
    let   media = container.firstElementChild;

    if (!media || media.tagName !== tag) {
      media = document.createElement(tag);
      media.className = 'cinematic-character custom-media';
      if (isVid) { media.muted = true; media.loop = true; media.playsInline = true; media.autoplay = true; }
      container.innerHTML = '';
      container.appendChild(media);
    }
    if (media.getAttribute('src') !== data.img) {
      media.src = data.img;
      if (isVid) media.load();
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  static _applyStyles(overlay, wrapper, stage, data) {
    const set = (k, v) => wrapper.style.setProperty(k, v);
    wrapper.className = 'cinematic-wrapper';
    wrapper.classList.add(`theme-${data.theme}`, `format-${data.format}`);

    if (data.hideBackground) wrapper.classList.add('hide-bg');
    if (data.hideMainText)   wrapper.classList.add('hide-main-text');
    if (data.hideSubText)    wrapper.classList.add('hide-sub-text');

    set('--theme-color',       data.color         || '#e61c34');
    set('--cinematic-font',    `"${data.fontFamily || 'Teko'}"`);
    set('--main-font-size',    `${data.mainFontSize  || 8}rem`);
    set('--sub-font-size',     `${data.subFontSize   || 2}rem`);
    set('--main-text-color',   data.mainTextColor || '#ffffff');
    set('--sub-text-color',    data.subTextColor  || '#ffffff');
    set('--main-offset-x',     `${data.mainOffsetX || 0}px`);
    set('--main-offset-y',     `${data.mainOffsetY || 0}px`);
    set('--sub-offset-x',      `${data.subOffsetX  || 0}px`);
    set('--sub-offset-y',      `${data.subOffsetY  || 0}px`);
    set('--char-scale',        data.charScale || 1.0);
    set('--char-offset-x',     `${data.charOffsetX || 0}px`);
    set('--char-offset-y',     `${data.charOffsetY || 0}px`);
    set('--char-rotate',       `${data.charRotation || 0}deg`);
    set('--char-mirror-x',     data.charMirror ? '-1' : '1');
    set('--char-shadow-filter',`drop-shadow(15px 10px 0px ${data.charShadowColor || '#000000'})`);
    set('--screen-y',          `${data.screenPos  ?? 50}%`);
    set('--screen-x',          `${data.screenPosX ?? 50}%`);
    set('--dim-intensity',     Number(data.dimIntensity || 0));
    set('--custom-duration',   `${data.customDuration}s`);
    set('--border-color',      data.borderColor || '#ffffff');
    set('--border-width',      `${data.borderWidth || 0}px`);

    const bgLayer = wrapper.querySelector('.cinematic-bg-layer');
    if (bgLayer) {
      const w = data.borderWidth, c = data.borderColor;
      bgLayer.style.setProperty('--border-filter', w > 0
        ? `drop-shadow(${w}px 0 0 ${c}) drop-shadow(-${w}px 0 0 ${c}) drop-shadow(0 ${w}px 0 ${c}) drop-shadow(0 -${w}px 0 ${c})`
        : 'none');
    }

    if (stage) stage.style.setProperty('--custom-duration', `${data.customDuration}s`);
    overlay.classList.remove('active');
    void wrapper.offsetWidth; // reflow
  }

  // ── Animation ────────────────────────────────────────────────────────────
  static _startAnim(overlay, wrapper, stage, data) {
    overlay.classList.add('active');
    const isTW     = data.theme === 'typewriter';
    const wrapperId = 'dd-cutin-single';

    const startAnim = () => {
      this._handleAudio(data, wrapperId);
      wrapper.classList.add('animate');
      if (stage) { stage.classList.add('animate', `theme-${data.theme}`); }
      if (data.theme === 'yakuza') document.body.classList.add('cinematic-yakuza-active');
      if (isTW) this._typewriterEffect(wrapper, data.text || '', data.subText || '', data.customDuration);
    };

    const allMedia = Array.from(wrapper.querySelectorAll('img, video'));
    if (allMedia.length === 0) {
      setTimeout(startAnim, 50);
    } else {
      const promises = allMedia.map(el => new Promise(resolve => {
        if (el.tagName === 'VIDEO') {
          if (el.readyState >= 4) resolve();
          else { el.oncanplaythrough = resolve; el.onerror = resolve; el.load(); }
        } else {
          if (el.complete) resolve();
          else { el.onload = resolve; el.onerror = resolve; }
        }
      }));
      Promise.race([Promise.all(promises), new Promise(r => setTimeout(r, 7000))])
        .then(() => requestAnimationFrame(() => requestAnimationFrame(startAnim)));
    }

    if (data.shakeIntensity > 0) setTimeout(() => this.triggerShake(data.shakeIntensity), 200);

    const clearTime = Math.max(1000, data.customDuration * 1000 + 200);
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._stopAudio(wrapperId);
      overlay.classList.remove('active');
      wrapper.classList.remove('animate');
      if (stage) { stage.classList.remove('animate', `theme-${data.theme}`); }
      document.body.classList.remove('cinematic-yakuza-active');
    }, clearTime);
  }

  // ── Audio ────────────────────────────────────────────────────────────────
  static async _handleAudio(data, wrapperId) {
    const plays = [];
    const play = src => foundry.audio.AudioHelper.play({ src, volume: 0.8, autoplay: true, loop: false }, false);
    if (data.sound) plays.push(play(data.sound));
    if (data.sfx)   plays.push(play(data.sfx));
    if (plays.length) {
      const sounds = await Promise.all(plays);
      this._activeSounds.set(wrapperId, sounds.filter(Boolean));
    }
  }

  static _stopAudio(wrapperId) {
    const sounds = this._activeSounds.get(wrapperId) || [];
    sounds.forEach(s => s?.stop?.());
    this._activeSounds.delete(wrapperId);
  }

  // ── Typewriter ───────────────────────────────────────────────────────────
  static _typewriterEffect(wrapper, mainText, subText, durationSec) {
    const mainEl = wrapper.querySelector('.cinematic-text-main');
    const subEl  = wrapper.querySelector('.cinematic-text-sub');
    const id     = 'dd-cutin-single';

    this._clearTWTimers(id);
    const timers = [];
    this._typewriterTimerMap.set(id, timers);

    const total       = durationSec * 1000;
    const mainDur     = total * 0.35;
    const subDur      = total * 0.2;
    const fadeStart   = total - 600;

    [mainEl, subEl].forEach(el => {
      if (el) { el.innerHTML = ''; el.style.setProperty('opacity', '0', 'important'); }
    });

    const createCursor = () => {
      const c = document.createElement('span');
      c.className = 'typewriter-cursor'; c.textContent = '|'; return c;
    };

    const typeText = (element, text, duration, onComplete) => {
      if (!element || !text?.trim()) { onComplete?.(); return; }
      element.innerHTML = '';
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('display', 'block', 'important');
      element.style.setProperty('transform', 'none', 'important');

      const cursor = createCursor();
      element.appendChild(cursor);
      const lines = text.split(/<br\s*\/?>/i);
      let li = 0, ci = 0;

      const typeLine = () => {
        if (li >= lines.length) { cursor.remove(); onComplete?.(); return; }
        const line     = lines[li];
        const charDelay = duration / lines.length / Math.max(line.length, 1);

        const typeChar = () => {
          if (ci < line.length) {
            const node = document.createTextNode(line[ci] === ' ' ? '\u00A0' : line[ci]);
            element.insertBefore(node, cursor); ci++;
            timers.push(setTimeout(typeChar, charDelay));
          } else {
            li++; ci = 0;
            if (li < lines.length) element.insertBefore(document.createElement('br'), cursor);
            timers.push(setTimeout(typeLine, 100));
          }
        };
        typeChar();
      };
      typeLine();
    };

    timers.push(setTimeout(() => {
      typeText(mainEl, mainText, mainDur, () => {
        timers.push(setTimeout(() => typeText(subEl, subText, subDur, () => {}), 200));
      });
    }, 100));

    timers.push(setTimeout(() => {
      [mainEl, subEl].forEach(el => {
        if (el) { el.style.transition = 'opacity 0.5s ease-out'; el.style.setProperty('opacity', '0', 'important'); }
      });
    }, fadeStart));
  }

  static _clearTWTimers(id) {
    (this._typewriterTimerMap.get(id) || []).forEach(t => clearTimeout(t));
    this._typewriterTimerMap.delete(id);
  }

  // ── Shake ────────────────────────────────────────────────────────────────
  static triggerShake(intensity) {
    if (!intensity || intensity <= 0) return;
    const target = document.getElementById(this.OVERLAY_ID);
    if (!target) return;
    target.style.setProperty('--shake-power', intensity);
    target.classList.remove('cinematic-canvas-shake');
    void target.offsetWidth;
    target.classList.add('cinematic-canvas-shake');
    setTimeout(() => { target.classList.remove('cinematic-canvas-shake'); }, 550);
  }

  // ── Stop all ─────────────────────────────────────────────────────────────
  static stopAll() {
    this._queue = [];
    if (this._timer) clearTimeout(this._timer);
    this._activeSounds.forEach(s => s.forEach(x => x?.stop?.()));
    this._activeSounds.clear();
    const overlay = document.getElementById(this.OVERLAY_ID);
    if (overlay) overlay.classList.remove('active');
    this._isPlaying = false;
    this._showSkipButton(false);
  }

  // ── Skip button ──────────────────────────────────────────────────────────
  static _showSkipButton(show) {
    let btn = document.getElementById('dd-cutin-skip-btn');
    if (show) {
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'dd-cutin-skip-btn';
        btn.innerHTML = "<i class='fas fa-forward'></i> SKIP";
        btn.style.cssText = 'position:fixed;bottom:30px;right:330px;z-index:20000;background:rgba(0,0,0,0.6);color:#fff;border:1px solid #777;border-radius:20px;padding:5px 12px;font-family:Teko,sans-serif;font-size:1.1rem;cursor:pointer;';
        btn.onclick = () => this.stopAll();
        document.body.appendChild(btn);
      }
      btn.style.display = 'flex';
    } else {
      if (btn) btn.style.display = 'none';
    }
  }

  // ── Presets storage ──────────────────────────────────────────────────────
  static getPresets() {
    return game.settings.get(MODULE_ID, 'cutinPresets') || {};
  }

  static async savePreset(id, data) {
    const presets = this.getPresets();
    presets[id] = data;
    await game.settings.set(MODULE_ID, 'cutinPresets', presets);
  }

  static async deletePreset(id) {
    const presets = this.getPresets();
    delete presets[id];
    await game.settings.set(MODULE_ID, 'cutinPresets', presets);
  }

  // ── Macro code generation ─────────────────────────────────────────────────
  static getMacroCode(presetId) {
    const preset = this.getPresets()[presetId];
    if (!preset) return null;
    const data = JSON.stringify(preset, null, 2);
    return `// Drama Director — Cut-in: ${preset.presetName || presetId}
game.socket.emit('module.drama-director', {
  action: 'cutin',
  data: ${data}
});
DDCutinManager.play(${data});`;
  }
}

// ─── DDCutinConfig ApplicationV2 ──────────────────────────────────────────
export class DDCutinConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._presetId    = options.presetId || null;
    this._previewTimer = null;
    this._resizeObs   = new ResizeObserver(() => this._fitPreview());
  }

  static DEFAULT_OPTIONS = {
    id:       'dd-cutin-config',
    classes:  ['cinematic-config'],
    tag:      'form',
    window:   { title: 'Drama Director — Настройка Cut-in', resizable: true },
    position: { width: 900, height: 620 },
    form:     { closeOnSubmit: false, submitOnChange: false },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/cutin-config.hbs` }
  };

  // ── Data for template ─────────────────────────────────────────────────────
  async _prepareContext() {
    const presets = DDCutinManager.getPresets();
    let   data    = this._currentData || {};

    // If a presetId was passed (open existing preset)
    if (this._presetId && presets[this._presetId] && !this._currentData) {
      data = { ...presets[this._presetId] };
      this._currentData = data;
    }

    const theme = data.theme || 'brush';

    const themeOptions = DD_THEME_LIST.map(t => ({
      id: t.id, label: t.label, selected: t.id === theme
    }));

    const sfxOptions = DD_THEME_LIST.map(t => ({
      path:     DD_SFX[t.id] || '',
      label:    t.label,
      selected: (data.sfx || DD_SFX[theme]) === DD_SFX[t.id],
    }));

    const fontOptions = DD_FONT_LIST.map(f => ({
      id: f.id, label: f.label,
      selected: (data.fontFamily || 'Teko') === f.id,
    }));

    const presetList = Object.entries(presets).map(([id, p]) => ({
      id, name: p.presetName || 'Без названия'
    })).sort((a, b) => a.name.localeCompare(b.name));

    const themeDefaults = DD_THEME_DEFAULTS[theme] || DD_THEME_DEFAULTS.brush;

    return {
      presets:        presetList,
      presetName:     data.presetName || '',
      themeOptions,
      sfxOptions,
      fontOptions,
      img:            data.img            || '',
      theme,
      format:         data.format         || 'popout',
      customDuration: data.customDuration ?? 3.5,
      text:           data.text           || '',
      subText:        data.subText        || '',
      hideMainText:   data.hideMainText   || false,
      hideSubText:    data.hideSubText    || false,
      mainFontSize:   data.mainFontSize   ?? 8,
      subFontSize:    data.subFontSize    ?? 2,
      mainOffsetX:    data.mainOffsetX    ?? 0,
      mainOffsetY:    data.mainOffsetY    ?? 0,
      subOffsetX:     data.subOffsetX     ?? 0,
      subOffsetY:     data.subOffsetY     ?? 0,
      fontFamily:     data.fontFamily     || 'Teko',
      mainTextColor:  data.mainTextColor  || themeDefaults.main,
      subTextColor:   data.subTextColor   || themeDefaults.sub,
      color:          data.color          || '#e61c34',
      borderWidth:    data.borderWidth    ?? 0,
      borderColor:    data.borderColor    || '#ffffff',
      shakeIntensity: data.shakeIntensity ?? 0,
      dimIntensity:   data.dimIntensity   ?? 0,
      sfx:            data.sfx            || DD_SFX[theme] || '',
      sound:          data.sound          || '',
      charScale:      data.charScale      ?? 1.0,
      charOffsetX:    data.charOffsetX    ?? 0,
      charOffsetY:    data.charOffsetY    ?? 0,
      charRotation:   data.charRotation   ?? 0,
      hideBackground: data.hideBackground || false,
      screenPosX:     data.screenPosX     ?? 50,
      screenPos:      data.screenPos      ?? 50,
    };
  }

  // ── After render ───────────────────────────────────────────────────────────
  _onRender(context, options) {
    const html = this.element;

    // Range value live display
    html.querySelectorAll('input[type="range"]').forEach(range => {
      const span = range.parentElement.querySelector('.range-value');
      if (span) range.addEventListener('input', () => {
        const name = range.getAttribute('name');
        span.textContent = name === 'dimIntensity'
          ? `${range.value}%`
          : `${range.value}${name?.includes('FontSize') ? 'rem' : (name === 'shakeIntensity' ? '' : 's')}`;
      });
    });

    // Live preview on any change
    const schedulePreview = () => {
      clearTimeout(this._previewTimer);
      this._previewTimer = setTimeout(() => this._updatePreview(), 400);
    };
    html.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change',  schedulePreview);
      el.addEventListener('input',   schedulePreview);
    });

    // Theme change → update sfx dropdown default
    const themeSelect = html.querySelector('select[name="theme"]');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        const newTheme = themeSelect.value;
        const sfxSel   = html.querySelector('select[name="sfx"]');
        if (sfxSel && DD_SFX[newTheme]) sfxSel.value = DD_SFX[newTheme];
      });
    }

    // Fit preview
    const previewContainer = html.querySelector('.preview-container');
    if (previewContainer) this._resizeObs.observe(previewContainer);

    // Preset select → load
    html.querySelector('#dd-cutin-preset-select')?.addEventListener('change', e => {
      if (e.target.value) this._loadPreset(e.target.value);
    });

    this._fitPreview();
    this._updatePreview();
  }

  _fitPreview() {
    const stage = this.element?.querySelector('#dd-cutin-preview-stage');
    const cont  = this.element?.querySelector('.preview-container');
    if (!stage || !cont) return;
    const r     = cont.getBoundingClientRect();
    const scale = Math.min(r.width / 1920, r.height / 1080) * 0.98;
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    stage.style.transformOrigin = 'center center';
  }

  _updatePreview() {
    const stage   = this.element?.querySelector('#dd-cutin-preview-stage');
    const wrapper = stage?.querySelector('.cinematic-wrapper');
    if (!wrapper) return;

    const data = this._collectFormData();
    DDCutinManager._updateText(wrapper, data);
    DDCutinManager._updateMedia(wrapper, data);
    DDCutinManager._applyStyles({ classList: { remove: () => {}, add: () => {} } }, wrapper, null, data);
    wrapper.classList.add('animate');
  }

  _collectFormData() {
    const html = this.element;
    if (!html) return {};
    const fd = new FormData(html);
    const get = name => fd.get(name);
    return {
      img:            get('img')           || '',
      theme:          get('theme')         || 'brush',
      format:         get('format')        || 'popout',
      customDuration: parseFloat(get('customDuration') ?? 3.5),
      text:           get('text')          || '',
      subText:        get('subText')       || '',
      hideMainText:   !!html.querySelector('[name="hideMainText"]')?.checked,
      hideSubText:    !!html.querySelector('[name="hideSubText"]')?.checked,
      mainFontSize:   parseFloat(get('mainFontSize')  ?? 8),
      subFontSize:    parseFloat(get('subFontSize')   ?? 2),
      mainOffsetX:    parseFloat(get('mainOffsetX')   ?? 0),
      mainOffsetY:    parseFloat(get('mainOffsetY')   ?? 0),
      subOffsetX:     parseFloat(get('subOffsetX')    ?? 0),
      subOffsetY:     parseFloat(get('subOffsetY')    ?? 0),
      fontFamily:     get('fontFamily')    || 'Teko',
      mainTextColor:  get('mainTextColor') || '#ffffff',
      subTextColor:   get('subTextColor')  || '#ffffff',
      color:          get('color')         || '#e61c34',
      borderWidth:    parseInt(get('borderWidth')     ?? 0),
      borderColor:    get('borderColor')   || '#ffffff',
      shakeIntensity: parseInt(get('shakeIntensity')  ?? 0),
      dimIntensity:   parseInt(get('dimIntensity')    ?? 0),
      sfx:            get('sfx')           || '',
      sound:          get('sound')         || '',
      charScale:      parseFloat(get('charScale')     ?? 1),
      charOffsetX:    parseFloat(get('charOffsetX')   ?? 0),
      charOffsetY:    parseFloat(get('charOffsetY')   ?? 0),
      charRotation:   parseFloat(get('charRotation')  ?? 0),
      hideBackground: !!html.querySelector('[name="hideBackground"]')?.checked,
      screenPosX:     parseFloat(get('screenPosX')    ?? 50),
      screenPos:      parseFloat(get('screenPos')     ?? 50),
    };
  }

  // ── Action handlers ────────────────────────────────────────────────────────
  static ACTIONS = {
    'save':          (self) => self._onSave(),
    'test':          (self) => self._onTest(),
    'reset':         (self) => self._onReset(),
    'save-preset':   (self) => self._onSavePreset(),
    'load-preset':   (self) => self._onLoadPreset(),
    'delete-preset': (self) => self._onDeletePreset(),
  };

  _onClickAction(event, target) {
    const action = target.dataset.action;
    const handler = this.constructor.ACTIONS[action];
    if (handler) { event.preventDefault(); handler(this); }
  }

  async _onSave() {
    const nameEl = this.element?.querySelector('#dd-cutin-preset-name');
    const name   = nameEl?.value?.trim();
    if (!name) { ui.notifications.warn('Drama Director: введите название пресета.'); return; }
    await this._saveCurrentAsPreset(name);
    ui.notifications.info(`Drama Director: пресет "${name}" сохранён.`);
    this.render();
  }

  async _onSavePreset() {
    await this._onSave();
  }

  async _saveCurrentAsPreset(name) {
    const data    = this._collectFormData();
    data.presetName = name;
    const id      = this._presetId || foundry.utils.randomID();
    this._presetId    = id;
    this._currentData = data;
    await DDCutinManager.savePreset(id, data);
    return id;
  }

  _onLoadPreset() {
    const select = this.element?.querySelector('#dd-cutin-preset-select');
    if (select?.value) this._loadPreset(select.value);
  }

  _loadPreset(id) {
    const preset = DDCutinManager.getPresets()[id];
    if (!preset) return;
    this._presetId    = id;
    this._currentData = { ...preset };
    this.render();
    ui.notifications.info(`Drama Director: загружен пресет "${preset.presetName || id}".`);
  }

  async _onDeletePreset() {
    const select = this.element?.querySelector('#dd-cutin-preset-select');
    const id     = select?.value;
    if (!id) { ui.notifications.warn('Drama Director: выберите пресет для удаления.'); return; }
    const preset = DDCutinManager.getPresets()[id];
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Удалить пресет' },
      content: `<p>Удалить пресет <strong>${preset?.presetName || id}</strong>?</p>`,
    });
    if (!confirmed) return;
    await DDCutinManager.deletePreset(id);
    if (this._presetId === id) { this._presetId = null; this._currentData = null; }
    this.render();
    ui.notifications.info('Drama Director: пресет удалён.');
  }

  _onTest() {
    const data = this._collectFormData();
    DDCutinManager.playSingle(data);
  }

  _onReset() {
    this._currentData = null;
    this._presetId    = null;
    this.render();
  }

  _onClose() {
    this._resizeObs.disconnect();
    clearTimeout(this._previewTimer);
  }
}
