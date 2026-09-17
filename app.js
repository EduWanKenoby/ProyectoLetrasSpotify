let syncedLyrics = [];
let activeIndex = -1;
let currentMs = 0;
let isPlaying = false;
let timer = null;
let isForeignLanguage = false;

let lastLineChangeRealTime = -99999;
const LYRIC_ANIM_DURATION_MS = 450;

let posX = 0;
let posY = 0;
let quotePosX = 0;
let quotePosY = -480;

// Variables de Grabación de Video
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let animationFrameId = null;

let safeCoverImage = new Image();

// Elementos DOM
const screenSearch = document.getElementById('screen-search');
const screenStudio = document.getElementById('screen-studio');
const resultsGrid = document.getElementById('search-results-grid');

const elPrev = document.getElementById('line-prev');
const elCurrent = document.getElementById('line-current');
const elNext = document.getElementById('line-next');
const selectorList = document.getElementById('lyrics-selector-list');

const tiktokCanvas = document.getElementById('tiktok-canvas');
const spotifyCard = document.getElementById('spotify-card');
const cardBlurBg = document.getElementById('card-blur-bg');
const cardColorOverlay = document.getElementById('card-color-overlay');
const albumArt = document.getElementById('album-art');
const btnPlay = document.getElementById('btn-play');
const btnRecordVideo = document.getElementById('btn-record-video');

// Cronómetro, Rango y Atajos
const timerText = document.getElementById('timer-text');
const inputTimeStart = document.getElementById('input-time-start');
const inputTimeEnd = document.getElementById('input-time-end');
const btnSyncTime = document.getElementById('btn-sync-time');
const btnResetTime = document.getElementById('btn-reset-time');

// Elementos Quote Header
const quoteHeader = document.getElementById('quote-header');
const checkShowQuote = document.getElementById('check-show-quote');
const inputQuotePrefix = document.getElementById('input-quote-prefix');
const inputQuoteArtist = document.getElementById('input-quote-artist');
const quoteTextPrefix = document.getElementById('quote-text-prefix');
const quoteTextArtist = document.getElementById('quote-text-artist');
const inputQuoteHighlightColor = document.getElementById('input-quote-highlight-color');
const inputQuotePosX = document.getElementById('input-quote-pos-x');
const inputQuotePosY = document.getElementById('input-quote-pos-y');
const inputQuoteFontSize = document.getElementById('input-quote-font-size');

// Elementos Traducción
const panelTranslation = document.getElementById('panel-translation');
const checkEnableTranslation = document.getElementById('check-enable-translation');
const inputSubtextColor = document.getElementById('input-subtext-color');
const inputSubtextFontSize = document.getElementById('input-subtext-font-size');

// Controles Estilo y Canvas
const inputCanvasBg = document.getElementById('input-canvas-bg');
const inputPosX = document.getElementById('input-pos-x');
const inputPosY = document.getElementById('input-pos-y');
const inputBgColor = document.getElementById('input-bg-color');
const inputCardWidth = document.getElementById('input-card-width');
const inputCardHeight = document.getElementById('input-card-height');
const inputBlurAmount = document.getElementById('input-blur-amount');
const inputCustomCover = document.getElementById('input-custom-cover');
const inputTextColor = document.getElementById('input-text-color');
const inputFontSize = document.getElementById('input-font-size');
const selectFontWeight = document.getElementById('select-font-weight');

// CARGAR IMAGEN DE FORMA SEGURA
function cargarImagenSegura(url) {
  if (!url || url.startsWith('data:')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  return fetch(url, { mode: 'cors' })
    .then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .catch(() => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    });
}

