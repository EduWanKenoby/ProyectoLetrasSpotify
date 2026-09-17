let syncedLyrics = [];
let activeIndex = -1;
let currentMs = 0;
let isPlaying = false;
let timer = null;

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

// Objeto Image limpio para Canvas
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

// Elementos del Quote Header
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

// CARGAR IMAGEN DE FORMA SEGURA Y GARANTIZADA
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

// PARSER DIRECTO DE CADENA "MM:SS" A MS
function parsearStringATiempoMs(cadena) {
  if (!cadena || typeof cadena !== 'string') {
    return { ms: 0, esValido: false, normalizado: "00:00" };
  }
  
  const str = cadena.trim();
  const partes = str.split(':');
  
  if (partes.length !== 2) {
    return { ms: 0, esValido: false, normalizado: "00:00" };
  }

  const min = parseInt(partes[0], 10);
  const seg = parseInt(partes[1], 10);

  if (isNaN(min) || isNaN(seg) || min < 0 || seg < 0 || seg >= 60) {
    return { ms: 0, esValido: false, normalizado: "00:00" };
  }

  const ms = (min * 60 + seg) * 1000;
  const normalizado = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  return { ms, esValido: true, normalizado };
}

function actualizarDisplayCronometro(ms) {
  if (timerText) timerText.innerText = msATiempoCronometro(ms);
}

