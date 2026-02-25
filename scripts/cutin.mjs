/**
 * Drama Director — Система текстовых Cut-In
 * Темы адаптированы из cinematic-cut-ins (ironmonk88)
 */

const MODULE_ID   = 'drama-director';
const SOUNDS_PATH = `modules/${MODULE_ID}/assets/sounds/cutin/`;

// ─── Реестр тем ────────────────────────────────────────────────────────────
export const DD_CUTIN_THEMES = [
  { id: 'brush',      label: 'Brush — Мазок кистью',   sound: 'sfx_brush.mp3'      },
  { id: 'cyber',      label: 'Cyber — Sci-Fi',          sound: 'sfx_cyber.mp3'      },
  { id: 'cinematic',  label: 'Cinematic — Кино',        sound: 'sfx_cinematic.mp3'  },
  { id: 'royal',      label: 'Royal — Золото',          sound: 'sfx_royal.mp3'      },
  { id: 'saga',       label: 'Saga — Пергамент',        sound: 'sfx_saga.mp3'       },
  { id: 'tribal',     label: 'Tribal — Дракон',         sound: 'sfx_tribal.mp3'     },
  { id: 'impact',     label: 'Impact — Удар',           sound: 'sfx_impact.mp3'     },
  { id: 'phantom',    label: 'Phantom — Халфтон',       sound: 'sfx_phantom.mp3'    },
  { id: 'arcane',     label: 'Arcane — Магия',          sound: 'sfx_arcane.mp3'     },
  { id: 'voltage',    label: 'Voltage — Молния',        sound: 'sfx_voltage.mp3'    },
  { id: 'scope',      label: 'Scope — Минимал',         sound: 'sfx_cinematic.mp3'  },
  { id: 'blitz',      label: 'Blitz — Вправо',          sound: 'finish_urban.mp3'   },
  { id: 'blitz_left', label: 'Blitz Left — Влево',      sound: 'finish_urban.mp3'   },
  { id: 'blossom',    label: 'Blossom — Нежный',        sound: 'sfx_cinematic.mp3'  },
  { id: 'slash',      label: 'Slash — Разрез',          sound: 'finish_urban.mp3'   },
  { id: 'burst',      label: 'Burst — Взрыв',           sound: 'char_urban.mp3'     },
  { id: 'glitch',     label: 'Glitch — Глитч',          sound: 'sfx_voltage.mp3'    },
  { id: 'dash',       label: 'Dash — Рывок',            sound: 'sfx_dash.mp3'       },
  { id: 'runes',      label: 'Runes — Руны',            sound: 'sfx_impact.mp3'     },
  { id: 'typewriter', label: 'Typewriter — Машинопись', sound: 'sfx_typewriter.mp3' },
  { id: 'yakuza',     label: 'Yakuza — Якудза',         sound: 'sfx_yakuza.mp3'     },
];

// ─── Интро-темы (персонажные) ───────────────────────────────────────────────
export const DD_INTRO_THEMES = [];

