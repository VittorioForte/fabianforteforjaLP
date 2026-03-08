/**
 * ═══════════════════════════════════════════════════
 *  FABIAN FORTE FORJA — script.js
 *
 *  Arquitectura de scroll cinematográfico:
 *  • El canvas permanece fijo mientras se desplaza
 *  • 4 etapas de texto se revelan progresivamente
 *  • La animación de frames avanza durante todo el hero
 *  • GSAP ScrollTrigger gestiona el pin y el progreso
 * ═══════════════════════════════════════════════════
 */

'use strict';

/* ─────────────────────────────────────────────────
   CONFIGURACIÓN GLOBAL
───────────────────────────────────────────────── */
const CONFIG = {
  BASE_URL:        'https://fabianforteforjahero.vercel.app/frames',
  FRAME_COUNT:     191,          // frames totales (0–190)
  DELAY_TAG:       '_delay-0.041s',
  SCROLL_DISTANCE: 2500,         // px de scroll para el hero completo

  // Etapas: [inicio, fin] como fracción del scroll (0→1)
  // El texto de cada etapa es visible en su ventana
  STAGES: [
    { id: 'stage1', in: 0.00, hold: 0.06, out: 0.22, fade: 0.28 },  // Intro
    { id: 'stage2', in: 0.26, hold: 0.32, out: 0.48, fade: 0.54 },  // Concepto
    { id: 'stage3', in: 0.52, hold: 0.58, out: 0.72, fade: 0.78 },  // Oficio
    { id: 'stage4', in: 0.76, hold: 0.82, out: 0.96, fade: 1.00 },  // CTA
  ],
};

/* ─────────────────────────────────────────────────
   ESTADO
───────────────────────────────────────────────── */
const images      = new Array(CONFIG.FRAME_COUNT);
let   loadedCount = 0;
let   currentFrame = 0;
let   targetFrame  = 0;
let   currentProgress = 0;  // progreso del hero (0→1)

/* ─────────────────────────────────────────────────
   REFERENCIAS AL DOM
───────────────────────────────────────────────── */
const loader          = document.getElementById('loader');
const loaderBar       = document.getElementById('loaderBar');
const loaderPct       = document.getElementById('loaderPct');
const canvas          = document.getElementById('heroCanvas');
const ctx             = canvas.getContext('2d');
const progressFillEl  = document.getElementById('heroProgressFill');
const navbar          = document.getElementById('navbar');
const navHamburger    = document.getElementById('navHamburger');
const mobileNav       = document.getElementById('mobileNav');
const cursorDot       = document.getElementById('cursor');
const cursorRing      = document.getElementById('cursorFollower');
const scrollCue       = document.getElementById('scrollCue');
const frameNumDisplay = document.getElementById('frameNumDisplay');

// Etapas de historia
const stageEls = CONFIG.STAGES.map(s => document.getElementById(s.id));

// Puntos de progreso lateral
const pstageEls = [
  document.getElementById('pstage1'),
  document.getElementById('pstage2'),
  document.getElementById('pstage3'),
  document.getElementById('pstage4'),
];

/* ─────────────────────────────────────────────────
   CONSTRUCTOR DE URL DE FRAME
   índice → "frame_042_delay-0.041s.jpg"
───────────────────────────────────────────────── */
function frameURL(index) {
  const padded = index.toString().padStart(3, '0');
  return `${CONFIG.BASE_URL}/frame_${padded}${CONFIG.DELAY_TAG}.jpg`;
}

/* ─────────────────────────────────────────────────
   REDIMENSIÓN DEL CANVAS
   Mantiene resolución pixel-perfect en resize y retina
───────────────────────────────────────────────── */
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  drawFrame(Math.round(currentFrame));
}

