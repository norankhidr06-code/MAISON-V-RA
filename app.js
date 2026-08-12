/**
 * MAISON VÉRA — Product Showcase & Responsive 360° Inertia Engine
 */

(function () {
  'use strict';

  // --- Configuration & State ---
  let framesList = [];
  const loadedImages = [];
  let totalFrames = 0;
  
  // Physics & Frame State
  let targetFrameIndex = 0;
  let currentFrameIndex = 0;
  const lerpDamping = 0.085; // Momentum smoothness factor (lower = smoother inertia)
  let dragVelocity = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartFrame = 0;
  
  // Interaction Modes
  let isAutoSpinning = false;
  let isDragMode = false;
  let soundEnabled = false;

  // DOM Elements
  const canvas = document.getElementById('product-canvas');
  const ctx = canvas.getContext('2d');
  const preloader = document.getElementById('preloader');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const progressCount = document.getElementById('progress-count');
  const angleValue = document.getElementById('angle-value');
  const frameTag = document.getElementById('frame-tag');
  const hotspotsLayer = document.getElementById('hotspots-layer');
  const storySections = document.querySelectorAll('.story-section');
  const navLinks = document.querySelectorAll('.nav-link');
  const soundBtn = document.getElementById('sound-btn');

  // Web Audio Context for Subtle Sound Effects
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
    }
  }

  function playClickSound(freq = 600, duration = 0.05) {
    if (!soundEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + duration);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  // --- Step 1: Frame Loading & Preloader ---
  async function loadFrames() {
    try {
      const response = await fetch('frames.json');
      if (response.ok) {
        framesList = await response.json();
      } else {
        throw new Error('Failed to load frames.json');
      }
    } catch (e) {
      console.warn('Using generated frame list fallback');
      framesList = Array.from({ length: 240 }, (_, i) => `ezgif-frame-${String(i + 1).padStart(3, '0')}.png`);
    }

    totalFrames = framesList.length;
    let loadedCount = 0;

    return new Promise((resolve) => {
      framesList.forEach((src, index) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          const percent = Math.floor((loadedCount / totalFrames) * 100);
          progressBar.style.width = `${percent}%`;
          progressText.innerText = `${percent}%`;
          progressCount.innerText = `Loading studio frame ${loadedCount}/${totalFrames}...`;

          if (loadedCount === totalFrames) {
            setTimeout(() => {
              preloader.classList.add('hidden');
              resolve();
            }, 300);
          }
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === totalFrames) {
            preloader.classList.add('hidden');
            resolve();
          }
        };
        img.src = src;
        loadedImages[index] = img;
      });
    });
  }

  // --- Step 2: Responsive High-DPI Canvas Fitting ---
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x DPR for high performance
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    renderCurrentFrame();
  }

  function renderCurrentFrame() {
    if (!totalFrames || !loadedImages.length) return;

    // Normalize frame index loop
    let idx = Math.floor(currentFrameIndex) % totalFrames;
    if (idx < 0) idx += totalFrames;

    const img = loadedImages[idx];
    if (!img || !img.complete) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    ctx.clearRect(0, 0, viewportW, viewportH);

    // Calculate aspect ratio contain fit
    const paddingMultiplier = viewportW < 768 ? 0.90 : 0.80; // Slightly larger on mobile
    const scale = Math.min((viewportW * paddingMultiplier) / img.width, (viewportH * paddingMultiplier) / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    const drawX = (viewportW - drawW) / 2;
    const drawY = (viewportH - drawH) / 2 + (viewportW < 768 ? 10 : 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Update Angle & Frame Tag
    const degrees = Math.round((idx / totalFrames) * 360);
    angleValue.innerText = `${degrees}°`;
    frameTag.innerText = `${idx + 1} / ${totalFrames}`;

    // Sync story overlays & hotspots
    updateOverlaysAndHotspots(idx);
  }

  // --- Step 3: Story Overlays & Hotspots Sync ---
  function updateOverlaysAndHotspots(frameIdx) {
    const progress = frameIdx / totalFrames;

    // Active Section Mapping
    let activeIndex = 0;
    if (progress >= 0.85) activeIndex = 4;
    else if (progress >= 0.65) activeIndex = 3;
    else if (progress >= 0.40) activeIndex = 2;
    else if (progress >= 0.15) activeIndex = 1;
    else activeIndex = 0;

    storySections.forEach((section, idx) => {
      if (idx === activeIndex) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Nav Link Highlighting
    navLinks.forEach((link, idx) => {
      if (idx === activeIndex) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Hotspots visibility in Craftsmanship & Hardware sections
    if (activeIndex === 1 || activeIndex === 2 || activeIndex === 3) {
      hotspotsLayer.classList.add('visible');
    } else {
      hotspotsLayer.classList.remove('visible');
    }
  }

  // --- Step 4: Smooth Inertia Animation Loop ---
  function animate() {
    requestAnimationFrame(animate);

    // Auto spin handling
    if (isAutoSpinning) {
      targetFrameIndex += 0.35;
    }

    // Drag inertia momentum decay
    if (!isDragging && Math.abs(dragVelocity) > 0.01) {
      targetFrameIndex += dragVelocity;
      dragVelocity *= 0.92; // Friction decay
    }

    // Damped Linear Interpolation (Lerp) for smooth inertia
    const diff = targetFrameIndex - currentFrameIndex;
    if (Math.abs(diff) > 0.001) {
      currentFrameIndex += diff * lerpDamping;
      renderCurrentFrame();
    }
  }

  // --- Step 5: Input Event Listeners (Scroll, Touch, Drag) ---

  // Page Scroll sync
  function onScroll() {
    if (isDragMode || isAutoSpinning) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const scrollFraction = window.scrollY / maxScroll;
    targetFrameIndex = scrollFraction * (totalFrames - 1);
  }

  // Mouse Wheel Momentum Handler
  window.addEventListener('wheel', (e) => {
    if (isDragMode) return;
    playClickSound(400, 0.03);
    // Smooth wheel scroll velocity increment
    const scrollSensitivity = 0.12;
    targetFrameIndex += e.deltaY * scrollSensitivity * 0.1;
  }, { passive: true });

  // Drag / Touch Handlers
  function onPointerDown(e) {
    if (e.target.closest('.header') || e.target.closest('.controls-bar') || e.target.closest('.modal-overlay')) return;
    isDragging = true;
    dragStartX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    dragStartFrame = targetFrameIndex;
    dragVelocity = 0;
    initAudio();
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const deltaX = currentX - dragStartX;
    const dragSensitivity = 0.35;
    const newTarget = dragStartFrame - deltaX * dragSensitivity;
    dragVelocity = newTarget - targetFrameIndex;
    targetFrameIndex = newTarget;
  }

  function onPointerUp() {
    isDragging = false;
  }

  // Bind Mouse & Touch events
  canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  canvas.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);

  // Window scroll event
  window.addEventListener('scroll', onScroll, { passive: true });

  // Window Resize
  window.addEventListener('resize', resizeCanvas);

  // --- Step 6: Controls Bar Actions ---
  const modeScrollBtn = document.getElementById('mode-scroll-btn');
  const modeDragBtn = document.getElementById('mode-drag-btn');
  const autoSpinBtn = document.getElementById('auto-spin-btn');
  const playIcon = autoSpinBtn.querySelector('.play-icon');
  const pauseIcon = autoSpinBtn.querySelector('.pause-icon');

  modeScrollBtn.addEventListener('click', () => {
    initAudio();
    playClickSound(700, 0.08);
    isDragMode = false;
    isAutoSpinning = false;
    modeScrollBtn.classList.add('active');
    modeDragBtn.classList.remove('active');
    autoSpinBtn.classList.remove('active');
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onScroll();
  });

  modeDragBtn.addEventListener('click', () => {
    initAudio();
    playClickSound(800, 0.08);
    isDragMode = true;
    isAutoSpinning = false;
    modeDragBtn.classList.add('active');
    modeScrollBtn.classList.remove('active');
    autoSpinBtn.classList.remove('active');
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  });

  autoSpinBtn.addEventListener('click', () => {
    initAudio();
    playClickSound(900, 0.08);
    isAutoSpinning = !isAutoSpinning;
    if (isAutoSpinning) {
      autoSpinBtn.classList.add('active');
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
    } else {
      autoSpinBtn.classList.remove('active');
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
    }
  });

  soundBtn.addEventListener('click', () => {
    initAudio();
    soundEnabled = !soundEnabled;
    const soundOff = soundBtn.querySelector('.sound-off');
    const soundOn = soundBtn.querySelector('.sound-on');
    if (soundEnabled) {
      soundOff.classList.add('hidden');
      soundOn.classList.remove('hidden');
      playClickSound(880, 0.1);
    } else {
      soundOff.classList.remove('hidden');
      soundOn.classList.add('hidden');
    }
  });

  // Global Navigation scroll function
  window.scrollToSection = function (percentage) {
    initAudio();
    playClickSound(650, 0.05);
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: maxScroll * percentage,
      behavior: 'smooth'
    });
  };

  // Specs Modal toggle
  window.toggleSpecsModal = function (show) {
    initAudio();
    playClickSound(550, 0.05);
    const modal = document.getElementById('specs-modal');
    if (show) {
      modal.classList.add('active');
    } else {
      modal.classList.remove('active');
    }
  };

  window.openOrderModal = function () {
    initAudio();
    playClickSound(950, 0.1);
    alert('Thank you for your interest in MAISON VÉRA — Le Sac Baguette.\n\nPre-order reservations are now open for the limited edition Purple Collection ($2,450).');
  };

  // --- Initialization ---
  async function init() {
    await loadFrames();
    resizeCanvas();
    animate();
  }

  window.addEventListener('DOMContentLoaded', init);

})();