// CONVERTIR MILISEGUNDOS A TEXTO "MM:SS"
function msAFormatoMinutosSegundos(ms) {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSeg = Math.floor(ms / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

function msATiempoCronometro(ms) {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSegundos = Math.floor(ms / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  const decima = Math.floor((ms % 1000) / 100);
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}.${decima}`;
}

function parsearStringATiempoMs(cadena) {
  if (!cadena || typeof cadena !== 'string') {
    return { ms: 0, esValido: false, normalizado: "00:00" };
  }
  const str = cadena.trim();
  const partes = str.split(':');
  if (partes.length !== 2) return { ms: 0, esValido: false, normalizado: "00:00" };

  const min = parseInt(partes[0], 10);
  const seg = parseInt(partes[1], 10);
  if (isNaN(min) || isNaN(seg) || min < 0 || seg < 0 || seg >= 60) {
    return { ms: 0, esValido: false, normalizado: "00:00" };
  }

  const ms = (min * 60 + seg) * 1000;
  return { ms, esValido: true, normalizado: `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}` };
}

function actualizarDisplayCronometro(ms) {
  if (timerText) timerText.innerText = msATiempoCronometro(ms);
}

function validarYObtenerTiempos() {
  const startRes = parsearStringATiempoMs(inputTimeStart.value);
  const endRes = parsearStringATiempoMs(inputTimeEnd.value);
  let esValido = startRes.esValido && endRes.esValido && (startRes.ms < endRes.ms);

  if (!esValido) {
    btnSyncTime.innerText = "INVALID RANGE";
    btnSyncTime.classList.add('invalid');
  } else {
    btnSyncTime.innerText = "Ir a Tiempo";
    btnSyncTime.classList.remove('invalid');
    inputTimeStart.value = startRes.normalizado;
    inputTimeEnd.value = endRes.normalizado;
  }
  return { esValido, startMs: startRes.ms, endMs: endRes.ms };
}

// DETECCION DE IDIOMA ESPAÑOL
function esTextoEnEspanol(texto) {
  const palabrasEs = /\b(el|la|los|las|un|una|que|con|por|para|como|sobre|mas|pero|sus|donde|cuando|sin|esta|estamos|siempre|mar|viento|libre|oscuridad|corazon|amor|vida|ti|mi|tu)\b/i;
  const matches = (texto.match(palabrasEs) || []).length;
  return matches >= 2;
}

// MOTOR DE TRADUCCIÓN CON GOOGLE TRANSLATE ENDPOINT
async function traducirTexto(texto) {
  if (!texto || texto.trim() === '') return texto;

  try {
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(texto)}`;
    const res = await fetch(googleUrl);
    
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const traduccionGoogle = data[0].map(item => item[0]).filter(Boolean).join('');
        if (traduccionGoogle) return traduccionGoogle;
      }
    }
  } catch (e) {
    console.warn("Falló Google Translate, usando servidor secundario...", e);
  }

  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=autodetect|es`;
    const res2 = await fetch(myMemoryUrl);
    const data2 = await res2.json();
    if (data2 && data2.responseData && data2.responseData.translatedText) {
      return data2.responseData.translatedText;
    }
  } catch (e) {
    console.warn("Falló traducción de respaldo.", e);
  }

  return texto;
}

// BUSCAR CATÁLOGO
function ejecutarBusquedaGlobal() {
  const query = document.getElementById('global-search-input').value.trim();
  if (!query) return;

  resultsGrid.innerHTML = `<p style="color:#a1a1aa; grid-column: 1/-1;">Buscando catálogo para "${query}"...</p>`;

  const script = document.createElement('script');
  window.deezerSearchCallback = function(data) {
    resultsGrid.innerHTML = '';
    if (data.data && data.data.length > 0) {
      data.data.forEach(track => {
        const card = document.createElement('div');
        card.classList.add('track-card');
        card.innerHTML = `
          <img src="${track.album.cover_medium}" alt="${track.title}">
          <h4>${track.title}</h4>
          <p>${track.artist.name}</p>
        `;
        card.addEventListener('click', () => {
          seleccionarCancion(track.title, track.artist.name, track.album.cover_xl || track.album.cover_big);
        });
        resultsGrid.appendChild(card);
      });
    } else {
      resultsGrid.innerHTML = `<p style="color:#a1a1aa; grid-column: 1/-1;">No se encontraron canciones.</p>`;
    }
    if (document.body.contains(script)) document.body.removeChild(script);
  };

  script.src = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&output=jsonp&callback=deezerSearchCallback`;
  document.body.appendChild(script);
}