// VALIDACIÓN DEL RANGO
function validarYObtenerTiempos() {
  const startRes = parsearStringATiempoMs(inputTimeStart.value);
  const endRes = parsearStringATiempoMs(inputTimeEnd.value);

  let esValido = startRes.esValido && endRes.esValido;

  if (startRes.ms >= endRes.ms) {
    esValido = false;
  }

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

// 1. BUSCAR CATÁLOGO (Deezer API)
function ejecutarBusquedaGlobal() {
  const query = document.getElementById('global-search-input').value.trim();
  if (!query) {
    resultsGrid.innerHTML = `<p style="color:#a1a1aa; grid-column: 1/-1;">Escribe un artista o canción en la barra superior y presiona "Buscar Catálogo".</p>`;
    return;
  }

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
      resultsGrid.innerHTML = `<p style="color:#a1a1aa; grid-column: 1/-1;">No se encontraron canciones relacionadas.</p>`;
    }
    if (document.body.contains(script)) document.body.removeChild(script);
  };

  script.src = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&output=jsonp&callback=deezerSearchCallback`;
  document.body.appendChild(script);
}

document.getElementById('global-search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') ejecutarBusquedaGlobal();
});

// 2. SELECCIONAR CANCIÓN
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
  elPrev.innerText = "";
  elCurrent.innerText = "Buscando letra...";
  elNext.innerText = "";
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
      
      let tiempoTotalMs = 180000;
      if (syncedLyrics.length > 0) {
        tiempoTotalMs = syncedLyrics[syncedLyrics.length - 1].time + 3000;
      }
      
      inputTimeStart.value = "00:00";
      inputTimeEnd.value = msAFormatoMinutosSegundos(tiempoTotalMs);

      renderizarSelectorLyrics();
      
      currentMs = 0;
      actualizarRuleta(currentMs);
      actualizarDisplayCronometro(currentMs);
      validarYObtenerTiempos();
    } else {
      elCurrent.innerText = "Letra sincronizada no disponible";
      selectorList.innerHTML = `<div class="selector-placeholder">Sin letras sincronizadas.</div>`;
    }
  } catch (err) {
    elCurrent.innerText = "Error al conectar con servidor de letras";
  }
}

// 3. PARSEAR .LRC
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
      const mili = parseInt(miliStr, 10);
      const timeMs = (min * 60 + seg) * 1000 + mili;
      return { time: timeMs, text: match[4].trim() };
    }
    return null;
  }).filter(item => item && item.text.length > 0);
}

// 4. SELECTOR LATERAL DE VERSOS
function renderizarSelectorLyrics() {
  selectorList.innerHTML = '';
  syncedLyrics.forEach((item, index) => {
    const div = document.createElement('div');
    div.classList.add('selector-item');
    div.innerText = item.text;
    
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

// 5. RULETA
function actualizarRuleta(tiempoActualMs) {
  if (!syncedLyrics || syncedLyrics.length === 0) return;
  
  let newIndex = syncedLyrics.findLastIndex(item => item.time <= tiempoActualMs);
  if (newIndex === -1) newIndex = 0;

  if (newIndex !== activeIndex) {
    activeIndex = newIndex;
    lastLineChangeRealTime = performance.now();

    elPrev.innerText = syncedLyrics[activeIndex - 1]?.text || "";
    elCurrent.innerText = syncedLyrics[activeIndex]?.text || "";
    elNext.innerText = syncedLyrics[activeIndex + 1]?.text || "";

    [elPrev, elCurrent, elNext].forEach((el) => {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translateY(26px)';
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

// 6. TIMER Y CONTROL DE RANGO AUTOMÁTICO
function actualizarEstadoBoton() {
  if (isPlaying) {
    btnPlay.innerText = "PLAYING";
    btnPlay.className = "btn-status playing";
  } else {
    btnPlay.innerText = "PAUSED";
    btnPlay.className = "btn-status paused";
  }
}

function iniciarReproduccion() {
  if (isPlaying) return;

  const { esValido, startMs, endMs } = validarYObtenerTiempos();

  if (esValido && endMs > 0 && currentMs >= endMs) {
    currentMs = startMs;
  }

  isPlaying = true;
  actualizarEstadoBoton();

  timer = setInterval(() => {
    currentMs += 100;
    actualizarRuleta(currentMs);
    actualizarDisplayCronometro(currentMs);

    if (esValido && endMs > 0 && currentMs >= endMs) {
      detenerReproduccion();
      if (isRecording) {
        detenerGrabacionVideo();
      }
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

// CANVAS OFFSCREEN PARA GRABACIÓN
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

// 7. RENDERIZADO VECTORIAL COMPLETO (SNOOSIC HD 1080x1920)
function renderFrameOnCanvas() {
  if (!isRecording) return;

  try {
    dibujarFrameHD();
  } catch (err) {
    console.error('Snoosic: error dibujando frame HD.', err);
  }

  if (isRecording) {
    animationFrameId = requestAnimationFrame(renderFrameOnCanvas);
  }
}

function dibujarFrameHD() {
  const targetCanvas = obtenerCanvasHD();
  const ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, 1080, 1920);

  // 1. Fondo General del Canvas
  const computedBg = window.getComputedStyle(tiktokCanvas).backgroundColor;
  ctx.fillStyle = (computedBg && computedBg !== 'rgba(0, 0, 0, 0)') ? computedBg : (inputCanvasBg.value || "#ffffff");
  ctx.fillRect(0, 0, 1080, 1920);

  // 2. Quote Header ("Y como dijo Avicii:")
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
    ctx.fillStyle = inputQuoteHighlightColor.value || "#f97316";
    ctx.fillText(artistText, startX, quoteY);
    ctx.restore();
  }

  // 3. Tarjeta Spotify
  ctx.save();
  const cardW = parseInt(inputCardWidth.value, 10) || 700;
  const cardH = parseInt(inputCardHeight.value, 10) || 450;
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

  // Sombra de la Tarjeta
  ctx.save();
  trazarRectRedondeado(cardX, cardY, cardW, cardH, radius);
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.restore();

  // Clip Bordes Redondeados
  trazarRectRedondeado(cardX, cardY, cardW, cardH, radius);
  ctx.clip();

  // Fondo Blur de la Portada
  if (safeCoverImage && safeCoverImage.complete && safeCoverImage.naturalWidth !== 0) {
    ctx.filter = `blur(${inputBlurAmount.value || 30}px)`;
    ctx.drawImage(safeCoverImage, cardX - 50, cardY - 50, cardW + 100, cardH + 100);
    ctx.filter = 'none';
  }

  // Overlay Oscuro Transparente
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

  // Miniatura de portada
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

  // Watermark Snoosic
  const footerFontSize = 24;
  const footerLineHeight = footerFontSize * 1.2;
  const footerBaselineY = cardY + cardH - padding;

  // Letras Sincronizadas
  const textColor = inputTextColor.value || "#ffffff";
  const fontSizeCurrent = parseInt(inputFontSize.value, 10) || 28;
  const fontSizeSide = Math.max(fontSizeCurrent - 6, 14);
  const fontWeight = selectFontWeight.value || "700";
  const lineHeightMultiplier = 1.25;
  const blockGap = 20;
  const maxTextWidth = cardW - padding * 2;

  function envolverTexto(texto, tamFuente) {
    if (!texto) return [];
    ctx.font = `${fontWeight} ${tamFuente}px 'Inter', sans-serif`;
    const palabras = texto.split(/\s+/).filter(Boolean);
    const lineas = [];
    let actual = '';
    palabras.forEach((palabra) => {
      const prueba = actual ? actual + ' ' + palabra : palabra;
      if (actual && ctx.measureText(prueba).width > maxTextWidth) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    });
    if (actual) lineas.push(actual);
    return lineas;
  }

  const lineasPrev = envolverTexto(elPrev.innerText || "", fontSizeSide);
  const lineasCurrent = envolverTexto(elCurrent.innerText || "", fontSizeCurrent);
  const lineasNext = envolverTexto(elNext.innerText || "", fontSizeSide);

  const progresoLineal = Math.min(1, Math.max(0, (performance.now() - lastLineChangeRealTime) / LYRIC_ANIM_DURATION_MS));
  const progresoAnim = 1 - Math.pow(1 - progresoLineal, 3);
  const animAlpha = progresoAnim;
  const animOffsetY = (1 - progresoAnim) * 26;

  const lineHeightSide = fontSizeSide * lineHeightMultiplier;
  const lineHeightCurrent = fontSizeCurrent * lineHeightMultiplier;

  const totalLyricsHeight =
    (lineasPrev.length * lineHeightSide) +
    (lineasCurrent.length * lineHeightCurrent) +
    (lineasNext.length * lineHeightSide) +
    blockGap * 2;

  const lyricsAreaTop = thumbY + thumbSize + blockGap;
  const lyricsAreaBottom = footerBaselineY - footerLineHeight - blockGap;
  const lyricsAreaHeight = Math.max(0, lyricsAreaBottom - lyricsAreaTop);

  let cursorY = lyricsAreaTop + Math.max(0, (lyricsAreaHeight - totalLyricsHeight) / 2);

  function dibujarBloque(lineas, tamFuente, alpha, lineHeight) {
    ctx.globalAlpha = alpha * animAlpha;
    ctx.fillStyle = textColor;
    ctx.font = `${fontWeight} ${tamFuente}px 'Inter', sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lineas.forEach((linea) => {
      ctx.fillText(linea, cardX + padding, cursorY + animOffsetY);
      cursorY += lineHeight;
    });
    cursorY += blockGap;
  }

  dibujarBloque(lineasPrev, fontSizeSide, 0.35, lineHeightSide);
  dibujarBloque(lineasCurrent, fontSizeCurrent, 1.0, lineHeightCurrent);
  dibujarBloque(lineasNext, fontSizeSide, 0.35, lineHeightSide);

  // Watermark Snoosic
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${footerFontSize}px 'Inter', sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Snoosic", cardX + cardW - padding, footerBaselineY);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// 8. MÓDULO DE GRABACIÓN HD ESTABLE
async function iniciarGrabacionVideo() {
  if (isRecording) return;

  recordedChunks = [];

  try {
    await document.fonts.ready;
  } catch (e) { }

  const esperaMaxMs = 1500;
  const inicioEspera = performance.now();
  while (
    safeCoverImage &&
    !(safeCoverImage.complete && safeCoverImage.naturalWidth !== 0) &&
    performance.now() - inicioEspera < esperaMaxMs
  ) {
    await new Promise((r) => setTimeout(r, 50));
  }

  const targetCanvas = obtenerCanvasHD();

  isRecording = true;
  try {
    dibujarFrameHD();
  } catch (err) {
    console.error('Snoosic: error en el primer frame HD.', err);
  }
  animationFrameId = requestAnimationFrame(renderFrameOnCanvas);

  const stream = targetCanvas.captureStream(30);

  const candidatosMime = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  let mimeElegido = candidatosMime.find((m) => MediaRecorder.isTypeSupported(m));
  let options = mimeElegido ? { mimeType: mimeElegido } : {};

  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (e) {
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = function(e) {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = function() {
    const tipoFinal = mediaRecorder.mimeType || 'video/webm';
    const blob = new Blob(recordedChunks, { type: tipoFinal });

    if (blob.size === 0) {
      alert("Error: El archivo grabado está vacío.");
      return;
    }

    const extension = tipoFinal.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Snoosic_Lyric_${Date.now()}.${extension}`;
    
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
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  detenerReproduccion();
  
  btnRecordVideo.innerText = "🔴 Grabar Canvas HD";
  btnRecordVideo.classList.remove('recording');
}

btnRecordVideo.addEventListener('click', () => {
  if (!isRecording) iniciarGrabacionVideo();
  else detenerGrabacionVideo();
});

// STEPPERS (+1s / -1s)
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

// LISTENERS DE FLECHAS STEPPERS
document.getElementById('btn-start-up').addEventListener('click', () => modificarSegundoInput(inputTimeStart, 1));
document.getElementById('btn-start-down').addEventListener('click', () => modificarSegundoInput(inputTimeStart, -1));
document.getElementById('btn-end-up').addEventListener('click', () => modificarSegundoInput(inputTimeEnd, 1));
document.getElementById('btn-end-down').addEventListener('click', () => modificarSegundoInput(inputTimeEnd, -1));

// SUMA RELATIVA DIRECTA DE PRESETS
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', function() {
    const attrSeg = this.getAttribute('data-seconds');
    const deltaSec = parseInt(attrSeg, 10);

    if (isNaN(deltaSec)) return;

    const startRes = parsearStringATiempoMs(inputTimeStart.value);
    const baseStartMs = startRes.esValido ? startRes.ms : currentMs;
    
    const nuevoEndMs = baseStartMs + (deltaSec * 1000);

    inputTimeEnd.value = msAFormatoMinutosSegundos(nuevoEndMs);
    validarYObtenerTiempos();
  });
});

// REINICIAR RANGO DE TIEMPO
btnResetTime.addEventListener('click', () => {
  let tiempoFinalMs = 180000;
  if (syncedLyrics.length > 0) {
    tiempoFinalMs = syncedLyrics[syncedLyrics.length - 1].time + 3000;
  }
  inputTimeStart.value = "00:00";
  inputTimeEnd.value = msAFormatoMinutosSegundos(tiempoFinalMs);
  currentMs = 0;
  actualizarRuleta(0);
  actualizarDisplayCronometro(0);
  validarYObtenerTiempos();
});

// LISTENERS DE CONTROL DE QUOTE TEXT
checkShowQuote.addEventListener('change', (e) => {
  if (e.target.checked) quoteHeader.classList.remove('hidden');
  else quoteHeader.classList.add('hidden');
});

inputQuotePrefix.addEventListener('input', (e) => {
  quoteTextPrefix.innerText = e.target.value;
});

inputQuoteArtist.addEventListener('input', (e) => {
  quoteTextArtist.innerText = e.target.value;
});

inputQuoteHighlightColor.addEventListener('input', (e) => {
  quoteTextArtist.style.color = e.target.value;
});

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
  const size = parseInt(e.target.value, 10);
  quoteHeader.style.fontSize = `${size}px`;
  document.getElementById('val-quote-font-size').innerText = `${size}px`;
});

// LISTENERS DE NAVEGACIÓN Y PLAYBACK
document.getElementById('btn-global-search').addEventListener('click', ejecutarBusquedaGlobal);

document.getElementById('btn-back-to-search').addEventListener('click', () => {
  detenerReproduccion();
  if (isRecording) detenerGrabacionVideo();
  screenStudio.classList.add('hidden');
  screenSearch.classList.remove('hidden');
});

btnPlay.addEventListener('click', () => {
  if (isPlaying) detenerReproduccion();
  else iniciarReproduccion();
});

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

inputTimeStart.addEventListener('change', () => {
  const { esValido, startMs } = validarYObtenerTiempos();
  if (esValido) {
    currentMs = startMs;
    actualizarRuleta(currentMs);
    actualizarDisplayCronometro(currentMs);
  }
});

inputTimeEnd.addEventListener('change', () => validarYObtenerTiempos());

// LISTENERS DE CANVAS Y ESTILOS
inputCanvasBg.addEventListener('input', (e) => {
  tiktokCanvas.style.backgroundColor = e.target.value;
});

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
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  cardColorOverlay.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.75)`;
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

inputTextColor.addEventListener('input', (e) => {
  const color = e.target.value;
  elPrev.style.color = color;
  elCurrent.style.color = color;
  elNext.style.color = color;
});

inputFontSize.addEventListener('input', (e) => {
  const size = parseInt(e.target.value, 10);
  document.getElementById('val-font-size').innerText = `${size}px`;
  elCurrent.style.fontSize = `${size}px`;
  elPrev.style.fontSize = `${Math.max(size - 6, 14)}px`;
  elNext.style.fontSize = `${Math.max(size - 6, 14)}px`;
});

selectFontWeight.addEventListener('change', (e) => {
  const weight = e.target.value;
  elPrev.style.fontWeight = weight;
  elCurrent.style.fontWeight = weight;
  elNext.style.fontWeight = weight;
});

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

// Carga inicial
ejecutarBusquedaGlobal();