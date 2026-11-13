// Sprite Atlas Loader, Seamless RO Ground Tile Baker & Anchor-Aligned Frame Renderer
// Uses import.meta.url resolution + per-image timeouts so subpath proxies & slow sockets never hang boot.

const PUBLIC_ROOT = new URL('../', import.meta.url);

export function resolveAssetUrl(relPath) {
  if (!relPath) return '';
  if (relPath.startsWith('http://') || relPath.startsWith('https://') || relPath.startsWith('data:')) {
    return relPath;
  }
  const clean = relPath.replace(/^\.?\//, '');
  return new URL(clean, PUBLIC_ROOT).href;
}

export class AssetStore {
  constructor() {
    this.manifest = null;
    this.images = new Map();
    this.loadingPromises = new Map();
    this.groundPatterns = new Map();
  }

  async loadManifest() {
    const res = await fetch(resolveAssetUrl('assets/manifest.json'));
    if (!res.ok) {
      throw new Error(`Manifest HTTP ${res.status}`);
    }
    this.manifest = await res.json();
    return this.manifest;
  }

  loadImage(src, timeoutMs = 4500) {
    if (!src) return Promise.resolve(null);
    if (this.images.has(src)) return Promise.resolve(this.images.get(src));
    if (this.loadingPromises.has(src)) return this.loadingPromises.get(src);

    const p = new Promise((resolve) => {
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!val) this.loadingPromises.delete(src);
        resolve(val);
      };
      const timer = setTimeout(() => done(null), timeoutMs);
      const img = new Image();
      img.onload = () => {
        this.images.set(src, img);
        done(img);
      };
      img.onerror = () => done(null);
      img.src = resolveAssetUrl(src);
    });
    this.loadingPromises.set(src, p);
    return p;
  }

  getImage(src) {
    if (!src) return null;
    if (this.images.has(src)) return this.images.get(src);
    this.loadImage(src);
    return null;
  }

  async preloadHero(classId, gender) {
    const poses = this.manifest?.heroes?.[classId]?.[gender];
    if (!poses) return;
    await Promise.all(Object.values(poses).map((m) => this.loadImage(m.src)));
  }

  async preloadZoneMenuPreview(zoneDef, onProgress) {
    const urls = new Set();
    const mapData = this.manifest?.maps?.[zoneDef.id];
    if (mapData) {
      (mapData.textures || []).forEach((t) => urls.add(t));
      if (mapData.minimap) urls.add(mapData.minimap);
    }
    const list = [...urls];
    let done = 0;
    await Promise.all(
      list.map(async (u) => {
        await this.loadImage(u);
        done++;
        if (onProgress) onProgress(done / Math.max(1, list.length));
      })
    );
    this.bakeGroundCanvas(zoneDef.id);
    // Warm zone monsters in background without blocking the menu!
    this.preloadZone(zoneDef).catch(() => {});
  }

  async preloadZone(zoneDef, onProgress) {
    const urls = new Set();
    const mapData = this.manifest?.maps?.[zoneDef.id];
    if (mapData) {
      (mapData.textures || []).forEach((t) => urls.add(t));
      if (mapData.minimap) urls.add(mapData.minimap);
    }
    const allMobs = [...zoneDef.mobs, ...zoneDef.bosses.map((b) => b.mobId)];
    for (const mid of allMobs) {
      const mobPoses = this.manifest?.mobs?.[String(mid)];
      if (mobPoses) {
        Object.values(mobPoses).forEach((m) => urls.add(m.src));
      }
    }
    [501, 503, 504, 603, 607, 909, 984, 985, 4001, 7444, 7539].forEach((iid) => {
      urls.add(`assets/icons/item/${iid}.png`);
    });
    if (this.manifest?.ui?.grid) urls.add(this.manifest.ui.grid);

    const list = [...urls];
    let done = 0;
    await Promise.all(
      list.map(async (u) => {
        await this.loadImage(u);
        done++;
        if (onProgress) onProgress(done / Math.max(1, list.length));
      })
    );
    this.bakeGroundCanvas(zoneDef.id);
  }

  bakeGroundCanvas(zoneId) {
    if (this.groundPatterns.has(zoneId)) {
      const cached = this.groundPatterns.get(zoneId);
      if (cached._hasTex) return cached;
    }
    const mapData = this.manifest?.maps?.[zoneId];
    const texList = (mapData?.textures || [])
      .map((src) => this.images.get(src))
      .filter(Boolean);

    const tileSize = 128;
    const gridN = 8;
    const canvas = document.createElement('canvas');
    canvas.width = tileSize * gridN;
    canvas.height = tileSize * gridN;
    canvas._hasTex = texList.length > 0;
    const ctx = canvas.getContext('2d');

    if (texList.length === 0) {
      ctx.fillStyle = '#2a3829';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const baseTex = texList[0];
      for (let gy = 0; gy < gridN; gy++) {
        for (let gx = 0; gx < gridN; gx++) {
          const x = gx * tileSize;
          const y = gy * tileSize;
          ctx.drawImage(baseTex, x, y, tileSize, tileSize);

          const hash = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
          if (texList.length > 1 && hash % 5 === 0) {
            const alt = texList[1 + (hash % (texList.length - 1))];
            ctx.save();
            ctx.globalAlpha = 0.42;
            ctx.drawImage(alt, x, y, tileSize, tileSize);
            ctx.restore();
          }

          ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, tileSize / 2, tileSize / 2);
          ctx.strokeRect(x + tileSize / 2 + 0.5, y + 0.5, tileSize / 2, tileSize / 2);
          ctx.strokeRect(x + 0.5, y + tileSize / 2 + 0.5, tileSize / 2, tileSize / 2);
          ctx.strokeRect(x + tileSize / 2 + 0.5, y + tileSize / 2 + 0.5, tileSize / 2, tileSize / 2);
        }
      }
    }

    this.groundPatterns.set(zoneId, canvas);
    return canvas;
  }

  resolveFrame(meta, animMs, loop = true) {
    if (!meta || meta.frames <= 1) return 0;
    const durs = meta.durations || [];
    let total = 0;
    for (let i = 0; i < meta.frames; i++) total += durs[i] || 100;
    if (total <= 0) return 0;

    let t = loop ? ((animMs % total) + total) % total : Math.min(animMs, total - 1);
    let acc = 0;
    for (let i = 0; i < meta.frames; i++) {
      acc += durs[i] || 100;
      if (t < acc) return i;
    }
    return meta.frames - 1;
  }

  drawSprite(ctx, meta, animMs, x, y, opts = {}) {
    if (!meta) return false;
    const img = this.getImage(meta.src);
    if (!img) return false;

    const {
      flipX = false,
      scale = 1,
      alpha = 1,
      loop = true,
      tint = null,
      zHop = 0
    } = opts;

    const frameIdx = this.resolveFrame(meta, animMs, loop);
    const sx = frameIdx * meta.fw;
    const dw = meta.fw * scale;
    const dh = meta.fh * scale;
    const ax = meta.ax * scale;
    const ay = meta.ay * scale;

    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(x, y - zHop);
    if (flipX) ctx.scale(-1, 1);

    ctx.drawImage(img, sx, 0, meta.fw, meta.fh, -ax, -ay, dw, dh);

    if (tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = tint;
      ctx.fillRect(-ax, -ay, dw, dh);
    }
    ctx.restore();
    return true;
  }
}
