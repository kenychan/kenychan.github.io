import {
  parseGIF,
  decompressFrames
} from 'https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/+esm';

const gifFrameCache = {};
const staticImageCache = {};

const DEFAULT_FLOOR_SRC =
  'texture/1. 背景/2. 地板/00-迷你屋原始图.png';

async function loadGifFrames(src) {

  if (gifFrameCache[src]) {
    return gifFrameCache[src];
  }

  const res = await fetch(src);

  const buffer =
    await res.arrayBuffer();

  const gif =
    parseGIF(buffer);

  const rawFrames =
    decompressFrames(gif, true);

  const gifWidth =
    gif.lsd.width;

  const gifHeight =
    gif.lsd.height;

  // master compositing canvas
  const masterCanvas =
    document.createElement('canvas');

  masterCanvas.width =
    gifWidth;

  masterCanvas.height =
    gifHeight;

  const masterCtx =
    masterCanvas.getContext('2d', {
      willReadFrequently: true
    });

  const finalFrames = [];

  rawFrames.forEach((frame, i) => {

    // ===== ADDED: dispose the PREVIOUS frame's region if it asked us to =====
    // In the GIF spec, disposalType is declared on a frame and applies
    // AFTER that frame has been shown. So before drawing the current
    // patch, we check what the previous frame's disposalType wanted.
    //   type 0 / 1 = leave canvas as-is (original behavior, do nothing)
    //   type 2     = restore that region to background = clearRect it
    //   type 3     = restore-to-previous; rare, deliberately skipped
    //                because handling it caused regressions on this
    //                asset set. Falls through to no-op (same as type 1).
    if (i > 0) {

      const prev = rawFrames[i - 1];

      if (prev.disposalType === 2) {

        masterCtx.clearRect(
          prev.dims.left,
          prev.dims.top,
          prev.dims.width,
          prev.dims.height
        );

      }

    }
    // ===== END ADDED =====

    // patch canvas
    const patchCanvas =
      document.createElement('canvas');

    patchCanvas.width =
      frame.dims.width;

    patchCanvas.height =
      frame.dims.height;

    const patchCtx =
      patchCanvas.getContext('2d');

    const imgData =
      patchCtx.createImageData(
        frame.dims.width,
        frame.dims.height
      );

    imgData.data.set(frame.patch);

    patchCtx.putImageData(
      imgData,
      0,
      0
    );

    // composite patch into master
    masterCtx.drawImage(
      patchCanvas,
      frame.dims.left,
      frame.dims.top
    );

    // snapshot full frame
    const snapshot =
      document.createElement('canvas');

    snapshot.width =
      gifWidth;

    snapshot.height =
      gifHeight;

    const snapCtx =
      snapshot.getContext('2d');

    snapCtx.drawImage(
      masterCanvas,
      0,
      0
    );

    finalFrames.push(snapshot);

  });

  // loop from start to fill up to 9 frames
  const actualCount = finalFrames.length;

  while (finalFrames.length < 9) {

    finalFrames.push(
      finalFrames[
        finalFrames.length % actualCount
      ]
    );

  }

  gifFrameCache[src] =
    finalFrames.slice(0, 9);

  return gifFrameCache[src];

}

async function loadStaticImage(src) {

  if (staticImageCache[src]) {
    return staticImageCache[src];
  }

  return new Promise(resolve => {

    const img = new Image();

    img.crossOrigin = 'anonymous';

    img.onload = () => {

      staticImageCache[src] = img;

      resolve(img);

    };

    img.src = src;

  });

}

async function exportSceneGif() {

  const loading =
    document.createElement('div');

  loading.style.position = 'fixed';
  loading.style.left = '0';
  loading.style.top = '0';
  loading.style.width = '100%';
  loading.style.height = '100%';

  loading.style.background =
    'rgba(0,0,0,0.7)';

  loading.style.display = 'flex';

  loading.style.alignItems = 'center';

  loading.style.justifyContent = 'center';

  loading.style.zIndex = '999999';

  loading.style.color = '#fff';

  loading.style.fontSize = '20px';

  loading.innerHTML =
    'Generating GIF...';

  document.body.appendChild(loading);

  const renderCanvas =
    document.createElement('canvas');

  renderCanvas.width = CW;
  renderCanvas.height = CH;

  const ctx =
    renderCanvas.getContext('2d', {
      willReadFrequently: true
    });

  // preload default floor
  const defaultFloor =
    await loadStaticImage(
      DEFAULT_FLOOR_SRC
    );

  const gif = new GIF({
    workers: 2,
    quality: 1,
    repeat: 0,
    width: CW,
    height: CH,
    workerScript: 'gif.worker.js',
    transparent: null
  });

  const sorted =
    [...roomItems]
      .sort((a,b)=>a.z-b.z);

  const assetMap = {};

  // preload all assets
  for (const item of sorted) {

    if (assetMap[item.src]) {
      continue;
    }

    if (
      item.src
        .toLowerCase()
        .endsWith('.gif')
    ) {

      assetMap[item.src] =
        await loadGifFrames(item.src);

    } else {

      const img =
        await loadStaticImage(item.src);

      assetMap[item.src] = img;

    }

  }

  // compose 9 frames
  for (
    let frameIndex = 0;
    frameIndex < 9;
    frameIndex++
  ) {

    // fill opaque white so no transparency exists
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);

    // draw default floor bottom layer
    ctx.drawImage(
      defaultFloor,
      0,
      0,
      CW,
      CH
    );

    for (const item of sorted) {

      const asset =
        assetMap[item.src];

      // static image or gif frames array
      const img = Array.isArray(asset)
        ? asset[frameIndex % asset.length]
        : asset;

      if (!img) continue;

      if (item.mirrored) {

        ctx.save();

        ctx.scale(-1, 1);

        ctx.drawImage(
          img,
          -item.x - item.w,
          item.y,
          item.w,
          item.h
        );

        ctx.restore();

      } else {

        ctx.drawImage(
          img,
          item.x,
          item.y,
          item.w,
          item.h
        );

      }

    }

    // *** KEY FIX: pass the context (ctx), NOT the canvas element.
    // When you pass a canvas element, gif.js uses getImageData()
    // which draws onto a SHARED internal canvas that doesn't get
    // cleared between frames — causing frame stacking.
    // When you pass the context, gif.js uses getContextData()
    // which just calls ctx.getImageData() directly — clean copy,
    // no shared state, no stacking. ***
    gif.addFrame(ctx, {
      copy: true,
      delay: 200
    });

  }

  gif.on('finished', blob => {

    loading.remove();

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;

    a.download =
      'minihouse.gif';

    document.body.appendChild(a);

    a.click();

    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  });

  gif.render();

}

window.exportSceneGif =
  exportSceneGif;
