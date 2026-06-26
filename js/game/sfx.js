const MOAN_SRC = 'assets/moan.mp3';
const FART_SRC = 'assets/fart.mp3';
const HOORAY_SRC = 'assets/hooray.mp3';
const MOAN_VOLUME = 0.65;
const FART_VOLUME = 0.55;
const HOORAY_VOLUME = 0.7;
const FART_POOL_SIZE = 14;

/** @type {HTMLAudioElement|null} */
let moanAudio = null;
/** @type {HTMLAudioElement|null} */
let hoorayAudio = null;

/** @type {AudioContext|null} */
let audioCtx = null;
/** @type {AudioBuffer|null} */
let fartBuffer = null;
/** @type {Promise<AudioBuffer|null>|null} */
let fartLoadPromise = null;

/** @type {HTMLAudioElement[]} */
const fartPool = [];
let fartPoolIdx = 0;

function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function loadFartBuffer() {
  if (fartLoadPromise) return fartLoadPromise;

  fartLoadPromise = (async () => {
    const ctx = getAudioContext();
    if (!ctx) return null;
    const res = await fetch(FART_SRC);
    if (!res.ok) return null;
    fartBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
    return fartBuffer;
  })().catch(() => null);

  return fartLoadPromise;
}

function initFartPool() {
  if (fartPool.length) return;
  for (let i = 0; i < FART_POOL_SIZE; i++) {
    const audio = new Audio(FART_SRC);
    audio.preload = 'auto';
    audio.volume = FART_VOLUME;
    fartPool.push(audio);
  }
}

function playFartFromPool() {
  initFartPool();
  const audio = fartPool[fartPoolIdx % FART_POOL_SIZE];
  fartPoolIdx += 1;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function playFartFromBuffer() {
  const ctx = getAudioContext();
  if (!ctx || !fartBuffer) return false;

  if (ctx.state === 'suspended') ctx.resume();

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = fartBuffer;
  gain.gain.value = FART_VOLUME;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
  return true;
}

function getMoanAudio() {
  if (!moanAudio) {
    moanAudio = new Audio(MOAN_SRC);
    moanAudio.preload = 'auto';
    moanAudio.volume = MOAN_VOLUME;
  }
  return moanAudio;
}

function getHoorayAudio() {
  if (!hoorayAudio) {
    hoorayAudio = new Audio(HOORAY_SRC);
    hoorayAudio.preload = 'auto';
    hoorayAudio.volume = HOORAY_VOLUME;
  }
  return hoorayAudio;
}

/** Warm decode + pool — call on game boot. */
export function preloadSfx() {
  initFartPool();
  loadFartBuffer();
  getHoorayAudio();
  getMoanAudio();
}

/** Resume audio context after first user gesture. */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') ctx.resume();
  loadFartBuffer();
}

/** Tap-to-grow — instant when buffer ready, pool fallback otherwise. */
export function playFart() {
  try {
    if (fartBuffer && playFartFromBuffer()) return;
    playFartFromPool();
    loadFartBuffer();
  } catch {
    /* ignore */
  }
}

/** Purchase / gacha moan. */
export function playMoan() {
  try {
    unlockAudio();
    const audio = getMoanAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Phase up celebration. */
export function playHooray() {
  try {
    unlockAudio();
    const audio = getHoorayAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

preloadSfx();