/* ─────────────────────────────────────────────────
   DIBUJAR FRAME
   Ajusta la imagen al canvas en modo "cover" (CSS cover)
───────────────────────────────────────────────── */
function drawFrame(index) {
  const img = images[index];
  if (!img || !img.complete || !img.naturalWidth) return;

  const cw = canvas.width,  ch = canvas.height;
  const iw = img.naturalWidth, ih = img.naturalHeight;

  const scale = Math.max(cw / iw, ch / ih);
  const dw = iw * scale,   dh = ih * scale;
  const dx = (cw - dw) / 2, dy = (ch - dh) / 2;

  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* ─────────────────────────────────────────────────
   LOOP DE ANIMACIÓN (RAF)
   Interpola suavemente currentFrame → targetFrame
───────────────────────────────────────────────── */
function animateLoop() {
  requestAnimationFrame(animateLoop);

  if (Math.abs(targetFrame - currentFrame) < 0.5) {
    if (currentFrame !== targetFrame) {
      currentFrame = targetFrame;
      drawFrame(currentFrame);
    }
    return;
  }

  // Lerp con velocidad proporcional a la diferencia
  const diff = targetFrame - currentFrame;
  currentFrame += diff * 0.2;
  currentFrame = Math.max(0, Math.min(CONFIG.FRAME_COUNT - 1, currentFrame));

  drawFrame(Math.round(currentFrame));

  // Actualizar contador de frames
  if (frameNumDisplay) {
    frameNumDisplay.textContent = String(Math.round(currentFrame)).padStart(3, '0');
  }
}

/* ─────────────────────────────────────────────────
   PRECARGA DE FRAMES
   Carga todos los JPEGs y actualiza la barra de carga
───────────────────────────────────────────────── */
function preloadFrames() {
  return new Promise((resolve) => {

    // Cargar y mostrar el primer frame de inmediato
    const boot = new Image();
    boot.src = frameURL(0);
    boot.onload = () => {
      images[0] = boot;
      drawFrame(0);
    };

    for (let i = 0; i < CONFIG.FRAME_COUNT; i++) {
      const img = new Image();

      img.onload = img.onerror = () => {
        loadedCount++;
        const pct = Math.round((loadedCount / CONFIG.FRAME_COUNT) * 100);
        if (loaderBar)  loaderBar.style.width = pct + '%';
        if (loaderPct)  loaderPct.textContent  = pct + '%';
        if (loadedCount >= CONFIG.FRAME_COUNT) resolve();
      };

      img.src   = frameURL(i);
      images[i] = img;
    }
  });
}

/* ─────────────────────────────────────────────────
   CALCULAR OPACIDAD DE UNA ETAPA
   Curva suave: fade in → hold → fade out
   p    = progreso actual (0→1)
   s    = objeto de etapa { in, hold, out, fade }
───────────────────────────────────────────────── */
function stageOpacity(p, s) {
  if (p < s.in || p > s.fade) return 0;
  if (p < s.hold) {
    // Fade in
    return smoothstep(s.in, s.hold, p);
  }
  if (p < s.out) {
    // Hold máximo
    return 1;
  }
  // Fade out
  return 1 - smoothstep(s.out, s.fade, p);
}

/* ─────────────────────────────────────────────────
   SUAVIZADO (smoothstep)
   Curva hermite para transiciones más elegantes
───────────────────────────────────────────────── */
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/* ─────────────────────────────────────────────────
   ACTUALIZAR ETAPAS DE HISTORIA
   Llamado en cada tick de ScrollTrigger.onUpdate
───────────────────────────────────────────────── */
function updateStages(progress) {
  currentProgress = progress;

  // Actualizar opacidad de cada etapa
  CONFIG.STAGES.forEach((s, i) => {
    const alpha = stageOpacity(progress, s);
    const el    = stageEls[i];
    if (!el) return;

    el.style.opacity = alpha;

    // Leve desplazamiento vertical: entra desde abajo, sale hacia arriba
    const inPhase  = progress < s.hold;
    const outPhase = progress > s.out;
    const yOffset  = inPhase
      ? (1 - smoothstep(s.in, s.hold, progress)) * 28
      : outPhase
        ? -(smoothstep(s.out, s.fade, progress)) * 22
        : 0;

    el.style.transform = `translateY(${yOffset}px)`;

    // Clase .stage-active para sub-animaciones CSS (ej. stage-rule)
    if (alpha > 0.5) {
      el.classList.add('stage-active');
    } else {
      el.classList.remove('stage-active');
    }
  });

  // Actualizar indicadores de progreso lateral
  CONFIG.STAGES.forEach((s, i) => {
    const isActive = progress >= s.in && progress <= s.fade;
    if (pstageEls[i]) {
      pstageEls[i].classList.toggle('active', isActive);
    }
  });

  // Barra de progreso (CSS variable --progress)
  if (progressFillEl) {
    progressFillEl.style.setProperty('--progress', (progress * 100) + '%');
  }

  // Ocultar pista de scroll después de 12% de avance
  if (scrollCue) {
    scrollCue.classList.toggle('hidden', progress > 0.12);
  }

  // Actualizar frame objetivo
  targetFrame = Math.round(progress * (CONFIG.FRAME_COUNT - 1));
  targetFrame = Math.max(0, Math.min(CONFIG.FRAME_COUNT - 1, targetFrame));
}

/* ─────────────────────────────────────────────────
   ANIMACIÓN DE ENTRADA DEL HERO
   Activa las líneas del título tras el loader
───────────────────────────────────────────────── */
function animateHeroIn() {
  // La etapa 1 aparece de inmediato con opacidad 1
  if (stageEls[0]) stageEls[0].style.opacity = '1';

  // Animar líneas del título con stagger CSS
  requestAnimationFrame(() => {
    document.querySelectorAll('.smt-line').forEach(line => {
      line.classList.add('line-in');
    });
    stageEls[0].classList.add('stage-active');
  });
}

/* ─────────────────────────────────────────────────
   INICIALIZAR GSAP SCROLL TRIGGER
   Pin del hero + sincronización de frames y etapas
───────────────────────────────────────────────── */
function initScrollTrigger() {
  gsap.registerPlugin(ScrollTrigger);

  const heroSection = document.getElementById('hero');

  // ── Pin principal del hero ───────────────────────
  // El hero se fija durante SCROLL_DISTANCE px.
  // El canvas y las etapas de texto se actualizan
  // con cada tick de onUpdate.
  ScrollTrigger.create({
    trigger: heroSection,
    start:   'top top',
    end:     `+=${CONFIG.SCROLL_DISTANCE}`,
    pin:     true,
    pinSpacing: true,
    anticipatePin: 1,

    onUpdate(self) {
      updateStages(self.progress);
    },

    onLeave() {
      // Al salir: asegurar último frame y última etapa visible
      updateStages(1.0);
      navbar.classList.add('solid');
    },

    onEnterBack() {
      // Al volver: quitar navbar sólida si volvemos al hero
      navbar.classList.remove('solid');
    },
  });

  // ── Navbar sólida tras el hero ───────────────────
  ScrollTrigger.create({
    trigger: '#sobre',
    start:   'top 90%',
    onEnter()     { navbar.classList.add('solid'); },
    onLeaveBack() { navbar.classList.remove('solid'); },
  });
}

/* ─────────────────────────────────────────────────
   SCROLL REVEAL — IntersectionObserver
   Para secciones debajo del hero
───────────────────────────────────────────────── */
function initReveal() {
  const targets = document.querySelectorAll(
    '.reveal-up, .reveal-rule, .reveal-step, .reveal-card'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -36px 0px' });

  targets.forEach(el => observer.observe(el));
}



/* ─────────────────────────────────────────────────
   SCROLL SUAVE — enlaces de anclaje
───────────────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const id = anchor.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();

      // Cerrar menú móvil si está abierto
      mobileNav.classList.remove('open');
      navHamburger.classList.remove('open');
      document.body.style.overflow = '';

      target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ─────────────────────────────────────────────────
   MENÚ MÓVIL
───────────────────────────────────────────────── */
function initMobileNav() {
  navHamburger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    navHamburger.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
}

/* ─────────────────────────────────────────────────
   ANIMACIÓN DE CONTADORES (estadísticas)
───────────────────────────────────────────────── */
function initCounters() {
  const stats = document.querySelectorAll('.stat-num');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);

      const el    = entry.target;
      const raw   = el.textContent.trim();
      const match = raw.match(/(\d+)/);
      if (!match) return;

      const end      = parseInt(match[1], 10);
      const suffix   = raw.replace(match[1], '');
      const duration = 1400;
      const start    = performance.now();

      const tick = now => {
        const t      = Math.min((now - start) / duration, 1);
        const eased  = 1 - Math.pow(1 - t, 3); // ease-out cúbico
        el.textContent = Math.round(eased * end) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });

  stats.forEach(s => observer.observe(s));
}

