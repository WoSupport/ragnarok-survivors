// Audio Manager for Authentic Ragnarok Online .wav SFX & SoundTeMP .mp3 BGM
// Safe in sandboxed iframes (no uncaught localStorage access) and lazy-loads audio
// on demand so zero HTTP sockets are blocked during initial asset boot.

import { resolveAssetUrl } from './assets.js?v=2';

function safeStorageGet(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function safeStorageSet(key, val) {
  try {
    window.localStorage.setItem(key, val);
  } catch (_) {}
}

export class AudioManager {
  constructor() {
    this.enabled = safeStorageGet('ro_surv_audio', '1') !== '0';
    this.bgmAudio = null;
    this.currentBgmSrc = '';
    this.sfxPool = new Map();
    this.lastPlayed = new Map();
    this.manifest = null;
    this.unlocked = false;

    const unlock = () => {
      this.unlocked = true;
      if (this.enabled && this.bgmAudio && this.bgmAudio.paused) {
        this.bgmAudio.play().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  init(manifest) {
    this.manifest = manifest;
    // Do NOT pre-instantiate 75 preload="auto" Audio elements here — that saturates
    // browser per-origin HTTP/1.1 connection limits (6 sockets) and blocks image boot!
  }

  getOrCreatePool(key) {
    if (this.sfxPool.has(key)) return this.sfxPool.get(key);
    const rawSrc = this.manifest?.sfx?.[key];
    if (!rawSrc) return null;
    const src = resolveAssetUrl(rawSrc);
    const pool = [];
    for (let i = 0; i < 3; i++) {
      const a = new Audio();
      a.preload = 'none';
      a.src = src;
      a.volume = 0.34;
      pool.push(a);
    }
    const entry = { pool, idx: 0 };
    this.sfxPool.set(key, entry);
    return entry;
  }

  toggle() {
    this.enabled = !this.enabled;
    safeStorageSet('ro_surv_audio', this.enabled ? '1' : '0');
    if (!this.enabled) {
      if (this.bgmAudio) this.bgmAudio.pause();
    } else if (this.currentBgmSrc) {
      this.playBgmBySrc(this.currentBgmSrc);
    }
    return this.enabled;
  }

  playBgm(trackKey) {
    const src = this.manifest?.bgm?.[trackKey];
    if (!src) return;
    this.playBgmBySrc(src);
  }

  playBgmBySrc(rawSrc) {
    const src = resolveAssetUrl(rawSrc);
    this.currentBgmSrc = src;
    if (!this.enabled) return;
    if (this.bgmAudio && this.bgmAudio.dataset.src === src) {
      if (this.bgmAudio.paused && this.unlocked) {
        this.bgmAudio.play().catch(() => {});
      }
      return;
    }
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
    const audio = new Audio();
    audio.preload = 'none';
    audio.src = src;
    audio.dataset.src = src;
    audio.loop = true;
    audio.volume = 0.28;
    this.bgmAudio = audio;
    if (this.unlocked) {
      audio.play().catch(() => {});
    }
  }

  playSfx(key, volume = 0.34, minIntervalMs = 95) {
    if (!this.enabled || !this.unlocked) return;
    const now = performance.now();
    const prev = this.lastPlayed.get(key) || 0;
    if (now - prev < minIntervalMs) return;
    this.lastPlayed.set(key, now);

    const entry = this.getOrCreatePool(key);
    if (!entry) return;

    const snd = entry.pool[entry.idx];
    entry.idx = (entry.idx + 1) % entry.pool.length;
    try {
      snd.currentTime = 0;
      snd.volume = Math.max(0.05, Math.min(0.85, volume));
      snd.play().catch(() => {});
    } catch (_) {}
  }
}