document.getElementById('global-search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') ejecutarBusquedaGlobal();
});

// SELECCIONAR CANCIÓN Y TRADUCIR
async function seleccionarCancion(cancion, artista, coverUrl) {
  screenSearch.classList.add('hidden');
  screenStudio.classList.remove('hidden');

  document.getElementById('song-title').innerText = cancion;
  document.getElementById('song-artist').innerText = artista;
  document.getElementById('selected-song-title').innerText = cancion;
  document.getElementById('selected-song-artist').innerText = artista;

  inputQuoteArtist.value = `${artista}:`;
  quoteTextArtist.innerText = `${artista}:`;

  albumArt.src = coverUrl;
  cardBlurBg.style.backgroundImage = `url('${coverUrl}')`;
  safeCoverImage = await cargarImagenSegura(coverUrl);

  detenerReproduccion();
  currentMs = 0;
  activeIndex = -1;
  elPrev.innerHTML = "";
  elCurrent.innerHTML = '<div class="main-text">Buscando letra...</div>';
  elNext.innerHTML = "";
  selectorList.innerHTML = `<div class="selector-placeholder">Cargando lista...</div>`;

  try {
    let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artista)}&track_name=${encodeURIComponent(cancion)}`;
    let res = await fetch(url);
    let data = res.ok ? await res.json() : null;

    if (!data || !data.syncedLyrics) {
      let searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(artista + ' ' + cancion)}`;
      let searchRes = await fetch(searchUrl);
      let searchData = searchRes.ok ? await searchRes.json() : [];
      data = searchData.find(item => item.syncedLyrics) || null;
    }

    if (data && data.syncedLyrics) {
      syncedLyrics = parsearLRC(data.syncedLyrics);
      
      const fullSample = syncedLyrics.slice(0, 5).map(l => l.text).join(' ');
      isForeignLanguage = !esTextoEnEspanol(fullSample);

      if (isForeignLanguage) {
        panelTranslation.classList.remove('hidden');
        elCurrent.innerHTML = '<div class="main-text">Traduciendo letra...</div>';

        for (let i = 0; i < syncedLyrics.length; i++) {
          const trad = await traducirTexto(syncedLyrics[i].text);
          syncedLyrics[i].translatedText = trad;
        }
      } else {
        panelTranslation.classList.add('hidden');
      }

      let tiempoTotalMs = syncedLyrics.length > 0 ? syncedLyrics[syncedLyrics.length - 1].time + 3000 : 180000;
      inputTimeStart.value = "00:00";
      inputTimeEnd.value = msAFormatoMinutosSegundos(tiempoTotalMs);

      renderizarSelectorLyrics();
      currentMs = 0;
      actualizarRuleta(currentMs);
      actualizarDisplayCronometro(currentMs);
      validarYObtenerTiempos();
    } else {
      elCurrent.innerHTML = '<div class="main-text">Letra sincronizada no disponible</div>';
    }
  } catch (err) {
    elCurrent.innerHTML = '<div class="main-text">Error al cargar letra</div>';
  }
}

// PARSEAR .LRC
function parsearLRC(lrcText) {
  if (!lrcText) return [];
  const lineas = lrcText.split(/\r?\n/);
  return lineas.map(linea => {
    const match = linea.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const min = parseInt(match[1], 10);
      const seg = parseInt(match[2], 10);
      let miliStr = match[3];
      if (miliStr.length === 2) miliStr += '0';
      const timeMs = (min * 60 + seg) * 1000 + parseInt(miliStr, 10);
      return { time: timeMs, text: match[4].trim(), translatedText: match[4].trim() };
    }
    return null;
  }).filter(item => item && item.text.length > 0);
}

