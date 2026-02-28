/**
 * Drama Director — Visual Novel Mode
 * Updated: Added mouse control, depth mode, player control
 */

import { getLanguagePromise } from './drama-director.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = 'drama-director';
const SOCKET    = `module.${MODULE_ID}`;

function deepClone(o) { return foundry.utils.deepClone(o); }
function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Встроенные фоны ─────────────────────────────────────────────────────────
const _BUILTIN_BG_DEFS = [
  {
    id: 'citybank', _nameKey: 'DRAMADIRECTOR.vn.bg.citybank',
    variants: [
      { id: 'citybank-day',   _nameKey: 'DRAMADIRECTOR.vn.bg.citybankDay',   src: 'modules/drama-director/assets/vn-assets/CityBank.mp4' },
      { id: 'citybank-night', _nameKey: 'DRAMADIRECTOR.vn.bg.citybankNight', src: 'modules/drama-director/assets/vn-assets/CityBankNight.mp4' },
    ],
  },
  {
    id: 'forest', _nameKey: 'DRAMADIRECTOR.vn.bg.forest',
    variants: [
      { id: 'forest-day',   _nameKey: 'DRAMADIRECTOR.vn.bg.forestDay',   src: 'modules/drama-director/assets/vn-assets/Fungal-Forest.mp4' },
      { id: 'forest-night', _nameKey: 'DRAMADIRECTOR.vn.bg.forestNight', src: 'modules/drama-director/assets/vn-assets/Fungal-Forest-Night.mp4' },
    ],
  },
  {
    id: 'church', _nameKey: 'DRAMADIRECTOR.vn.bg.church',
    variants: [
      { id: 'church', _nameKey: 'DRAMADIRECTOR.vn.bg.church', src: 'modules/drama-director/assets/vn-assets/GrandChurchInterior.mp4' },
    ],
  },
  {
    id: 'sawmill', _nameKey: 'DRAMADIRECTOR.vn.bg.sawmill',
    variants: [
      { id: 'sawmill-day',   _nameKey: 'DRAMADIRECTOR.vn.bg.sawmillDay',   src: 'modules/drama-director/assets/vn-assets/Sawmill.mp4' },
      { id: 'sawmill-night', _nameKey: 'DRAMADIRECTOR.vn.bg.sawmillNight', src: 'modules/drama-director/assets/vn-assets/Sawmill_Night.mp4' },
    ],
  },
  {
    id: 'sewer', _nameKey: 'DRAMADIRECTOR.vn.bg.sewer',
    variants: [
      { id: 'sewer', _nameKey: 'DRAMADIRECTOR.vn.bg.sewer', src: 'modules/drama-director/assets/vn-assets/Sewer_Lair.mp4' },
    ],
  },
];

function _resolveBgNames(defs) {
  return defs.map(bg => ({
    ...bg,
    name: game.i18n.localize(bg._nameKey),
    _builtin: true,
    variants: bg.variants.map(v => ({ ...v, name: game.i18n.localize(v._nameKey) })),
  }));
}

export const VN_BUILTIN_BACKGROUNDS = _BUILTIN_BG_DEFS;

export function newChar(side = 'left', slot = 0) {
  return { id: uid(), name: '', title: '', img: '', activeImg: '', side, slot,
    playerId: null, active: false, visible: true, locked: false,
    scale: 1.0, baseScale: 1.0, mirror: false, nameColor: '#ffe066',
    x: 0, y: 0, zIndex: 0 };
}

export function newLayer(type = 'image') {
  return { id: uid(), type, name: '',
    src: '', text: '', locked: false,
    x: 760, y: 400, zIndex: 0,
    width: 400, height: 300, scale: 1, baseScale: 1.0,
    fontSize: 28, color: '#ffffff', fontFamily: 'inherit',
    textAlign: 'center', opacity: 1, visible: true };
}

export function newInteractiveImage() {
  return { id: uid(), name: '', src: '', locked: false,
    x: 900, y: 500, zIndex: 0,
    width: 200, height: 200, scale: 1, baseScale: 1.0, macroId: '',
    opacity: 1, visible: true };
}

// ─── Состояние ───────────────────────────────────────────────────────────────
const _state = {
  open: false,
  background: '',
  bgFit: 'cover',
  bgColor: '#0a0a14',
  dimBg: 0.0,
  chars: [],
  dialogue: { visible: false, speakerName: '', speakerColor: '#ffe066', text: '', _subtitleActive: false },
  layers: [],
  interactiveImages: [],
  // Новые флаги управления
  mouseControl: false,
  depthMode: false,
  playerControl: false,
  depthScaleMultiplier: 1.0,
  depthYMultiplier: 1.0,
  horizonLine: false,
  horizonY: 30,
};

// ─── Глобальные z-index базы ─────────────────────────────────────────────────
const ZINDEX_BASE = {
  ALL: 100,
};

// ─── Drag State ─────────────────────────────────────────────────────────────
let _dragState = {
  active: false,
  element: null,
  type: null,
  id: null,
  startX: 0,
  startY: 0,
  elemStartX: 0,
  elemStartY: 0,
  elemStartZ: 0,
  elemStartScale: 1,
  elemBaseScale: 1,
};

