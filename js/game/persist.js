import { SAVE_KEY } from './config.js';
import { createInitialState, loadState, saveState } from './engine.js';
import {
  deleteCloudSave,
  fetchCloudSave,
  isCloudSaveEnabled,
  pushCloudSave,
} from './cloud-save.js';

/** @typedef {'idle'|'syncing'|'synced'|'local'|'error'} CloudStatus */

/** @type {CloudStatus} */
let cloudStatus = 'idle';
/** @type {ReturnType<typeof setTimeout>|null} */
let cloudSaveTimer = null;
/** @type {Array<(status: CloudStatus) => void>} */
const statusListeners = [];

/** @returns {CloudStatus} */
export function getCloudSaveStatus() {
  return cloudStatus;
}

/** @param {(status: CloudStatus) => void} listener */
export function onCloudSaveStatus(listener) {
  statusListeners.push(listener);
}

/** @param {CloudStatus} status */
function setCloudStatus(status) {
  cloudStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

export function isCloudConfigured() {
  return isCloudSaveEnabled();
}

/**
 * Load save — cloud wins if newer than local cache.
 * @param {string} walletAddress
 */
export async function loadGameState(walletAddress) {
  const local = loadState();

  if (!isCloudSaveEnabled()) {
    setCloudStatus('local');
    return local;
  }

  try {
    const cloud = await fetchCloudSave(walletAddress);
    if (!cloud) {
      setCloudStatus('synced');
      return local;
    }

    const localTs = local.lastSavedAt ?? 0;
    const cloudTs = cloud.lastSavedAt ?? 0;

    if (cloudTs > localTs) {
      saveState(cloud);
      setCloudStatus('synced');
      return cloud;
    }

    setCloudStatus('synced');
    return local;
  } catch {
    setCloudStatus('error');
    return local;
  }
}

/**
 * Save to localStorage immediately + debounced cloud upsert.
 * @param {string} walletAddress
 * @param {import('./engine.js').GameState} state
 */
export function persistGameState(walletAddress, state) {
  saveState(state);

  if (!isCloudSaveEnabled()) {
    setCloudStatus('local');
    return;
  }

  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  setCloudStatus('syncing');

  cloudSaveTimer = setTimeout(async () => {
    try {
      await pushCloudSave(walletAddress, state);
      setCloudStatus('synced');
    } catch {
      setCloudStatus('error');
    }
  }, 1200);
}

/**
 * Wipe progress locally and in cloud.
 * @param {string} walletAddress
 */
export async function resetGameState(walletAddress) {
  localStorage.removeItem(SAVE_KEY);
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);

  if (isCloudSaveEnabled()) {
    try {
      await deleteCloudSave(walletAddress);
      setCloudStatus('synced');
    } catch {
      setCloudStatus('error');
    }
  } else {
    setCloudStatus('local');
  }

  return createInitialState();
}

/** Flush pending cloud save (e.g. beforeunload). */
export async function flushCloudSave(walletAddress, state) {
  saveState(state);
  if (!isCloudSaveEnabled()) return;

  if (cloudSaveTimer) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }

  try {
    await pushCloudSave(walletAddress, state);
    setCloudStatus('synced');
  } catch {
    setCloudStatus('error');
  }
}