/* ─────────────────────────────────────────────────
   ESPERAR A GSAP (cargado con defer)
───────────────────────────────────────────────── */
function waitForGSAP() {
  return new Promise(resolve => {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      return resolve();
    }
    const id = setInterval(() => {
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        clearInterval(id);
        resolve();
      }
    }, 40);
  });
}

/* ─────────────────────────────────────────────────
   FUNCIÓN PRINCIPAL
   Secuencia de arranque:
   1. Redimensionar canvas
   2. Iniciar loop RAF
   3. Precargar frames (loader visible)
   4. Ocultar loader
   5. Animar título de entrada
   6. Registrar ScrollTrigger
   7. Iniciar interacciones secundarias
───────────────────────────────────────────────── */
async function main() {
  // 1 — Canvas listo antes de cualquier pintura
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 2 — Loop RAF siempre activo
  animateLoop();

  // Dibujar primer frame enseguida para evitar negro
  drawFrame(0);

  // 3 — Precargar todos los frames (muestra progreso)
  await preloadFrames();

  // Pequeña pausa para que el usuario vea el 100%
  await new Promise(r => setTimeout(r, 350));

  // 4 — Ocultar loader
  loader.classList.add('hidden');

  // Redibujar frame 0 con canvas a tamaño correcto
  drawFrame(0);

  // 5 — Animar entrada del hero
  animateHeroIn();

  // 6 — Esperar GSAP y registrar el scroll
  await waitForGSAP();
  initScrollTrigger();

  // 7 — Resto de interacciones
  initReveal();
  initSmoothScroll();
  initMobileNav();
  initCounters();
}

/* ─────────────────────────────────────────────────
   INICIO
───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', main);



document.querySelectorAll(".project-card").forEach(card => {

  const images = card.querySelectorAll(".carousel-img");
  const next = card.querySelector(".next");
  const prev = card.querySelector(".prev");

  let index = 0;

  function showImage(i){
    images.forEach(img => img.classList.remove("active"));
    images[i].classList.add("active");
  }

  next.addEventListener("click", () => {
    index++;
    if(index >= images.length) index = 0;
    showImage(index);
  });

  prev.addEventListener("click", () => {
    index--;
    if(index < 0) index = images.length - 1;
    showImage(index);
  });

});