// SELECTOR LATERAL DE VERSOS (CON EDICIÓN POR DOBLE CLIC)
function renderizarSelectorLyrics() {
  selectorList.innerHTML = '';
  syncedLyrics.forEach((item, index) => {
    const div = document.createElement('div');
    div.classList.add('selector-item');
    div.innerText = (isForeignLanguage && checkEnableTranslation.checked) ? item.translatedText : item.text;
    div.title = "Doble clic para editar la traducción de este verso";

    // Permite ajustar manualmente la traducción si deseas afinar una frase
    div.addEventListener('dblclick', () => {
      if (!isForeignLanguage) return;
      const nuevoTexto = prompt("Editar traducción de este verso:", item.translatedText);
      if (nuevoTexto !== null && nuevoTexto.trim() !== "") {
        syncedLyrics[index].translatedText = nuevoTexto.trim();
        renderizarSelectorLyrics();
        actualizarRuleta(currentMs);
      }
    });

    div.addEventListener('click', () => {
      currentMs = item.time;
      inputTimeStart.value = msAFormatoMinutosSegundos(currentMs);
      actualizarRuleta(currentMs);
      actualizarDisplayCronometro(currentMs);
      validarYObtenerTiempos();
    });

    selectorList.appendChild(div);
  });
}

// DIBUJAR SLOT BILINGÜE
function renderSlotHTML(el, itemData) {
  if (!itemData) {
    el.innerHTML = "";
    return;
  }

  const showTranslation = isForeignLanguage && checkEnableTranslation.checked;
  const mainText = showTranslation ? itemData.translatedText : itemData.text;
  const subText = showTranslation ? itemData.text : "";

  let html = `<div class="main-text" style="font-size:${inputFontSize.value}px; color:${inputTextColor.value}">${mainText}</div>`;
  if (subText) {
    html += `<div class="sub-text" style="font-size:${inputSubtextFontSize.value}px; color:${inputSubtextColor.value}">${subText}</div>`;
  }
  el.innerHTML = html;
}

// RULETA
function actualizarRuleta(tiempoActualMs) {
  if (!syncedLyrics || syncedLyrics.length === 0) return;  
  let newIndex = syncedLyrics.findLastIndex(item => item.time <= tiempoActualMs);
  if (newIndex === -1) newIndex = 0;

  if (newIndex !== activeIndex) {
    activeIndex = newIndex;
    lastLineChangeRealTime = performance.now();

    renderSlotHTML(elPrev, syncedLyrics[activeIndex - 1]);
    renderSlotHTML(elCurrent, syncedLyrics[activeIndex]);
    renderSlotHTML(elNext, syncedLyrics[activeIndex + 1]);

    [elPrev, elCurrent, elNext].forEach((el) => {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translateY(26px) scale(0.85)';
    });
    void elCurrent.offsetWidth;
    [elPrev, elCurrent, elNext].forEach((el) => {
      el.style.transition = '';
      el.style.opacity = '';
      el.style.transform = '';
    });

    const items = selectorList.querySelectorAll('.selector-item');
    items.forEach((el, i) => {
      if (i === activeIndex) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });
  }
}

// REPRODUCCIÓN
function actualizarEstadoBoton() {
  btnPlay.innerText = isPlaying ? "PLAYING" : "PAUSED";
  btnPlay.className = isPlaying ? "btn-status playing" : "btn-status paused";
}

function iniciarReproduccion() {
  if (isPlaying) return;
  const { esValido, startMs, endMs } = validarYObtenerTiempos();

  if (esValido && endMs > 0 && currentMs >= endMs) currentMs = startMs;

  isPlaying = true;
  actualizarEstadoBoton();

  timer = setInterval(() => {
    currentMs += 100;
    actualizarRuleta(currentMs);
    actualizarDisplayCronometro(currentMs);

    if (esValido && endMs > 0 && currentMs >= endMs) {
      detenerReproduccion();
      if (isRecording) detenerGrabacionVideo();
    }
  }, 100);
}

function detenerReproduccion() {
  isPlaying = false;
  actualizarEstadoBoton();
  clearInterval(timer);
}

function actualizarTransformTarjeta() {
  spotifyCard.style.transform = `translate(${posX}px, ${posY}px)`;
}

