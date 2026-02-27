/**
 * Drama Director — Visual Novel Mode
 */

import { getLanguagePromise } from './drama-director.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = 'drama-director';
const SOCKET    = `module.${MODULE_ID}`;

function deepClone(o) { return foundry.utils.deepClone(o); }
function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Встроенные фоны ─────────────────────────────────────────────────────────
// Built-in backgrounds — names are resolved lazily via i18n keys so they
// work regardless of language load order.
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

// Resolve i18n names at call-time (game.i18n is ready by then)
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
    playerId: null, active: false, visible: true,
    scale: 1.0, mirror: false, nameColor: '#ffe066',
    x: 0, y: 0, zIndex: 0 };
}

export function newLayer(type = 'image') {
  return { id: uid(), type, name: '',
    src: '', text: '',
    x: 760, y: 400, zIndex: 0,
    width: 400, height: 300, scale: 1,
    fontSize: 28, color: '#ffffff', fontFamily: 'inherit',
    textAlign: 'center', opacity: 1, visible: true };
}

export function newInteractiveImage() {
  return { id: uid(), name: '', src: '',
    x: 900, y: 500, zIndex: 10,
    width: 200, height: 200, scale: 1, macroId: '',
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
};

// ─── Глобальные z-index базы ─────────────────────────────────────────────────
// Все элементы используют ОБЩУЮ базу z-index для полной свободы перекрытия
const ZINDEX_BASE = {
  ALL: 100,  // Общая база для всех: персонажи, слои, интерактивные изображения
};

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNOverlay {
  static ID = 'dd-vn-overlay';
  static _lastBg = ''; // Запоминаем последний установленный фон

  static build() {
    if (document.getElementById(this.ID)) return;
    const el = document.createElement('div');
    el.id = this.ID;
    el.innerHTML = `
      <div class="vn-bg-layer" id="vn-bg-layer"></div>
      <div class="vn-stage" id="vn-stage">
        <!-- Единый контейнер для всех элементов с z-index -->
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

    // Кнопки быстрого доступа к вкладкам сайдбара (Foundry v13: renderPopout())
    el.querySelectorAll('[data-sidebar-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.sidebarTab;
        const tab = ui[tabName];
        if (tab?.renderPopout) {
          // v13 API
          tab.renderPopout();
        } else if (tab?.popOut !== undefined) {
          // v12 fallback
          tab.renderPopout?.();
        }
      });
    });

    el.querySelector('#vn-mic-toggle')?.addEventListener('click', async () => {
      if (DDVNMic._active) {
        DDVNMic.stop();
      } else {
        await DDVNMic.start();
      }
      this.updateMicIndicator();
    });

    // Обработчик смены языка в quick-bar
    el.querySelector('#vn-quick-lang')?.addEventListener('change', (e) => {
      const lang = e.target.value;
      DDVNMic.lang = lang;
      // Синхронизируем с панелью настроек
      const panelLang = document.getElementById('vn-mic-lang');
      if (panelLang) panelLang.value = lang;
      // Перезапускаем распознавание с новым языком
      if (DDVNMic._active) {
        DDVNMic.stop();
        DDVNMic.start();
      }
    });

    window.addEventListener('resize', () => this.fitStage());
    this.fitStage();
  }

  static fitStage() {
    const stage = document.getElementById('vn-stage');
    if (!stage) return;
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
  }

  static clearStage() {
    // Очищаем единый контейнер
    const container = document.getElementById('vn-unified-container');
    if (container) container.innerHTML = '';

    // Скрываем диалоговое окно
    const dialogue = document.getElementById('vn-dialogue');
    if (dialogue) dialogue.style.display = 'none';

    // Очищаем субтитры
    this.hideAllSubtitles();

    console.log('DD VN | Stage cleared');
  }

  static apply(state) {
    let overlay = document.getElementById(this.ID);
    if (!overlay) { 
      this.build(); 
      overlay = document.getElementById(this.ID);
    }
    if (!overlay) {
      console.error('DD VN | Cannot create overlay!');
      return;
    }

    console.log('DD VN | Apply state:', state);
    
    // Используем opacity для плавной анимации
    if (state.open) overlay.classList.add('interactive');
    else overlay.classList.remove('interactive');
    this._renderBg(state);
    // Единый рендеринг всех элементов с учётом z-index
    this._renderAllElements(state);
    this._renderDialogue(state.dialogue);
    this._renderNameBar(state.chars || []);

    const gmBar = document.getElementById('vn-gm-bar');
    if (gmBar) gmBar.style.display = (state.open && game.user?.isGM) ? 'flex' : 'none';
    
    // Показывать quick-bar всем когда VN открыта
    const quickBar = document.getElementById('vn-quick-bar');
    if (quickBar) quickBar.style.display = state.open ? 'flex' : 'none';
    this.updateMicIndicator();

    // GM левая панель
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
    
    // Синхронизируем язык в quick-bar с текущим значением
    const quickLang = document.getElementById('vn-quick-lang');
    if (quickLang && DDVNMic.lang) {
      quickLang.value = DDVNMic.lang;
    }
    // Синхронизируем язык в панели настроек
    const panelLang = document.getElementById('vn-mic-lang');
    if (panelLang && DDVNMic.lang) {
      panelLang.value = DDVNMic.lang;
    }
  }

  static ensureOpen() {
    if (!_state.open) {
      _state.open = true;
      this.broadcast();
    }
  }

  static _renderBg(state) {
    const bg = document.getElementById('vn-bg-layer');
    if (!bg) return;
    
    const currentSrc = bg.dataset.src || '';
    const stateBg = state.background || '';
    
    // Запоминаем последний установленный фон
    if (stateBg) this._lastBg = stateBg;
    
    bg.style.backgroundColor = state.bgColor || '#0a0a14';
    bg.style.setProperty('--vn-dim', String(state.dimBg || 0));

    // Используем: state фон -> последний запомненный -> текущий в DOM
    let bgToRender = stateBg || this._lastBg || currentSrc;
    
    // Никогда не очищаем фон если он уже установлен
    if (!bgToRender && !currentSrc && !this._lastBg) {
      return;
    }
    
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
        bg.style.backgroundSize   = state.bgFit || 'cover';
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

    // Проверяем есть ли активный персонаж
    const hasActive = chars.some(c => c && c.active && c.visible !== false);

    // Собираем все элементы с их z-index и позицией
    const allElements = [];

    // ─── Персонажи ───
    // Группируем по сторонам для расчёта позиций
    const leftChars = chars.filter(c => c && c.side === 'left' && c.visible !== false).sort((a, b) => (a.slot || 0) - (b.slot || 0));
    const centerChars = chars.filter(c => c && c.side === 'center' && c.visible !== false).sort((a, b) => (a.slot || 0) - (b.slot || 0));
    const rightChars = chars.filter(c => c && c.side === 'right' && c.visible !== false).sort((a, b) => (a.slot || 0) - (b.slot || 0));

    // Функция для расчёта базовой позиции персонажа по стороне и слоту
    const calcCharBasePos = (side, slot, totalOnSide) => {
      // Базовые координаты для каждой стороны
      const basePositions = {
        left: { x: 250, y: 1080 },    // Нижняя левая область
        center: { x: 960, y: 1080 },  // Нижняя центральная область
        right: { x: 1670, y: 1080 }   // Нижняя правая область
      };
      const base = basePositions[side];
      
      // Динамический расчёт ширины и перекрытия
      let baseWidth = side === 'center' ? 380 : 420;
      let overlap = 0;
      
      if (totalOnSide <= 3) {
        baseWidth = side === 'center' ? 350 : 420;
        overlap = 0;
      } else if (totalOnSide <= 5) {
        baseWidth = side === 'center' ? 280 : 350;
        overlap = 30;
      } else if (totalOnSide <= 8) {
        baseWidth = side === 'center' ? 220 : 280;
        overlap = 50;
      } else {
        baseWidth = side === 'center' ? 180 : 220;
        overlap = 70;
      }

      // Смещение по слоту
      const slotOffset = slot * (baseWidth - overlap);
      
      // Для левой стороны - персонажи идут слева направо
      // Для центра - центрируются
      // Для правой стороны - персонажи идут справа налево
      let x = base.x;
      if (side === 'left') {
        x = 100 + slotOffset;
      } else if (side === 'center') {
        x = 960 - (totalOnSide * (baseWidth - overlap)) / 2 + slotOffset;
      } else if (side === 'right') {
        x = 1820 - slotOffset - baseWidth;
      }

      return { x, y: base.y, width: baseWidth };
    };

    // Добавляем персонажей
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

    // ─── Слои (Layers) ───
    layers.filter(l => l.visible !== false).forEach(layer => {
      allElements.push({
        type: 'layer',
        data: layer,
        zIndex: ZINDEX_BASE.ALL + (layer.zIndex ?? 0)
      });
    });

    // ─── Интерактивные изображения ───
    interactiveImages.filter(img => img.visible !== false && img.src).forEach(image => {
      allElements.push({
        type: 'interactive',
        data: image,
        zIndex: ZINDEX_BASE.ALL + (image.zIndex ?? 0)
      });
    });

    // Сортируем по z-index (меньшие значения — ниже)
    allElements.sort((a, b) => a.zIndex - b.zIndex);

    // ─── Рендерим все элементы ───
    allElements.forEach(elem => {
      const el = document.createElement('div');

      if (elem.type === 'char') {
        const char = elem.data;
        const visClass = !hasActive ? 'vn-char-all-visible' : (char.active ? 'vn-char-active' : 'vn-char-dim');
        const charColor = char.nameColor || '#ffe066';
        const charScale = char.scale || 1;
        const offsetX = char.x || 0;
        const offsetY = char.y || 0;
        const mirror = elem.side === 'center' 
          ? (char.mirror ? -1 : 1) 
          : ((char.mirror ? 1 : 0) ^ (elem.side === 'right' ? 1 : 0));

        el.className = `vn-char ${visClass}`;
        el.dataset.charId = char.id;
        // Контейнер полностью без pointer-events
        el.style.cssText = `position:absolute;left:${elem.baseX + offsetX}px;bottom:0;width:${elem.width}px;height:900px;z-index:${elem.zIndex};pointer-events:none;`;

        // Рендерим изображения с поддержкой активного портрета
        const hasMainImg = char.img?.trim();
        const hasActiveImg = char.activeImg?.trim();
        const isActive = char.active;

        // Генерируем уникальный ID для изображений чтобы найти их позже
        const imgId = `char-img-${char.id}-${Date.now()}`;

        let portraitHtml;
        if (hasMainImg || hasActiveImg) {
          const mainSrc = hasMainImg ? char.img : char.activeImg;
          if (hasActiveImg && hasMainImg) {
            portraitHtml = `
              <div class="vn-char-img-wrap" id="${imgId}-wrap">
                <img class="vn-char-img-base ${isActive ? 'vn-img-hidden' : ''}"
                     id="${imgId}-base"
                     src="${char.img}"
                     alt="${char.name || ''}"
                     style="pointer-events:auto;cursor:pointer;"
                     onerror="this.style.display='none'"/>
                <img class="vn-char-img-active ${isActive ? 'vn-img-visible' : ''}"
                     id="${imgId}-active"
                     src="${char.activeImg}"
                     alt="${char.name || ''}"
                     style="pointer-events:auto;cursor:pointer;"
                     onerror="this.style.display='none'"/>
              </div>`;
          } else {
            portraitHtml = `<img id="${imgId}" src="${mainSrc}" alt="${char.name || ''}" style="pointer-events:auto;cursor:pointer;" onerror="this.parentElement.innerHTML='<div class=\\'vn-char-empty\\'><i class=\\'fas fa-user\\'></i></div>'"/>`;
          }
        } else {
          portraitHtml = `<div class="vn-char-empty"><i class="fas fa-user"></i></div>`;
        }

        const glowStyle = char.active ? `filter: drop-shadow(0 0 20px ${charColor}) drop-shadow(0 0 40px ${charColor}80);` : '';

        // wrapper без pointer-events
        el.innerHTML = `
          <div class="vn-char-wrapper" style="transform:translateY(${offsetY}px);pointer-events:none;">
            <div class="vn-char-portrait" style="transform-origin:bottom center;transform:scaleX(${mirror ? -1 : 1}) scale(${charScale});${glowStyle}pointer-events:none;">
              ${portraitHtml}
            </div>
          </div>`;

        // Hover tracking - вешаем на само изображение (pointer-events:auto на img)
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

      } else if (elem.type === 'layer') {
        const layer = elem.data;
        const layerScale = layer.scale || 1;
        const layerWidth = (layer.width || 300) * layerScale;
        const layerHeight = (layer.height || 200) * layerScale;
        el.className = 'vn-layer-item';
        el.style.cssText = `position:absolute;left:${layer.x||0}px;top:${layer.y||0}px;z-index:${elem.zIndex};opacity:${layer.opacity??1};pointer-events:none;`;
        if (layer.type === 'image' && layer.src) {
          el.innerHTML = `<img src="${layer.src}" style="width:${layerWidth}px;height:${layerHeight}px;object-fit:contain;display:block;" onerror="this.style.display='none'"/>`;
        } else if (layer.type === 'text' && layer.text) {
          el.innerHTML = `<div style="width:${(layer.width||400)*layerScale}px;font-size:${(layer.fontSize||28)*layerScale}px;color:${layer.color||'#fff'};font-family:${layer.fontFamily||'inherit'};text-align:${layer.textAlign||'left'};text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 20px rgba(0,0,0,.8);line-height:1.4;white-space:pre-wrap;">${layer.text}</div>`;
        }

      } else if (elem.type === 'interactive') {
        const image = elem.data;
        const imgScale = image.scale || 1;
        const imgWidth = (image.width || 200) * imgScale;
        const imgHeight = (image.height || 200) * imgScale;
        el.className = 'vn-interactive-img-item';
        el.dataset.imgId = image.id;
        el.style.cssText = `position:absolute;left:${image.x||0}px;top:${image.y||0}px;z-index:${elem.zIndex};opacity:${image.opacity??1};width:${imgWidth}px;height:${imgHeight}px;cursor:pointer;pointer-events:auto;transition:filter .2s,transform .1s;`;
        el.innerHTML = `<img src="${image.src}" style="width:100%;height:100%;object-fit:contain;display:block;" title="${image.name||''}" onerror="this.style.display='none'"/>`;
        if (image.macroId) {
          el.addEventListener('click', () => {
            const macro = game.macros?.get(image.macroId) ?? game.macros?.getName(image.macroId);
            if (macro) macro.execute();
            else ui.notifications?.warn(`Macro not found: ${image.macroId}`);
          });
          el.addEventListener('mouseenter', () => { el.style.filter = 'brightness(1.2) drop-shadow(0 0 12px rgba(255,220,60,.6))'; el.style.transform = 'scale(1.05)'; });
          el.addEventListener('mouseleave', () => { el.style.filter = ''; el.style.transform = ''; });
        }
      }

      container.appendChild(el);
    });

    console.log('DD VN | Rendered elements:', allElements.length, 'sorted by z-index');
  }

  static _renderChars(chars) {
    // Устаревший метод - теперь используется _renderAllElements
    // Оставляем для совместимости
  }

  static _hoveredCharId = null;

  static _renderNameBar(chars) {
    const bar = document.getElementById('vn-name-bar');
    if (!bar) return;
    const activeChars = chars.filter(c => c.active && c.visible !== false && c.name?.trim());
    const hoveredChar = this._hoveredCharId ? chars.find(c => c.id === this._hoveredCharId) : null;
    const allVisible = [...activeChars];
    if (hoveredChar && !activeChars.find(c => c.id === hoveredChar.id) && hoveredChar.name?.trim()) {
      allVisible.push(hoveredChar);
    }
    if (!allVisible.length) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';
    bar.innerHTML = allVisible.map((c, i) =>
      (i > 0 ? '<span class="vn-name-bar-sep">·</span>' : '') +
      `<span class="vn-name-bar-name">${c.name}</span>`
    ).join('');
  }

  static _renderLayers(layers) {
    // Устаревший метод - теперь используется _renderAllElements
  }

  static _renderInteractiveImages(images) {
    // Устаревший метод - теперь используется _renderAllElements
  }

  static _renderDialogue(d) {
    const box = document.getElementById('vn-dialogue');
    if (!box) return;

    // Показываем диалоговое окно если есть текст ИЛИ активны субтитры
    const hasContent = (d.visible && (d.speakerName || d.text)) || d._subtitleActive;
    box.style.display = hasContent ? 'flex' : 'none';

    const speaker = document.getElementById('vn-speaker');
    const text    = document.getElementById('vn-text');
    if (d.visible && (d.speakerName || d.text)) {
      if (speaker) { speaker.textContent = d.speakerName || ''; speaker.style.color = d.speakerColor || '#ffe066'; }
      if (text) text.innerHTML = d.text || '';
    } else {
      if (speaker) speaker.textContent = '';
      if (text) text.textContent = '';
    }
  }

  static _subtitles = [];
  static _subTimeout = null;

  static showSubtitle(name, text, color, charId = null) {
    const box = document.getElementById('vn-dialogue');
    if (!box) return;

    box.style.display = 'flex';
    
    const existing = this._subtitles.find(s => s.charId === charId);
    if (existing) {
      existing.name = name;
      existing.text = text;
      existing.color = color;
    } else {
      this._subtitles.push({ name, text, color, charId });
    }

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
    if (this._subtitles.length === 0) {
      this.hideAllSubtitles();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GM LEFT BAR
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNGMBar {
  static _charsOpen = false;
  static _bgsOpen   = false;
  static _presetsOpen = false;
  static _charQuery = '';
  static _bgQuery   = '';
  static _bound     = false;

  // Возвращаем текущий gmCharId из панели настроек (или локальный)
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

    // ── Строим HTML ──
    bar.innerHTML = `
      <div class="vn-gml-inner">

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

    // Список игроков (не-GM)
    const players = (game.users?.contents || []).filter(u => !u.isGM);

    return filtered.map(c => {
      const isActive  = !!c.active;
      const isVisible = c.visible !== false;
      const sideIcon  = c.side === 'left' ? '◀' : c.side === 'center' ? '◆' : '▶';
      const imgHtml   = c.img
        ? `<img src="${c.img}" class="vn-gml-char-thumb-img"/>`
        : `<i class="fas fa-user vn-gml-char-thumb-icon"></i>`;

      const playerOpts = players.map(u =>
        `<option value="${u.id}" ${c.playerId === u.id ? 'selected' : ''}>${u.name}</option>`
      ).join('');

      const sideLabel = c.side === 'left' ? game.i18n.localize('DRAMADIRECTOR.vn.gml.left') : 
                        c.side === 'center' ? game.i18n.localize('DRAMADIRECTOR.vn.gml.center') : 
                        game.i18n.localize('DRAMADIRECTOR.vn.gml.right');

      return `
        <div class="vn-gml-char-item ${isActive ? 'gml-active' : ''} ${isVisible ? '' : 'gml-hidden-char'}"
             data-char-id="${c.id}" title="${game.i18n.localize('DRAMADIRECTOR.vn.gml.charTooltip')}">
          <div class="vn-gml-char-thumb">${imgHtml}</div>
          <div class="vn-gml-char-info">
            <span class="vn-gml-char-name" style="color:${c.nameColor || '#ffe066'}">${c.name || game.i18n.localize('DRAMADIRECTOR.vn.gml.noName')}</span>
            <div class="vn-gml-char-player-row">
              <span class="vn-gml-char-meta">${sideIcon} ${sideLabel}${c.title ? ' · ' + c.title : ''}</span>
              <select class="vn-gml-player-sel" data-player-for="${c.id}" title="${game.i18n.localize('DRAMADIRECTOR.vn.gml.assignPlayer')}">
                <option value="">${game.i18n.localize('DRAMADIRECTOR.vn.gml.playerNone')}</option>
                ${playerOpts}
              </select>
            </div>
          </div>
          <button class="vn-gml-active-btn ${isActive ? 'on' : ''}" data-activate-id="${c.id}" title="${game.i18n.localize('DRAMADIRECTOR.vn.charActivate')}">
            <i class="fas fa-lightbulb"></i>
          </button>
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
        const icon  = isVid ? 'fa-film' : 'fa-image';
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

  static _bindEvents(bar, state, allBg) {
    // Голос GM
    bar.querySelector('#vn-gml-voice-sel')?.addEventListener('change', e => {
      this._gmCharId = e.target.value || null;
    });

    // Аккордеон — актёры
    bar.querySelector('#vn-gml-chars-btn')?.addEventListener('click', () => {
      this._charsOpen = !this._charsOpen;
      this.update(_state);
    });

    // Аккордеон — фоны
    bar.querySelector('#vn-gml-bgs-btn')?.addEventListener('click', () => {
      this._bgsOpen = !this._bgsOpen;
      this.update(_state);
    });

    // Аккордеон — пресеты
    bar.querySelector('#vn-gml-presets-btn')?.addEventListener('click', () => {
      this._presetsOpen = !this._presetsOpen;
      this.update(_state);
    });

    // Поиск актёров — live filter без перерисовки всего
    bar.querySelector('#vn-gml-char-search')?.addEventListener('input', e => {
      this._charQuery = e.target.value;
      const list = bar.querySelector('#vn-gml-char-list');
      if (list) list.innerHTML = this._renderCharList(state.chars || [], this._charQuery);
      this._bindCharItemEvents(bar, state.chars || []);
    });

    // Поиск фонов — live filter
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
    // ЛКМ — toggle visible
    bar.querySelectorAll('.vn-gml-char-item').forEach(item => {
      // Клонируем чтобы убрать старые листенеры
      const fresh = item.cloneNode(true);
      item.replaceWith(fresh);
    });

    bar.querySelectorAll('.vn-gml-char-item').forEach(item => {
      const id = item.dataset.charId;

      item.addEventListener('click', e => {
        if (e.target.closest('[data-activate-id]')) return;
        if (e.target.closest('.vn-gml-player-sel')) return; // не скрывать при клике на select
        const c = _state.chars.find(c => c.id === id);
        if (!c) return;
        c.visible = c.visible === false ? true : false;
        // Синхронизируем с панелью настроек
        this._syncCharToPanel(id);
        DDVNManager.broadcast();
      });

      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        const c = _state.chars.find(c => c.id === id);
        if (!c) return;
        // Циклическое переключение: left -> center -> right -> left
        const sides = ['left', 'center', 'right'];
        const currentIdx = sides.indexOf(c.side);
        c.side = sides[(currentIdx + 1) % sides.length];
        // Пересчитать слоты
        let l = 0, cCnt = 0, r = 0;
        _state.chars.forEach(ch => { 
          if (ch.side === 'left') ch.slot = l++;
          else if (ch.side === 'center') ch.slot = cCnt++;
          else ch.slot = r++;
        });
        // Синхронизируем с панелью настроек
        this._syncCharToPanel(id);
        DDVNManager.broadcast();
      });
    });

    // Привязка игрока
    bar.querySelectorAll('.vn-gml-player-sel').forEach(sel => {
      sel.addEventListener('change', e => {
        e.stopPropagation();
        const id = sel.dataset.playerFor;
        const c = _state.chars.find(c => c.id === id);
        if (!c) return;
        c.playerId = sel.value || null;
        // Синхронизируем с панелью настроек
        this._syncCharToPanel(id);
        DDVNManager.broadcast();
      });
    });

    // Кнопка активации
    bar.querySelectorAll('[data-activate-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.activateId;
        const c = _state.chars.find(c => c.id === id);
        if (!c) return;
        c.active = !c.active;
        // Синхронизируем с панелью настроек
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
    if (pc) {
      // Копируем все свойства
      Object.assign(pc, deepClone(c));
    }
    // Перерисовываем панель настроек
    DDVNPanel._instance.render();
  }

  static _bindBgItemEvents(bar) {
    bar.querySelectorAll('.vn-gml-bg-item').forEach(item => {
      item.addEventListener('click', () => {
        DDVNManager.setBackground(item.dataset.bgSrc);
        // Перерисовываем панель настроек
        if (DDVNPanel._instance) DDVNPanel._instance.render();
      });
    });
  }

  static _bindPresetEvents(bar) {
    // Загрузка сцены
    bar.querySelectorAll('[data-scene-preset]').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.scenePreset;
        const scene = DDVNPresets.getScene(name);
        if (!scene) {
          ui.notifications?.warn(game.i18n.format("DRAMADIRECTOR.notifications.sceneNotFound", {name}));
          return;
        }
        // Применяем состояние сцены
        if (scene.background) _state.background = scene.background;
        if (scene.bgFit) _state.bgFit = scene.bgFit;
        if (scene.bgColor) _state.bgColor = scene.bgColor;
        if (scene.dimBg !== undefined) _state.dimBg = scene.dimBg;
        if (scene.chars) _state.chars = deepClone(scene.chars);
        if (scene.dialogue) _state.dialogue = { ...scene.dialogue, _subtitleActive: false };
        // Синхронизируем с панелью настроек и перерисовываем
        if (DDVNPanel._instance) {
          DDVNPanel._instance._chars = deepClone(_state.chars);
          DDVNPanel._instance.render();
        }
        DDVNManager.broadcast();
        DDVNOverlay.ensureOpen();
        ui.notifications?.info(game.i18n.format("DRAMADIRECTOR.notifications.sceneLoaded", {name}));
      });
    });

    // Загрузка ростера
    bar.querySelectorAll('[data-char-preset]').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.charPreset;
        const chars = DDVNPresets.getChars(name);
        if (!chars) {
          ui.notifications?.warn(game.i18n.format("DRAMADIRECTOR.notifications.rosterNotFound", {name}));
          return;
        }
        _state.chars = deepClone(chars);
        // Синхронизируем с панелью настроек и перерисовываем
        if (DDVNPanel._instance) {
          DDVNPanel._instance._chars = deepClone(_state.chars);
          DDVNPanel._instance.render();
        }
        DDVNManager.broadcast();
        DDVNOverlay.ensureOpen();
        ui.notifications?.info(game.i18n.format("DRAMADIRECTOR.notifications.rosterLoaded", {name, count: chars.length}));
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIC
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNMic {
  static _stream      = null;
  static _ctx         = null;
  static _analyser    = null;
  static _recognition = null;
  static _active      = false;
  static _vadTimer    = null;
  static _speaking    = false;
  static threshold    = 18;
  static lang         = 'ru-RU';

  static async start() {
    if (this._active) return;
    try {
      this._stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._ctx      = new AudioContext();
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 256;
      this._ctx.createMediaStreamSource(this._stream).connect(this._analyser);
      this._active   = true;
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
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = this.lang;

    rec.onresult = e => {
      const last  = e.results[e.results.length - 1];
      const text  = last[0].transcript.trim();
      const final = last.isFinal;
      if (final) DDVNManager.onSpeechResult(text);
    };

    rec.onerror = e => { if (e.error === 'not-allowed') ui.notifications?.warn(game.i18n.localize('DRAMADIRECTOR.notifications.micDenied')); };
    rec.onend   = () => { if (this._active) { try { rec.start(); } catch(_) {} } };
    try { rec.start(); } catch(_) {}
    this._recognition = rec;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNPresets {
  static CHARS_KEY  = 'vnCharPresets';
  static BG_KEY     = 'vnBgPresets';
  static SCENE_KEY  = 'vnScenePresets';
  static LAYERS_KEY = 'vnLayerPresets';
  static IIMGS_KEY  = 'vnIimgPresets';

  static register() {
    const base = { scope: 'world', config: false, type: Object, default: {} };
    for (const k of [this.CHARS_KEY, this.BG_KEY, this.SCENE_KEY, this.LAYERS_KEY, this.IIMGS_KEY])
      game.settings.register(MODULE_ID, k, { ...base });
  }

  static _g(k)          { return game.settings.get(MODULE_ID, k) || {}; }
  static _s(k, v)       { return game.settings.set(MODULE_ID, k, v); }

  // Фоны — формат: { name, src, variants: [{name, src}] }
  static listBg()       { return Object.entries(this._g(this.BG_KEY)).map(([id, v]) => ({ id, ...v })); }
  static saveBg(id, data) { const a = this._g(this.BG_KEY); a[id] = data; return this._s(this.BG_KEY, a); }
  static deleteBg(id)   { const a = this._g(this.BG_KEY); delete a[id]; return this._s(this.BG_KEY, a); }

  // Ростеры персонажей
  static listChars()    { return Object.keys(this._g(this.CHARS_KEY)).sort(); }
  static saveChars(n,v) { const a = this._g(this.CHARS_KEY); a[n] = v; return this._s(this.CHARS_KEY, a); }
  static getChars(n)    { return this._g(this.CHARS_KEY)[n] ?? null; }
  static deleteChars(n) { const a = this._g(this.CHARS_KEY); delete a[n]; return this._s(this.CHARS_KEY, a); }

  // Сцены
  static listScenes()   { return Object.keys(this._g(this.SCENE_KEY)).sort(); }
  static saveScene(n,v) { const a = this._g(this.SCENE_KEY); a[n] = v; return this._s(this.SCENE_KEY, a); }
  static getScene(n)    { return this._g(this.SCENE_KEY)[n] ?? null; }
  static deleteScene(n) { const a = this._g(this.SCENE_KEY); delete a[n]; return this._s(this.SCENE_KEY, a); }

  // Layers
  static listLayers()     { return Object.keys(this._g(this.LAYERS_KEY)).sort(); }
  static saveLayers(n, v) { const a = this._g(this.LAYERS_KEY); a[n] = v; return this._s(this.LAYERS_KEY, a); }
  static getLayers(n)     { return this._g(this.LAYERS_KEY)[n] ?? null; }
  static deleteLayers(n)  { const a = this._g(this.LAYERS_KEY); delete a[n]; return this._s(this.LAYERS_KEY, a); }

  // Interactive images
  static listIimgs()     { return Object.keys(this._g(this.IIMGS_KEY)).sort(); }
  static saveIimgs(n, v) { const a = this._g(this.IIMGS_KEY); a[n] = v; return this._s(this.IIMGS_KEY, a); }
  static getIimgs(n)     { return this._g(this.IIMGS_KEY)[n] ?? null; }
  static deleteIimgs(n)  { const a = this._g(this.IIMGS_KEY); delete a[n]; return this._s(this.IIMGS_KEY, a); }

  // Получить все фоны (встроенные + пользовательские)
  static getAllBg() {
    const builtin  = _resolveBgNames(VN_BUILTIN_BACKGROUNDS);
    const custom   = this.listBg().map(b => ({ ...b, _builtin: false }));
    return [...builtin, ...custom];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export class DDVNManager {
  static _subTimer = null;
  static _gmOnlyMode = false; // Режим "только для GM"

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
    // Автозапуск микрофона
    DDVNMic.start();
    DDVNPanel._instance?.render();
  }

  static openLocal() {
    // Открыть VN только для текущего пользователя (без broadcast)
    _state.open = true;
    this._gmOnlyMode = true;
    DDVNOverlay.build();
    DDVNOverlay.apply(_state);
    // Автозапуск микрофона
    DDVNMic.start();
    DDVNPanel._instance?.render();
    ui.notifications?.info(game.i18n.localize('DRAMADIRECTOR.notifications.vnGmOnly'));
  }

  static stop(bcast = false) {
    _state.open = false;
    this._gmOnlyMode = false;
    DDVNMic.stop();
    // Очищаем сцену от персонажей и диалога при закрытии
    DDVNOverlay.clearStage();
    if (bcast) this.broadcast();
    else DDVNOverlay.apply(_state);
    DDVNPanel._instance?.render();
  }

  static stopLocal() {
    // Закрыть VN локально (без broadcast)
    _state.open = false;
    this._gmOnlyMode = false;
    DDVNMic.stop();
    DDVNOverlay.clearStage();
    DDVNOverlay.apply(_state);
    DDVNPanel._instance?.render();
  }

  static isGmOnlyMode() {
    return this._gmOnlyMode;
  }

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
  static addLayer(layer)   { _state.layers.push(deepClone(layer)); this.broadcast(); }
  static updateLayer(id, props) {
    const l = _state.layers.find(l => l.id === id);
    if (l) { Object.assign(l, props); this.broadcast(); }
  }
  static removeLayer(id) { _state.layers = _state.layers.filter(l => l.id !== id); this.broadcast(); }

  // ── Interactive Images ───────────────────────────────────────────────────
  static setInteractiveImages(images) { _state.interactiveImages = deepClone(images); this.broadcast(); }
  static addInteractiveImage(img)     { _state.interactiveImages.push(deepClone(img)); this.broadcast(); }
  static updateInteractiveImage(id, props) {
    const img = _state.interactiveImages.find(i => i.id === id);
    if (img) { Object.assign(img, props); this.broadcast(); }
  }
  static removeInteractiveImage(id) { _state.interactiveImages = _state.interactiveImages.filter(i => i.id !== id); this.broadcast(); }

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
      // GM: используем выбранного персонажа из левой панели / панели настроек
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
    
    // Для GM используется выбранный персонаж, для игроков - их персонаж
    let myChar = null;
    let charName = '';
    let charColor = '#ffe066';
    const playerId = game.userId;
    let charId = null;
    let isGM = game.user.isGM;
    
    if (isGM) {
      // GM говорит от лица выбранного персонажа
      const gmCharId = DDVNGMBar._gmCharId;
      if (gmCharId) {
        myChar = _state.chars.find(c => c.id === gmCharId);
        charId = gmCharId;
      }
    } else {
      // Игрок говорит за своего персонажа
      myChar = _state.chars.find(c => c.playerId === game.userId);
      charId = myChar?.id || null;
    }
    
    if (myChar) {
      charName = myChar.name || '';
      charColor = myChar.nameColor || '#ffe066';
    } else {
      charName = game.user?.name || '';
    }

    // Показываем субтитры БЕЗ активации персонажа (кроме GM)
    DDVNOverlay.showSubtitle(charName, text, charColor, charId);
    // Разослать всем
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
    this._chars    = deepClone(_state.chars);
    this._layers   = deepClone(_state.layers);
    this._interactiveImages = deepClone(_state.interactiveImages);
    this._activeTab = 'scene';
    this._editBgId  = null; // id редактируемого bg preset
  }

  static DEFAULT_OPTIONS = {
    id: 'dd-vn-panel', tag: 'div',
    classes: ['drama-director', 'dd-vn-panel'],
    window: { title: 'Drama Director — Visual Novel', icon: 'fas fa-book-open', resizable: true },
    position: { width: 1060, height: 760 },
  };

  static PARTS = { form: { template: `modules/${MODULE_ID}/templates/vn-panel.hbs` } };

  async _prepareContext() {
    // Wait for language override to finish loading before localizing
    await getLanguagePromise();
    
    const s    = DDVNManager.getState();
    const allBg = DDVNPresets.getAllBg();

    return {
      open:         s.open,
      background:   s.background,
      bgFit:        s.bgFit,
      bgColor:      s.bgColor,
      dimBg:        s.dimBg,
      chars:        this._chars.map((c, i) => ({ ...c, _idx: i })),
      leftChars:    this._chars.filter(c => c.side === 'left').length,
      centerChars:  this._chars.filter(c => c.side === 'center').length,
      rightChars:   this._chars.filter(c => c.side === 'right').length,
      players:      game.users.filter(u => !u.isGM).map(u => ({ id: u.id, name: u.name })),
      micOn:        DDVNMic._active,
      micThreshold: DDVNMic.threshold,
      micLang:      DDVNMic.lang,
      dialogue:     s.dialogue,
      charPresets:  DDVNPresets.listChars(),
      scenePresets: DDVNPresets.listScenes(),
      allBg,
      gmCharId:     this._gmCharId || '',
      layers:       this._layers.map((l, i) => ({ ...l, _idx: i })),
      interactiveImages: this._interactiveImages.map((img, i) => ({ ...img, _idx: i })),
      macros:       (game.macros?.contents || []).map(m => ({ id: m.id, name: m.name })).sort((a,b) => a.name.localeCompare(b.name)),
      layerPresets: DDVNPresets.listLayers(),
      iimgPresets:  DDVNPresets.listIimgs(),
    };
  }

  _onRender(ctx, opts) {
    super._onRender?.(ctx, opts);
    const el = this.element;

    // Восстановить активную вкладку
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

    // ── VN Open/Close ──
    el.querySelector('[data-action="vn-open"]')?.addEventListener('click', () => {
      DDVNManager.open(); this.render();
    });
    el.querySelector('[data-action="vn-open-local"]')?.addEventListener('click', () => {
      DDVNManager.openLocal(); this.render();
    });
    el.querySelector('[data-action="vn-close"]')?.addEventListener('click', () => {
      DDVNManager.stop(true); this.render();
    });

    // ── Фон ──
    el.querySelector('#vn-bg-path')?.addEventListener('change', e => {
      DDVNManager.setBackground(e.target.value);
    });
    el.querySelector('[data-action="vn-browse-bg"]')?.addEventListener('click', () => {
      this._openFilePicker('imagevideo', p => {
        const inp = el.querySelector('#vn-bg-path');
        if (inp) inp.value = p;
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

    // Быстрый выбор фона — плитки вариантов
    el.querySelectorAll('[data-bg-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        const src = btn.dataset.bgVariant;
        const inp = el.querySelector('#vn-bg-path');
        if (inp) inp.value = src;
        DDVNManager.setBackground(src);
        // Подсветка активной плитки
        el.querySelectorAll('[data-bg-variant]').forEach(b => b.classList.toggle('vn-bg-tile-active', b === btn));
      });
    });

    // Поиск по фонам в панели
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

    // ── Управление пресетами фона ──
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

    // Порядок плиток — drag (упрощённо через кнопки ←→)
    el.querySelectorAll('[data-bg-move]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const [id, dir] = btn.dataset.bgMove.split(':');
        const allCustom = DDVNPresets.listBg();
        const idx = allCustom.findIndex(b => b.id === id);
        if (idx < 0) return;
        const newIdx = dir === 'left' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= allCustom.length) return;
        // Swap
        const raw = DDVNPresets._g(DDVNPresets.BG_KEY);
        const keys = Object.keys(raw);
        const ki = keys.indexOf(id), kj = keys[newIdx];
        [raw[id], raw[kj]] = [raw[kj], raw[id]];
        // Rebuild ordered object
        const reordered = {};
        keys.forEach(k => { reordered[k] = raw[k]; });
        await game.settings.set(MODULE_ID, DDVNPresets.BG_KEY, reordered);
        this.render();
      });
    });

    // ── Персонажи ──
    this._bindCharEvents(el);
    this._bindTextPicsEvents(el);

    // Пресеты ростера
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

    // ── Диалог ──
    el.querySelector('[data-action="vn-dlg-show"]')?.addEventListener('click', () => {
      const name  = el.querySelector('#vn-dlg-name')?.value  || '';
      const text  = el.querySelector('#vn-dlg-text')?.value  || '';
      const color = el.querySelector('#vn-dlg-color')?.value || '#ffe066';
      const auto  = Number(el.querySelector('#vn-dlg-auto')?.value) || 0;
      DDVNManager.showDialogue(name, text, color, auto);
    });
    el.querySelector('[data-action="vn-dlg-hide"]')?.addEventListener('click', () => DDVNManager.hideDialogue());
    el.querySelector('[data-action="vn-dlg-active"]')?.addEventListener('click', () => {
      const active = _state.chars.find(c => c.active);
      if (!active) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.noActiveChar'));
      const text = el.querySelector('#vn-dlg-text')?.value || '';
      DDVNManager.showDialogue(active.name, text, active.nameColor);
    });

    // ── Микрофон ──
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
      // Синхронизируем с quick-bar
      const quickLang = document.getElementById('vn-quick-lang');
      if (quickLang) quickLang.value = e.target.value;
      if (DDVNMic._active) { DDVNMic.stop(); DDVNMic.start(); }
    });

    // GM от лица
    el.querySelector('#vn-gm-char')?.addEventListener('change', e => {
      this._gmCharId = e.target.value || null;
    });

    // Пресеты сцен (сохраняют всё: chars, layers, interactiveImages)
    el.querySelector('[data-action="vn-scene-save"]')?.addEventListener('click', async () => {
      const name = el.querySelector('#vn-scene-name')?.value?.trim();
      if (!name) return;
      // Сохраняем напрямую из _state - это всегда актуальное состояние
      await DDVNPresets.saveScene(name, deepClone(_state));
      ui.notifications.info(game.i18n.format('DRAMADIRECTOR.notifications.sceneSaved', {name}));
      this.render();
    });
    el.querySelector('[data-action="vn-scene-load"]')?.addEventListener('click', () => {
      const n = el.querySelector('#vn-scene-select')?.value;
      const s = DDVNPresets.getScene(n);
      if (!s) return;
      // Загружаем состояние в _state
      Object.assign(_state, {
        open: s.open ?? _state.open,
        background: s.background ?? '',
        bgFit: s.bgFit ?? 'cover',
        bgColor: s.bgColor ?? '#0a0a14',
        dimBg: s.dimBg ?? 0,
        chars: deepClone(s.chars || []),
        dialogue: s.dialogue ?? { visible: false, speakerName: '', speakerColor: '#ffe066', text: '', _subtitleActive: false },
        layers: deepClone(s.layers || []),
        interactiveImages: deepClone(s.interactiveImages || [])
      });
      // Синхронизируем панельные переменные с _state
      this._syncCharsFromState();
      DDVNManager.broadcast();
      this.render();
      ui.notifications.info(game.i18n.format('DRAMADIRECTOR.notifications.sceneLoaded', {name: n}));
    });
    el.querySelector('[data-action="vn-scene-delete"]')?.addEventListener('click', async () => {
      const n = el.querySelector('#vn-scene-select')?.value;
      if (!n) return;
      await DDVNPresets.deleteScene(n); this.render();
    });

    // ── Copy macro buttons ────────────────────────────────────────────────
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

  // ── Text & Pictures events ──────────────────────────────────────────────────
  _bindTextPicsEvents(el) {
    // ── Layers ──────────────────────────────────────────────────────────────
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
          this._layers[idx].src = p;
          const inp = row.querySelector('.vn-layer-src-inp');
          if (inp) inp.value = p;
          DDVNManager.setLayers(this._layers);
        });
      });

      row.querySelectorAll('input, select, textarea').forEach(inp => {
        inp.addEventListener('change', () => this._syncLayerRow(idx, row));
        inp.addEventListener('input',  () => this._syncLayerRow(idx, row));
      });
    });

    // Layer presets
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

    // ── Interactive Images ──────────────────────────────────────────────────
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
          this._interactiveImages[idx].src = p;
          const inp = row.querySelector('.vn-iimg-src-inp');
          if (inp) inp.value = p;
          DDVNManager.setInteractiveImages(this._interactiveImages);
        });
      });

      row.querySelectorAll('input, select').forEach(inp => {
        inp.addEventListener('change', () => this._syncIimgRow(idx, row));
        inp.addEventListener('input',  () => this._syncIimgRow(idx, row));
      });
    });

    // Interactive images presets
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
    l.name      = q('.vn-layer-name-inp')?.value ?? l.name;
    l.src       = q('.vn-layer-src-inp')?.value  ?? l.src;
    l.text      = q('.vn-layer-text-inp')?.value ?? l.text;
    l.x         = Number(q('.vn-layer-x')?.value) || 0;
    l.y         = Number(q('.vn-layer-y')?.value) || 0;
    l.zIndex    = Number(q('.vn-layer-z')?.value) || 0;
    l.width     = Number(q('.vn-layer-w')?.value) || 300;
    l.height    = Number(q('.vn-layer-h')?.value) || 200;
    l.opacity   = parseFloat(q('.vn-layer-opacity')?.value ?? 1);
    l.scale     = parseFloat(q('.vn-layer-scale')?.value ?? 1);
    l.fontSize  = Number(q('.vn-layer-fontsize')?.value) || 28;
    l.color     = q('.vn-layer-color')?.value ?? l.color;
    l.textAlign = q('.vn-layer-align')?.value ?? l.textAlign;
    l.visible   = q('.vn-layer-visible')?.checked !== false;
    // Update slider labels
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
    img.name    = q('.vn-iimg-name-inp')?.value ?? img.name;
    img.src     = q('.vn-iimg-src-inp')?.value  ?? img.src;
    img.macroId = q('.vn-iimg-macro-sel')?.value ?? img.macroId;
    img.x       = Number(q('.vn-iimg-x')?.value) || 0;
    img.y       = Number(q('.vn-iimg-y')?.value) || 0;
    img.zIndex  = Number(q('.vn-iimg-z')?.value) || 0;
    img.width   = Number(q('.vn-iimg-w')?.value) || 200;
    img.height  = Number(q('.vn-iimg-h')?.value) || 200;
    img.opacity = parseFloat(q('.vn-iimg-opacity')?.value ?? 1);
    img.scale   = parseFloat(q('.vn-iimg-scale')?.value ?? 1);
    img.visible = q('.vn-iimg-visible')?.checked !== false;
    ['.vn-iimg-x', '.vn-iimg-y', '.vn-iimg-z', '.vn-iimg-w', '.vn-iimg-h', '.vn-iimg-opacity', '.vn-iimg-scale'].forEach(sel => {
      const inp = q(sel);
      if (inp?.nextElementSibling?.classList.contains('vn-slider-val')) {
        inp.nextElementSibling.textContent = inp.value;
      }
    });
    DDVNManager.setInteractiveImages(this._interactiveImages);
  }

  // ── Bg Edit Form ─────────────────────────────────────────────────────────
  _showBgEditForm(el, editId = null) {
    const existing = el.querySelector('#vn-bg-edit-form');
    if (existing) existing.remove();

    const allCustom = DDVNPresets.listBg();
    const editData  = editId ? allCustom.find(b => b.id === editId) : null;

    const varRows = editData?.variants
      ? editData.variants.map((v, i) => this._variantRowHtml(i, v)).join('')
      : this._variantRowHtml(0);

    const form = document.createElement('div');
    form.id = 'vn-bg-edit-form';
    form.innerHTML = `
      <div class="vn-bgedit-overlay">
        <div class="vn-bgedit-box">
          <h4>${editId ? game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.titleEdit') : game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.titleAdd')}</h4>
          <input type="hidden" id="vn-bgedit-id" value="${editId || ''}"/>
          <div class="dd-row"><label>${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.name')}</label>
            <input type="text" id="vn-bgedit-name" class="dd-input" value="${editData?.name || ''}"/>
          </div>
          <div id="vn-bgedit-variants">${varRows}</div>
          <button type="button" id="vn-bgedit-add-var" class="vn-btn-secondary" style="margin-top:4px">
            <i class="fas fa-plus"></i> ${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.addVariant')}
          </button>
          <div class="vn-bgedit-actions">
            <button type="button" data-action="vn-bg-edit-cancel" class="vn-btn-secondary">${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.cancel')}</button>
            <button type="button" data-action="vn-bg-edit-save" class="vn-btn-primary">${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.save')}</button>
          </div>
        </div>
      </div>`;
    el.appendChild(form);

    // Re-bind cancel/save
    form.querySelector('[data-action="vn-bg-edit-cancel"]')?.addEventListener('click', () => form.remove());
    form.querySelector('[data-action="vn-bg-edit-save"]')?.addEventListener('click', () => this._saveBgFromForm(el));
    form.querySelector('#vn-bgedit-add-var')?.addEventListener('click', () => {
      const container = form.querySelector('#vn-bgedit-variants');
      const count = container.querySelectorAll('.vn-bgedit-var-row').length;
      if (count >= 3) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.maxVariants'));
      container.insertAdjacentHTML('beforeend', this._variantRowHtml(count));
      this._bindVarBrowse(form);
    });
    this._bindVarBrowse(form);
  }

  _variantRowHtml(idx, v = null) {
    return `<div class="vn-bgedit-var-row">
      <span class="vn-bgedit-var-num">${idx + 1}.</span>
      <input type="text" class="vn-bgedit-var-name dd-input" placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.variantName')}" value="${v?.name || ''}"/>
      <input type="text" class="vn-bgedit-var-src dd-input" placeholder="${game.i18n.localize('DRAMADIRECTOR.vn.bgEdit.variantPath')}" value="${v?.src || ''}"/>
      <button type="button" class="vn-bgedit-browse-var"><i class="fas fa-folder-open"></i></button>
    </div>`;
  }

  _bindVarBrowse(form) {
    form.querySelectorAll('.vn-bgedit-browse-var').forEach((btn, i) => {
      // Remove old listener by cloning
      const fresh = btn.cloneNode(true);
      btn.replaceWith(fresh);
      fresh.addEventListener('click', () => {
        const rows = form.querySelectorAll('.vn-bgedit-var-row');
        const srcInp = rows[i]?.querySelector('.vn-bgedit-var-src');
        this._openFilePicker('imagevideo', p => { if (srcInp) srcInp.value = p; });
      });
    });
  }

  async _saveBgFromForm(el) {
    const form = el.querySelector('#vn-bg-edit-form');
    if (!form) return;

    const editId = form.querySelector('#vn-bgedit-id')?.value?.trim();
    const name   = form.querySelector('#vn-bgedit-name')?.value?.trim();
    if (!name) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.bgNameRequired'));

    const variants = [];
    form.querySelectorAll('.vn-bgedit-var-row').forEach((row, i) => {
      const vName = row.querySelector('.vn-bgedit-var-name')?.value?.trim();
      const vSrc  = row.querySelector('.vn-bgedit-var-src')?.value?.trim();
      if (vSrc) variants.push({ id: uid(), name: vName || name, src: vSrc });
    });
    if (!variants.length) return ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.bgVariantRequired'));

    const id = editId || uid();
    await DDVNPresets.saveBg(id, { name, variants });
    form.remove();
    this.render();
  }

  // ── Chars ─────────────────────────────────────────────────────────────────
  _bindCharEvents(el) {
    el.querySelector('[data-action="vn-char-add-left"]')  ?.addEventListener('click', () => this._addChar('left'));
    el.querySelector('[data-action="vn-char-add-center"]')?.addEventListener('click', () => this._addChar('center'));
    el.querySelector('[data-action="vn-char-add-right"]') ?.addEventListener('click', () => this._addChar('right'));
    el.querySelector('[data-action="vn-deactivate-all"]')?.addEventListener('click', () => {
      DDVNManager.deactivateAll(); this._syncCharsFromState(); this.render();
    });

    // Поиск персонажей
    el.querySelector('#vn-char-search')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      el.querySelectorAll('[data-char-idx]').forEach(row => {
        const name = row.querySelector('.vn-char-name-inp')?.value?.toLowerCase() || '';
        const title = row.querySelector('.vn-char-title-inp')?.value?.toLowerCase() || '';
        const match = !query || name.includes(query) || title.includes(query);
        row.classList.toggle('dd-hidden', !match);
      });
    });

    el.querySelectorAll('[data-char-idx]').forEach(row => {
      const idx = Number(row.dataset.charIdx);

      row.querySelector('[data-char-action="active"]')?.addEventListener('click', () => {
        this._chars[idx].active = !this._chars[idx].active;
        DDVNManager.setChars(this._chars); this.render();
      });
      row.querySelector('[data-char-action="remove"]')?.addEventListener('click', () => {
        this._chars.splice(idx, 1);
        this._reorderSlots();
        DDVNManager.setChars(this._chars); this.render();
      });
      row.querySelector('[data-char-action="move-up"]')?.addEventListener('click', () => {
        if (idx > 0) { [this._chars[idx-1], this._chars[idx]] = [this._chars[idx], this._chars[idx-1]]; this._reorderSlots(); DDVNManager.setChars(this._chars); this.render(); }
      });
      row.querySelector('[data-char-action="move-down"]')?.addEventListener('click', () => {
        if (idx < this._chars.length - 1) { [this._chars[idx], this._chars[idx+1]] = [this._chars[idx+1], this._chars[idx]]; this._reorderSlots(); DDVNManager.setChars(this._chars); this.render(); }
      });
      row.querySelector('[data-char-action="switch-side"]')?.addEventListener('click', () => {
        // Циклическое переключение: left -> center -> right -> left
        const sides = ['left', 'center', 'right'];
        const currentIdx = sides.indexOf(this._chars[idx].side);
        this._chars[idx].side = sides[(currentIdx + 1) % sides.length];
        this._reorderSlots();
        DDVNManager.setChars(this._chars); this.render();
      });
      row.querySelector('[data-char-action="browse"]')?.addEventListener('click', () => {
        this._openFilePicker('image', p => {
          this._chars[idx].img = p;
          row.querySelector('.vn-char-img-inp').value = p;
          DDVNManager.setChars(this._chars);
        });
      });
      row.querySelector('[data-char-action="browse-active"]')?.addEventListener('click', () => {
        this._openFilePicker('image', p => {
          this._chars[idx].activeImg = p;
          row.querySelector('.vn-char-active-img-inp').value = p;
          DDVNManager.setChars(this._chars);
        });
      });

      row.querySelectorAll('input, select').forEach(inp => {
        inp.addEventListener('change', () => this._syncCharRow(idx, row));
        inp.addEventListener('input',  () => this._syncCharRow(idx, row));
      });
    });
  }

  // Helper to open FilePicker above VN panel
  _openFilePicker(type, callback) {
    // Create FilePicker using Foundry API
    const fp = new FilePicker({ 
      type, 
      callback: (path) => {
        callback(path);
        // After selection, bring VN panel back to proper position
        setTimeout(() => {
          if (this.bringToTop) this.bringToTop();
        }, 100);
      }
    });
    
    // Render the FilePicker
    fp.render(true);
    
    // Use Hook-based approach: Foundry will fire renderFilePicker hook
    // We handle bringing to front there (see initVNSystem)
    
    // Additional DOM-based approach for immediate effect
    const ensureFront = () => {
      // Find all FilePicker windows and bring them to front
      const selectors = [
        '.filepicker',
        '.app.window-app.filepicker', 
        '.window-app.filepicker',
        '.application.filepicker',
        '[data-application="filepicker"]',
        '#file-picker'  // v13 style
      ];
      
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.style.setProperty('z-index', '10050', 'important');
          if (el.classList) {
            el.classList.add('dd-frontend');
          }
        });
      });
      
      // Use Foundry's bringToTop if available
      if (fp.bringToTop) {
        try { fp.bringToTop(); } catch(e) {}
      }
    };
    
    // Try multiple times to catch async rendering
    ensureFront();
    setTimeout(ensureFront, 10);
    setTimeout(ensureFront, 50);
    setTimeout(ensureFront, 100);
    setTimeout(ensureFront, 200);
    setTimeout(ensureFront, 500);
  }

  _syncCharRow(idx, row) {
    if (!this._chars[idx]) return;
    const c = this._chars[idx];
    const q = s => row.querySelector(s);
    c.name      = q('.vn-char-name-inp')?.value  ?? c.name;
    c.title     = q('.vn-char-title-inp')?.value ?? c.title;
    c.img       = q('.vn-char-img-inp')?.value   ?? c.img;
    c.activeImg = q('.vn-char-active-img-inp')?.value   ?? c.activeImg;
    c.nameColor = q('.vn-char-ncolor')?.value     ?? c.nameColor;
    c.scale     = Number(q('.vn-char-scale')?.value)  || 1;
    c.x         = Number(q('.vn-char-x')?.value)      || 0;
    c.y         = Number(q('.vn-char-y')?.value)      || 0;
    c.zIndex    = Number(q('.vn-char-z')?.value)      || 0;
    c.mirror    = q('.vn-char-mirror')?.checked  || false;
    c.visible   = q('.vn-char-visible')?.checked !== false;
    c.playerId  = q('.vn-char-player')?.value    || null;

    // Обновить отображение значений слайдеров
    const scaleVal = q('.vn-char-scale')?.nextElementSibling;
    const xVal = q('.vn-char-x')?.nextElementSibling;
    const yVal = q('.vn-char-y')?.nextElementSibling;
    const zVal = q('.vn-char-z')?.nextElementSibling;
    if (scaleVal) scaleVal.textContent = c.scale.toFixed(2);
    if (xVal) xVal.textContent = c.x;
    if (yVal) yVal.textContent = c.y;
    if (zVal) zVal.textContent = c.zIndex;

    DDVNManager.setChars(this._chars);
  }

  _addChar(side) {
    const sideCount = this._chars.filter(c => c.side === side).length;
    const maxChars = side === 'center' ? 5 : 10;
    if (sideCount >= maxChars) { ui.notifications.warn(game.i18n.localize('DRAMADIRECTOR.notifications.maxChars')); return; }
    this._chars.push(newChar(side, sideCount));
    DDVNManager.setChars(this._chars);
    this.render();
  }

  _reorderSlots() {
    let l = 0, c = 0, r = 0;
    this._chars.forEach(ch => {
      if (ch.side === 'left') ch.slot = l++;
      else if (ch.side === 'center') ch.slot = c++;
      else ch.slot = r++;
    });
  }

  _syncCharsFromState() {
    this._chars = deepClone(_state.chars);
    this._layers = deepClone(_state.layers);
    this._interactiveImages = deepClone(_state.interactiveImages);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────
export const DDVNApi = {
  open()                             { DDVNOverlay.build(); DDVNManager.open(); },
  openLocal()                        { DDVNOverlay.build(); DDVNManager.openLocal(); },
  stop(bcast = true)                 { DDVNManager.stop(bcast); },
  stopLocal()                        { DDVNManager.stopLocal(); },
  setBackground(path)                { DDVNManager.setBackground(path); },
  setChars(chars)                    { DDVNManager.setChars(chars); },
  activateChar(id, val)              { DDVNManager.activateChar(id, val ?? true); },
  activateExclusive(id)              { DDVNManager.activateExclusive(id); },
  deactivateAll()                    { DDVNManager.deactivateAll(); },
  showDialogue(name, text, col, auto){ DDVNManager.showDialogue(name, text, col, auto); },
  hideDialogue()                     { DDVNManager.hideDialogue(); },
  startMic()                         { return DDVNMic.start(); },
  stopMic()                          { DDVNMic.stop(); },
  state()                            { return _state; },
  setLayers(layers)                  { DDVNManager.setLayers(layers); },
  addLayer(layer)                    { DDVNManager.addLayer(layer); },
  updateLayer(id, props)             { DDVNManager.updateLayer(id, props); },
  removeLayer(id)                    { DDVNManager.removeLayer(id); },
  setInteractiveImages(images)       { DDVNManager.setInteractiveImages(images); },
  addInteractiveImage(img)           { DDVNManager.addInteractiveImage(img); },
  updateInteractiveImage(id, props)  { DDVNManager.updateInteractiveImage(id, props); },
  removeInteractiveImage(id)         { DDVNManager.removeInteractiveImage(id); },
  openPanel() {
    const ex = foundry.applications.instances.get('dd-vn-panel');
    if (ex) { ex.bringToTop(); return; }
    const p = new DDVNPanel();
    DDVNPanel._instance = p;
    p.render(true);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
export function initVNSystem() {
  DDVNPresets.register();

  game.socket.on(SOCKET, packet => {
    if (packet?.type === 'vn:state') DDVNManager.applyRemote(packet.state);
    if (packet?.type === 'vn:subtitle') {
      // Показываем субтитры (активация персонажа идёт через vn:state от VAD)
      DDVNOverlay.showSubtitle(packet.name, packet.text, packet.color, packet.charId);
      
      // Удалить субтитры этого игрока через таймаут
      setTimeout(() => {
        DDVNOverlay.hideSubtitleByPlayer(packet.charId);
      }, Math.max(3000, (packet.text?.length || 0) * 65));
    }
  });

  Hooks.on('canvasReady', () => DDVNOverlay.build());
  if (document.getElementById('interface')) DDVNOverlay.build();

  // Автозапрос микрофона при входе (для не-GM)
  if (!game.user.isGM) {
    Hooks.once('ready', () => {
      // Небольшая задержка чтобы VN успела инициализироваться
      setTimeout(() => {
        if (_state.open && !DDVNMic._active) {
          DDVNMic.start().catch(() => {});
        }
      }, 1000);
    });
  }

  // Hook to bring FilePicker and other apps to front when VN panel is open
  Hooks.on('renderFilePicker', (app) => {
    // Use multiple attempts to ensure FilePicker gets proper z-index
    const bringToFront = () => {
      if (app.bringToTop) app.bringToTop();
      // Also set via DOM for good measure
      const el = app.element;
      if (el) {
        el.style.zIndex = '10050';
        el.style.setProperty('z-index', '10050', 'important');
      }
    };
    bringToFront();
    setTimeout(bringToFront, 10);
    setTimeout(bringToFront, 50);
    setTimeout(bringToFront, 100);
  });

  // Also hook other common apps
  Hooks.on('renderFormApplication', (app) => {
    if (app.bringToTop) {
      setTimeout(() => app.bringToTop(), 50);
    }
  });

  Hooks.on('renderDialog', (app) => {
    if (app.bringToTop) {
      setTimeout(() => app.bringToTop(), 50);
    }
  });

  if (!game.dramaDirector) game.dramaDirector = {};
  game.dramaDirector.vn = DDVNApi;
}
