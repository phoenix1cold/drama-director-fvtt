/**
 * Drama Director — Group Character Intro System
 * Ports renderCinematic from cinematic-cut-ins (ironmonk88)
 * Themes: rebel, comic, urban, noir, wanted, slice, arcane, legion, dragon
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = 'drama-director';
const SOUNDS_PATH = `modules/${MODULE_ID}/assets/sounds/cutin/`;

// ─── Настройки тем (интервал, длительность, тип анимации) ─────────────────
const GROUP_THEME_SETTINGS = {
  rebel:  { interval: 1.2,  duration: 0.5, layout: 'shatter',  type: 'pop'     },
  comic:  { interval: 1.2,  duration: 0.5, layout: 'shatter',  type: 'pop'     },
  urban:  { interval: 0.15, duration: 0.5, layout: 'shatter',  type: 'slide'   },
  noir:   { interval: 1.2,  duration: 0.5, layout: 'shatter',  type: 'pop'     },
  wanted: { interval: 1.50, duration: 2.5, layout: 'full',     type: 'mugshot' },
  slice:  { interval: 0.15, duration: 0.5, layout: 'diagonal', type: 'pop'     },
  arcane: { interval: 0.3,  duration: 0.8, layout: 'diagonal', type: 'slide'   },
  legion: { interval: 0.2,  duration: 0.6, layout: 'full',     type: 'scan'    },
  dragon: { interval: 0.4,  duration: 0.6, layout: 'shatter',  type: 'pop'     },
};

export const DD_GROUP_THEMES = [
  { id: 'rebel',  label: 'Rebel  (Persona 5)' },
  { id: 'comic',  label: 'Comic  (Persona 4)' },
  { id: 'urban',  label: 'Urban  (Persona 3)' },
  { id: 'noir',   label: 'Noir'               },
  { id: 'wanted', label: 'Wanted (Разыскивается)' },
  { id: 'slice',  label: 'Slice'              },
  { id: 'arcane', label: 'Arcane'             },
  { id: 'legion', label: 'Legion'             },
  { id: 'dragon', label: 'Dragon'             },
];

// ─────────────────────────────────────────────────────────────────────────────
export class DDGroupIntroManager {
  static OVERLAY_ID = 'dd-group-overlay';
  static _soundTimers = [];
  static _hideTimer   = null;

  static initialize() {
    if (document.getElementById(this.OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = this.OVERLAY_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;pointer-events:none;display:none;align-items:center;justify-content:center;';

    const stage = document.createElement('div');
    stage.id = 'dd-group-stage';
    stage.style.cssText = 'position:absolute;top:50%;left:50%;transform-origin:center center;width:1920px;height:1080px;overflow:hidden;';

    const container = document.createElement('div');
    container.className = 'cinematic-group-container';
    container.id = 'dd-group-container';

    stage.appendChild(container);
    overlay.appendChild(stage);
    document.getElementById('interface')?.appendChild(overlay);

    window.addEventListener('resize', () => this._fitScreen());
    this._fitScreen();
  }

  static _fitScreen() {
    const stage = document.getElementById('dd-group-stage');
    if (!stage) return;
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
  }

  /**
   * Показать групповое интро
   * @param {object} payload
   *   payload.theme        — строка: 'rebel' | 'comic' | ...
   *   payload.participants — массив { img, text, color, sound, sfx, scale, x, y, mirror, rotation }
   *   payload.centerMainText, payload.centerSubText — текст по центру
   *   payload.showNames    — bool
   *   payload.fontFamily   — строка
   *   payload.finishSound  — путь к звуку финала
   *   payload.displayTime  — секунды до скрытия (0 = авто)
   */
  static async play(payload = {}) {
    this.initialize();
    this._clearTimers();

    const overlay   = document.getElementById(this.OVERLAY_ID);
    const stage     = document.getElementById('dd-group-stage');
    const container = document.getElementById('dd-group-container');
    if (!overlay || !container) return;

    // Показываем overlay
    overlay.style.display = 'flex';

    const global = {
      theme:         payload.theme         || 'rebel',
      fontFamily:    payload.fontFamily    || 'Teko',
      showNames:     payload.showNames     ?? false,
      centerMainText:payload.centerMainText|| '',
      centerSubText: payload.centerSubText || '',
      centerMainColor:  payload.centerMainColor  || '#ffffff',
      centerMainShadow: payload.centerMainShadow || '#000000',
      centerMainSize:   payload.centerMainSize   || 10,
      centerSubColor:   payload.centerSubColor   || '#ffffff',
      centerSubShadow:  payload.centerSubShadow  || '#000000',
      centerSubSize:    payload.centerSubSize    || 3,
      finishSound:   payload.finishSound   || '',
    };

    const participants = Array.isArray(payload.participants)
      ? payload.participants
      : (payload.participants ? [payload.participants] : []);

    if (!participants.length) return;

    const currentTheme = global.theme;
    const baseConfig   = GROUP_THEME_SETTINGS[currentTheme] || GROUP_THEME_SETTINGS.rebel;
    const config = { ...baseConfig };

    // ── Сбрасываем контейнер ──
    container.innerHTML = '';
    container.className = 'cinematic-group-container';
    container.classList.add(`theme-${currentTheme}`);
    if (!global.showNames) container.classList.add('hide-text');
    container.dataset.layout = config.layout;
    container.dataset.count  = participants.length;

    const set = (k, v) => container.style.setProperty(k, v);
    set('--cinematic-font',      `"${global.fontFamily}"`);
    set('--anim-duration',       `${config.duration}s`);
    set('--center-main-color',   global.centerMainColor);
    set('--center-main-shadow',  global.centerMainShadow);
    set('--center-main-size',    `${global.centerMainSize}rem`);
    set('--center-main-x',       '0px');
    set('--center-main-y',       '0px');
    set('--center-sub-color',    global.centerSubColor);
    set('--center-sub-shadow',   global.centerSubShadow);
    set('--center-sub-size',     `${global.centerSubSize}rem`);
    set('--center-sub-x',        '0px');
    set('--center-sub-y',        '0px');

    // ── Порядок появления — рандомный (кроме mugshot) ──
    const count = participants.length;
    let delayOrder = Array.from({ length: count }, (_, i) => i);
    if (config.type !== 'mugshot') {
      for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [delayOrder[i], delayOrder[j]] = [delayOrder[j], delayOrder[i]];
      }
    }

    const maxDelay = (Math.max(...delayOrder) * config.interval) + config.duration;
    set('--total-delay', `${maxDelay}s`);

    // ── Строим слайсы ──
    for (let i = 0; i < count; i++) {
      const data  = participants[i];
      const slice = document.createElement('div');
      slice.className = 'cinematic-slice';

      // Геометрия по типу layout
      if (config.layout === 'full') {
        const cw = 100 / count;
        slice.style.setProperty('--col-left', `${cw * i}%`);
        slice.style.setProperty('--col-width', `${cw}%`);
        slice.style.setProperty('--final-center-x', `${cw * i + cw / 2}%`);
      } else if (config.layout === 'diagonal') {
        const step = 100 / count;
        const tilt = currentTheme === 'arcane' ? 5 : 15;
        const s = i * step, e = (i + 1) * step;
        let clip;
        if (i === 0)         clip = `polygon(-50% 0%,${e-tilt}% 0%,${e+tilt}% 100%,-50% 100%)`;
        else if (i===count-1)clip = `polygon(${s-tilt}% 0%,150% 0%,150% 100%,${s+tilt}% 100%)`;
        else                 clip = `polygon(${s-tilt}% 0%,${e-tilt}% 0%,${e+tilt}% 100%,${s+tilt}% 100%)`;
        slice.style.clipPath = clip;
        slice.style.setProperty('--base-x', `${s + step / 2}%`);
      } else {
        // shatter — равные колонки
        const cw = 100 / count;
        slice.style.setProperty('--base-x', `${cw * i + cw / 2}%`);
      }

      slice.style.setProperty('--theme-color',      data.color      || '#e61c34');
      slice.style.setProperty('--text-color',        data.textColor  || '#ffffff');
      slice.style.setProperty('--char-shadow-color', data.shadow     || '#000000');
      slice.style.setProperty('--char-scale',        String(data.scale    ?? 1.0));
      slice.style.setProperty('--mugshot-zoom',      String(data.zoom     ?? 2.0));
      slice.style.setProperty('--zoom-x',            `${data.zoomX   ?? 0}px`);
      slice.style.setProperty('--zoom-y',            `${data.zoomY   ?? 0}px`);
      slice.style.setProperty('--char-x',            `${data.x       ?? 0}px`);
      slice.style.setProperty('--char-y',            `${data.y       ?? 0}px`);
      slice.style.setProperty('--char-rotate',       `${data.rotation ?? 0}deg`);
      slice.style.setProperty('--char-mirror-x',     data.mirror ? '-1' : '1');
      slice.style.setProperty('--text-x',            `${data.textX   ?? 0}px`);
      slice.style.setProperty('--text-y',            `${data.textY   ?? 0}px`);

      const delaySec = delayOrder[i] * config.interval;
      slice.style.setProperty('--delay', `${delaySec}s`);

      // Звук слайса
      if (data.sound || data.sfx) {
        const t = setTimeout(() => {
          const pick = s => s?.includes(';')
            ? s.split(';')[Math.floor(Math.random()*s.split(';').length)].trim()
            : s;
          if (data.sound) foundry.audio.AudioHelper.play({ src: pick(data.sound), volume: 0.8, autoplay: true, loop: false }, false).catch(()=>{});
          if (data.sfx)   foundry.audio.AudioHelper.play({ src: pick(data.sfx),   volume: 0.8, autoplay: true, loop: false }, false).catch(()=>{});
        }, delaySec * 1000);
        this._soundTimers.push(t);
      }

      slice.innerHTML = `
        <div class="slice-bg"></div>
        <img class="cinematic-character" src="${data.img || 'icons/svg/mystery-man.svg'}" alt=""/>
        <div class="slice-text">${data.text || ''}</div>`;
      container.appendChild(slice);
    }

    // ── Финальный звук ──
    if (global.finishSound) {
      const extraDelay = (config.type !== 'mugshot' && currentTheme !== 'urban') ? 0.3 : 0;
      const t = setTimeout(() => {
        foundry.audio.AudioHelper.play({ src: global.finishSound, volume: 0.8, autoplay: true, loop: false }, false).catch(()=>{});
      }, (maxDelay + extraDelay) * 1000);
      this._soundTimers.push(t);
    }

    // ── Центральный текст ──
    if (global.centerMainText || global.centerSubText) {
      const isLegion = currentTheme === 'legion';
      const typeChars = txt => txt ? [...txt].map((ch, i) =>
        `<span style="--char-i:${i};display:inline-block">${ch === ' ' ? '&nbsp;' : ch}</span>`
      ).join('') : '';

      const centerDiv = document.createElement('div');
      centerDiv.className = 'cinematic-group-center-text';
      centerDiv.innerHTML = `
        <div class="center-main-wrapper"><div class="center-main">${isLegion ? typeChars(global.centerMainText) : global.centerMainText}</div></div>
        <div class="center-sub-wrapper"><div class="center-sub">${isLegion ? typeChars(global.centerSubText) : global.centerSubText}</div></div>`;
      container.appendChild(centerDiv);
    }

    // ── Флэш ──
    const flash = document.createElement('div');
    flash.className = 'cinematic-group-flash';
    container.appendChild(flash);

    // ── Старт анимации ──
    await new Promise(r => setTimeout(r, 50));
    container.classList.add('active');
    requestAnimationFrame(() => container.classList.add('animate'));

    // ── Авто-скрытие ──
    let safetyBuffer = currentTheme === 'legion' ? 4.0 : 2.0;
    const totalTime  = (payload.displayTime > 0 ? payload.displayTime : (maxDelay + safetyBuffer)) * 1000;

    this._hideTimer = setTimeout(() => this.stop(), totalTime);
  }

  static stop() {
    this._clearTimers();
    const overlay   = document.getElementById(this.OVERLAY_ID);
    const container = document.getElementById('dd-group-container');
    if (overlay)   overlay.style.display = 'none';
    if (container) { container.className = 'cinematic-group-container'; container.innerHTML = ''; }
  }

  static _clearTimers() {
    this._soundTimers.forEach(t => clearTimeout(t));
    this._soundTimers = [];
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESET STORAGE для групповых интро
// ─────────────────────────────────────────────────────────────────────────────
export class DDGroupPresets {
  static SETTING = 'groupIntroPresets';

  static register() {
    game.settings.register(MODULE_ID, this.SETTING, {
      scope: 'world', config: false, type: Object, default: {},
    });
  }

  static getAll() { return game.settings.get(MODULE_ID, this.SETTING) || {}; }
  static get(name) { return this.getAll()[name] ?? null; }
  static list() { return Object.keys(this.getAll()).sort(); }

  static async save(name, data) {
    const all = this.getAll();
    all[name] = { ...data, _name: name };
    await game.settings.set(MODULE_ID, this.SETTING, all);
  }

  static async delete(name) {
    const all = this.getAll();
    delete all[name];
    await game.settings.set(MODULE_ID, this.SETTING, all);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP INTRO PANEL
// ─────────────────────────────────────────────────────────────────────────────


const DEFAULT_PARTICIPANT = {
  img: '', text: '', color: '#e61c34', textColor: '#ffffff', shadow: '#000000',
  sound: '', sfx: '', scale: 1.0, x: 0, y: 0, mirror: false, rotation: 0,
};

const DEFAULT_GROUP_DATA = {
  theme: 'rebel',
  fontFamily: 'Teko',
  showNames: false,
  centerMainText: '',
  centerSubText: '',
  centerMainColor: '#ffffff',
  centerMainSize: 10,
  centerSubColor: '#ffffff',
  centerSubSize: 3,
  displayTime: 0,
  participants: [],
};

export class DDGroupIntroPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._data = foundry.utils.deepClone(DEFAULT_GROUP_DATA);
  }

  static DEFAULT_OPTIONS = {
    id: 'dd-group-panel', tag: 'div',
    classes: ['drama-director', 'dd-group-panel'],
    window: { title: 'Drama Director — Групповое Интро', icon: 'fas fa-users', resizable: true },
    position: { width: 860, height: 700 },
  };

  static PARTS = { form: { template: `modules/${MODULE_ID}/templates/group-panel.hbs` } };

  async _prepareContext() {
    return {
      themes:       DD_GROUP_THEMES,
      data:         this._data,
      presets:      DDGroupPresets.list(),
      participants: (this._data.participants || []).map((p, i) => ({ ...p, _idx: i, _num: i + 1 })),
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;

    // Sync all inputs live
    el.querySelectorAll('input,select,textarea').forEach(inp => {
      inp.addEventListener('change', () => this._syncFromForm());
      inp.addEventListener('input',  () => this._syncFromForm());
    });

    // Participant actions
    el.querySelector('[data-action="dd-group-add-participant"]')?.addEventListener('click', () => this._addParticipant());

    el.querySelectorAll('[data-part-action]').forEach(btn => {
      const idx = Number(btn.closest('[data-part-idx]')?.dataset.partIdx);
      const act = btn.dataset.partAction;
      btn.addEventListener('click', () => {
        this._syncFromForm();
        if (act === 'remove') this._removeParticipant(idx);
        if (act === 'browse-img')   this._browseParticipant(idx, 'image', 'img');
        if (act === 'browse-sound') this._browseParticipant(idx, 'audio', 'sound');
        if (act === 'browse-sfx')   this._browseParticipant(idx, 'audio', 'sfx');
        if (act === 'from-actor')   this._fillFromActor(idx);
      });
    });

    // Preset buttons
    el.querySelector('[data-action="dd-group-preset-save"]')  ?.addEventListener('click', () => this._savePreset());
    el.querySelector('[data-action="dd-group-preset-load"]')  ?.addEventListener('click', () => this._loadPreset());
    el.querySelector('[data-action="dd-group-preset-delete"]')?.addEventListener('click', () => this._deletePreset());
    el.querySelector('[data-action="dd-group-macro-copy"]')   ?.addEventListener('click', () => this._copyMacro());
    el.querySelector('[data-action="dd-group-play"]')         ?.addEventListener('click', () => this._play());
    el.querySelector('[data-action="dd-group-stop"]')         ?.addEventListener('click', () => DDGroupIntroManager.stop());

    // Fill from selected tokens
    el.querySelector('[data-action="dd-group-fill-tokens"]')?.addEventListener('click', () => this._fillFromTokens());
    el.querySelector('[data-action="dd-group-fill-players"]')?.addEventListener('click', () => this._fillFromPlayers());
  }

  _syncFromForm() {
    const q = s => this.element.querySelector(s);
    this._data.theme           = q('#ddg-theme')?.value           || 'rebel';
    this._data.fontFamily      = q('#ddg-font')?.value            || 'Teko';
    this._data.showNames       = q('#ddg-show-names')?.checked    || false;
    this._data.centerMainText  = q('#ddg-center-main')?.value     || '';
    this._data.centerSubText   = q('#ddg-center-sub')?.value      || '';
    this._data.centerMainColor = q('#ddg-center-main-color')?.value || '#ffffff';
    this._data.centerMainSize  = Number(q('#ddg-center-main-size')?.value) || 10;
    this._data.centerSubColor  = q('#ddg-center-sub-color')?.value  || '#ffffff';
    this._data.centerSubSize   = Number(q('#ddg-center-sub-size')?.value)  || 3;
    this._data.displayTime     = Number(q('#ddg-display-time')?.value) || 0;

    // Participants
    this.element.querySelectorAll('[data-part-idx]').forEach(row => {
      const idx = Number(row.dataset.partIdx);
      if (!this._data.participants[idx]) return;
      const p = this._data.participants[idx];
      const qr = s => row.querySelector(s);
      p.img       = qr('.ddg-part-img')?.value       || '';
      p.text      = qr('.ddg-part-text')?.value      || '';
      p.color     = qr('.ddg-part-color')?.value     || '#e61c34';
      p.textColor = qr('.ddg-part-tcolor')?.value    || '#ffffff';
      p.sound     = qr('.ddg-part-sound')?.value     || '';
      p.sfx       = qr('.ddg-part-sfx')?.value       || '';
      p.scale     = Number(qr('.ddg-part-scale')?.value) || 1.0;
      p.x         = Number(qr('.ddg-part-x')?.value)     || 0;
      p.y         = Number(qr('.ddg-part-y')?.value)     || 0;
      p.mirror    = qr('.ddg-part-mirror')?.checked  || false;
      p.rotation  = Number(qr('.ddg-part-rot')?.value)   || 0;
    });
  }

  _addParticipant() {
    this._syncFromForm();
    this._data.participants.push(foundry.utils.deepClone(DEFAULT_PARTICIPANT));
    this.render();
  }

  _removeParticipant(idx) {
    this._data.participants.splice(idx, 1);
    this.render();
  }

  _browseParticipant(idx, type, field) {
    new FilePicker({ type, callback: path => {
      if (!this._data.participants[idx]) return;
      this._data.participants[idx][field] = path;
      const row = this.element.querySelector(`[data-part-idx="${idx}"]`);
      const inp = row?.querySelector(`.ddg-part-${field}`);
      if (inp) inp.value = path;
    }}).render(true);
  }

  async _fillFromActor(idx) {
    // Открыть picker актора
    if (!this._data.participants[idx]) return;
    const actors = game.actors.filter(a => a.type !== 'group');
    const dialog = new Dialog({
      title: 'Выбрать персонажа',
      content: `<select id="dd-actor-pick" style="width:100%;margin-top:8px">
        ${actors.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
      </select>`,
      buttons: {
        ok: { label: 'Выбрать', callback: html => {
          const id = html.querySelector('#dd-actor-pick')?.value;
          const a = game.actors.get(id);
          if (!a) return;
          this._data.participants[idx].img  = a.img;
          this._data.participants[idx].text = a.name;
          this.render();
        }},
        cancel: { label: 'Отмена' },
      },
    });
    dialog.render(true);
  }

  _fillFromTokens() {
    this._syncFromForm();
    const tokens = canvas.tokens.controlled;
    if (!tokens.length) { ui.notifications.warn('Выберите токены на сцене.'); return; }
    this._data.participants = tokens.map(t => ({
      ...foundry.utils.deepClone(DEFAULT_PARTICIPANT),
      img:  t.document.texture.src || t.actor?.img || 'icons/svg/mystery-man.svg',
      text: t.name,
    }));
    this.render();
  }

  _fillFromPlayers() {
    this._syncFromForm();
    const players = game.users.filter(u => u.active && !u.isGM && u.character);
    if (!players.length) { ui.notifications.warn('Нет активных игроков с персонажами.'); return; }
    this._data.participants = players.map(u => ({
      ...foundry.utils.deepClone(DEFAULT_PARTICIPANT),
      img:  u.character.img || 'icons/svg/mystery-man.svg',
      text: u.character.name,
    }));
    this.render();
  }

  async _play() {
    this._syncFromForm();
    const d = foundry.utils.deepClone(this._data);
    // Подставляем звук темы если не задан кастомный
    if (!d.finishSound) {
      const FINISH = {
        urban: SOUNDS_PATH + 'finish_urban.mp3',
        wanted: SOUNDS_PATH + 'finish_wanted.mp3',
        arcane: SOUNDS_PATH + 'fisnish_arcane.mp3',
      };
      d.finishSound = FINISH[d.theme] || '';
    }
    game.socket.emit(`module.${MODULE_ID}`, { type: 'groupIntro', data: d });
    DDGroupIntroManager.play(d);
  }

  async _savePreset() {
    this._syncFromForm();
    const name = this.element.querySelector('#ddg-preset-name')?.value?.trim();
    if (!name) return ui.notifications.warn('Введите название пресета.');
    await DDGroupPresets.save(name, this._data);
    ui.notifications.info(`Пресет «${name}» сохранён.`);
    this.render();
  }

  async _loadPreset() {
    const name = this.element.querySelector('#ddg-preset-select')?.value;
    if (!name) return;
    const p = DDGroupPresets.get(name);
    if (!p) return;
    this._data = { ...DEFAULT_GROUP_DATA, ...p, participants: foundry.utils.deepClone(p.participants || []) };
    this.render();
  }

  async _deletePreset() {
    const name = this.element.querySelector('#ddg-preset-select')?.value;
    if (!name) return;
    await DDGroupPresets.delete(name);
    ui.notifications.info(`Пресет «${name}» удалён.`);
    this.render();
  }

  _copyMacro() {
    this._syncFromForm();
    const presetName = this.element.querySelector('#ddg-preset-select')?.value;
    const code = presetName
      ? `// Групповое интро по пресету\ngame.dramaDirector.groupIntro.playPreset(${JSON.stringify(presetName)});`
      : `// Групповое интро с параметрами\ngame.dramaDirector.groupIntro.play(${JSON.stringify(this._data, null, 2)});`;
    navigator.clipboard.writeText(code)
      .then(() => ui.notifications.info('Код макроса скопирован!'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
export const DDGroupIntroAPI = {
  play(data)     { DDGroupIntroManager.play(data); game.socket.emit(`module.${MODULE_ID}`, { type: 'groupIntro', data }); },
  playPreset(name) {
    const p = DDGroupPresets.get(name);
    if (!p) { ui.notifications.warn(`Групповой пресет «${name}» не найден.`); return; }
    this.play(p);
  },
  stop()         { DDGroupIntroManager.stop(); },
  openPanel() {
    if (!DDGroupIntroPanel._instance) DDGroupIntroPanel._instance = new DDGroupIntroPanel();
    DDGroupIntroPanel._instance.render(true);
  },
  presets()      { return DDGroupPresets.list(); },
};

export function initGroupIntroSystem() {
  DDGroupPresets.register();
  game.socket.on(`module.${MODULE_ID}`, packet => {
    if (packet?.type === 'groupIntro') DDGroupIntroManager.play(packet.data);
  });
  Hooks.on('canvasReady', () => DDGroupIntroManager.initialize());
  if (document.getElementById('interface')) DDGroupIntroManager.initialize();
  if (!game.dramaDirector) game.dramaDirector = {};
  game.dramaDirector.groupIntro = DDGroupIntroAPI;
}