// ─── Horizon Line State ──────────────────────────────────────────────────────
let _horizonY = null; // Фиксированная линия горизонта (Y в пикселях стейджа)

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNOverlay {
  static ID = 'dd-vn-overlay';
  static _lastBg = '';
  static _hoveredCharId = null;

  // ─── Scroll-to-select state ──────────────────────────────────────────────
  // При наведении мыши на сцену + прокрутка колесом → цикл по объектам под курсором
  static _scrollSelect = {
    active: false,       // включён ли режим выбора
    elemId: null,        // id выбранного элемента
    elemType: null,      // 'char' | 'layer' | 'interactive'
    candidates: [],      // [{id, type, zIndex, el}] — все элементы под курсором, по z desc
    curIdx: -1,          // текущий индекс в candidates
    mouseX: 0,
    mouseY: 0,
    hideTimer: null,
  };

  static build() {
    if (document.getElementById(this.ID)) return;
    const el = document.createElement('div');
    el.id = this.ID;
    el.innerHTML = `
      <div class="vn-bg-layer" id="vn-bg-layer"></div>
      <div class="vn-stage" id="vn-stage">
        <div id="vn-unified-container" class="vn-unified-container"></div>
      </div>
      <div class="vn-name-bar" id="vn-name-bar" style="display:none"></div>
      <div class="vn-dialogue-box" id="vn-dialogue" style="display:none">
        <div class="vn-dialogue-inner">
          <div class="vn-speaker" id="vn-speaker"></div>
          <div class="vn-text" id="vn-text"></div>
          <div class="vn-subtitle-line" id="vn-subtitle-line" style="display:none">
            <span class="vn-sub-name" id="vn-sub-name"></span>
            <span class="vn-sub-text" id="vn-sub-text"></span>
          </div>
          <div class="vn-subtitles-container" id="vn-subtitles-container" style="display:none"></div>
        </div>
      </div>
      <div class="vn-gm-controls" id="vn-gm-bar" style="display:none">
        <span class="vn-gm-label"><i class="fas fa-book-open"></i> VN</span>
        <button id="vn-ctrl-panel" title="${game.i18n.localize('DRAMADIRECTOR.vn.overlay.settings')}"><i class="fas fa-cog"></i></button>
        <button id="vn-ctrl-stop" class="vn-btn-danger"><i class="fas fa-stop"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.overlay.close')}</button>
      </div>
      <div class="vn-quick-bar" id="vn-quick-bar" style="display:none">
        <select id="vn-quick-lang" class="vn-quick-lang-sel" title="${game.i18n.localize('DRAMADIRECTOR.vn.micLanguage')}">
          <option value="ru-RU">RU</option>
          <option value="en-US">EN</option>
          <option value="de-DE">DE</option>
          <option value="fr-FR">FR</option>
          <option value="ja-JP">JP</option>
        </select>
        <div class="vn-quick-sep"></div>
        <div class="vn-mic-indicator" id="vn-mic-indicator">
          <button id="vn-mic-toggle" class="vn-quick-btn" title="${game.i18n.localize('DRAMADIRECTOR.vn.overlay.mic')}">
            <i class="fas fa-microphone"></i>
          </button>
          <span class="vn-mic-dot"></span>
        </div>
        <div class="vn-quick-sep"></div>
        <button class="vn-quick-btn" data-sidebar-tab="chat" title="${game.i18n.localize('DRAMADIRECTOR.vn.overlay.chat')}">
          <i class="fas fa-comments"></i>
        </button>
        <button class="vn-quick-btn" data-sidebar-tab="actors" title="${game.i18n.localize('DRAMADIRECTOR.vn.overlay.actors')}">
          <i class="fas fa-users"></i>
        </button>
        <button class="vn-quick-btn" data-sidebar-tab="scenes" title="${game.i18n.localize('DRAMADIRECTOR.vn.overlay.scenes')}">
          <i class="fas fa-map"></i>
        </button>
        <button class="vn-quick-btn" data-sidebar-tab="playlists" title="${game.i18n.localize('DRAMADIRECTOR.vn.overlay.playlists')}">
          <i class="fas fa-music"></i>
        </button>
        <button class="vn-quick-btn" data-sidebar-tab="items" title="${game.i18n.localize('DRAMADIRECTOR.vn.overlay.items')}">
          <i class="fas fa-suitcase"></i>
        </button>
      </div>
      <div id="vn-gm-left-bar" style="display:none"></div>`;
    document.getElementById('interface')?.appendChild(el);

    el.querySelector('#vn-ctrl-stop')?.addEventListener('click', () => DDVNManager.stop(true));
    el.querySelector('#vn-ctrl-panel')?.addEventListener('click', () => DDVNApi.openPanel());

    el.querySelectorAll('[data-sidebar-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.sidebarTab;
        const tab = ui[tabName];
        if (tab?.renderPopout) tab.renderPopout();
        else if (tab?.popOut !== undefined) tab.renderPopout?.();
      });
    });

    el.querySelector('#vn-mic-toggle')?.addEventListener('click', async () => {
      if (DDVNMic._active) DDVNMic.stop();
      else await DDVNMic.start();
      this.updateMicIndicator();
    });

    el.querySelector('#vn-quick-lang')?.addEventListener('change', (e) => {
      const lang = e.target.value;
      DDVNMic.lang = lang;
      const panelLang = document.getElementById('vn-mic-lang');
      if (panelLang) panelLang.value = lang;
      if (DDVNMic._active) { DDVNMic.stop(); DDVNMic.start(); }
    });

    window.addEventListener('resize', () => this.fitStage());
    this.fitStage();
    this._initScrollSelect();
  }

  // ─── Scroll-to-select: колесо мыши для выбора объектов под курсором ─────────
  static _initScrollSelect() {
    const stage = document.getElementById('vn-stage');
    if (!stage) return;
    const ss = this._scrollSelect;

    // Уход со сцены → снять подсветку
    stage.addEventListener('mouseleave', () => {
      clearTimeout(ss.hideTimer);
      ss.hideTimer = setTimeout(() => this._clearScrollSelect(), 600);
    });
    stage.addEventListener('mouseenter', () => clearTimeout(ss.hideTimer));

    // Scroll без Ctrl → scroll-to-select
    stage.addEventListener('wheel', (e) => {
      if (!_state.mouseControl) return;
      if (!game.user?.isGM)     return;
      if (e.ctrlKey)            return; // Ctrl+scroll = baseScale
      if (_dragState.active)    return;

      e.preventDefault();
      e.stopPropagation();

      const hits = this._getElementsAt(e.clientX, e.clientY);
      if (!hits.length) { this._clearScrollSelect(); return; }

      const hitKey = hits.map(h => h.type + h.id).join('|');
      if (ss._lastHitKey !== hitKey) {
        // Курсор попал на новую группу объектов — начинаем с верхнего
        ss._lastHitKey  = hitKey;
        ss.candidates   = hits; // отсортированы по z убыванию (верхний первый)
        ss.curIdx       = 0;
      } else {
        // Крутим по циклу: вниз → глубже (следующий), вверх → ближе
        const dir = e.deltaY > 0 ? 1 : -1;
        ss.curIdx = (ss.curIdx + dir + hits.length) % hits.length;
      }

      const chosen   = hits[ss.curIdx];
      ss.active      = true;
      ss.elemId      = chosen.id;
      ss.elemType    = chosen.type;

      this._applyScrollHighlight(chosen.id, chosen.type);
      this._showScrollToast(hits, ss.curIdx);

      clearTimeout(ss.hideTimer);
      ss.hideTimer = setTimeout(() => this._clearScrollSelect(), 2500);
    }, { passive: false });

    // ЛКМ по сцене: если есть активный выбор → начать drag на нём
    stage.addEventListener('mousedown', (e) => {
      if (e.button !== 0)    return;
      if (!ss.active)        return;
      if (_dragState.active) return;

      const item = this._getItemById(ss.elemType, ss.elemId);
      if (!item || item.locked)               return;
      if (!this._canDragElement(item, _state)) return;

      const container = document.getElementById('vn-unified-container');
      if (!container) return;
      const selector =
        ss.elemType === 'char'        ? `[data-char-id="${ss.elemId}"]`  :
        ss.elemType === 'layer'       ? `[data-layer-id="${ss.elemId}"]` :
                                        `[data-img-id="${ss.elemId}"]`;
      const selEl = container.querySelector(selector);
      if (!selEl) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const stageEl    = document.getElementById('vn-stage');
      const stageRect  = stageEl?.getBoundingClientRect();
      const stageScale = stageRect
        ? Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
        : 1;

      _dragState = {
        active: true,
        element: selEl,
        type: ss.elemType,
        id: ss.elemId,
        startX: e.clientX,
        startY: e.clientY,
        elemStartX: item.x || 0,
        elemStartY: item.y || 0,
        elemStartZ: item.zIndex || 0,
        elemStartScale: item.scale || 1,
        elemBaseScale: item.baseScale ?? item.scale ?? 1,
        stageScale,
      };

      selEl.style.cursor = 'grabbing';
      selEl.style.zIndex = (parseInt(selEl.style.zIndex) || 100) + 1000;

      document.addEventListener('mousemove', this._onDragMove);
      document.addEventListener('mouseup',   this._onDragEnd);

      this._clearScrollSelect();
    }, true);
  }

  // Собирает все DOM-элементы сцены под точкой экрана, сортирует по z-index убыванию
  static _getElementsAt(clientX, clientY) {
    const container = document.getElementById('vn-unified-container');
    if (!container) return [];

    // Временно делаем все элементы pointer-events:none чтобы elementFromPoint работал насквозь
    const children = Array.from(container.children);
    const results  = [];

    // Используем elementsFromPoint для получения всех слоёв
    const allHit = document.elementsFromPoint(clientX, clientY);

    for (const hitEl of allHit) {
      // Ищем ближайший родительский элемент с data-elem-type
      let el = hitEl;
      while (el && el !== container) {
        if (el.dataset?.elemType) break;
        el = el.parentElement;
      }
      if (!el || !el.dataset?.elemType) continue;
      if (results.find(r => r.el === el)) continue; // дубликат

      const type = el.dataset.elemType;
      const id   =
        type === 'char'        ? el.dataset.charId  :
        type === 'layer'       ? el.dataset.layerId :
                                 el.dataset.imgId;
      if (!id) continue;

      const zIndex = parseInt(el.style.zIndex) || 0;
      results.push({ id, type, zIndex, el });
    }

    // Сортируем по z убыванию (верхний — первый)
    results.sort((a, b) => b.zIndex - a.zIndex);
    return results;
  }

  // Помощник: достаёт объект данных по type+id из _state
  static _getItemById(type, id) {
    if (type === 'char')        return _state.chars.find(c => c.id === id) ?? null;
    if (type === 'layer')       return _state.layers.find(l => l.id === id) ?? null;
    if (type === 'interactive') return _state.interactiveImages.find(i => i.id === id) ?? null;
    return null;
  }

  // Подсвечивает выбранный элемент белым ореолом
  static _applyScrollHighlight(id, type) {
    const container = document.getElementById('vn-unified-container');
    if (!container) return;

    // Снимаем прошлое выделение
    container.querySelectorAll('.vn-scroll-selected').forEach(el => {
      el.classList.remove('vn-scroll-selected');
    });

    const selector =
      type === 'char'        ? `[data-char-id="${id}"]`  :
      type === 'layer'       ? `[data-layer-id="${id}"]` :
                               `[data-img-id="${id}"]`;
    const el = container.querySelector(selector);
    if (el) el.classList.add('vn-scroll-selected');
  }

  // Показывает небольшой тост со списком объектов и стрелкой на текущий
  static _showScrollToast(candidates, curIdx) {
    let toast = document.getElementById('vn-scroll-select-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vn-scroll-select-toast';
      toast.style.cssText = [
        'position:fixed', 'bottom:72px', 'left:50%',
        'transform:translateX(-50%)',
        'background:rgba(10,10,20,.88)',
        'border:1px solid rgba(255,255,255,.18)',
        'border-radius:10px',
        'padding:8px 14px 6px',
        'font-size:12px',
        'font-family:monospace',
        'color:#e8e8f0',
        'pointer-events:none',
        'z-index:99999',
        'backdrop-filter:blur(6px)',
        'transition:opacity .25s',
        'white-space:nowrap',
        'min-width:160px',
        'text-align:left',
        'box-shadow:0 4px 24px rgba(0,0,0,.5)',
      ].join(';');
      document.body.appendChild(toast);
    }

    const icon = t =>
      t === 'char'        ? '👤' :
      t === 'layer'       ? '🖼' :
                            '🖱';

    const lines = candidates.map((c, i) => {
      const item  = this._getItemById(c.type, c.id);
      const label = item?.name || c.type;
      const z     = item?.zIndex ?? 0;
      const isChosen = i === curIdx;
      const arrow = isChosen ? '<span style="color:#fff;font-weight:bold">▶ </span>' : '&nbsp;&nbsp;';
      const style = isChosen
        ? 'color:#fff;background:rgba(255,255,255,.1);border-radius:4px;padding:1px 4px;'
        : 'color:#aaa;padding:1px 4px;';
      return `<div style="${style}">${arrow}${icon(c.type)} ${label} <span style="color:#666;font-size:10px">z:${z}</span></div>`;
    }).join('');

    const hint = '<div style="color:#555;font-size:10px;margin-top:4px;border-top:1px solid rgba(255,255,255,.08);padding-top:4px;">🖱 scroll — выбор · ЛКМ — двигать</div>';
    toast.innerHTML = lines + hint;
    toast.style.opacity = '1';
  }

  // Снимает выделение и прячет тост
  static _clearScrollSelect() {
    const ss = this._scrollSelect;
    ss.active    = false;
    ss.elemId    = null;
    ss.elemType  = null;
    ss.candidates = [];
    ss.curIdx    = -1;
    ss._lastHitKey = null;

    const container = document.getElementById('vn-unified-container');
    container?.querySelectorAll('.vn-scroll-selected').forEach(el => {
      el.classList.remove('vn-scroll-selected');
    });

    const toast = document.getElementById('vn-scroll-select-toast');
    if (toast) {
      toast.style.opacity = '0';
      clearTimeout(toast._removeTimer);
      toast._removeTimer = setTimeout(() => toast.remove(), 280);
    }
  }

  static fitStage() {
    const stage = document.getElementById('vn-stage');
    if (!stage) return;
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
  }

  static clearStage() {
    const container = document.getElementById('vn-unified-container');
    if (container) container.innerHTML = '';
    const dialogue = document.getElementById('vn-dialogue');
    if (dialogue) dialogue.style.display = 'none';
    this.hideAllSubtitles();
  }

  static apply(state) {
    let overlay = document.getElementById(this.ID);
    if (!overlay) { this.build(); overlay = document.getElementById(this.ID); }
    if (!overlay) { console.error('DD VN | Cannot create overlay!'); return; }

    if (state.open) overlay.classList.add('interactive');
    else overlay.classList.remove('interactive');
    this._renderBg(state);
    this._renderAllElements(state);
    this._renderDialogue(state.dialogue);
    this._renderNameBar(state.chars || []);

    const gmBar = document.getElementById('vn-gm-bar');
    if (gmBar) gmBar.style.display = (state.open && game.user?.isGM) ? 'flex' : 'none';
    
    const quickBar = document.getElementById('vn-quick-bar');
    if (quickBar) quickBar.style.display = state.open ? 'flex' : 'none';
    this.updateMicIndicator();

    DDVNGMBar.update(state);
  }

  static updateMicIndicator() {
    const indicator = document.getElementById('vn-mic-indicator');
    const btn = document.getElementById('vn-mic-toggle');
    const dot = indicator?.querySelector('.vn-mic-dot');
    if (!btn || !dot) return;
    
    if (DDVNMic._active) {
      btn.classList.add('vn-mic-on');
      dot.classList.add('vn-mic-dot-on');
      btn.querySelector('i')?.classList.replace('fa-microphone-slash', 'fa-microphone');
    } else {
      btn.classList.remove('vn-mic-on');
      dot.classList.remove('vn-mic-dot-on');
      btn.querySelector('i')?.classList.replace('fa-microphone', 'fa-microphone-slash');
    }
    
    const quickLang = document.getElementById('vn-quick-lang');
    if (quickLang && DDVNMic.lang) quickLang.value = DDVNMic.lang;
    const panelLang = document.getElementById('vn-mic-lang');
    if (panelLang && DDVNMic.lang) panelLang.value = DDVNMic.lang;
  }

  static ensureOpen() {
    if (!_state.open) {
      _state.open = true;
      DDVNManager.broadcast();
    }
  }

  static _renderBg(state) {
    const bg = document.getElementById('vn-bg-layer');
    if (!bg) return;
    
    const currentSrc = bg.dataset.src || '';
    const stateBg = state.background || '';
    
    if (stateBg) this._lastBg = stateBg;
    
    bg.style.backgroundColor = state.bgColor || '#0a0a14';
    bg.style.setProperty('--vn-dim', String(state.dimBg || 0));

    let bgToRender = stateBg || this._lastBg || currentSrc;
    
    if (!bgToRender && !currentSrc && !this._lastBg) return;
    
    if (bgToRender && bgToRender !== currentSrc) {
      const isVid = /\.(webm|mp4|ogv)$/i.test(bgToRender);
      if (isVid) {
        bg.dataset.src = bgToRender;
        bg.style.backgroundImage = 'none';
        bg.innerHTML = `<video autoplay loop muted playsinline
          style="width:100%;height:100%;object-fit:${state.bgFit || 'cover'}"
          src="${bgToRender}"></video>`;
      } else {
        bg.dataset.src = bgToRender;
        bg.innerHTML = '';
        bg.style.backgroundImage = `url('${bgToRender}')`;
        bg.style.backgroundSize = state.bgFit || 'cover';
        bg.style.backgroundPosition = 'center';
      }
    }
  }

  static _renderAllElements(state) {
    const container = document.getElementById('vn-unified-container');
    if (!container) return;
    container.innerHTML = '';

    const chars = state.chars || [];
    const layers = state.layers || [];
    const interactiveImages = state.interactiveImages || [];

    const hasActive = chars.some(c => c && c.active && c.visible !== false);
    const allElements = [];

    // ─── Персонажи ───
    const leftChars = chars.filter(c => c && c.side === 'left' && c.visible !== false).sort((a, b) => (a.slot || 0) - (b.slot || 0));
    const centerChars = chars.filter(c => c && c.side === 'center' && c.visible !== false).sort((a, b) => (a.slot || 0) - (b.slot || 0));
    const rightChars = chars.filter(c => c && c.side === 'right' && c.visible !== false).sort((a, b) => (a.slot || 0) - (b.slot || 0));

    const calcCharBasePos = (side, slot, totalOnSide) => {
      const basePositions = {
        left: { x: 250, y: 1080 },
        center: { x: 960, y: 1080 },
        right: { x: 1670, y: 1080 }
      };
      const base = basePositions[side];
      
      let baseWidth = side === 'center' ? 380 : 420;
      let overlap = 0;
      
      if (totalOnSide <= 3) { baseWidth = side === 'center' ? 350 : 420; overlap = 0; }
      else if (totalOnSide <= 5) { baseWidth = side === 'center' ? 280 : 350; overlap = 30; }
      else if (totalOnSide <= 8) { baseWidth = side === 'center' ? 220 : 280; overlap = 50; }
      else { baseWidth = side === 'center' ? 180 : 220; overlap = 70; }

      const slotOffset = slot * (baseWidth - overlap);
      
      let x = base.x;
      if (side === 'left') x = 100 + slotOffset;
      else if (side === 'center') x = 960 - (totalOnSide * (baseWidth - overlap)) / 2 + slotOffset;
      else if (side === 'right') x = 1820 - slotOffset - baseWidth;

      return { x, y: base.y, width: baseWidth };
    };

    const addCharElements = (charList, side) => {
      const total = charList.length;
      charList.forEach((char, idx) => {
        const basePos = calcCharBasePos(side, idx, total);
        allElements.push({
          type: 'char',
          data: char,
          zIndex: ZINDEX_BASE.ALL + (char.zIndex ?? 0),
          baseX: basePos.x,
          baseY: basePos.y,
          width: basePos.width,
          side,
          slot: idx,
          totalOnSide: total
        });
      });
    };

    addCharElements(leftChars, 'left');
    addCharElements(centerChars, 'center');
    addCharElements(rightChars, 'right');

    layers.filter(l => l.visible !== false).forEach(layer => {
      allElements.push({ type: 'layer', data: layer, zIndex: ZINDEX_BASE.ALL + (layer.zIndex ?? 0) });
    });

    interactiveImages.filter(img => img.visible !== false && img.src).forEach(image => {
      allElements.push({ type: 'interactive', data: image, zIndex: ZINDEX_BASE.ALL + (image.zIndex ?? 0) });
    });

    allElements.sort((a, b) => a.zIndex - b.zIndex);

    // ─── Рендерим все элементы ───
    allElements.forEach(elem => {
      const el = document.createElement('div');
      const isMouseControl = state.mouseControl;
      const canDrag = this._canDragElement(elem.data, state);

      if (elem.type === 'char') {
        const char = elem.data;
        const visClass = !hasActive ? 'vn-char-all-visible' : (char.active ? 'vn-char-active' : 'vn-char-dim');
        const charColor = char.nameColor || '#ffe066';
        const charScale = char.scale || 1;
        const offsetX = char.x || 0;
        const offsetY = char.y || 0;
        const mirror = elem.side === 'center' ? (char.mirror ? -1 : 1) : ((char.mirror ? 1 : 0) ^ (elem.side === 'right' ? 1 : 0));

        el.className = `vn-char ${visClass}${char.locked ? ' vn-locked' : ''}`;
        el.dataset.charId = char.id;
        el.dataset.elemType = 'char';
        el.style.cssText = `position:absolute;left:${elem.baseX + offsetX}px;bottom:0;width:${elem.width}px;height:900px;z-index:${elem.zIndex};`;

        const hasMainImg = char.img?.trim();
        const hasActiveImg = char.activeImg?.trim();
        const isActive = char.active;
        const imgId = `char-img-${char.id}-${Date.now()}`;

        let portraitHtml;
        if (hasMainImg || hasActiveImg) {
          const mainSrc = hasMainImg ? char.img : char.activeImg;
          if (hasActiveImg && hasMainImg) {
            portraitHtml = `
              <div class="vn-char-img-wrap" id="${imgId}-wrap">
                <img class="vn-char-img-base ${isActive ? 'vn-img-hidden' : ''}" id="${imgId}-base" src="${char.img}" alt="${char.name || ''}" style="pointer-events:auto;cursor:${isMouseControl && canDrag && !char.locked ? 'grab' : 'pointer'};" onerror="this.style.display='none'"/>
                <img class="vn-char-img-active ${isActive ? 'vn-img-visible' : ''}" id="${imgId}-active" src="${char.activeImg}" alt="${char.name || ''}" style="pointer-events:auto;cursor:${isMouseControl && canDrag && !char.locked ? 'grab' : 'pointer'};" onerror="this.style.display='none'"/>
              </div>`;
          } else {
            portraitHtml = `<img id="${imgId}" src="${mainSrc}" alt="${char.name || ''}" style="pointer-events:auto;cursor:${isMouseControl && canDrag && !char.locked ? 'grab' : 'pointer'};" onerror="this.parentElement.innerHTML='<div class=\\'vn-char-empty\\'><i class=\\'fas fa-user\\'></i></div>'"/>`;
          }
        } else {
          portraitHtml = `<div class="vn-char-empty"><i class="fas fa-user"></i></div>`;
        }

        const glowStyle = char.active ? `filter: drop-shadow(0 0 20px ${charColor}) drop-shadow(0 0 40px ${charColor}80);` : '';

        el.innerHTML = `
          <div class="vn-char-wrapper" style="transform:translateY(${offsetY}px);">
            <div class="vn-char-portrait" style="transform-origin:bottom center;transform:scaleX(${mirror ? -1 : 1}) scale(${charScale});${glowStyle}">
              ${portraitHtml}
              ${char.locked ? '<div class="vn-lock-badge"><i class="fas fa-lock"></i></div>' : ''}
            </div>
          </div>`;

        // Hover tracking
        const imgs = el.querySelectorAll('img');
        imgs.forEach(img => {
          img.addEventListener('mouseenter', () => {
            DDVNOverlay._hoveredCharId = char.id;
            DDVNOverlay._renderNameBar(_state.chars || []);
          });
          img.addEventListener('mouseleave', () => {
            DDVNOverlay._hoveredCharId = null;
            DDVNOverlay._renderNameBar(_state.chars || []);
          });
        });

        // Drag & Drop (заблокированные получают только ПКМ для разблокировки GM-ом)
        if (isMouseControl && canDrag && !char.locked) {
          this._setupDrag(el, 'char', char.id);
        } else if (isMouseControl && game.user?.isGM && char.locked) {
          this._setupContextMenu(el, 'char', char.id);
        }

      } else if (elem.type === 'layer') {
        const layer = elem.data;
        const layerScale = layer.scale || 1;
        const layerWidth = (layer.width || 300) * layerScale;
        const layerHeight = (layer.height || 200) * layerScale;
        el.className = `vn-layer-item${layer.locked ? ' vn-locked' : ''}`;
        el.dataset.layerId = layer.id;
        el.dataset.elemType = 'layer';
        el.style.cssText = `position:absolute;left:${layer.x||0}px;top:${layer.y||0}px;z-index:${elem.zIndex};opacity:${layer.opacity??1};`;
        
        if (layer.type === 'image' && layer.src) {
          el.innerHTML = `<img src="${layer.src}" style="width:${layerWidth}px;height:${layerHeight}px;object-fit:contain;display:block;cursor:${isMouseControl && !layer.locked ? 'grab' : 'default'};" onerror="this.style.display='none'"/>`;
        } else if (layer.type === 'text' && layer.text) {
          el.innerHTML = `<div style="width:${(layer.width||400)*layerScale}px;font-size:${(layer.fontSize||28)*layerScale}px;color:${layer.color||'#fff'};font-family:${layer.fontFamily||'inherit'};text-align:${layer.textAlign||'left'};text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 20px rgba(0,0,0,.8);line-height:1.4;white-space:pre-wrap;cursor:${isMouseControl && !layer.locked ? 'grab' : 'default'};">${layer.text}</div>`;
        }
        
        if (layer.locked) {
          el.innerHTML += '<div class="vn-lock-badge"><i class="fas fa-lock"></i></div>';
        }

        if (isMouseControl && !layer.locked) {
          this._setupDrag(el, 'layer', layer.id);
        } else if (isMouseControl && game.user?.isGM && layer.locked) {
          this._setupContextMenu(el, 'layer', layer.id);
        }

      } else if (elem.type === 'interactive') {
        const image = elem.data;
        const imgScale = image.scale || 1;
        const imgWidth = (image.width || 200) * imgScale;
        const imgHeight = (image.height || 200) * imgScale;
        el.className = `vn-interactive-img-item${image.locked ? ' vn-locked' : ''}`;
        el.dataset.imgId = image.id;
        el.dataset.elemType = 'interactive';
        el.style.cssText = `position:absolute;left:${image.x||0}px;top:${image.y||0}px;z-index:${elem.zIndex};opacity:${image.opacity??1};width:${imgWidth}px;height:${imgHeight}px;cursor:${isMouseControl && !image.locked ? 'grab' : 'pointer'};transition:filter .2s,transform .1s;`;
        el.innerHTML = `<img src="${image.src}" style="width:100%;height:100%;object-fit:contain;display:block;" title="${image.name||''}" onerror="this.style.display='none'"/>`;
        
        if (image.macroId && !isMouseControl) {
          el.addEventListener('click', () => {
            const macro = game.macros?.get(image.macroId) ?? game.macros?.getName(image.macroId);
            if (macro) macro.execute();
            else ui.notifications?.warn(`Macro not found: ${image.macroId}`);
          });
          el.addEventListener('mouseenter', () => { el.style.filter = 'brightness(1.2) drop-shadow(0 0 12px rgba(255,220,60,.6))'; el.style.transform = 'scale(1.05)'; });
          el.addEventListener('mouseleave', () => { el.style.filter = ''; el.style.transform = ''; });
        }

        if (image.locked) {
          el.innerHTML += '<div class="vn-lock-badge"><i class="fas fa-lock"></i></div>';
        }

        if (isMouseControl && !image.locked) {
          this._setupDrag(el, 'interactive', image.id);
        } else if (isMouseControl && game.user?.isGM && image.locked) {
          this._setupContextMenu(el, 'interactive', image.id);
        }
      }

      container.appendChild(el);
    });

    console.log('DD VN | Rendered elements:', allElements.length);
  }

  static _canDragElement(elemData, state) {
    if (!state.mouseControl) return false;
    if (game.user?.isGM) return true;
    if (!state.playerControl) return false;
    // Игроки могут двигать только свои персонажи
    if (elemData.playerId === game.userId) return true;
    return false;
  }

  // ─── Perspective factor for depth mode ────────────────────────────────────
  // Returns a value [0.02..2.0] representing how large the object should appear
  // based on its Y position relative to the horizon line.
  // At the horizon → ~0, at the bottom (y=1080) → scaleMult.
  static _perspectiveFactor(y, state = _state) {
    const horizonRef = (state.horizonLine && _horizonY !== null)
      ? _horizonY
      : Math.round((state.horizonY ?? 30) / 100 * 1080);
    const stageH = 1080;
    const usableH = Math.max(1, stageH - horizonRef);
    const t = (y - horizonRef) / usableH; // 0 at horizon, 1 at bottom
    const scaleMult = state.depthScaleMultiplier || 1.0;
    return Math.max(0.02, Math.min(3.0, t * scaleMult));
  }

  // Персонажи позиционируются от bottom:0 — их Y это translateY смещение (0 = низ сцены).
  // Для перспективы нужен Y от верха: effectiveY = stageH + char.y
  // Слои и интерактивные — top-based, их Y уже правильный.
  static _depthY(type, item) {
    if (type === 'char') return 1080 + (item.y || 0);
    return item.y || 0;
  }

  static _depthZ(type, item) {
    const ey = this._depthY(type, item);
    return Math.max(-50, Math.min(100, Math.round((ey / 1080) * 100)));
  }

  // Только контекстное меню (ПКМ) — для заблокированных элементов, чтобы GM мог разблокировать
  static _setupContextMenu(el, type, id) {
    el.style.pointerEvents = 'auto';
    el.addEventListener('contextmenu', (e) => {
      if (!game.user?.isGM) return;
      if (!_state.mouseControl) return;
      e.preventDefault();
      e.stopPropagation();
      DDVNManager.toggleLock(type, id);
    });
    this._setupBaseScaleScroll(el, type, id);
  }

  // ─── Ctrl+Scroll для baseScale ────────────────────────────────────────────
  static _setupBaseScaleScroll(el, type, id) {
    el.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      if (!game.user?.isGM) return;
      if (!_state.mouseControl) return;
      e.preventDefault();
      e.stopPropagation();

      const state = DDVNManager.getState();
      let item = null;
      if (type === 'char') item = state.chars.find(c => c.id === id);
      else if (type === 'layer') item = state.layers.find(l => l.id === id);
      else if (type === 'interactive') item = state.interactiveImages.find(i => i.id === id);
      if (!item) return;

      const step = e.deltaY < 0 ? 0.05 : -0.05;
      item.baseScale = parseFloat(Math.max(0.05, Math.min(10, (item.baseScale || 1) + step)).toFixed(2));

      // В режиме глубины сразу пересчитываем scale
      if (_state.depthMode) {
        item.scale = parseFloat((item.baseScale * DDVNOverlay._perspectiveFactor(item.y || 0)).toFixed(3));
      } else {
        item.scale = item.baseScale;
      }

      DDVNManager.broadcast();
      // Показываем мини-тост с текущим baseScale
      const toast = document.getElementById('vn-basescale-toast') || (() => {
        const t = document.createElement('div');
        t.id = 'vn-basescale-toast';
        t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#ffe066;padding:6px 16px;border-radius:20px;font-size:13px;font-family:monospace;pointer-events:none;z-index:99999;transition:opacity .3s;';
        document.body.appendChild(t);
        return t;
      })();
      toast.textContent = `Base Scale: ${item.baseScale}×`;
      toast.style.opacity = '1';
      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1200);
    }, { passive: false });
  }

  static _setupDrag(el, type, id) {
    el.style.pointerEvents = 'auto';
    
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Только ЛКМ
      
      e.preventDefault();
      e.stopPropagation();
      
      const state = DDVNManager.getState();
      let item = null;
      
      if (type === 'char') item = state.chars.find(c => c.id === id);
      else if (type === 'layer') item = state.layers.find(l => l.id === id);
      else if (type === 'interactive') item = state.interactiveImages.find(i => i.id === id);
      
      if (!item || item.locked) return;
      
      // Проверяем право на перетаскивание
      if (!this._canDragElement(item, state)) return;
      
      const rect = el.getBoundingClientRect();
      const stage = document.getElementById('vn-stage');
      const stageRect = stage?.getBoundingClientRect();
      const stageScale = stageRect ? Math.min(window.innerWidth / 1920, window.innerHeight / 1080) : 1;
      
      _dragState = {
        active: true,
        element: el,
        type: type,
        id: id,
        startX: e.clientX,
        startY: e.clientY,
        elemStartX: item.x || 0,
        elemStartY: item.y || 0,
        elemStartZ: item.zIndex || 0,
        elemStartScale: item.scale || 1,
        elemBaseScale: item.baseScale ?? item.scale ?? 1,
        stageScale: stageScale,
      };
      
      el.style.cursor = 'grabbing';
      el.style.zIndex = (parseInt(el.style.zIndex) || 100) + 1000;
      
      document.addEventListener('mousemove', this._onDragMove);
      document.addEventListener('mouseup', this._onDragEnd);
    });
    
    // ПКМ для блокировки (только GM)
    el.addEventListener('contextmenu', (e) => {
      if (!game.user?.isGM) return;
      if (!_state.mouseControl) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      DDVNManager.toggleLock(type, id);
    });

    // Ctrl+Scroll для baseScale (только GM)
    this._setupBaseScaleScroll(el, type, id);
  }

  static _onDragMove = (e) => {
    if (!_dragState.active) return;
    
    const dx = (e.clientX - _dragState.startX) / _dragState.stageScale;
    const dy = (e.clientY - _dragState.startY) / _dragState.stageScale;
    
    let newX = _dragState.elemStartX;
    let newY = _dragState.elemStartY;
    let newZ = _dragState.elemStartZ;
    let newScale = _dragState.elemStartScale;

    // Режим глубины: Y → масштаб + Z-index автоматически
    if (_state.depthMode) {
      const yMult = _state.depthYMultiplier || 1.0;

      // Движение по Y с множителем
      newY = _dragState.elemStartY + dy * yMult;

      // Ограничение горизонтом (для персонажей горизонт тоже в effectiveY пространстве)
      if (_state.horizonLine && _horizonY !== null) {
        if (_dragState.type === 'char') {
          // effectiveY = 1080 + newY, ограничиваем effectiveY >= _horizonY
          const minY = _horizonY - 1080;
          newY = Math.max(minY, newY);
        } else {
          newY = Math.max(_horizonY, newY);
        }
      }

      // effectiveY для перспективы
      const ey = _dragState.type === 'char' ? 1080 + newY : newY;

      // Масштаб = baseScale × perspectiveFactor(effectiveY)
      const baseScale = _dragState.elemBaseScale;
      newScale = parseFloat((baseScale * DDVNOverlay._perspectiveFactor(ey)).toFixed(3));

      // Z-index из effectiveY
      const stageH = 1080;
      newZ = Math.max(-50, Math.min(100, Math.round((ey / stageH) * 100)));

      // X движется как обычно
      newX = _dragState.elemStartX + dx;
    } else {
      // Обычный режим: движение по X и Y
      newX = _dragState.elemStartX + dx;
      newY = _dragState.elemStartY + dy;
    }
    
    // Ограничения
    newX = Math.max(-1000, Math.min(2000, newX));
    newY = Math.max(-500, Math.min(1500, newY));
    newZ = Math.max(-50, Math.min(100, newZ));
    
    // Обновляем элемент
    DDVNManager.updateElementPosition(_dragState.type, _dragState.id, {
      x: Math.round(newX),
      y: Math.round(newY),
      zIndex: newZ,
      scale: parseFloat(newScale.toFixed(2))
    });
  }

  static _onDragEnd = (e) => {
    if (_dragState.element) {
      _dragState.element.style.cursor = 'grab';
    }
    
    _dragState = {
      active: false,
      element: null,
      type: null,
      id: null,
      startX: 0,
      startY: 0,
      elemStartX: 0,
      elemStartY: 0,
      elemStartZ: 0,
      elemStartScale: 1,
    };
    
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
  }

  static _renderNameBar(chars) {
    const bar = document.getElementById('vn-name-bar');
    if (!bar) return;
    const activeChars = chars.filter(c => c.active && c.visible !== false && c.name?.trim());
    const hoveredChar = this._hoveredCharId ? chars.find(c => c.id === this._hoveredCharId) : null;
    const allVisible = [...activeChars];
    if (hoveredChar && !activeChars.find(c => c.id === hoveredChar.id) && hoveredChar.name?.trim()) {
      allVisible.push(hoveredChar);
    }
    if (!allVisible.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = allVisible.map((c, i) =>
      (i > 0 ? '<span class="vn-name-bar-sep">·</span>' : '') +
      `<span class="vn-name-bar-name">${c.name}</span>`
    ).join('');
  }

  static _subtitles = [];
  static _subTimeout = null;

  static showSubtitle(name, text, color, charId = null) {
    const box = document.getElementById('vn-dialogue');
    if (!box) return;

    box.style.display = 'flex';
    
    const existing = this._subtitles.find(s => s.charId === charId);
    if (existing) { existing.name = name; existing.text = text; existing.color = color; }
    else this._subtitles.push({ name, text, color, charId });

    this._renderSubtitles();
    _state.dialogue._subtitleActive = true;

    clearTimeout(this._subTimeout);
    this._subTimeout = setTimeout(() => this.hideAllSubtitles(), 4000);
  }

  static _renderSubtitles() {
    const container = document.getElementById('vn-subtitles-container');
    if (!container) return;
    
    container.innerHTML = this._subtitles.map((s, i) => `
      <div class="vn-subtitle-item" style="animation-delay: ${i * 0.1}s">
        <span class="vn-sub-name" style="color:${s.color || '#ffe066'}">${s.name}:</span>
        <span class="vn-sub-text">${s.text}</span>
      </div>
    `).join('');
    
    container.style.display = this._subtitles.length ? 'flex' : 'none';
  }

  static hideAllSubtitles() {
    this._subtitles = [];
    const container = document.getElementById('vn-subtitles-container');
    if (container) container.style.display = 'none';
    _state.dialogue._subtitleActive = false;
    if (!_state.dialogue.visible) {
      const box = document.getElementById('vn-dialogue');
      if (box) box.style.display = 'none';
    }
  }

  static hideSubtitleByPlayer(charId) {
    this._subtitles = this._subtitles.filter(s => s.charId !== charId);
    this._renderSubtitles();
    if (this._subtitles.length === 0) this.hideAllSubtitles();
  }

  static _renderDialogue(d) {
    const box = document.getElementById('vn-dialogue');
    if (!box) return;

    const hasContent = (d.visible && (d.speakerName || d.text)) || d._subtitleActive;
    box.style.display = hasContent ? 'flex' : 'none';

    const speaker = document.getElementById('vn-speaker');
    const text = document.getElementById('vn-text');
    if (d.visible && (d.speakerName || d.text)) {
      if (speaker) { speaker.textContent = d.speakerName || ''; speaker.style.color = d.speakerColor || '#ffe066'; }
      if (text) text.innerHTML = d.text || '';
    } else {
      if (speaker) speaker.textContent = '';
      if (text) text.textContent = '';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GM LEFT BAR
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNGMBar {
  static _charsOpen = false;
  static _bgsOpen = false;
  static _presetsOpen = false;
  static _controlsOpen = false;
  static _charQuery = '';
  static _bgQuery = '';
  static _bound = false;

  static get _gmCharId() { return DDVNPanel._instance?._gmCharId ?? this.__gmCharId ?? null; }
  static set _gmCharId(v) {
    this.__gmCharId = v;
    if (DDVNPanel._instance) DDVNPanel._instance._gmCharId = v;
  }

  static update(state) {
    const bar = document.getElementById('vn-gm-left-bar');
    if (!bar) return;

    if (!state.open || !game.user?.isGM) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';

    const chars = state.chars || [];
    const allBg = DDVNPresets.getAllBg();
    const scenePresets = DDVNPresets.listScenes();
    const charPresets = DDVNPresets.listChars();

    bar.innerHTML = `
      <div class="vn-gml-inner">
        
        <!-- Mouse Controls Section -->
        <div class="vn-gml-section vn-gml-controls-section">
          <button class="vn-gml-toggle-btn ${this._controlsOpen ? 'open' : ''}" id="vn-gml-controls-btn">
            <i class="fas fa-mouse-pointer"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.mouseControl')}
            <i class="fas fa-chevron-${this._controlsOpen ? 'up' : 'down'} vn-gml-chev"></i>
          </button>
          <div class="vn-gml-dropdown ${this._controlsOpen ? 'open' : ''}" id="vn-gml-controls-drop">
            <div class="vn-gml-control-item">
              <label class="vn-gml-checkbox-label">
                <input type="checkbox" id="vn-mouse-control" ${state.mouseControl ? 'checked' : ''}/>
                <span><i class="fas fa-hand-pointer"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.mouseControl')}</span>
              </label>
            </div>
            <div class="vn-gml-control-item">
              <label class="vn-gml-checkbox-label">
                <input type="checkbox" id="vn-depth-mode" ${state.depthMode ? 'checked' : ''} ${!state.mouseControl ? 'disabled' : ''}/>
                <span><i class="fas fa-layer-group"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.depthMode')}</span>
              </label>
            </div>
            <div class="vn-gml-control-item vn-gml-depth-slider ${state.depthMode && state.mouseControl ? '' : 'dd-hidden'}" id="vn-depth-slider-wrap">
              <label class="vn-gml-slider-label">
                <span><i class="fas fa-expand-arrows-alt"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.depthScaleMultiplier')}</span>
                <input type="range" id="vn-depth-scale-mult" value="${state.depthScaleMultiplier || 1}" min="0.1" max="4" step="0.1" style="flex:1;min-width:50px"/>
                <span class="vn-slider-val">${state.depthScaleMultiplier || 1}x</span>
              </label>
            </div>
            <div class="vn-gml-control-item vn-gml-depth-slider ${state.depthMode && state.mouseControl ? '' : 'dd-hidden'}" id="vn-depth-y-slider-wrap">
              <label class="vn-gml-slider-label">
                <span><i class="fas fa-arrows-alt-v"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.depthYMultiplier')}</span>
                <input type="range" id="vn-depth-y-mult" value="${state.depthYMultiplier || 1}" min="0.1" max="4" step="0.1" style="flex:1;min-width:50px"/>
                <span class="vn-slider-val">${state.depthYMultiplier || 1}x</span>
              </label>
            </div>
            <div class="vn-gml-control-item ${state.depthMode && state.mouseControl ? '' : 'dd-hidden'}" id="vn-horizon-wrap">
              <label class="vn-gml-checkbox-label">
                <input type="checkbox" id="vn-horizon-line" ${state.horizonLine ? 'checked' : ''}/>
                <span><i class="fas fa-minus"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.horizonLine')}</span>
              </label>
              <div class="vn-gml-hint">${game.i18n.localize('DRAMADIRECTOR.vn.gml.horizonLineHint')}</div>
              <div id="vn-horizon-y-wrap" style="display:${state.horizonLine ? '' : 'none'};margin-top:4px;">
                <label class="vn-gml-slider-label" style="font-size:11px;">
                  <span style="white-space:nowrap;min-width:90px;"><i class="fas fa-arrows-alt-v"></i> Горизонт Y</span>
                  <input type="range" id="vn-horizon-y-slider" value="${state.horizonY ?? 30}" min="0" max="90" step="1" style="flex:1;min-width:50px"/>
                  <span class="vn-slider-val" id="vn-horizon-y-val">${state.horizonY ?? 30}%</span>
                </label>
              </div>
            </div>
            <div class="vn-gml-control-item">
              <label class="vn-gml-checkbox-label">
                <input type="checkbox" id="vn-player-control" ${state.playerControl ? 'checked' : ''}/>
                <span><i class="fas fa-users"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.playerControl')}</span>
              </label>
              <div class="vn-gml-hint">${game.i18n.localize('DRAMADIRECTOR.vn.gml.playerControlHint')}</div>
            </div>
          </div>
        </div>

        <!-- GM Voice -->
        <div class="vn-gml-section vn-gml-voice">
          <span class="vn-gml-label"><i class="fas fa-comment-alt"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.speaking')}</span>
          <select id="vn-gml-voice-sel" class="vn-gml-select">
            <option value="">${game.i18n.localize('DRAMADIRECTOR.vn.gml.noOne')}</option>
            ${chars.map(c => `<option value="${c.id}" ${this._gmCharId === c.id ? 'selected' : ''}>${c.name || game.i18n.localize('DRAMADIRECTOR.vn.gml.noName')}</option>`).join('')}
          </select>
        </div>

        <!-- Actors -->
        <div class="vn-gml-section">
          <button class="vn-gml-toggle-btn ${this._charsOpen ? 'open' : ''}" id="vn-gml-chars-btn">
            <i class="fas fa-users"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.actors')}
            <span class="vn-gml-count">${chars.length}</span>
            <i class="fas fa-chevron-${this._charsOpen ? 'up' : 'down'} vn-gml-chev"></i>
          </button>
          <div class="vn-gml-dropdown ${this._charsOpen ? 'open' : ''}" id="vn-gml-chars-drop">
            <div class="vn-gml-search-row">
              <input type="text" class="vn-gml-search" id="vn-gml-char-search"
                placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.gml.search')}" value="${this._charQuery}"/>
            </div>
            <div class="vn-gml-list" id="vn-gml-char-list">
              ${this._renderCharList(chars, this._charQuery)}
            </div>
          </div>
        </div>

        <!-- Backgrounds -->
        <div class="vn-gml-section">
          <button class="vn-gml-toggle-btn ${this._bgsOpen ? 'open' : ''}" id="vn-gml-bgs-btn">
            <i class="fas fa-image"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.backgrounds')}
            <i class="fas fa-chevron-${this._bgsOpen ? 'up' : 'down'} vn-gml-chev"></i>
          </button>
          <div class="vn-gml-dropdown ${this._bgsOpen ? 'open' : ''}" id="vn-gml-bgs-drop">
            <div class="vn-gml-search-row">
              <input type="text" class="vn-gml-search" id="vn-gml-bg-search"
                placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.gml.search')}" value="${this._bgQuery}"/>
            </div>
            <div class="vn-gml-list" id="vn-gml-bg-list">
              ${this._renderBgList(allBg, state.background, this._bgQuery)}
            </div>
          </div>
        </div>

        <!-- Presets -->
        <div class="vn-gml-section">
          <button class="vn-gml-toggle-btn ${this._presetsOpen ? 'open' : ''}" id="vn-gml-presets-btn">
            <i class="fas fa-bookmark"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.presets')}
            <i class="fas fa-chevron-${this._presetsOpen ? 'up' : 'down'} vn-gml-chev"></i>
          </button>
          <div class="vn-gml-dropdown ${this._presetsOpen ? 'open' : ''}" id="vn-gml-presets-drop">
            <div class="vn-gml-preset-section">
              <div class="vn-gml-preset-header"><i class="fas fa-film"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.scenes')}</div>
              <div class="vn-gml-preset-list">
                ${this._renderScenePresets(scenePresets)}
              </div>
            </div>
            <div class="vn-gml-preset-section">
              <div class="vn-gml-preset-header"><i class="fas fa-users"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.rosters')}</div>
              <div class="vn-gml-preset-list">
                ${this._renderCharPresets(charPresets)}
              </div>
            </div>
            <div class="vn-gml-preset-section">
              <div class="vn-gml-preset-header"><i class="fas fa-layer-group"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.layerPresets')}</div>
              <div class="vn-gml-preset-list">
                ${this._renderLayerPresets(DDVNPresets.listLayers())}
              </div>
            </div>
            <div class="vn-gml-preset-section">
              <div class="vn-gml-preset-header"><i class="fas fa-hand-pointer"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.gml.interactivePresets')}</div>
              <div class="vn-gml-preset-list">
                ${this._renderIimgPresets(DDVNPresets.listIimgs())}
              </div>
            </div>
          </div>
        </div>

      </div>`;

    this._bindEvents(bar, state, allBg);
  }

  static _renderCharList(chars, query) {
    const q = query.toLowerCase().trim();
    const filtered = q ? chars.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q)
    ) : chars;

    if (!filtered.length) return `<div class="vn-gml-empty">${game.i18n.localize('DRAMADIRECTOR.notifications.noChars')}</div>`;

    const players = (game.users?.contents || []).filter(u => !u.isGM);

    return filtered.map(c => {
      const isActive = !!c.active;
      const isVisible = c.visible !== false;
      const isLocked = c.locked === true;
      const sideIcon = c.side === 'left' ? '◀' : c.side === 'center' ? '◆' : '▶';
      const imgHtml = c.img
        ? `<img src="${c.img}" class="vn-gml-char-thumb-img"/>`
        : `<i class="fas fa-user vn-gml-char-thumb-icon"></i>`;

      const playerOpts = players.map(u =>
        `<option value="${u.id}" ${c.playerId === u.id ? 'selected' : ''}>${u.name}</option>`
      ).join('');

      const sideLabel = c.side === 'left' ? game.i18n.localize('DRAMADIRECTOR.vn.gml.left') : 
                        c.side === 'center' ? game.i18n.localize('DRAMADIRECTOR.vn.gml.center') : 
                        game.i18n.localize('DRAMADIRECTOR.vn.gml.right');

      return `
        <div class="vn-gml-char-item ${isActive ? 'gml-active' : ''} ${isVisible ? '' : 'gml-hidden-char'} ${isLocked ? 'gml-locked' : ''}"
             data-char-id="${c.id}" title="${game.i18n.localize('DRAMADIRECTOR.vn.gml.charTooltip')}">
          <div class="vn-gml-char-thumb">${imgHtml}</div>
          <div class="vn-gml-char-info">
            <span class="vn-gml-char-name" style="color:${c.nameColor || '#ffe066'}">
              ${c.name || game.i18n.localize('DRAMADIRECTOR.vn.gml.noName')}
              ${isLocked ? '<i class="fas fa-lock vn-lock-icon"></i>' : ''}
            </span>
            <div class="vn-gml-char-player-row">
              <span class="vn-gml-char-meta">${sideIcon} ${sideLabel}${c.title ? ' · ' + c.title : ''}</span>
              <select class="vn-gml-player-sel" data-player-for="${c.id}" title="${game.i18n.localize('DRAMADIRECTOR.vn.gml.assignPlayer')}">
                <option value="">${game.i18n.localize('DRAMADIRECTOR.vn.gml.playerNone')}</option>
                ${playerOpts}
              </select>
            </div>
          </div>
          <button class="vn-gml-active-btn ${isActive ? 'on' : ''}" data-activate-id="${c.id}" title="${game.i18n.localize('DRAMADIRECTOR.vn.charActivate')}"><i class="fas fa-lightbulb"></i></button>
        </div>`;
    }).join('');
  }

  static _renderBgList(allBg, currentBg, query) {
    const q = query.toLowerCase().trim();
    let html = '';
    for (const group of allBg) {
      const variants = (group.variants || []).filter(v =>
        !q || (v.name || '').toLowerCase().includes(q) || (group.name || '').toLowerCase().includes(q)
      );
      if (!variants.length) continue;
      html += `<div class="vn-gml-bg-group-name">${group.name}</div>`;
      for (const v of variants) {
        const isVid = /\.(webm|mp4|ogv)$/i.test(v.src);
        const icon = isVid ? 'fa-film' : 'fa-image';
        const active = v.src === currentBg ? 'gml-bg-active' : '';
        html += `
          <div class="vn-gml-bg-item ${active}" data-bg-src="${v.src}" title="${v.name}">
            <i class="fas ${icon} vn-gml-bg-icon"></i>
            <span class="vn-gml-bg-name">${v.name}</span>
          </div>`;
      }
    }
    return html || `<div class="vn-gml-empty">${game.i18n.localize("DRAMADIRECTOR.notifications.nothingFound")}</div>`;
  }

  static _renderScenePresets(scenePresets) {
    if (!scenePresets.length) return `<div class="vn-gml-empty">${game.i18n.localize("DRAMADIRECTOR.notifications.noSavedScenes")}</div>`;
    return scenePresets.map(name => `
      <div class="vn-gml-preset-item" data-scene-preset="${name}" title="${game.i18n.localize('DRAMADIRECTOR.vn.gml.loadScene')}">
        <i class="fas fa-film vn-gml-preset-icon"></i>
        <span class="vn-gml-preset-name">${name}</span>
        <i class="fas fa-play vn-gml-preset-load"></i>
      </div>
    `).join('');
  }

  static _renderCharPresets(charPresets) {
    if (!charPresets.length) return `<div class="vn-gml-empty">${game.i18n.localize("DRAMADIRECTOR.notifications.noSavedRosters")}</div>`;
    return charPresets.map(name => `
      <div class="vn-gml-preset-item" data-char-preset="${name}" title="${game.i18n.localize('DRAMADIRECTOR.vn.gml.loadRoster')}">
        <i class="fas fa-users vn-gml-preset-icon"></i>
        <span class="vn-gml-preset-name">${name}</span>
        <i class="fas fa-play vn-gml-preset-load"></i>
      </div>
    `).join('');
  }

  static _renderLayerPresets(layerPresets) {
    if (!layerPresets.length) return `<div class="vn-gml-empty">${game.i18n.localize("DRAMADIRECTOR.notifications.noSavedLayers")}</div>`;
    return layerPresets.map(name => `
      <div class="vn-gml-preset-item" data-layer-preset="${name}" title="${game.i18n.localize('DRAMADIRECTOR.vn.gml.loadLayers')}">
        <i class="fas fa-layer-group vn-gml-preset-icon"></i>
        <span class="vn-gml-preset-name">${name}</span>
        <i class="fas fa-play vn-gml-preset-load"></i>
      </div>
    `).join('');
  }

  static _renderIimgPresets(iimgPresets) {
    if (!iimgPresets.length) return `<div class="vn-gml-empty">${game.i18n.localize("DRAMADIRECTOR.notifications.noSavedInteractive")}</div>`;
    return iimgPresets.map(name => `
      <div class="vn-gml-preset-item" data-iimg-preset="${name}" title="${game.i18n.localize('DRAMADIRECTOR.vn.gml.loadInteractive')}">
        <i class="fas fa-hand-pointer vn-gml-preset-icon"></i>
        <span class="vn-gml-preset-name">${name}</span>
        <i class="fas fa-play vn-gml-preset-load"></i>
      </div>
    `).join('');
  }

  static _bindEvents(bar, state, allBg) {
    // Controls toggle
    bar.querySelector('#vn-gml-controls-btn')?.addEventListener('click', () => {
      this._controlsOpen = !this._controlsOpen;
      this.update(_state);
    });

    // Mouse control
    bar.querySelector('#vn-mouse-control')?.addEventListener('change', (e) => {
      _state.mouseControl = e.target.checked;
      const depthCheckbox = bar.querySelector('#vn-depth-mode');
      if (depthCheckbox) depthCheckbox.disabled = !e.target.checked;
      // Показать/скрыть все элементы глубины
      const sliderWrap = bar.querySelector('#vn-depth-slider-wrap');
      const ySliderWrap = bar.querySelector('#vn-depth-y-slider-wrap');
      const horizonWrap = bar.querySelector('#vn-horizon-wrap');
      if (sliderWrap) sliderWrap.classList.toggle('dd-hidden', !_state.depthMode || !_state.mouseControl);
      if (ySliderWrap) ySliderWrap.classList.toggle('dd-hidden', !_state.depthMode || !_state.mouseControl);
      if (horizonWrap) horizonWrap.classList.toggle('dd-hidden', !_state.depthMode || !_state.mouseControl);
      DDVNManager.broadcast();
    });

    // Depth mode
    bar.querySelector('#vn-depth-mode')?.addEventListener('change', (e) => {
      _state.depthMode = e.target.checked;
      // Показать/скрыть все элементы глубины
      const sliderWrap = bar.querySelector('#vn-depth-slider-wrap');
      const ySliderWrap = bar.querySelector('#vn-depth-y-slider-wrap');
      const horizonWrap = bar.querySelector('#vn-horizon-wrap');
      if (sliderWrap) sliderWrap.classList.toggle('dd-hidden', !_state.depthMode || !_state.mouseControl);
      if (ySliderWrap) ySliderWrap.classList.toggle('dd-hidden', !_state.depthMode || !_state.mouseControl);
      if (horizonWrap) horizonWrap.classList.toggle('dd-hidden', !_state.depthMode || !_state.mouseControl);
      // При включении — снимок baseScale и пересчёт перспективы
      if (_state.depthMode) DDVNManager._snapshotAndRecalcDepth();
      DDVNManager.broadcast();
    });

    // Depth scale multiplier
    bar.querySelector('#vn-depth-scale-mult')?.addEventListener('input', (e) => {
      _state.depthScaleMultiplier = parseFloat(e.target.value);
      const valSpan = bar.querySelector('#vn-depth-slider-wrap .vn-slider-val');
      if (valSpan) valSpan.textContent = _state.depthScaleMultiplier + 'x';
      DDVNManager.broadcast();
    });

    // Depth Y multiplier
    bar.querySelector('#vn-depth-y-mult')?.addEventListener('input', (e) => {
      _state.depthYMultiplier = parseFloat(e.target.value);
      const valSpan = bar.querySelector('#vn-depth-y-slider-wrap .vn-slider-val');
      if (valSpan) valSpan.textContent = _state.depthYMultiplier + 'x';
      DDVNManager.broadcast();
    });

    // Horizon line
    bar.querySelector('#vn-horizon-line')?.addEventListener('change', (e) => {
      _state.horizonLine = e.target.checked;
      const yWrap = bar.querySelector('#vn-horizon-y-wrap');
      if (yWrap) yWrap.style.display = e.target.checked ? '' : 'none';
      if (e.target.checked) {
        DDVNManager.initHorizonLine();
      } else {
        DDVNManager.clearHorizonLine();
      }
      DDVNManager.broadcast();
    });

    bar.querySelector('#vn-horizon-y-slider')?.addEventListener('input', (e) => {
      const pct = parseFloat(e.target.value);
      _state.horizonY = pct;
      const valSpan = bar.querySelector('#vn-horizon-y-val');
      if (valSpan) valSpan.textContent = pct + '%';
      if (_state.horizonLine) {
        DDVNManager.initHorizonLine();
        DDVNManager._updateHorizonIndicator();
      }
    });

    // Player control
    bar.querySelector('#vn-player-control')?.addEventListener('change', (e) => {
      _state.playerControl = e.target.checked;
      DDVNManager.broadcast();
    });

    // GM Voice
    bar.querySelector('#vn-gml-voice-sel')?.addEventListener('change', e => {
      this._gmCharId = e.target.value || null;
    });

    // Actors accordion
    bar.querySelector('#vn-gml-chars-btn')?.addEventListener('click', () => {
      this._charsOpen = !this._charsOpen;
      this.update(_state);
    });

    // Backgrounds accordion
    bar.querySelector('#vn-gml-bgs-btn')?.addEventListener('click', () => {
      this._bgsOpen = !this._bgsOpen;
      this.update(_state);
    });

    // Presets accordion
    bar.querySelector('#vn-gml-presets-btn')?.addEventListener('click', () => {
      this._presetsOpen = !this._presetsOpen;
      this.update(_state);
    });

    // Search
    bar.querySelector('#vn-gml-char-search')?.addEventListener('input', e => {
      this._charQuery = e.target.value;
      const list = bar.querySelector('#vn-gml-char-list');
      if (list) list.innerHTML = this._renderCharList(state.chars || [], this._charQuery);
      this._bindCharItemEvents(bar, state.chars || []);
    });

    bar.querySelector('#vn-gml-bg-search')?.addEventListener('input', e => {
      this._bgQuery = e.target.value;
      const list = bar.querySelector('#vn-gml-bg-list');
      if (list) list.innerHTML = this._renderBgList(allBg, state.background, this._bgQuery);
      this._bindBgItemEvents(bar);
    });

    this._bindCharItemEvents(bar, state.chars || []);
    this._bindBgItemEvents(bar);
    this._bindPresetEvents(bar);
  }

  static _bindCharItemEvents(bar, chars) {
    bar.querySelectorAll('.vn-gml-char-item').forEach(item => {
      const fresh = item.cloneNode(true);
      item.replaceWith(fresh);
    });

    bar.querySelectorAll('.vn-gml-char-item').forEach(item => {
      const id = item.dataset.charId;

      item.addEventListener('click', e => {
        if (e.target.closest('[data-activate-id]')) return;
        if (e.target.closest('.vn-gml-player-sel')) return;
        const c = _state.chars.find(c => c.id === id);
        if (!c) return;
        c.visible = c.visible === false ? true : false;
        this._syncCharToPanel(id);
        DDVNManager.broadcast();
      });

      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        const c = _state.chars.find(c => c.id === id);
        if (!c) return;
        const sides = ['left', 'center', 'right'];
        const currentIdx = sides.indexOf(c.side);
        c.side = sides[(currentIdx + 1) % sides.length];
        let l = 0, cCnt = 0, r = 0;
        _state.chars.forEach(ch => { 
          if (ch.side === 'left') ch.slot = l++;
          else if (ch.side === 'center') ch.slot = cCnt++;
          else ch.slot = r++;
        });
        this._syncCharToPanel(id);
        DDVNManager.broadcast();
      });
    });

    bar.querySelectorAll('.vn-gml-player-sel').forEach(sel => {
      sel.addEventListener('change', e => {
        e.stopPropagation();
        const id = sel.dataset.playerFor;
        const c = _state.chars.find(c => c.id === id);
        if (!c) return;
        c.playerId = sel.value || null;
        this._syncCharToPanel(id);
        DDVNManager.broadcast();
      });
    });

    bar.querySelectorAll('[data-activate-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.activateId;
        const c = _state.chars.find(c => c.id === id);
        if (!c) return;
        c.active = !c.active;
        this._syncCharToPanel(id);
        DDVNManager.broadcast();
      });
    });
  }

  static _syncCharToPanel(charId) {
    if (!DDVNPanel._instance || !charId) return;
    const c = _state.chars.find(ch => ch.id === charId);
    if (!c) return;
    const pc = DDVNPanel._instance._chars.find(ch => ch.id === charId);
    if (pc) Object.assign(pc, deepClone(c));
    DDVNPanel._instance.render();
  }

  static _bindBgItemEvents(bar) {
    bar.querySelectorAll('.vn-gml-bg-item').forEach(item => {
      item.addEventListener('click', () => {
        DDVNManager.setBackground(item.dataset.bgSrc);
        if (DDVNPanel._instance) DDVNPanel._instance.render();
      });
    });
  }

  static _bindPresetEvents(bar) {
    bar.querySelectorAll('[data-scene-preset]').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.scenePreset;
        const scene = DDVNPresets.getScene(name);
        if (!scene) {
          ui.notifications?.warn(game.i18n.format("DRAMADIRECTOR.notifications.sceneNotFound", {name}));
          return;
        }
        DDVNManager.applySceneState(scene);
        ui.notifications?.info(game.i18n.format("DRAMADIRECTOR.notifications.sceneLoaded", {name}));
      });
    });

    bar.querySelectorAll('[data-char-preset]').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.charPreset;
        const chars = DDVNPresets.getChars(name);
        if (!chars) {
          ui.notifications?.warn(game.i18n.format("DRAMADIRECTOR.notifications.rosterNotFound", {name}));
          return;
        }
        _state.chars = deepClone(chars);
        if (DDVNPanel._instance) {
          DDVNPanel._instance._chars = deepClone(_state.chars);
          DDVNPanel._instance.render();
        }
        DDVNManager.broadcast();
        DDVNOverlay.ensureOpen();
        ui.notifications?.info(game.i18n.format("DRAMADIRECTOR.notifications.rosterLoaded", {name, count: chars.length}));
      });
    });

    // Layer presets
    bar.querySelectorAll('[data-layer-preset]').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.layerPreset;
        const layers = DDVNPresets.getLayers(name);
        if (!layers) {
          ui.notifications?.warn(game.i18n.format("DRAMADIRECTOR.notifications.layerPresetNotFound", {name}));
          return;
        }
        _state.layers = deepClone(layers);
        if (DDVNPanel._instance) {
          DDVNPanel._instance._layers = deepClone(_state.layers);
          DDVNPanel._instance.render();
        }
        DDVNManager.broadcast();
        DDVNOverlay.ensureOpen();
        ui.notifications?.info(game.i18n.format("DRAMADIRECTOR.notifications.layerPresetLoaded", {name, count: layers.length}));
      });
    });

    // Interactive image presets
    bar.querySelectorAll('[data-iimg-preset]').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.iimgPreset;
        const iimgs = DDVNPresets.getIimgs(name);
        if (!iimgs) {
          ui.notifications?.warn(game.i18n.format("DRAMADIRECTOR.notifications.iimgPresetNotFound", {name}));
          return;
        }
        _state.interactiveImages = deepClone(iimgs);
        if (DDVNPanel._instance) {
          DDVNPanel._instance._interactiveImages = deepClone(_state.interactiveImages);
          DDVNPanel._instance.render();
        }
        DDVNManager.broadcast();
        DDVNOverlay.ensureOpen();
        ui.notifications?.info(game.i18n.format("DRAMADIRECTOR.notifications.iimgPresetLoaded", {name, count: iimgs.length}));
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIC
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNMic {
  static _stream = null;
  static _ctx = null;
  static _analyser = null;
  static _recognition = null;
  static _active = false;
  static _vadTimer = null;
  static _speaking = false;
  static threshold = 18;
  static lang = 'ru-RU';

  static async start() {
    if (this._active) return;
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._ctx = new AudioContext();
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 256;
      this._ctx.createMediaStreamSource(this._stream).connect(this._analyser);
      this._active = true;
      this._startVAD();
      this._startSpeech();
      DDVNOverlay.updateMicIndicator();
    } catch (e) {
      ui.notifications?.warn(game.i18n.format('DRAMADIRECTOR.notifications.micNoAccess', {error: e.message}));
    }
  }

  static stop() {
    this._active = false;
    clearInterval(this._vadTimer);
    this._recognition?.stop();
    this._stream?.getTracks().forEach(t => t.stop());
    this._ctx?.close().catch(() => {});
    this._stream = this._ctx = this._analyser = this._recognition = null;
    this._speaking = false;
    DDVNOverlay.updateMicIndicator();
  }

  static _startVAD() {
    const data = new Uint8Array(this._analyser.frequencyBinCount);
    this._vadTimer = setInterval(() => {
      if (!this._active || !this._analyser) return;
      this._analyser.getByteFrequencyData(data);
      const vol = data.reduce((a, b) => a + b, 0) / data.length;
      const isSpeaking = vol > this.threshold;
      if (isSpeaking !== this._speaking) {
        this._speaking = isSpeaking;
        DDVNManager.onLocalSpeaking(isSpeaking);
      }
    }, 80);
  }

  static _startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;

    rec.onresult = e => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript.trim();
      const final = last.isFinal;
      if (final) DDVNManager.onSpeechResult(text);
    };

    rec.onerror = e => { if (e.error === 'not-allowed') ui.notifications?.warn(game.i18n.localize('DRAMADIRECTOR.notifications.micDenied')); };
    rec.onend = () => { if (this._active) { try { rec.start(); } catch(_) {} } };
    try { rec.start(); } catch(_) {}
    this._recognition = rec;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNPresets {
  static CHARS_KEY = 'vnCharPresets';
  static BG_KEY = 'vnBgPresets';
  static SCENE_KEY = 'vnScenePresets';
  static LAYERS_KEY = 'vnLayerPresets';
  static IIMGS_KEY = 'vnIimgPresets';

  static register() {
    const base = { scope: 'world', config: false, type: Object, default: {} };
    for (const k of [this.CHARS_KEY, this.BG_KEY, this.SCENE_KEY, this.LAYERS_KEY, this.IIMGS_KEY])
      game.settings.register(MODULE_ID, k, { ...base });
  }

  static _g(k) { return game.settings.get(MODULE_ID, k) || {}; }
  static _s(k, v) { return game.settings.set(MODULE_ID, k, v); }

  static listBg() { return Object.entries(this._g(this.BG_KEY)).map(([id, v]) => ({ id, ...v })); }
  static saveBg(id, data) { const a = this._g(this.BG_KEY); a[id] = data; return this._s(this.BG_KEY, a); }
  static deleteBg(id) { const a = this._g(this.BG_KEY); delete a[id]; return this._s(this.BG_KEY, a); }

  static listChars() { return Object.keys(this._g(this.CHARS_KEY)).sort(); }
  static saveChars(n,v) { const a = this._g(this.CHARS_KEY); a[n] = v; return this._s(this.CHARS_KEY, a); }
  static getChars(n) { return this._g(this.CHARS_KEY)[n] ?? null; }
  static deleteChars(n) { const a = this._g(this.CHARS_KEY); delete a[n]; return this._s(this.CHARS_KEY, a); }

  static listScenes() { return Object.keys(this._g(this.SCENE_KEY)).sort(); }
  static saveScene(n,v) { const a = this._g(this.SCENE_KEY); a[n] = v; return this._s(this.SCENE_KEY, a); }
  static getScene(n) { return this._g(this.SCENE_KEY)[n] ?? null; }
  static deleteScene(n) { const a = this._g(this.SCENE_KEY); delete a[n]; return this._s(this.SCENE_KEY, a); }

  static listLayers() { return Object.keys(this._g(this.LAYERS_KEY)).sort(); }
  static saveLayers(n, v) { const a = this._g(this.LAYERS_KEY); a[n] = v; return this._s(this.LAYERS_KEY, a); }
  static getLayers(n) { return this._g(this.LAYERS_KEY)[n] ?? null; }
  static deleteLayers(n) { const a = this._g(this.LAYERS_KEY); delete a[n]; return this._s(this.LAYERS_KEY, a); }

  static listIimgs() { return Object.keys(this._g(this.IIMGS_KEY)).sort(); }
  static saveIimgs(n, v) { const a = this._g(this.IIMGS_KEY); a[n] = v; return this._s(this.IIMGS_KEY, a); }
  static getIimgs(n) { return this._g(this.IIMGS_KEY)[n] ?? null; }
  static deleteIimgs(n) { const a = this._g(this.IIMGS_KEY); delete a[n]; return this._s(this.IIMGS_KEY, a); }

  static getAllBg() {
    const builtin = _resolveBgNames(VN_BUILTIN_BACKGROUNDS);
    const custom = this.listBg().map(b => ({ ...b, _builtin: false }));
    return [...builtin, ...custom];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNManager {
  static _subTimer = null;
  static _gmOnlyMode = false;

  static getState() { return _state; }

  static broadcast(partial = null) {
    if (partial) Object.assign(_state, partial);
    game.socket.emit(SOCKET, { type: 'vn:state', state: deepClone(_state) });
    DDVNOverlay.apply(_state);
  }

  static applyRemote(state) {
    Object.assign(_state, state);
    DDVNOverlay.apply(_state);
  }

  static open() {
    _state.open = true;
    this._gmOnlyMode = false;
    DDVNOverlay.build();
    this.broadcast();
    DDVNMic.start();
    DDVNPanel._instance?.render();
  }

  static openLocal() {
    _state.open = true;
    this._gmOnlyMode = true;
    DDVNOverlay.build();
    DDVNOverlay.apply(_state);
    DDVNMic.start();
    DDVNPanel._instance?.render();
    ui.notifications?.info(game.i18n.localize('DRAMADIRECTOR.notifications.vnGmOnly'));
  }

  static stop(bcast = false) {
    _state.open = false;
    this._gmOnlyMode = false;
    DDVNMic.stop();
    DDVNOverlay.clearStage();
    if (bcast) this.broadcast();
    else DDVNOverlay.apply(_state);
    DDVNPanel._instance?.render();
  }

  static stopLocal() {
    _state.open = false;
    this._gmOnlyMode = false;
    DDVNMic.stop();
    DDVNOverlay.clearStage();
    DDVNOverlay.apply(_state);
    DDVNPanel._instance?.render();
  }

  static isGmOnlyMode() { return this._gmOnlyMode; }

  static setBackground(path) {
    _state.background = path;
    this.broadcast();
  }

  static setChars(chars) {
    _state.chars = deepClone(chars);
    this.broadcast();
    DDVNOverlay.ensureOpen();
  }

  static activateExclusive(id) {
    _state.chars.forEach(c => { c.active = c.id === id; });
    this.broadcast();
  }

  static activateChar(id, val = true) {
    const c = _state.chars.find(c => c.id === id);
    if (c) { c.active = val; this.broadcast(); }
  }

  static deactivateAll() {
    _state.chars.forEach(c => { c.active = false; });
    this.broadcast();
  }

  // ── Layers ───────────────────────────────────────────────────────────────
  static setLayers(layers) { _state.layers = deepClone(layers); this.broadcast(); }
  static addLayer(layer) { _state.layers.push(deepClone(layer)); this.broadcast(); }
  static updateLayer(id, props) {
    const l = _state.layers.find(l => l.id === id);
    if (l) { Object.assign(l, props); this.broadcast(); }
  }
  static removeLayer(id) { _state.layers = _state.layers.filter(l => l.id !== id); this.broadcast(); }

  // ── Interactive Images ───────────────────────────────────────────────────
  static setInteractiveImages(images) { _state.interactiveImages = deepClone(images); this.broadcast(); }
  static addInteractiveImage(img) { _state.interactiveImages.push(deepClone(img)); this.broadcast(); }
  static updateInteractiveImage(id, props) {
    const img = _state.interactiveImages.find(i => i.id === id);
    if (img) { Object.assign(img, props); this.broadcast(); }
  }
  static removeInteractiveImage(id) { _state.interactiveImages = _state.interactiveImages.filter(i => i.id !== id); this.broadcast(); }

  // ── Generic Element Position Update ──────────────────────────────────────
  static updateElementPosition(type, id, props) {
    let list;
    if (type === 'char') list = _state.chars;
    else if (type === 'layer') list = _state.layers;
    else if (type === 'interactive') list = _state.interactiveImages;
    else return;
    
    const item = list.find(item => item.id === id);
    if (item) {
      Object.assign(item, props);
      this.broadcast();
    }
  }

  // ── Lock/Unlock ───────────────────────────────────────────────────────────
  // При включении depth mode: сохраняем текущий scale как baseScale,
  // затем пересчитываем scale и zIndex из текущей Y-позиции для всех элементов.
  static _snapshotAndRecalcDepth() {
    const recalc = (items, type) => {
      items.forEach(item => {
        item.baseScale = item.baseScale ?? item.scale ?? 1;
        const pf = DDVNOverlay._perspectiveFactor(DDVNOverlay._depthY(type, item));
        item.scale  = parseFloat((item.baseScale * pf).toFixed(3));
        item.zIndex = DDVNOverlay._depthZ(type, item);
      });
    };
    recalc(_state.chars,             'char');
    recalc(_state.layers,            'layer');
    recalc(_state.interactiveImages, 'interactive');
    console.log('DD VN | Depth mode ON — baseScales snapshotted, scales recalculated');
  }

  // ── Единый метод применения пресета сцены ────────────────────────────────
  // Вызывается из GM-бара и из панели. Применяет ВСЕ поля состояния.
  static applySceneState(scene) {
    if (!scene) return;

    // Фон и оформление
    if (scene.background  !== undefined) _state.background  = scene.background;
    if (scene.bgFit       !== undefined) _state.bgFit       = scene.bgFit;
    if (scene.bgColor     !== undefined) _state.bgColor     = scene.bgColor;
    if (scene.dimBg       !== undefined) _state.dimBg       = scene.dimBg;

    // Элементы сцены
    if (scene.chars)             _state.chars             = deepClone(scene.chars);
    if (scene.layers)            _state.layers            = deepClone(scene.layers);
    if (scene.interactiveImages) _state.interactiveImages = deepClone(scene.interactiveImages);

    // Диалог
    if (scene.dialogue) {
      _state.dialogue = { ...scene.dialogue, _subtitleActive: false };
    }

    // Управление мышью и глубиной
    if (scene.mouseControl      !== undefined) _state.mouseControl      = scene.mouseControl;
    if (scene.depthMode         !== undefined) _state.depthMode         = scene.depthMode;
    if (scene.playerControl     !== undefined) _state.playerControl     = scene.playerControl;
    if (scene.depthScaleMultiplier !== undefined) _state.depthScaleMultiplier = scene.depthScaleMultiplier;
    if (scene.depthYMultiplier  !== undefined) _state.depthYMultiplier  = scene.depthYMultiplier;

    // Горизонт
    if (scene.horizonLine !== undefined) _state.horizonLine = scene.horizonLine;
    if (scene.horizonY    !== undefined) _state.horizonY    = scene.horizonY;
    if (_state.horizonLine) {
      DDVNManager.initHorizonLine();
    } else {
      DDVNManager.clearHorizonLine();
    }

    // Синхронизируем локальные копии в панели если она открыта
    if (DDVNPanel._instance) {
      DDVNPanel._instance._chars             = deepClone(_state.chars);
      DDVNPanel._instance._layers            = deepClone(_state.layers);
      DDVNPanel._instance._interactiveImages = deepClone(_state.interactiveImages);
      DDVNPanel._instance.render();
    }

    this.broadcast();
    DDVNOverlay.ensureOpen();
  }

  static toggleLock(type, id) {
    let item = null;
    if (type === 'char') item = _state.chars.find(c => c.id === id);
    else if (type === 'layer') item = _state.layers.find(l => l.id === id);
    else if (type === 'interactive') item = _state.interactiveImages.find(i => i.id === id);
    
    if (item) {
      item.locked = !item.locked;
      this.broadcast();
      ui.notifications?.info(item.locked 
        ? game.i18n.format('DRAMADIRECTOR.vn.gml.elementLocked', {name: item.name || id})
        : game.i18n.format('DRAMADIRECTOR.vn.gml.elementUnlocked', {name: item.name || id})
      );
    }
  }

  static setLock(type, id, locked) {
    let item = null;
    if (type === 'char') item = _state.chars.find(c => c.id === id);
    else if (type === 'layer') item = _state.layers.find(l => l.id === id);
    else if (type === 'interactive') item = _state.interactiveImages.find(i => i.id === id);
    
    if (item) {
      item.locked = locked;
      this.broadcast();
    }
  }

  // ── Horizon Line ───────────────────────────────────────────────────────────
  static initHorizonLine() {
    // Горизонт теперь задаётся вручную в % от высоты стейджа (1080px)
    const pct = _state.horizonY ?? 30;
    _horizonY = Math.round((pct / 100) * 1080);
    console.log('DD VN | Horizon line set at Y:', _horizonY, `(${pct}% of stage)`);
    this._updateHorizonIndicator();
  }

  static _updateHorizonIndicator() {
    const stage = document.getElementById('vn-stage');
    if (!stage) return;

    let indicator = document.getElementById('vn-horizon-indicator');
    if (_state.horizonLine && _horizonY !== null) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'vn-horizon-indicator';
        indicator.style.cssText = [
          'position:absolute', 'left:0', 'right:0',
          'height:2px',
          'background:repeating-linear-gradient(90deg,rgba(255,220,60,.7) 0,rgba(255,220,60,.7) 12px,transparent 12px,transparent 20px)',
          'pointer-events:none',
          'z-index:9999',
          'transition:top .15s ease',
        ].join(';');
        // Метка
        const label = document.createElement('div');
        label.id = 'vn-horizon-label';
        label.style.cssText = 'position:absolute;right:10px;top:-18px;font-size:11px;color:rgba(255,220,60,.9);font-family:monospace;pointer-events:none;text-shadow:0 1px 3px #000;';
        label.textContent = `⬇ Горизонт`;
        indicator.appendChild(label);
        stage.appendChild(indicator);
      }
      indicator.style.top = _horizonY + 'px';
      // Обновляем процент в метке
      const label = indicator.querySelector('#vn-horizon-label');
      if (label) label.textContent = `⬇ Горизонт ${_state.horizonY ?? 30}%`;
    } else {
      indicator?.remove();
    }
  }

  static clearHorizonLine() {
    _horizonY = null;
    this._updateHorizonIndicator();
  }

  static showDialogue(speakerName, text, speakerColor = '#ffe066', autoClose = 0) {
    _state.dialogue = { visible: true, speakerName, text, speakerColor, _subtitleActive: _state.dialogue._subtitleActive };
    this.broadcast();
    if (autoClose > 0) setTimeout(() => this.hideDialogue(), autoClose * 1000);
  }

  static hideDialogue() {
    _state.dialogue.visible = false;
    this.broadcast();
  }

  static onLocalSpeaking(isSpeaking) {
    if (!_state.open) return;

    let myChar;
    if (game.user?.isGM) {
      const gmCharId = DDVNGMBar._gmCharId;
      if (!gmCharId) return;
      myChar = _state.chars.find(c => c.id === gmCharId);
    } else {
      myChar = _state.chars.find(c => c.playerId === game.userId);
    }

    if (!myChar) return;
    if (myChar.active !== isSpeaking) {
      myChar.active = isSpeaking;
      this.broadcast();
    }
  }

  static onSpeechResult(text) {
    if (!_state.open) return;
    
    let myChar = null;
    let charName = '';
    let charColor = '#ffe066';
    const playerId = game.userId;
    let charId = null;
    let isGM = game.user.isGM;
    
    if (isGM) {
      const gmCharId = DDVNGMBar._gmCharId;
      if (gmCharId) {
        myChar = _state.chars.find(c => c.id === gmCharId);
        charId = gmCharId;
      }
    } else {
      myChar = _state.chars.find(c => c.playerId === game.userId);
      charId = myChar?.id || null;
    }
    
    if (myChar) {
      charName = myChar.name || '';
      charColor = myChar.nameColor || '#ffe066';
    } else {
      charName = game.user?.name || '';
    }

    DDVNOverlay.showSubtitle(charName, text, charColor, charId);
    game.socket.emit(SOCKET, { type: 'vn:subtitle', name: charName, text, color: charColor, charId: charId, isGM: isGM });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static _instance = null;

  constructor(opts = {}) {
    super(opts);
    DDVNPanel._instance = this;
    this._chars = deepClone(_state.chars);
    this._layers = deepClone(_state.layers);
    this._interactiveImages = deepClone(_state.interactiveImages);
    this._activeTab = 'scene';
    this._editBgId = null;
  }

  static DEFAULT_OPTIONS = {
    id: 'dd-vn-panel', tag: 'div',
    classes: ['drama-director', 'dd-vn-panel'],
    window: { title: 'Drama Director — Visual Novel', icon: 'fas fa-book-open', resizable: true },
    position: { width: 1060, height: 760 },
  };

  static PARTS = { form: { template: `modules/${MODULE_ID}/templates/vn-panel.hbs` } };

  async _prepareContext() {
    await getLanguagePromise();
    
    // Синхронизируем локальные копии с глобальным состоянием
    // Это предотвращает сброс позиции при изменении настроек в панели
    const s = DDVNManager.getState();
    
    // Обновляем локальные копии, сохраняя порядок и добавляя отсутствующие элементы
    this._chars = s.chars.map(c => {
      const existing = this._chars.find(ec => ec.id === c.id);
      return existing ? { ...existing, ...c } : deepClone(c);
    });
    this._layers = s.layers.map(l => {
      const existing = this._layers.find(el => el.id === l.id);
      return existing ? { ...existing, ...l } : deepClone(l);
    });
    this._interactiveImages = s.interactiveImages.map(img => {
      const existing = this._interactiveImages.find(ei => ei.id === img.id);
      return existing ? { ...existing, ...img } : deepClone(img);
    });
    
    const allBg = DDVNPresets.getAllBg();

    return {
      open: s.open,
      background: s.background,
      bgFit: s.bgFit,
      bgColor: s.bgColor,
      dimBg: s.dimBg,
      chars: this._chars.map((c, i) => ({ ...c, _idx: i })),
      leftChars: this._chars.filter(c => c.side === 'left').length,
      centerChars: this._chars.filter(c => c.side === 'center').length,
      rightChars: this._chars.filter(c => c.side === 'right').length,
      players: game.users.filter(u => !u.isGM).map(u => ({ id: u.id, name: u.name })),
      micOn: DDVNMic._active,
      micThreshold: DDVNMic.threshold,
      micLang: DDVNMic.lang,
      dialogue: s.dialogue,
      charPresets: DDVNPresets.listChars(),
      scenePresets: DDVNPresets.listScenes(),
      allBg,
      gmCharId: this._gmCharId || '',
      layers: this._layers.map((l, i) => ({ ...l, _idx: i })),
      interactiveImages: this._interactiveImages.map((img, i) => ({ ...img, _idx: i })),
      macros: (game.macros?.contents || []).map(m => ({ id: m.id, name: m.name })).sort((a,b) => a.name.localeCompare(b.name)),
      layerPresets: DDVNPresets.listLayers(),
      iimgPresets: DDVNPresets.listIimgs(),
      depthMode: s.depthMode,
    };
  }

  _onRender(ctx, opts) {
    super._onRender?.(ctx, opts);
    const el = this.element;

    el.querySelectorAll('.vn-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.vtab;
        el.querySelectorAll('.vn-tab').forEach(t => t.classList.toggle('active', t === tab));
        el.querySelectorAll('.vn-tab-content').forEach(c =>
          c.classList.toggle('dd-hidden', c.dataset.vtabContent !== this._activeTab));
      });
    });
    const activeTab = el.querySelector(`.vn-tab[data-vtab="${this._activeTab}"]`);
    if (activeTab) activeTab.click();

    el.querySelector('[data-action="vn-open"]')?.addEventListener('click', () => {
      DDVNManager.open(); this.render();
    });
    el.querySelector('[data-action="vn-open-local"]')?.addEventListener('click', () => {
      DDVNManager.openLocal(); this.render();
    });
    el.querySelector('[data-action="vn-close"]')?.addEventListener('click', () => {
      DDVNManager.stop(true); this.render();
    });

    el.querySelector('#vn-bg-path')?.addEventListener('change', e => {
      DDVNManager.setBackground(e.target.value);
    });
    el.querySelector('[data-action="vn-browse-bg"]')?.addEventListener('click', () => {
      this._openFilePicker('imagevideo', p => {
        console.log('DD VN | vn-browse-bg callback, path:', p);
        const inp = el.querySelector('#vn-bg-path');
        console.log('DD VN | input element:', inp);
        if (inp) {
          inp.value = p;
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        DDVNManager.setBackground(p);
      });
    });
    el.querySelector('#vn-bg-fit')?.addEventListener('change', e => {
      Object.assign(_state, { bgFit: e.target.value });
      DDVNManager.broadcast();
    });
    el.querySelector('#vn-bg-color')?.addEventListener('change', e => {
      DDVNManager.broadcast({ bgColor: e.target.value });
    });
    el.querySelector('#vn-dim')?.addEventListener('input', e => {
      DDVNManager.broadcast({ dimBg: Number(e.target.value) });
    });

    el.querySelectorAll('[data-bg-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        const src = btn.dataset.bgVariant;
        const inp = el.querySelector('#vn-bg-path');
        if (inp) inp.value = src;
        DDVNManager.setBackground(src);
        el.querySelectorAll('[data-bg-variant]').forEach(b => b.classList.toggle('vn-bg-tile-active', b === btn));
      });
    });

    el.querySelector('#vn-bg-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      el.querySelectorAll('.vn-bg-group').forEach(group => {
        const groupName = (group.dataset.bgGroupName || '').toLowerCase();
        let anyVisible = false;
        group.querySelectorAll('[data-bg-variant]').forEach(tile => {
          const tileName = (tile.dataset.bgVariantName || '').toLowerCase();
          const match = !q || groupName.includes(q) || tileName.includes(q);
          tile.style.display = match ? '' : 'none';
          if (match) anyVisible = true;
        });
        group.style.display = anyVisible ? '' : 'none';
      });
    });

    el.querySelector('[data-action="vn-bg-add"]')?.addEventListener('click', () => {
      this._showBgEditForm(el);
    });
    el.querySelectorAll('[data-bg-edit]').forEach(btn => {
      btn.addEventListener('click', () => this._showBgEditForm(el, btn.dataset.bgEdit));
    });
    el.querySelectorAll('[data-bg-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.bgDelete;
        if (!id) return;
        await DDVNPresets.deleteBg(id);
        this.render();
      });
    });
    el.querySelector('[data-action="vn-bg-edit-save"]')?.addEventListener('click', () => this._saveBgFromForm(el));
    el.querySelector('[data-action="vn-bg-edit-cancel"]')?.addEventListener('click', () => {
      el.querySelector('#vn-bg-edit-form')?.remove();
    });

    el.querySelectorAll('[data-bg-move]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const [id, dir] = btn.dataset.bgMove.split(':');
        const allCustom = DDVNPresets.listBg();
        const idx = allCustom.findIndex(b => b.id === id);
        if (idx < 0) return;
        const newIdx = dir === 'left' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= allCustom.length) return;
        const raw = DDVNPresets._g(DDVNPresets.BG_KEY);
        const keys = Object.keys(raw);
        const ki = keys.indexOf(id), kj = keys[newIdx];
        [raw[id], raw[kj]] = [raw[kj], raw[id]];
        const reordered = {};
        keys.forEach(k => { reordered[k] = raw[k]; });
        await game.settings.set(MODULE_ID, DDVNPresets.BG_KEY, reordered);
        this.render();
      });
    });

    this._bindCharEvents(el);
    this._bindTextPicsEvents(el);

    el.querySelector('[data-action="vn-chars-save"]')?.addEventListener('click', async () => {
      const name = el.querySelector('#vn-chars-preset-name')?.value?.trim();
      if (!name) return;
      await DDVNPresets.saveChars(name, deepClone(this._chars));
      ui.notifications.info(game.i18n.format('DRAMADIRECTOR.notifications.rosterSaved', {name}));
      this.render();
    });
    el.querySelector('[data-action="vn-chars-load"]')?.addEventListener('click', () => {
      const n = el.querySelector('#vn-chars-preset-select')?.value;
      const c = DDVNPresets.getChars(n);
      if (!c) return;
      this._chars = deepClone(c);
      DDVNManager.setChars(this._chars);
      this.render();
    });
    el.querySelector('[data-action="vn-chars-delete"]')?.addEventListener('click', async () => {
      const n = el.querySelector('#vn-chars-preset-select')?.value;
      if (!n) return;
      await DDVNPresets.deleteChars(n);
      this.render();
    });

    el.querySelector('[data-action="vn-dlg-show"]')?.addEventListener('click', () => {
      const name = el.querySelector('#vn-dlg-name')?.value || '';
      const text = el.querySelector('#vn-dlg-text')?.value || '';
      const color = el.querySelector('#vn-dlg-color')?.value || '#ffe066';
      const auto = Number(el.querySelector('#vn-dlg-auto')?.value) || 0;
      DDVNManager.showDialogue(name, text, color, auto);
    });
    el.querySelector('[data-action="vn-dlg-hide"]')?.addEventListener('click', () => DDVNManager.hideDialogue());
    el.querySelector('[data-action="vn-dlg-active"]')?.addEventListener('click', () => {
      const active = _state.chars.find(c => c.active);
      if (!active) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.noActiveChar'));
      const text = el.querySelector('#vn-dlg-text')?.value || '';
      DDVNManager.showDialogue(active.name, text, active.nameColor);
    });

    el.querySelector('[data-action="vn-mic-start"]')?.addEventListener('click', async () => {
      await DDVNMic.start(); this.render();
    });
    el.querySelector('[data-action="vn-mic-stop"]')?.addEventListener('click', () => {
      DDVNMic.stop(); this.render();
    });
    el.querySelector('#vn-mic-threshold')?.addEventListener('input', e => {
      DDVNMic.threshold = Number(e.target.value);
      const lbl = el.querySelector('#vn-mic-threshold-val');
      if (lbl) lbl.textContent = e.target.value;
    });
    el.querySelector('#vn-mic-lang')?.addEventListener('change', e => {
      DDVNMic.lang = e.target.value;
      const quickLang = document.getElementById('vn-quick-lang');
      if (quickLang) quickLang.value = e.target.value;
      if (DDVNMic._active) { DDVNMic.stop(); DDVNMic.start(); }
    });

    el.querySelector('#vn-gm-char')?.addEventListener('change', e => {
      this._gmCharId = e.target.value || null;
    });

    el.querySelector('[data-action="vn-scene-save"]')?.addEventListener('click', async () => {
      const name = el.querySelector('#vn-scene-name')?.value?.trim();
      if (!name) return;
      await DDVNPresets.saveScene(name, deepClone(_state));
      ui.notifications.info(game.i18n.format('DRAMADIRECTOR.notifications.sceneSaved', {name}));
      this.render();
    });
    el.querySelector('[data-action="vn-scene-load"]')?.addEventListener('click', () => {
      const n = el.querySelector('#vn-scene-select')?.value;
      if (!n) return;
      const s = DDVNPresets.getScene(n);
      if (!s) return;
      DDVNManager.applySceneState(s);
      this.render();
      ui.notifications.info(game.i18n.format('DRAMADIRECTOR.notifications.sceneLoaded', {name: n}));
    });
    el.querySelector('[data-action="vn-scene-delete"]')?.addEventListener('click', async () => {
      const n = el.querySelector('#vn-scene-select')?.value;
      if (!n) return;
      await DDVNPresets.deleteScene(n); this.render();
    });

    el.querySelectorAll('.vn-macro-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pre = btn.closest('.vn-macro-wrap')?.querySelector('.vn-macro-example');
        if (!pre) return;
        navigator.clipboard.writeText(pre.textContent).then(() => {
          btn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
        });
      });
    });
  }

  _bindTextPicsEvents(el) {
    el.querySelector('[data-action="vn-layer-add-img"]')?.addEventListener('click', () => {
      this._layers.push(newLayer('image'));
      DDVNManager.setLayers(this._layers);
      this.render();
    });
    el.querySelector('[data-action="vn-layer-add-text"]')?.addEventListener('click', () => {
      this._layers.push(newLayer('text'));
      DDVNManager.setLayers(this._layers);
      this.render();
    });

    el.querySelectorAll('[data-layer-idx]').forEach(row => {
      const idx = Number(row.dataset.layerIdx);
      const layer = this._layers[idx];
      if (!layer) return;

      row.querySelector('[data-layer-action="remove"]')?.addEventListener('click', () => {
        this._layers.splice(idx, 1);
        DDVNManager.setLayers(this._layers);
        this.render();
      });
      row.querySelector('[data-layer-action="move-up"]')?.addEventListener('click', () => {
        if (idx > 0) {
          [this._layers[idx-1], this._layers[idx]] = [this._layers[idx], this._layers[idx-1]];
          DDVNManager.setLayers(this._layers); this.render();
        }
      });
      row.querySelector('[data-layer-action="move-down"]')?.addEventListener('click', () => {
        if (idx < this._layers.length - 1) {
          [this._layers[idx], this._layers[idx+1]] = [this._layers[idx+1], this._layers[idx]];
          DDVNManager.setLayers(this._layers); this.render();
        }
      });
      row.querySelector('[data-layer-action="browse"]')?.addEventListener('click', () => {
        this._openFilePicker(layer.type === 'image' ? 'image' : 'any', p => {
          console.log('DD VN | layer browse callback, path:', p);
          this._layers[idx].src = p;
          const inp = row.querySelector('.vn-layer-src-inp');
          if (inp) {
            inp.value = p;
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          }
          DDVNManager.setLayers(this._layers);
        });
      });

      row.querySelectorAll('input, select, textarea').forEach(inp => {
        inp.addEventListener('change', () => this._syncLayerRow(idx, row));
        inp.addEventListener('input', () => this._syncLayerRow(idx, row));
      });
    });

    el.querySelector('[data-action="vn-layers-save"]')?.addEventListener('click', async () => {
      const name = el.querySelector('#vn-layers-preset-name')?.value?.trim();
      if (!name) return;
      await DDVNPresets.saveLayers(name, deepClone(this._layers));
      ui.notifications.info(`Layers preset "${name}" saved.`);
      this.render();
    });
    el.querySelector('[data-action="vn-layers-load"]')?.addEventListener('click', () => {
      const n = el.querySelector('#vn-layers-preset-select')?.value;
      const layers = DDVNPresets.getLayers(n);
      if (!layers) return;
      this._layers = deepClone(layers);
      DDVNManager.setLayers(this._layers);
      this.render();
    });
    el.querySelector('[data-action="vn-layers-delete"]')?.addEventListener('click', async () => {
      const n = el.querySelector('#vn-layers-preset-select')?.value;
      if (!n) return;
      await DDVNPresets.deleteLayers(n); this.render();
    });
    el.querySelector('[data-action="vn-layers-macro"]')?.addEventListener('click', () => {
      const code = `// Apply VN layers
const layers = ${JSON.stringify(this._layers, null, 2)};
game.dramaDirector.vn.setLayers(layers);`;
      const wrap = el.querySelector('#vn-layers-macro-wrap');
      if (wrap) { wrap.style.display = ''; wrap.querySelector('.vn-macro-example').textContent = code; }
    });
    el.querySelector('[data-action="vn-layers-clear"]')?.addEventListener('click', () => {
      this._layers = [];
      DDVNManager.setLayers(this._layers);
      this.render();
    });

    el.querySelector('[data-action="vn-iimg-add"]')?.addEventListener('click', () => {
      this._interactiveImages.push(newInteractiveImage());
      DDVNManager.setInteractiveImages(this._interactiveImages);
      this.render();
    });

    el.querySelectorAll('[data-iimg-idx]').forEach(row => {
      const idx = Number(row.dataset.iimgIdx);
      if (!this._interactiveImages[idx]) return;

      row.querySelector('[data-iimg-action="remove"]')?.addEventListener('click', () => {
        this._interactiveImages.splice(idx, 1);
        DDVNManager.setInteractiveImages(this._interactiveImages);
        this.render();
      });
      row.querySelector('[data-iimg-action="browse"]')?.addEventListener('click', () => {
        this._openFilePicker('image', p => {
          console.log('DD VN | iimg browse callback, path:', p);
          this._interactiveImages[idx].src = p;
          const inp = row.querySelector('.vn-iimg-src-inp');
          if (inp) {
            inp.value = p;
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          }
          DDVNManager.setInteractiveImages(this._interactiveImages);
        });
      });

      row.querySelectorAll('input, select').forEach(inp => {
        inp.addEventListener('change', () => this._syncIimgRow(idx, row));
        inp.addEventListener('input', () => this._syncIimgRow(idx, row));
      });
    });

    el.querySelector('[data-action="vn-iimg-save"]')?.addEventListener('click', async () => {
      const name = el.querySelector('#vn-iimg-preset-name')?.value?.trim();
      if (!name) return;
      await DDVNPresets.saveIimgs(name, deepClone(this._interactiveImages));
      ui.notifications.info(`Interactive images preset "${name}" saved.`);
      this.render();
    });
    el.querySelector('[data-action="vn-iimg-load"]')?.addEventListener('click', () => {
      const n = el.querySelector('#vn-iimg-preset-select')?.value;
      const imgs = DDVNPresets.getIimgs(n);
      if (!imgs) return;
      this._interactiveImages = deepClone(imgs);
      DDVNManager.setInteractiveImages(this._interactiveImages);
      this.render();
    });
    el.querySelector('[data-action="vn-iimg-delete"]')?.addEventListener('click', async () => {
      const n = el.querySelector('#vn-iimg-preset-select')?.value;
      if (!n) return;
      await DDVNPresets.deleteIimgs(n); this.render();
    });
    el.querySelector('[data-action="vn-iimg-macro"]')?.addEventListener('click', () => {
      const code = `// Apply VN interactive images
const images = ${JSON.stringify(this._interactiveImages, null, 2)};
game.dramaDirector.vn.setInteractiveImages(images);`;
      const wrap = el.querySelector('#vn-iimg-macro-wrap');
      if (wrap) { wrap.style.display = ''; wrap.querySelector('.vn-macro-example').textContent = code; }
    });
    el.querySelector('[data-action="vn-iimg-clear"]')?.addEventListener('click', () => {
      this._interactiveImages = [];
      DDVNManager.setInteractiveImages(this._interactiveImages);
      this.render();
    });
  }

  _syncLayerRow(idx, row) {
    const l = this._layers[idx];
    if (!l) return;
    const q = s => row.querySelector(s);
    l.name = q('.vn-layer-name-inp')?.value ?? l.name;
    l.src = q('.vn-layer-src-inp')?.value ?? l.src;
    l.text = q('.vn-layer-text-inp')?.value ?? l.text;
    l.x = Number(q('.vn-layer-x')?.value) || 0;
    l.y = Number(q('.vn-layer-y')?.value) || 0;
    l.zIndex = Number(q('.vn-layer-z')?.value) || 0;
    l.width = Number(q('.vn-layer-w')?.value) || 300;
    l.height = Number(q('.vn-layer-h')?.value) || 200;
    l.opacity = parseFloat(q('.vn-layer-opacity')?.value ?? 1);
    l.baseScale = parseFloat(q('.vn-layer-scale')?.value ?? 1);
    // В режиме глубины — пересчитываем
    if (_state.depthMode) {
      l.scale  = parseFloat((l.baseScale * DDVNOverlay._perspectiveFactor(DDVNOverlay._depthY('layer', l))).toFixed(3));
      l.zIndex = DDVNOverlay._depthZ('layer', l);
    } else {
      l.scale = l.baseScale;
    }
    l.fontSize = Number(q('.vn-layer-fontsize')?.value) || 28;
    l.color = q('.vn-layer-color')?.value ?? l.color;
    l.textAlign = q('.vn-layer-align')?.value ?? l.textAlign;
    l.visible = q('.vn-layer-visible')?.checked !== false;
    ['.vn-layer-x', '.vn-layer-y', '.vn-layer-z', '.vn-layer-w', '.vn-layer-h', '.vn-layer-opacity', '.vn-layer-scale', '.vn-layer-fontsize'].forEach(sel => {
      const inp = q(sel);
      if (inp?.nextElementSibling?.classList.contains('vn-slider-val')) {
        inp.nextElementSibling.textContent = inp.value;
      }
    });
    DDVNManager.setLayers(this._layers);
  }

  _syncIimgRow(idx, row) {
    const img = this._interactiveImages[idx];
    if (!img) return;
    const q = s => row.querySelector(s);
    img.name = q('.vn-iimg-name-inp')?.value ?? img.name;
    img.src = q('.vn-iimg-src-inp')?.value ?? img.src;
    img.macroId = q('.vn-iimg-macro-sel')?.value ?? img.macroId;
    img.x = Number(q('.vn-iimg-x')?.value) || 0;
    img.y = Number(q('.vn-iimg-y')?.value) || 0;
    img.zIndex = Number(q('.vn-iimg-z')?.value) || 0;
    img.width = Number(q('.vn-iimg-w')?.value) || 200;
    img.height = Number(q('.vn-iimg-h')?.value) || 200;
    img.opacity = parseFloat(q('.vn-iimg-opacity')?.value ?? 1);
    img.baseScale = parseFloat(q('.vn-iimg-scale')?.value ?? 1);
    // В режиме глубины — пересчитываем
    if (_state.depthMode) {
      img.scale  = parseFloat((img.baseScale * DDVNOverlay._perspectiveFactor(DDVNOverlay._depthY('interactive', img))).toFixed(3));
      img.zIndex = DDVNOverlay._depthZ('interactive', img);
    } else {
      img.scale = img.baseScale;
    }
    img.visible = q('.vn-iimg-visible')?.checked !== false;
    ['.vn-iimg-x', '.vn-iimg-y', '.vn-iimg-z', '.vn-iimg-w', '.vn-iimg-h', '.vn-iimg-opacity', '.vn-iimg-scale'].forEach(sel => {
      const inp = q(sel);
      if (inp?.nextElementSibling?.classList.contains('vn-slider-val')) {
        inp.nextElementSibling.textContent = inp.value;
      }
    });
    DDVNManager.setInteractiveImages(this._interactiveImages);
  }

  _syncCharsFromState() {
    this._chars = deepClone(_state.chars);
    this._layers = deepClone(_state.layers);
    this._interactiveImages = deepClone(_state.interactiveImages);
  }

  _bindCharEvents(el) {
    el.querySelector('[data-action="vn-deactivate-all"]')?.addEventListener('click', () => {
      DDVNManager.deactivateAll();
      this.render();
    });
    el.querySelector('[data-action="vn-char-add-left"]')?.addEventListener('click', () => {
      const count = this._chars.filter(c => c.side === 'left').length;
      if (count >= 10) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.maxChars'));
      const char = newChar('left', count);
      this._chars.push(char);
      DDVNManager.setChars(this._chars);
      this.render();
    });
    el.querySelector('[data-action="vn-char-add-center"]')?.addEventListener('click', () => {
      const count = this._chars.filter(c => c.side === 'center').length;
      if (count >= 5) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.maxChars'));
      const char = newChar('center', count);
      this._chars.push(char);
      DDVNManager.setChars(this._chars);
      this.render();
    });
    el.querySelector('[data-action="vn-char-add-right"]')?.addEventListener('click', () => {
      const count = this._chars.filter(c => c.side === 'right').length;
      if (count >= 10) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.maxChars'));
      const char = newChar('right', count);
      this._chars.push(char);
      DDVNManager.setChars(this._chars);
      this.render();
    });

    el.querySelector('#vn-char-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      el.querySelectorAll('.vn-char-row').forEach(row => {
        const name = (row.dataset.charName || '').toLowerCase();
        row.style.display = !q || name.includes(q) ? '' : 'none';
      });
    });

    el.querySelectorAll('.vn-char-row').forEach(row => {
      const idx = Number(row.dataset.charIdx);
      const char = this._chars[idx];
      if (!char) return;

      row.querySelectorAll('input, select').forEach(inp => {
        inp.addEventListener('input', () => this._syncCharRow(idx, row));
      });

      row.querySelectorAll('[data-char-action]').forEach(btn => {
        const action = btn.dataset.charAction;
        btn.addEventListener('click', () => {
          if (action === 'active') {
            this._chars.forEach((c, i) => { c.active = i === idx ? !c.active : false; });
            DDVNManager.setChars(this._chars);
            this.render();
          } else if (action === 'switch-side') {
            const sides = ['left', 'center', 'right'];
            const currentIdx = sides.indexOf(char.side);
            char.side = sides[(currentIdx + 1) % sides.length];
            this._recalcSlots();
            DDVNManager.setChars(this._chars);
            this.render();
          } else if (action === 'move-up') {
            if (idx > 0) {
              const sameSide = this._chars.filter(c => c.side === char.side);
              const sameIdx = sameSide.indexOf(char);
              if (sameIdx > 0) {
                const other = sameSide[sameIdx - 1];
                const temp = char.slot;
                char.slot = other.slot;
                other.slot = temp;
                this._sortChars();
                DDVNManager.setChars(this._chars);
              }
            }
            this.render();
          } else if (action === 'move-down') {
            const sameSide = this._chars.filter(c => c.side === char.side);
            const sameIdx = sameSide.indexOf(char);
            if (sameIdx < sameSide.length - 1) {
              const other = sameSide[sameIdx + 1];
              const temp = char.slot;
              other.slot = temp;
              other.slot = temp;
              this._sortChars();
              DDVNManager.setChars(this._chars);
            }
            this.render();
          } else if (action === 'remove') {
            this._chars.splice(idx, 1);
            this._recalcSlots();
            DDVNManager.setChars(this._chars);
            this.render();
          } else if (action === 'browse') {
            this._openFilePicker('image', p => {
              console.log('DD VN | browse callback, path:', p, 'char:', char);
              char.img = p;
              const inp = row.querySelector('.vn-char-img-inp');
              console.log('DD VN | input element:', inp);
              if (inp) {
                inp.value = p;
                inp.dispatchEvent(new Event('change', { bubbles: true }));
              }
              DDVNManager.setChars(this._chars);
              this.render();
            });
          } else if (action === 'browse-active') {
            this._openFilePicker('image', p => {
              console.log('DD VN | browse-active callback, path:', p, 'char:', char);
              char.activeImg = p;
              const inp = row.querySelector('.vn-char-active-img-inp');
              console.log('DD VN | input element:', inp);
              if (inp) {
                inp.value = p;
                inp.dispatchEvent(new Event('change', { bubbles: true }));
              }
              DDVNManager.setChars(this._chars);
              this.render();
            });
          }
        });
      });
    });
  }

  _syncCharRow(idx, row) {
    const c = this._chars[idx];
    if (!c) return;
    c.name = row.querySelector('.vn-char-name-inp')?.value ?? c.name;
    c.nameColor = row.querySelector('.vn-char-ncolor')?.value ?? c.nameColor;
    c.title = row.querySelector('.vn-char-title-inp')?.value ?? c.title;
    c.img = row.querySelector('.vn-char-img-inp')?.value ?? c.img;
    c.activeImg = row.querySelector('.vn-char-active-img-inp')?.value ?? c.activeImg;
    c.baseScale = parseFloat(row.querySelector('.vn-char-scale')?.value) || 1;
    c.x = Number(row.querySelector('.vn-char-x')?.value) || 0;
    c.y = Number(row.querySelector('.vn-char-y')?.value) || 0;
    c.zIndex = Number(row.querySelector('.vn-char-z')?.value) || 0;
    c.mirror = row.querySelector('.vn-char-mirror')?.checked ?? false;
    c.visible = row.querySelector('.vn-char-visible')?.checked ?? true;
    c.playerId = row.querySelector('.vn-char-player')?.value || null;
    c.locked = row.querySelector('.vn-char-locked')?.checked ?? false;
    // В режиме глубины scale пересчитывается из baseScale + Y; иначе scale = baseScale
    if (_state.depthMode) {
      c.scale  = parseFloat((c.baseScale * DDVNOverlay._perspectiveFactor(DDVNOverlay._depthY('char', c))).toFixed(3));
      c.zIndex = DDVNOverlay._depthZ('char', c);
    } else {
      c.scale = c.baseScale;
    }

    row.querySelectorAll('.vn-slider-val').forEach(v => {
      const inp = v.previousElementSibling;
      if (inp) v.textContent = inp.value;
    });

    DDVNManager.setChars(this._chars);
  }

  _recalcSlots() {
    let l = 0, c = 0, r = 0;
    this._chars.forEach(char => {
      if (char.side === 'left') char.slot = l++;
      else if (char.side === 'center') char.slot = c++;
      else char.slot = r++;
    });
  }

  _sortChars() {
    this._chars.sort((a, b) => {
      if (a.side !== b.side) {
        const order = { left: 0, center: 1, right: 2 };
        return order[a.side] - order[b.side];
      }
      return a.slot - b.slot;
    });
  }

  _openFilePicker(type, callback) {
    // Foundry V13: FilePicker API
    const FilePickerClass = foundry.applications.apps.FilePicker.implementation;
    
    const fp = new FilePickerClass({
      type: type,
      callback: (path) => {
        console.log('DD VN | FilePicker callback path:', path);
        // Call the original callback and trigger change event
        callback(path);
      }
    });
    
    console.log('DD VN | FilePicker instance created');
    
    fp.render({ force: true });
  }

  _showBgEditForm(el, editId = null) {
    const existingForm = el.querySelector('#vn-bg-edit-form');
    if (existingForm) existingForm.remove();

    const editBg = editId ? DDVNPresets.listBg().find(b => b.id === editId) : null;

    const form = document.createElement('div');
    form.id = 'vn-bg-edit-form';
    form.className = 'vn-bg-edit-form';
    form.innerHTML = `
      <h4>${editBg ? game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.titleEdit') : game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.titleAdd')}</h4>
      <div class="dd-row">
        <label>${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.name')}</label>
        <input type="text" id="vn-bg-edit-name" class="dd-input" value="${editBg?.name || ''}" placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.name')}"/>
      </div>
      <div id="vn-bg-edit-variants">
        ${(editBg?.variants || [{name: '', src: ''}]).map((v, i) => `
          <div class="vn-bg-edit-variant" data-variant-idx="${i}">
            <div class="dd-row">
              <input type="text" class="vn-bg-edit-vname dd-input" value="${v.name || ''}" placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.variantName')}"/>
              <input type="text" class="vn-bg-edit-vpath dd-input" value="${v.src || ''}" placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.variantPath')}"/>
              <button type="button" class="dd-icon-btn vn-bg-edit-browse"><i class="fas fa-folder-open"></i></button>
              ${i > 0 ? '<button type="button" class="dd-icon-btn dd-danger-btn vn-bg-edit-vdel"><i class="fas fa-times"></i></button>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <button type="button" class="vn-btn-add" id="vn-bg-edit-add-variant"><i class="fas fa-plus"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.addVariant')}</button>
      <div class="dd-row" style="margin-top:8px">
        <button type="button" class="vn-btn-secondary" data-action="vn-bg-edit-cancel">${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.cancel')}</button>
        <button type="button" class="vn-btn-primary" data-action="vn-bg-edit-save">${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.save')}</button>
      </div>
    `;

    const bgSection = el.querySelector('.vn-bg-group:last-child')?.parentElement || el.querySelector('.dd-section');
    bgSection?.appendChild(form);

    form.querySelector('#vn-bg-edit-add-variant')?.addEventListener('click', () => {
      const variantsContainer = form.querySelector('#vn-bg-edit-variants');
      const count = variantsContainer.querySelectorAll('.vn-bg-edit-variant').length;
      if (count >= 3) {
        ui.notifications?.warn(game.i18n.localize('DRAMADIRECTOR.notifications.maxVariants'));
        return;
      }
      const newVariant = document.createElement('div');
      newVariant.className = 'vn-bg-edit-variant';
      newVariant.dataset.variantIdx = count;
      newVariant.innerHTML = `
        <div class="dd-row">
          <input type="text" class="vn-bg-edit-vname dd-input" value="" placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.variantName')}"/>
          <input type="text" class="vn-bg-edit-vpath dd-input" value="" placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.variantPath')}"/>
          <button type="button" class="dd-icon-btn vn-bg-edit-browse"><i class="fas fa-folder-open"></i></button>
          <button type="button" class="dd-icon-btn dd-danger-btn vn-bg-edit-vdel"><i class="fas fa-times"></i></button>
        </div>
      `;
      variantsContainer.appendChild(newVariant);
      this._bindVariantEvents(newVariant);
    });

    form.querySelectorAll('.vn-bg-edit-variant').forEach(v => this._bindVariantEvents(v));

    form.querySelector('[data-action="vn-bg-edit-cancel"]')?.addEventListener('click', () => form.remove());
    form.querySelector('[data-action="vn-bg-edit-save"]')?.addEventListener('click', async () => {
      const name = form.querySelector('#vn-bg-edit-name')?.value?.trim();
      if (!name) {
        ui.notifications?.warn(game.i18n.localize('DRAMADIRECTOR.notifications.bgNameRequired'));
        return;
      }

      const variants = [];
      form.querySelectorAll('.vn-bg-edit-variant').forEach(vRow => {
        const vName = vRow.querySelector('.vn-bg-edit-vname')?.value?.trim();
        const vPath = vRow.querySelector('.vn-bg-edit-vpath')?.value?.trim();
        if (vPath) variants.push({ name: vName || vPath.split('/').pop(), src: vPath });
      });

      if (!variants.length) {
        ui.notifications?.warn(game.i18n.localize('DRAMADIRECTOR.notifications.bgVariantRequired'));
        return;
      }

      const bgId = editId || `bg-${Date.now()}`;
      await DDVNPresets.saveBg(bgId, { name, variants });
      form.remove();
      this.render();
    });
  }

  _bindVariantEvents(vRow) {
    vRow.querySelector('.vn-bg-edit-browse')?.addEventListener('click', () => {
      this._openFilePicker('imagevideo', p => {
        const inp = vRow.querySelector('.vn-bg-edit-vpath');
        if (inp) {
          inp.value = p;
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
    vRow.querySelector('.vn-bg-edit-vdel')?.addEventListener('click', () => vRow.remove());
  }

  async _saveBgFromForm(el) {
    // This is handled in _showBgEditForm now
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNApi {
  static open() { DDVNManager.open(); }
  static openLocal() { DDVNManager.openLocal(); }
  static stop() { DDVNManager.stop(true); }
  static setBackground(path) { DDVNManager.setBackground(path); }
  static setChars(chars) { DDVNManager.setChars(chars); }
  static setLayers(layers) { DDVNManager.setLayers(layers); }
  static setInteractiveImages(images) { DDVNManager.setInteractiveImages(images); }
  static showDialogue(name, text, color, autoClose) { DDVNManager.showDialogue(name, text, color, autoClose); }
  static hideDialogue() { DDVNManager.hideDialogue(); }
  static activateExclusive(id) { DDVNManager.activateExclusive(id); }
  static deactivateAll() { DDVNManager.deactivateAll(); }
  static openPanel() {
    if (DDVNPanel._instance) {
      DDVNPanel._instance.render({force: true});
    } else {
      new DDVNPanel().render({force: true});
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
export function initVNSystem() {
  DDVNPresets.register();

  game.socket.on(SOCKET, (data) => {
    if (data.type === 'vn:state') {
      if (DDVNManager.isGmOnlyMode() && !game.user?.isGM) return;
      DDVNManager.applyRemote(data.state);
    } else if (data.type === 'vn:subtitle') {
      DDVNOverlay.showSubtitle(data.name, data.text, data.color, data.charId);
    }
  });

  Hooks.on('getSceneControlButtons', (buttons) => {
    if (!game.user?.isGM) return;
    const tool = {
      name: 'vn',
      title: 'Visual Novel',
      icon: 'fas fa-book-open',
      onClick: () => DDVNApi.openPanel(),
      button: true
    };
    const tokenTools = buttons.find(b => b.name === 'token');
    if (tokenTools) tokenTools.tools.push(tool);
  });
}