function actualizarTransformQuote() {
  quoteHeader.style.transform = `translate(${quotePosX}px, ${quotePosY}px)`;
}

// CANVAS OFFSCREEN HD
function obtenerCanvasHD() {
  let targetCanvas = document.getElementById('render-canvas-hd');
  if (!targetCanvas) {
    targetCanvas = document.createElement('canvas');
    targetCanvas.id = 'render-canvas-hd';
    targetCanvas.width = 1080;
    targetCanvas.height = 1920;
    targetCanvas.style.position = 'fixed';
    targetCanvas.style.left = '-99999px';
    targetCanvas.style.top = '0';
    targetCanvas.style.pointerEvents = 'none';
    document.body.appendChild(targetCanvas);
  }
  return targetCanvas;
}

// RENDER VECTORIAL BILINGÜE EN CANVAS HD
function renderFrameOnCanvas() {
  if (!isRecording) return;
  try {
    dibujarFrameHD();
  } catch (err) {}
  if (isRecording) {
    animationFrameId = requestAnimationFrame(renderFrameOnCanvas);
  }
}

function dibujarFrameHD() {
  const targetCanvas = obtenerCanvasHD();
  const ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, 1080, 1920);

  // 1. Fondo
  const computedBg = window.getComputedStyle(tiktokCanvas).backgroundColor;
  ctx.fillStyle = (computedBg && computedBg !== 'rgba(0, 0, 0, 0)') ? computedBg : (inputCanvasBg.value || "#ffffff");
  ctx.fillRect(0, 0, 1080, 1920);

  // 2. Quote Header
  if (checkShowQuote.checked) {
    ctx.save();
    const quoteX = 540 + quotePosX;
    const quoteY = 960 + quotePosY;
    const fontSize = parseInt(inputQuoteFontSize.value, 10) || 42;
    
    ctx.font = `bold ${fontSize}px 'Alte Haas Grotesk', 'Inter', sans-serif`;
    ctx.textBaseline = "middle";

    const prefixText = (quoteTextPrefix.innerText || "") + " ";
    const artistText = quoteTextArtist.innerText || "";
    const totalWidth = ctx.measureText(prefixText + artistText).width;
    let startX = quoteX - (totalWidth / 2);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    ctx.fillText(prefixText, startX, quoteY);
    
    startX += ctx.measureText(prefixText).width;
    ctx.fillStyle = inputQuoteHighlightColor.value || "#ff6b00";
    ctx.fillText(artistText, startX, quoteY);
    ctx.restore();
  }

  // 3. Tarjeta Spotify
  ctx.save();
  const cardW = parseInt(inputCardWidth.value, 10) || 700;
  const cardH = parseInt(inputCardHeight.value, 10) || 650;
  const cardX = 540 - (cardW / 2) + posX;
  const cardY = 960 - (cardH / 2) + posY;
  const radius = 44;

  function trazarRectRedondeado(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  ctx.save();
  trazarRectRedondeado(cardX, cardY, cardW, cardH, radius);
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.restore();

  trazarRectRedondeado(cardX, cardY, cardW, cardH, radius);
  ctx.clip();

  if (safeCoverImage && safeCoverImage.complete && safeCoverImage.naturalWidth !== 0) {
    ctx.filter = `blur(${inputBlurAmount.value || 30}px)`;
    ctx.drawImage(safeCoverImage, cardX - 50, cardY - 50, cardW + 100, cardH + 100);
    ctx.filter = 'none';
  }

  const hex = inputBgColor.value || "#000000";
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.75)`;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  const padding = 48;
  const headerGap = 20;
  const thumbSize = 80;
  const thumbRadius = 16;
  const thumbX = cardX + padding;
  const thumbY = cardY + padding;

  if (safeCoverImage && safeCoverImage.complete && safeCoverImage.naturalWidth !== 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(thumbX + thumbRadius, thumbY);
    ctx.arcTo(thumbX + thumbSize, thumbY, thumbX + thumbSize, thumbY + thumbSize, thumbRadius);
    ctx.arcTo(thumbX + thumbSize, thumbY + thumbSize, thumbX, thumbY + thumbSize, thumbRadius);
    ctx.arcTo(thumbX, thumbY + thumbSize, thumbX, thumbY, thumbRadius);
    ctx.arcTo(thumbX, thumbY, thumbX + thumbSize, thumbY, thumbRadius);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(safeCoverImage, thumbX, thumbY, thumbSize, thumbSize);
    ctx.restore();
  }

  const titleText = document.getElementById('selected-song-title')?.innerText || "";
  const artistSubText = document.getElementById('selected-song-artist')?.innerText || "";
  const textLeftX = thumbX + thumbSize + headerGap;

  const titleFontSize = 32;
  const artistFontSize = 22;
  const titleLineHeight = titleFontSize * 1.2;
  const artistLineHeight = artistFontSize * 1.2;
  const headerTextBlockHeight = titleLineHeight + artistLineHeight;
  const headerTextTop = thumbY + Math.max(0, (thumbSize - headerTextBlockHeight) / 2);

  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${titleFontSize}px 'Inter', sans-serif`;
  ctx.fillText(titleText, textLeftX, headerTextTop);

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = `700 ${artistFontSize}px 'Inter', sans-serif`;
  ctx.fillText(artistSubText, textLeftX, headerTextTop + titleLineHeight);

  const footerFontSize = 24;
  const footerBaselineY = cardY + cardH - padding;

  // ANIMACIÓN 3D BILINGÜE
  const mainColor = inputTextColor.value || "#ffffff";
  const subColor = inputSubtextColor.value || "#94a3b8";
  const fontSizeMain = parseInt(inputFontSize.value, 10) || 38;
  const fontSizeSub = parseInt(inputSubtextFontSize.value, 10) || 22;
  const fontWeight = selectFontWeight.value || "900";
  const centerX = cardX + padding;

  const progresoLineal = Math.min(1, Math.max(0, (performance.now() - lastLineChangeRealTime) / LYRIC_ANIM_DURATION_MS));
  const p = 1 - Math.pow(1 - progresoLineal, 3);

  const topY = thumbY + thumbSize + 45;        
  const centerY = topY + fontSizeMain + 45;     
  const bottomY = centerY + fontSizeMain + 45;  

  const statePrev = { y: topY - (p * 20), scale: 0.8 - (p * 0.1), alpha: 0.35 * (1 - p) };
  const stateCurrent = { y: centerY - (p * (centerY - topY)), scale: 1.0 - (p * 0.2), alpha: 1.0 - (p * 0.65) };
  const stateNext = { y: bottomY - (p * (bottomY - centerY)), scale: 0.8 + (p * 0.2), alpha: 0.35 + (p * 0.65) };

  function renderizarParBilingue(itemData, x, y, scale, alpha) {
    if (!itemData) return;
    const showTranslation = isForeignLanguage && checkEnableTranslation.checked;
    const mainStr = showTranslation ? itemData.translatedText : itemData.text;
    const subStr = showTranslation ? itemData.text : "";

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Texto Principal Traducido
    ctx.fillStyle = mainColor;
    ctx.font = `${fontWeight} ${fontSizeMain}px 'Inter', sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(mainStr, 0, 0);

    // Texto Secundario Original
    if (subStr) {
      ctx.fillStyle = subColor;
      ctx.font = `600 ${fontSizeSub}px 'Inter', sans-serif`;
      ctx.fillText(subStr, 0, fontSizeMain * 1.15);
    }
    ctx.restore();
  }

  renderizarParBilingue(syncedLyrics[activeIndex - 1], centerX, statePrev.y, statePrev.scale, statePrev.alpha);
  renderizarParBilingue(syncedLyrics[activeIndex], centerX, stateCurrent.y, stateCurrent.scale, stateCurrent.alpha);
  renderizarParBilingue(syncedLyrics[activeIndex + 1], centerX, stateNext.y, stateNext.scale, stateNext.alpha);

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${footerFontSize}px 'Inter', sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Snoosic", cardX + cardW - padding, footerBaselineY);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// GRABACIÓN DE VIDEO HD
async function iniciarGrabacionVideo() {
  if (isRecording) return;
  recordedChunks = [];

  try { await document.fonts.ready; } catch (e) {}

  const targetCanvas = obtenerCanvasHD();
  isRecording = true;
  dibujarFrameHD();
  animationFrameId = requestAnimationFrame(renderFrameOnCanvas);

  const stream = targetCanvas.captureStream(30);
  const candidatosMime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm'];
  let mimeElegido = candidatosMime.find(m => MediaRecorder.isTypeSupported(m));
  
  mediaRecorder = new MediaRecorder(stream, mimeElegido ? { mimeType: mimeElegido } : {});

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Snoosic_Lyric_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 1000);
  };

  mediaRecorder.start(100);
  btnRecordVideo.innerText = "⏹ Detener y Guardar Video";
  btnRecordVideo.classList.add('recording');

  const { startMs } = validarYObtenerTiempos();
  currentMs = startMs;
  actualizarRuleta(currentMs);
  actualizarDisplayCronometro(currentMs);
  iniciarReproduccion();
}

function detenerGrabacionVideo() {
  if (!isRecording) return;
  isRecording = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  detenerReproduccion();
  btnRecordVideo.innerText = "🔴 Grabar Canvas HD";
  btnRecordVideo.classList.remove('recording');
}

btnRecordVideo.addEventListener('click', () => {
  if (!isRecording) iniciarGrabacionVideo();
  else detenerGrabacionVideo();
});

// LISTENERS DE CONTROL DE TRADUCCIÓN
checkEnableTranslation.addEventListener('change', () => {
  renderizarSelectorLyrics();
  actualizarRuleta(currentMs);
});

inputSubtextColor.addEventListener('input', () => actualizarRuleta(currentMs));
inputSubtextFontSize.addEventListener('input', (e) => {
  document.getElementById('val-subtext-font-size').innerText = `${e.target.value}px`;
  actualizarRuleta(currentMs);
});

// STEPPERS Y CONTROLES
function modificarSegundoInput(inputEl, deltaSegundos) {
  const { ms, esValido } = parsearStringATiempoMs(inputEl.value);
  let baseMs = esValido ? ms : 0;
  baseMs = Math.max(0, baseMs + deltaSegundos * 1000);
  inputEl.value = msAFormatoMinutosSegundos(baseMs);
  if (inputEl === inputTimeStart) {
    currentMs = baseMs;
    actualizarRuleta(currentMs);
    actualizarDisplayCronometro(currentMs);
  }
  validarYObtenerTiempos();
}

document.getElementById('btn-start-up').addEventListener('click', () => modificarSegundoInput(inputTimeStart, 1));
document.getElementById('btn-start-down').addEventListener('click', () => modificarSegundoInput(inputTimeStart, -1));
document.getElementById('btn-end-up').addEventListener('click', () => modificarSegundoInput(inputTimeEnd, 1));
document.getElementById('btn-end-down').addEventListener('click', () => modificarSegundoInput(inputTimeEnd, -1));

document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', function() {
    const deltaSec = parseInt(this.getAttribute('data-seconds'), 10);
    const startRes = parsearStringATiempoMs(inputTimeStart.value);
    const baseStartMs = startRes.esValido ? startRes.ms : currentMs;
    inputTimeEnd.value = msAFormatoMinutosSegundos(baseStartMs + (deltaSec * 1000));
    validarYObtenerTiempos();
  });
});

btnResetTime.addEventListener('click', () => {
  let tiempoFinalMs = syncedLyrics.length > 0 ? syncedLyrics[syncedLyrics.length - 1].time + 3000 : 180000;
  inputTimeStart.value = "00:00";
  inputTimeEnd.value = msAFormatoMinutosSegundos(tiempoFinalMs);
  currentMs = 0;
  actualizarRuleta(0);
  actualizarDisplayCronometro(0);
  validarYObtenerTiempos();
});

checkShowQuote.addEventListener('change', (e) => quoteHeader.classList.toggle('hidden', !e.target.checked));
inputQuotePrefix.addEventListener('input', (e) => quoteTextPrefix.innerText = e.target.value);
inputQuoteArtist.addEventListener('input', (e) => quoteTextArtist.innerText = e.target.value);
inputQuoteHighlightColor.addEventListener('input', (e) => quoteTextArtist.style.color = e.target.value);

inputQuotePosX.addEventListener('input', (e) => {
  quotePosX = parseInt(e.target.value, 10);
  document.getElementById('val-quote-pos-x').innerText = `${quotePosX}px`;
  actualizarTransformQuote();
});

inputQuotePosY.addEventListener('input', (e) => {
  quotePosY = parseInt(e.target.value, 10);
  document.getElementById('val-quote-pos-y').innerText = `${quotePosY}px`;
  actualizarTransformQuote();
});

inputQuoteFontSize.addEventListener('input', (e) => {
  quoteHeader.style.fontSize = `${e.target.value}px`;
  document.getElementById('val-quote-font-size').innerText = `${e.target.value}px`;
});

document.getElementById('btn-global-search').addEventListener('click', ejecutarBusquedaGlobal);
document.getElementById('btn-back-to-search').addEventListener('click', () => {
  detenerReproduccion();
  if (isRecording) detenerGrabacionVideo();
  screenStudio.classList.add('hidden');
  screenSearch.classList.remove('hidden');
});

btnPlay.addEventListener('click', () => isPlaying ? detenerReproduccion() : iniciarReproduccion());
document.getElementById('btn-restart').addEventListener('click', () => {
  detenerReproduccion();
  const { startMs } = validarYObtenerTiempos();
  currentMs = startMs;
  actualizarRuleta(currentMs);
  actualizarDisplayCronometro(currentMs);
});

btnSyncTime.addEventListener('click', () => {
  const { esValido, startMs } = validarYObtenerTiempos();
  if (esValido) {
    currentMs = startMs;
    actualizarRuleta(currentMs);
    actualizarDisplayCronometro(currentMs);
  }
});

inputCanvasBg.addEventListener('input', (e) => tiktokCanvas.style.backgroundColor = e.target.value);
inputPosX.addEventListener('input', (e) => {
  posX = parseInt(e.target.value, 10);
  document.getElementById('val-pos-x').innerText = `${posX}px`;
  actualizarTransformTarjeta();
});
inputPosY.addEventListener('input', (e) => {
  posY = parseInt(e.target.value, 10);
  document.getElementById('val-pos-y').innerText = `${posY}px`;
  actualizarTransformTarjeta();
});

inputBgColor.addEventListener('input', (e) => {
  const hex = e.target.value;
  cardColorOverlay.style.backgroundColor = `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, 0.75)`;
});

inputCardWidth.addEventListener('input', (e) => {
  spotifyCard.style.width = `${e.target.value}px`;
  document.getElementById('val-width').innerText = `${e.target.value}px`;
});

inputCardHeight.addEventListener('input', (e) => {
  spotifyCard.style.height = `${e.target.value}px`;
  document.getElementById('val-height').innerText = `${e.target.value}px`;
});

inputBlurAmount.addEventListener('input', (e) => {
  cardBlurBg.style.filter = `blur(${e.target.value}px)`;
  document.getElementById('val-blur').innerText = `${e.target.value}px`;
});

inputTextColor.addEventListener('input', () => actualizarRuleta(currentMs));
inputFontSize.addEventListener('input', (e) => {
  document.getElementById('val-font-size').innerText = `${e.target.value}px`;
  actualizarRuleta(currentMs);
});

selectFontWeight.addEventListener('change', () => actualizarRuleta(currentMs));

inputCustomCover.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async function(event) {
      albumArt.src = event.target.result;
      cardBlurBg.style.backgroundImage = `url('${event.target.result}')`;
      safeCoverImage = await cargarImagenSegura(event.target.result);
    };
    reader.readAsDataURL(file);
  }
});

ejecutarBusquedaGlobal();