const THEME_DEFAULTS = {
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

const RESTRICTED_FORMATS = { slash: 'popout', blitz: 'popout', blitz_left: 'popout' };

export const DEFAULT_PRESET = {
  theme: 'brush', format: 'popout',
  text: '', subText: '',
  color: '#e61c34', fontFamily: 'Teko',
  mainFontSize: 8, subFontSize: 2,
  mainTextColor: '#ffffff', subTextColor: '#000000',
  mainOffsetX: 0, mainOffsetY: 0,
  subOffsetX: 0,  subOffsetY: 0,
  customDuration: 3.5, screenPos: 50, screenPosX: 50,
  img: '',
  charScale: 1, charOffsetX: 0, charOffsetY: 0, charRotation: 0, charMirror: false,
  hideBackground: false, hideMainText: false, hideSubText: false, hideBorder: false,
  customSound: false, soundPath: '',
  dimIntensity: 0,
  layers: [],
};

function fixPath(src) {
  if (!src) return '';
  if (src.startsWith('http') || src.startsWith('data:')) return src;
  return src.replace(/^\/+/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// CUTIN MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export class DDCutinManager {
  static OVERLAY_ID = 'dd-cutin-overlay';
  static _timer = null;
  static _activeSounds = [];
  static _typewriterTimers = [];

  static initialize() {
    if (document.getElementById(this.OVERLAY_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = this.OVERLAY_ID;
    overlay.innerHTML = `
      <div class="dd-cutin-stage" id="dd-cutin-stage">
        <div class="cinematic-wrapper">
          <div class="cinematic-custom-layers"></div>
          <div class="cinematic-bg-layer"><div class="cinematic-paint"></div></div>
          <div class="cinematic-deco-line"></div>
          <div class="cinematic-border-layer">
            <svg class="cinematic-border-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="dd-royal-gold" x1="0%" y1="0%" x2="100%" y2="100%">
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
          <div class="char-mask" id="dd-media-container"></div>
          <div class="cinematic-content">
            <div class="cinematic-text-main"></div>
            <div class="cinematic-text-sub"></div>
          </div>
        </div>
      </div>`;
    document.getElementById('interface')?.appendChild(overlay);
    window.addEventListener('resize', () => this._fitScreen());
    this._fitScreen();
  }

  static _fitScreen() {
    const stage = document.getElementById('dd-cutin-stage');
    if (!stage) return;
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.width     = '1920px';
    stage.style.height    = '1080px';
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
  }

  static async play(rawData) {
    this.initialize();
    const overlay = document.getElementById(this.OVERLAY_ID);
    const stage   = document.getElementById('dd-cutin-stage');
    const wrapper = overlay?.querySelector('.cinematic-wrapper');
    if (!overlay || !wrapper) return;

    this._clearTimers();
    this._stopAudio();

    const d = { ...DEFAULT_PRESET, ...rawData };
    const def = THEME_DEFAULTS[d.theme] || {};
    if (!rawData.mainTextColor) d.mainTextColor = def.main || '#ffffff';
    if (!rawData.subTextColor)  d.subTextColor  = def.sub  || '#ffffff';
    if (RESTRICTED_FORMATS[d.theme]) d.format = RESTRICTED_FORMATS[d.theme];

    wrapper.className = 'cinematic-wrapper';
    wrapper.classList.add(`theme-${d.theme}`, `format-${d.format}`);
    if (d.hideBackground) wrapper.classList.add('hide-bg');
    if (d.hideMainText)   wrapper.classList.add('hide-main-text');
    if (d.hideSubText)    wrapper.classList.add('hide-sub-text');
    if (d.hideBorder)     wrapper.classList.add('hide-border');

    const set = (k, v) => wrapper.style.setProperty(k, v);
    set('--theme-color',       d.color);
    set('--cinematic-font',    `"${d.fontFamily}"`);
    set('--main-font-size',    `${d.mainFontSize}rem`);
    set('--sub-font-size',     `${d.subFontSize}rem`);
    set('--main-text-color',   d.mainTextColor);
    set('--sub-text-color',    d.subTextColor);
    set('--main-offset-x',     `${d.mainOffsetX || 0}px`);
    set('--main-offset-y',     `${d.mainOffsetY || 0}px`);
    set('--sub-offset-x',      `${d.subOffsetX  || 0}px`);
    set('--sub-offset-y',      `${d.subOffsetY  || 0}px`);
    set('--screen-y',          `${d.screenPos}%`);
    set('--screen-x',          `${d.screenPosX}%`);
    set('--custom-duration',   `${d.customDuration}s`);
    set('--dim-intensity',     String(d.dimIntensity));
    set('--char-scale',        String(d.charScale ?? 1));
    set('--char-offset-x',     `${d.charOffsetX || 0}px`);
    set('--char-offset-y',     `${d.charOffsetY || 0}px`);
    set('--char-rotate',       `${d.charRotation || 0}deg`);
    set('--char-mirror-x',     d.charMirror ? '-1' : '1');
    set('--char-shadow-filter','drop-shadow(15px 10px 0px #000000)');
    set('--border-color',      '#ffffff');
    set('--border-width',      '0px');
    if (stage) stage.style.setProperty('--custom-duration', `${d.customDuration}s`);

    // Основной персонаж
    const container = wrapper.querySelector('#dd-media-container');
    if (container) {
      container.innerHTML = '';
      if (d.img?.trim()) {
        const isVid = /\.(webm|mp4|ogg)$/i.test(d.img);
        const el = document.createElement(isVid ? 'video' : 'img');
        el.className = 'cinematic-character custom-media';
        el.src = fixPath(d.img);
        if (isVid) { el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = true; }
        container.appendChild(el);
      }
    }

    // Кастомные слои
    this._applyLayers(wrapper, d.layers || []);

    // Текст
    const isTypewriter = d.theme === 'typewriter';
    const mainEl = wrapper.querySelector('.cinematic-text-main');
    const subEl  = wrapper.querySelector('.cinematic-text-sub');
    if (!isTypewriter) {
      if (mainEl) { mainEl.innerHTML = d.text || ''; mainEl.style.cssText = ''; }
      if (subEl)  { subEl.innerHTML  = d.subText || ''; subEl.style.cssText = ''; }
    } else {
      if (mainEl) mainEl.innerHTML = '';
      if (subEl)  subEl.innerHTML  = '';
    }

    overlay.classList.remove('active');
    void wrapper.offsetWidth;

    const allMedia = Array.from(wrapper.querySelectorAll('img, video'));
    if (allMedia.length) {
      await Promise.race([
        Promise.all(allMedia.map(el => new Promise(r => {
          if (el.tagName === 'VIDEO') { el.readyState >= 4 ? r() : (el.oncanplaythrough = r, el.onerror = r, el.load()); }
          else { el.complete ? r() : (el.onload = r, el.onerror = r); }
        }))),
        new Promise(r => setTimeout(r, 5000)),
      ]);
    }

    overlay.classList.add('active');
    wrapper.classList.add('animate');
    if (stage) stage.classList.add('animate', `theme-${d.theme}`);
    if (d.theme === 'yakuza') document.body.classList.add('cinematic-yakuza-active');

    const soundSrc = d.customSound && d.soundPath
      ? d.soundPath
      : (() => { const t = DD_CUTIN_THEMES.find(t => t.id === d.theme); return t?.sound ? SOUNDS_PATH + t.sound : null; })();
    if (soundSrc) {
      foundry.audio.AudioHelper.play({ src: soundSrc, volume: 0.8, autoplay: true, loop: false }, false)
        .then(s => { if (s) this._activeSounds.push(s); }).catch(() => {});
    }

    if (isTypewriter) this._typewriterEffect(wrapper, d.text || '', d.subText || '', d.customDuration);

    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._stopAudio();
      overlay.classList.remove('active');
      wrapper.classList.remove('animate');
      if (stage) stage.classList.remove('animate', `theme-${d.theme}`);
      document.body.classList.remove('cinematic-yakuza-active');
    }, Math.max(1000, d.customDuration * 1000 + 200));
  }

  static _applyLayers(wrapper, layers) {
    const container = wrapper.querySelector('.cinematic-custom-layers');
    if (!container) return;
    container.innerHTML = '';
    const sorted = [...layers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    for (const layer of sorted) {
      if (!layer.src) continue;
      const visible = layer.visible !== false;
      const isVid = /\.(webm|mp4|ogg)$/i.test(layer.src);
      const el = document.createElement(isVid ? 'video' : 'img');
      el.className = 'custom-layer-media';
      el.src = fixPath(layer.src);
      if (isVid) { el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = true; }
      const scale  = layer.scale    ?? 1;
      const mirror = layer.mirror   ? -1 : 1;
      el.style.cssText = [
        'position:absolute', 'top:50%', 'left:50%',
        'width:auto', 'height:auto', 'min-width:100%', 'min-height:100%', 'object-fit:contain',
        `transform:translate(-50%,-50%) translate(${layer.x||0}px,${layer.y||0}px) rotate(${layer.rotation||0}deg) scale(${scale*mirror},${scale})`,
        `opacity:${layer.opacity??1}`,
        `mix-blend-mode:${layer.blend||'normal'}`,
        `z-index:${layer.z??0}`,
        `display:${visible ? 'block' : 'none'}`,
      ].join(';');
      container.appendChild(el);
    }
  }

  static stop() {
    this._clearTimers(); this._stopAudio();
    const overlay = document.getElementById(this.OVERLAY_ID);
    const stage   = document.getElementById('dd-cutin-stage');
    const wrapper = overlay?.querySelector('.cinematic-wrapper');
    overlay?.classList.remove('active');
    wrapper?.classList.remove('animate');
    if (stage) stage.className = 'dd-cutin-stage';
    document.body.classList.remove('cinematic-yakuza-active');
  }

  static _clearTimers() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._typewriterTimers.forEach(t => clearTimeout(t));
    this._typewriterTimers = [];
  }

  static _stopAudio() {
    this._activeSounds.forEach(s => { try { s?.stop?.(); } catch (_) {} });
    this._activeSounds = [];
  }

  static _typewriterEffect(wrapper, mainText, subText, durationSec) {
    const mainEl = wrapper.querySelector('.cinematic-text-main');
    const subEl  = wrapper.querySelector('.cinematic-text-sub');
    const total  = durationSec * 1000;
    const type = (el, text, dur, onDone) => {
      if (!el || !text?.trim()) { el?.style.setProperty('display','none','important'); onDone?.(); return; }
      el.innerHTML = '';
      el.style.setProperty('opacity','1','important');
      el.style.setProperty('display','block','important');
      el.style.setProperty('transform','none','important');
      const cursor = Object.assign(document.createElement('span'), { className: 'typewriter-cursor', textContent: '|' });
      el.appendChild(cursor);
      const lines = text.split(/<br\s*\/?>/i);
      let li = 0, ci = 0;
      const tick = () => {
        if (li >= lines.length) { cursor.remove(); onDone?.(); return; }
        const line = lines[li];
        if (ci < line.length) {
          el.insertBefore(document.createTextNode(line[ci] === ' ' ? '\u00A0' : line[ci]), cursor);
          ci++;
          const tid = setTimeout(tick, Math.max(20, dur/lines.length/Math.max(line.length,1)));
          this._typewriterTimers.push(tid);
        } else {
          li++; ci = 0;
          if (li < lines.length) el.insertBefore(document.createElement('br'), cursor);
          const tid = setTimeout(tick, 100); this._typewriterTimers.push(tid);
        }
      };
      this._typewriterTimers.push(setTimeout(tick, 80));
    };
    if (mainEl) { mainEl.innerHTML=''; mainEl.style.setProperty('opacity','0','important'); }
    if (subEl)  { subEl.innerHTML='';  subEl.style.setProperty('opacity','0','important'); }
    type(mainEl, mainText, total*0.35, () => {
      this._typewriterTimers.push(setTimeout(() => type(subEl, subText, total*0.2, ()=>{}), 200));
    });
    this._typewriterTimers.push(setTimeout(() => {
      [mainEl,subEl].forEach(el => { if(!el) return; el.style.transition='opacity 0.5s ease-out'; el.style.setProperty('opacity','0','important'); });
    }, total-600));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESET STORAGE
// ─────────────────────────────────────────────────────────────────────────────
export class DDCutinPresets {
  static SETTING = 'cutinPresets';
  static register() {
    game.settings.register(MODULE_ID, this.SETTING, { name:'Cut-in Presets', scope:'world', config:false, type:Object, default:{} });
  }
  static getAll()  { return game.settings.get(MODULE_ID, this.SETTING) || {}; }
  static get(name) { return this.getAll()[name] ?? null; }
  static list()    { return Object.keys(this.getAll()).sort(); }
  static async save(name, data) {
    const all = this.getAll(); all[name] = { ...data, _name: name };
    await game.settings.set(MODULE_ID, this.SETTING, all);
  }
  static async delete(name) {
    const all = this.getAll(); delete all[name];
    await game.settings.set(MODULE_ID, this.SETTING, all);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────────────────────
const { ApplicationV2: CutinAppV2, HandlebarsApplicationMixin: CutinHbs } = foundry.applications.api;
export class DDCutinPanel extends CutinHbs(CutinAppV2) {
  constructor(options = {}) {
    super(options);
    this._data = foundry.utils.deepClone(DEFAULT_PRESET);
  }

  static DEFAULT_OPTIONS = {
    id: 'dd-cutin-panel', tag: 'div',
    classes: ['drama-director', 'dd-cutin-panel'],
    window: { title: 'Drama Director — Cut-In Редактор', icon: 'fas fa-film', resizable: true },
    position: { width: 920, height: 760 },
  };

  static PARTS = { form: { template: `modules/${MODULE_ID}/templates/cutin-panel.hbs` } };

  async _prepareContext() {
    return {
      themes:      DD_CUTIN_THEMES,
      introThemes: DD_INTRO_THEMES,
      data:        this._data,
      presets:     DDCutinPresets.list(),
      layers:      (this._data.layers || []).map((l, i) => ({ ...l, _idx: i, _num: i + 1 })),
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;

    // ── Правые вкладки (Текст / Персонаж / Звук / Слои) ──
    el.querySelectorAll('.dd-rtab').forEach(tab => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.rtab;
        el.querySelectorAll('.dd-rtab').forEach(t => t.classList.toggle('active', t === tab));
        el.querySelectorAll('.dd-rtab-content').forEach(c => {
          c.classList.toggle('dd-hidden', c.dataset.rtabContent !== key);
        });
        this._activeRTab = key;
      });
    });
    // Restore active tab after re-render
    if (this._activeRTab) {
      const activeTab = el.querySelector(`.dd-rtab[data-rtab="${this._activeRTab}"]`);
      activeTab?.click();
    }

    // ── Смена темы — обновить цвета по умолчанию ──
    el.querySelector('#dd-theme-select')?.addEventListener('change', e => {
      this._syncFromForm();
      this._data.theme = e.target.value;
      const def = THEME_DEFAULTS[this._data.theme] || {};
      if (!this._data.mainTextColor || this._data.mainTextColor === '#ffffff')
        this._data.mainTextColor = def.main || '#ffffff';
      if (!this._data.subTextColor  || this._data.subTextColor  === '#000000')
        this._data.subTextColor  = def.sub  || '#ffffff';
      this.render();
    });

    // ── Переключатель кастомного звука ──
    el.querySelector('#dd-custom-sound')?.addEventListener('change', e => {
      const soundInput = el.querySelector('#dd-sound-path');
      if (soundInput) soundInput.disabled = !e.target.checked;
    });

    // ── Живая синхронизация всех полей ──
    el.querySelectorAll('input,select,textarea').forEach(inp => {
      inp.addEventListener('change', () => this._syncFromForm());
      inp.addEventListener('input',  () => this._syncFromForm());
    });

    // ── Кнопки ──
    el.querySelector('[data-action="dd-preset-save"]')   ?.addEventListener('click', () => this._savePreset());
    el.querySelector('[data-action="dd-preset-load"]')   ?.addEventListener('click', () => this._loadPreset());
    el.querySelector('[data-action="dd-preset-delete"]') ?.addEventListener('click', () => this._deletePreset());
    el.querySelector('[data-action="dd-cutin-play"]')    ?.addEventListener('click', () => this._play());
    el.querySelector('[data-action="dd-cutin-stop"]')    ?.addEventListener('click', () => DDCutinManager.stop());
    el.querySelector('[data-action="dd-macro-copy"]')    ?.addEventListener('click', () => this._copyMacro());
    el.querySelector('[data-action="dd-browse-img"]')    ?.addEventListener('click', () => this._browse('image', '#dd-img'));
    el.querySelector('[data-action="dd-browse-sound"]')  ?.addEventListener('click', () => this._browse('audio', '#dd-sound-path'));
    el.querySelector('[data-action="dd-layer-add"]')     ?.addEventListener('click', () => this._addLayer());

    el.querySelectorAll('[data-layer-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        const row = e.currentTarget.closest('[data-layer-idx]');
        const idx = Number(row?.dataset.layerIdx);
        const act = e.currentTarget.dataset.layerAction;
        if (act === 'remove') this._removeLayer(idx);
        if (act === 'up')     this._moveLayer(idx, -1);
        if (act === 'down')   this._moveLayer(idx,  1);
        if (act === 'browse') this._browseLayer(idx);
      });
    });

    el.querySelectorAll('[data-layer-idx]').forEach(row => {
      const idx = Number(row.dataset.layerIdx);
      row.querySelectorAll('input,select').forEach(inp => {
        inp.addEventListener('change', () => this._syncLayerFromRow(idx, row));
        inp.addEventListener('input',  () => this._syncLayerFromRow(idx, row));
      });
    });
  }

  _syncFromForm() {
    const q = s => this.element.querySelector(s);
    this._data.theme          = q('#dd-theme-select')?.value       || 'brush';
    this._data.format         = q('#dd-format-select')?.value      || 'popout';
    this._data.text           = q('#dd-text-main')?.value          || '';
    this._data.subText        = q('#dd-text-sub')?.value           || '';
    this._data.color          = q('#dd-color')?.value              || '#e61c34';
    this._data.fontFamily     = q('#dd-font')?.value               || 'Teko';
    this._data.mainFontSize   = Number(q('#dd-main-size')?.value)  || 8;
    this._data.subFontSize    = Number(q('#dd-sub-size')?.value)   || 2;
    this._data.mainTextColor  = q('#dd-main-color')?.value         || '#ffffff';
    this._data.subTextColor   = q('#dd-sub-color')?.value          || '#ffffff';
    this._data.mainOffsetX    = Number(q('#dd-main-ox')?.value)    || 0;
    this._data.mainOffsetY    = Number(q('#dd-main-oy')?.value)    || 0;
    this._data.subOffsetX     = Number(q('#dd-sub-ox')?.value)     || 0;
    this._data.subOffsetY     = Number(q('#dd-sub-oy')?.value)     || 0;
    this._data.customDuration = Number(q('#dd-duration')?.value)   || 3.5;
    this._data.screenPos      = Number(q('#dd-screen-y')?.value)   || 50;
    this._data.screenPosX     = Number(q('#dd-screen-x')?.value)   || 50;
    this._data.img            = q('#dd-img')?.value                || '';
    this._data.charScale      = Number(q('#dd-char-scale')?.value) || 1;
    this._data.charOffsetX    = Number(q('#dd-char-ox')?.value)    || 0;
    this._data.charOffsetY    = Number(q('#dd-char-oy')?.value)    || 0;
    this._data.charRotation   = Number(q('#dd-char-rot')?.value)   || 0;
    this._data.charMirror     = q('#dd-char-mirror')?.checked      || false;
    this._data.hideBackground = q('#dd-hide-bg')?.checked          || false;
    this._data.hideMainText   = q('#dd-hide-main-text')?.checked   || false;
    this._data.hideSubText    = q('#dd-hide-sub-text')?.checked    || false;
    this._data.hideBorder     = q('#dd-hide-border')?.checked      || false;
    this._data.customSound    = q('#dd-custom-sound')?.checked     || false;
    this._data.soundPath      = q('#dd-sound-path')?.value         || '';
    this._data.dimIntensity   = Number(q('#dd-dim')?.value)        || 0;

    // Read ALL layers from DOM
    const rows = this.element.querySelectorAll('[data-layer-idx]');
    rows.forEach(row => {
      const idx = Number(row.dataset.layerIdx);
      if (!this._data.layers?.[idx]) return;
      this._syncLayerFromRow(idx, row);
    });
  }

  _syncLayerFromRow(idx, row) {
    if (!this._data.layers?.[idx]) return;
    const q = s => row.querySelector(s);
    const l = this._data.layers[idx];
    l.src      = q('.dd-layer-src')?.value                  ?? l.src;
    l.x        = Number(q('.dd-layer-x')?.value)            || 0;
    l.y        = Number(q('.dd-layer-y')?.value)            || 0;
    l.z        = Number(q('.dd-layer-z')?.value)            ?? 0;
    l.scale    = Number(q('.dd-layer-scale')?.value)        || 1;
    l.rotation = Number(q('.dd-layer-rot')?.value)          || 0;
    l.opacity  = Number(q('.dd-layer-opacity')?.value)      ?? 1;
    l.visible  = q('.dd-layer-visible')?.checked !== false;
    l.blend    = q('.dd-layer-blend')?.value                || 'normal';
    l.mirror   = q('.dd-layer-mirror')?.checked             || false;
  }

  _addLayer() {
    if (!this._data.layers) this._data.layers = [];
    this._data.layers.push({ src:'', x:0, y:0, z:this._data.layers.length, scale:1, opacity:1, visible:true, blend:'normal', rotation:0, mirror:false });
    this.render();
  }

  _removeLayer(idx) { this._data.layers.splice(idx, 1); this.render(); }

  _moveLayer(idx, dir) {
    const arr = this._data.layers;
    const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    arr.forEach((l, i) => { l.z = i; });
    this.render();
  }

  _browseLayer(idx) {
    new FilePicker({ type: 'image', callback: path => {
      if (!this._data.layers[idx]) return;
      this._data.layers[idx].src = path;
      const rows = this.element.querySelectorAll('[data-layer-idx]');
      const row = Array.from(rows).find(r => Number(r.dataset.layerIdx) === idx);
      const inp = row?.querySelector('.dd-layer-src');
      if (inp) inp.value = path;
    }}).render(true);
  }

  async _play() {
    this._syncFromForm();
    game.socket.emit(`module.${MODULE_ID}`, { type: 'cutin', data: this._data });
    DDCutinManager.play(this._data);
  }

  async _savePreset() {
    this._syncFromForm();
    const name = this.element.querySelector('#dd-preset-name')?.value?.trim();
    if (!name) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.cutin.notifications.presetNameRequired'));
    await DDCutinPresets.save(name, this._data);
    ui.notifications.info(game.i18n.format('DRAMADIRECTOR.cutin.notifications.presetSaved', {name}));
    this.render();
  }

  async _loadPreset() {
    const name = this.element.querySelector('#dd-preset-select')?.value;
    if (!name) return;
    const p = DDCutinPresets.get(name);
    if (!p) return;
    this._data = { ...DEFAULT_PRESET, ...p, layers: p.layers ? foundry.utils.deepClone(p.layers) : [] };
    this.render();
  }

  async _deletePreset() {
    const name = this.element.querySelector('#dd-preset-select')?.value;
    if (!name) return;
    await DDCutinPresets.delete(name);
    ui.notifications.info(game.i18n.format('DRAMADIRECTOR.cutin.notifications.presetDeleted', {name}));
    this.render();
  }

  _copyMacro() {
    this._syncFromForm();
    const presetName = this.element.querySelector('#dd-preset-select')?.value;
    const macro = presetName
      ? `// Показать пресет cut-in по имени\ngame.dramaDirector.cutin.playPreset(${JSON.stringify(presetName)});`
      : `// Показать cut-in с настройками\ngame.dramaDirector.cutin.play(${JSON.stringify(this._data, null, 2)});`;
    navigator.clipboard.writeText(macro)
      .then(() => ui.notifications.info(game.i18n.localize('DRAMADIRECTOR.cutin.notifications.macroCopied')));
  }

  _browse(type, selector) {
    new FilePicker({ type, callback: path => {
      const inp = this.element.querySelector(selector);
      if (inp) { inp.value = path; this._syncFromForm(); }
    }}).render(true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
export const DDCutinAPI = {
  play(data = {}) {
    DDCutinManager.play(data);
    game.socket.emit(`module.${MODULE_ID}`, { type: 'cutin', data });
  },
  playPreset(name) {
    const p = DDCutinPresets.get(name);
    if (!p) return ui.notifications.warn(game.i18n.format('DRAMADIRECTOR.cutin.notifications.presetNotFound', {name}));
    this.play(p);
  },
  stop() { DDCutinManager.stop(); },
  openPanel() {
    const ex = foundry.applications.instances.get('dd-cutin-panel');
    if (ex) ex.bringToTop(); else new DDCutinPanel().render(true);
  },
  presets() { return DDCutinPresets.list(); },
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
export function initCutinSystem() {
  DDCutinPresets.register();
  game.socket.on(`module.${MODULE_ID}`, packet => {
    if (packet?.type === 'cutin') DDCutinManager.play(packet.data);
  });
  Hooks.on('canvasReady', () => DDCutinManager.initialize());
  if (document.getElementById('interface')) DDCutinManager.initialize();
  if (!game.dramaDirector) game.dramaDirector = {};
  game.dramaDirector.cutin = DDCutinAPI;
}
