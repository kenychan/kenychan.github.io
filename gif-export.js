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

  rawFrames.forEach(frame => {

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

  // ensure minimum 8 frames
  while (finalFrames.length < 8) {

    finalFrames.push(
      finalFrames[
        finalFrames.length - 1
      ]
    );

  }

  gifFrameCache[src] =
    finalFrames.slice(0, 8);

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

      assetMap[item.src] = [
        img,
        img,
        img,
        img,
        img
      ];

    }

  }

  // compose 8 frames
  for (
    let frameIndex = 0;
    frameIndex < 8;
    frameIndex++
  ) {

    ctx.clearRect(0, 0, CW, CH);

    // draw default floor bottom layer
    ctx.drawImage(
      defaultFloor,
      0,
      0,
      CW,
      CH
    );

    for (const item of sorted) {

      const frames =
        assetMap[item.src];

      const img =
        frames[frameIndex];

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

    gif.addFrame(renderCanvas, {
      copy: true,
      delay: 190
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