const MUSIC_SAVE_KEY = 'growdy_music_state';
const MUSIC_SESSION_KEY = 'growdy_music_playback';
const TRACKS = Array.from({ length: 15 }, (_, i) => ({
  src: `assets/goofy${i + 1}.mp3`,
  label: `Goofy ${i + 1}`,
}));

const DRAG_THRESHOLD = 8;
const AUTOPLAY_UNLOCK_EVENTS = ['pointerdown', 'click', 'touchstart', 'keydown'];

/** @typedef {{ x: number, y: number, trackIndex: number, pausedByUser?: boolean }} MusicSave */
/** @typedef {{ trackIndex: number, currentTime: number, playing: boolean, pausedByUser?: boolean, savedAt: number }} MusicSession */

/** @returns {MusicSave|null} */
function loadMusicSave() {
  try {
    const raw = localStorage.getItem(MUSIC_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {MusicSave} data */
function saveMusicSave(data) {
  localStorage.setItem(MUSIC_SAVE_KEY, JSON.stringify(data));
}

/** @returns {MusicSession|null} */
function loadMusicSession() {
  try {
    const raw = sessionStorage.getItem(MUSIC_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {MusicSession} data */
function saveMusicSession(data) {
  sessionStorage.setItem(MUSIC_SESSION_KEY, JSON.stringify(data));
}

/** @param {MusicSession|null} session */
function getRestoreTime(session) {
  if (!session || !Number.isFinite(session.currentTime)) return 0;
  if (session.pausedByUser) return session.currentTime;
  const elapsed = (Date.now() - (session.savedAt ?? Date.now())) / 1000;
  return session.currentTime + Math.max(0, elapsed);
}

/**
 * @param {Object} els
 * @param {HTMLElement} els.root
 * @param {HTMLButtonElement} els.toggle
 * @param {HTMLElement} els.panel
 * @param {HTMLElement} els.trackLabel
 * @param {HTMLButtonElement} els.playBtn
 * @param {HTMLButtonElement} els.pauseBtn
 * @param {HTMLButtonElement} els.nextBtn
 */
export function initMusicPlayer(els) {
  if (!els.root || !els.toggle) return;

  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = 0.55;

  const session = loadMusicSession();
  const saved = loadMusicSave();

  let trackIndex = session?.trackIndex ?? saved?.trackIndex ?? 0;
  trackIndex = Math.min(Math.max(0, trackIndex), TRACKS.length - 1);

  let panelOpen = false;
  let pausedByUser = session?.pausedByUser ?? saved?.pausedByUser ?? false;
  let posX = saved?.x ?? 20;
  let posY = saved?.y ?? window.innerHeight - 88;
  let pendingAutoplay = false;
  // Only explicit user pause blocks autoplay — ignore stale session.playing from page unload
  let resumePlaying = !pausedByUser;
  let resumeTime = getRestoreTime(session);

  let dragging = false;
  let dragMoved = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let pointerStartX = 0;
  let pointerStartY = 0;
  /** @type {number|null} */
  let activePointerId = null;
  let lastSessionPersist = 0;

  function persistSessionThrottled(force = false) {
    const now = Date.now();
    if (!force && now - lastSessionPersist < 800) return;
    lastSessionPersist = now;
    persistSession();
  }

  function clampPosition() {
    const rect = els.root.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    posX = Math.min(Math.max(8, posX), Math.max(8, maxX));
    posY = Math.min(Math.max(8, posY), Math.max(8, maxY));
  }

  function applyPosition() {
    clampPosition();
    els.root.style.left = `${posX}px`;
    els.root.style.top = `${posY}px`;
  }

  function persist() {
    saveMusicSave({
      x: posX,
      y: posY,
      trackIndex,
      pausedByUser,
    });
  }

  function persistSession() {
    const playing = !audio.paused && !audio.ended && !pausedByUser;
    saveMusicSession({
      trackIndex,
      currentTime: audio.currentTime || 0,
      playing,
      pausedByUser,
      savedAt: Date.now(),
    });
  }

  function syncPlayingUi() {
    const playing = !audio.paused && !audio.ended;
    els.root.classList.toggle('is-playing', playing);
    els.root.classList.toggle('needs-gesture', pendingAutoplay && !playing);
  }

  function updateTrackLabel() {
    if (els.trackLabel) els.trackLabel.textContent = TRACKS[trackIndex].label;
  }

  function applySeek(time, onPastEnd) {
    if (!Number.isFinite(time) || time <= 0) return;
    const apply = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      if (time >= audio.duration - 0.25) {
        onPastEnd?.(Math.max(0, time - audio.duration));
        return;
      }
      audio.currentTime = Math.min(Math.max(0, time), Math.max(0, audio.duration - 0.05));
    };
    if (audio.readyState >= 1) apply();
    else {
      audio.addEventListener('loadedmetadata', apply, { once: true });
      audio.addEventListener('canplay', apply, { once: true });
    }
  }

  function loadTrack(index, autoplay = false, seekTo = null, depth = 0) {
    if (depth > TRACKS.length) return;

    trackIndex = (index + TRACKS.length) % TRACKS.length;
    const track = TRACKS[trackIndex];
    audio.src = track.src;
    audio.load();
    updateTrackLabel();

    const seek = seekTo ?? null;
    if (seek != null && seek > 0) {
      applySeek(seek, (overflow) => {
        loadTrack(trackIndex + 1, autoplay, overflow > 0 ? overflow : 0, depth + 1);
      });
    }

    if (autoplay) {
      const start = () => {
        audio.play().then(() => {
          pendingAutoplay = false;
          teardownAutoplayUnlock();
          syncPlayingUi();
          persistSession();
        }).catch(() => {
          pendingAutoplay = true;
          syncPlayingUi();
        });
      };
      if (audio.readyState >= 2) start();
      else audio.addEventListener('canplay', start, { once: true });
    }

    persist();
    syncPlayingUi();
  }

  function play() {
    if (!audio.src) loadTrack(trackIndex, false);
    pausedByUser = false;
    pendingAutoplay = false;
    resumePlaying = true;

    const start = () => {
      audio.play().then(() => {
        teardownAutoplayUnlock();
        syncPlayingUi();
        persist();
        persistSession();
      }).catch(() => {
        pendingAutoplay = true;
        syncPlayingUi();
      });
    };

    if (audio.readyState >= 2) start();
    else audio.addEventListener('canplay', start, { once: true });
  }

  function pause() {
    audio.pause();
    pausedByUser = true;
    pendingAutoplay = false;
    resumePlaying = false;
    teardownAutoplayUnlock();
    syncPlayingUi();
    persist();
    persistSession();
  }

  function next() {
    loadTrack(trackIndex + 1, true, 0);
    persistSession();
  }

  function tryAutoplay() {
    if (pausedByUser) return;
    play();
  }

  function unlockAutoplay() {
    if (pausedByUser) return;
    if (!audio.paused && !audio.ended) return;
    tryAutoplay();
  }

  /** @type {((e: Event) => void)|null} */
  let resumeGestureHandler = null;

  function setupAutoplayUnlock() {
    teardownAutoplayUnlock();
    resumeGestureHandler = () => {
      if (pausedByUser) {
        teardownAutoplayUnlock();
        return;
      }
      unlockAutoplay();
      if (!audio.paused && !audio.ended) teardownAutoplayUnlock();
    };
    for (const ev of AUTOPLAY_UNLOCK_EVENTS) {
      document.addEventListener(ev, resumeGestureHandler, true);
    }
  }

  function teardownAutoplayUnlock() {
    if (!resumeGestureHandler) return;
    for (const ev of AUTOPLAY_UNLOCK_EVENTS) {
      document.removeEventListener(ev, resumeGestureHandler, true);
    }
    resumeGestureHandler = null;
  }

  function setPanelOpen(open) {
    panelOpen = open;
    if (els.panel) els.panel.hidden = !open;
    els.root.classList.toggle('is-open', open);
    els.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  audio.addEventListener('ended', () => next());
  audio.addEventListener('play', () => {
    syncPlayingUi();
    persistSessionThrottled(true);
  });
  audio.addEventListener('pause', () => {
    syncPlayingUi();
    persistSessionThrottled(true);
  });
  audio.addEventListener('timeupdate', () => {
    if (audio.paused) return;
    persistSessionThrottled();
  });

  els.playBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    play();
  });

  els.pauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    pause();
  });

  els.nextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    next();
  });

  els.panel?.addEventListener('pointerdown', (e) => e.stopPropagation());

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== activePointerId) return;

    const dx = Math.abs(e.clientX - pointerStartX);
    const dy = Math.abs(e.clientY - pointerStartY);
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) dragMoved = true;

    if (!dragMoved) return;

    posX = e.clientX - dragOffsetX;
    posY = e.clientY - dragOffsetY;
    applyPosition();
  }

  function onPointerUp(e) {
    if (!dragging || e.pointerId !== activePointerId) return;

    const wasDrag = dragMoved;
    dragging = false;
    activePointerId = null;
    dragMoved = false;
    els.root.classList.remove('is-dragging');
    els.toggle.releasePointerCapture(e.pointerId);

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    if (!wasDrag) {
      setPanelOpen(!panelOpen);
      unlockAutoplay();
    } else persist();
  }

  els.toggle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;

    dragging = true;
    dragMoved = false;
    activePointerId = e.pointerId;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    dragOffsetX = e.clientX - posX;
    dragOffsetY = e.clientY - posY;

    els.root.classList.add('is-dragging');
    els.toggle.setPointerCapture(e.pointerId);

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    e.preventDefault();
  });

  els.toggle.addEventListener('click', (e) => {
    e.preventDefault();
  });

  window.addEventListener('resize', applyPosition);

  window.addEventListener('pagehide', () => persistSessionThrottled(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistSessionThrottled(true);
  });

  document.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', () => persistSessionThrottled(true));
  });

  setupAutoplayUnlock();

  loadTrack(trackIndex, resumePlaying, resumeTime);
  applyPosition();
  setPanelOpen(false);

  if (resumePlaying && audio.paused) {
    pendingAutoplay = true;
    syncPlayingUi();
  }
}

/** Mount player from standard DOM ids (all pages). */
export function initMusicPlayerFromDom() {
  const root = document.getElementById('musicPlayer');
  if (!root) return;

  initMusicPlayer({
    root,
    toggle: /** @type {HTMLButtonElement|null} */ (document.getElementById('musicToggle')),
    panel: document.getElementById('musicPanel'),
    trackLabel: document.getElementById('musicTrack'),
    playBtn: /** @type {HTMLButtonElement|null} */ (document.getElementById('musicPlay')),
    pauseBtn: /** @type {HTMLButtonElement|null} */ (document.getElementById('musicPause')),
    nextBtn: /** @type {HTMLButtonElement|null} */ (document.getElementById('musicNext')),
  });
}
