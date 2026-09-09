import omggifPkg from 'omggif';

const { GifReader } = omggifPkg.default || omggifPkg;

/**
 * Decodes an existing GIF file buffer into composite frames with delays
 */
export function decodeGif(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const reader = new GifReader(bytes);

  const width = reader.width;
  const height = reader.height;
  const numFrames = reader.numFrames();

  // Offscreen accumulator canvas for handling frame disposal
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  const frames = [];
  let prevImageData = null;

  for (let i = 0; i < numFrames; i++) {
    const frameInfo = reader.frameInfo(i);
    // frameInfo has { x, y, width, height, disposal, delay }
    // delay is in 10ms units (e.g. 10 = 100ms)
    const delay = Math.max(20, (frameInfo.delay || 10) * 10);

    const frameRgba = new Uint8Array(frameInfo.width * frameInfo.height * 4);
    reader.decodeAndBlitFrameRGBA(i, frameRgba);

    const frameImageData = tempCtx.createImageData(frameInfo.width, frameInfo.height);
    frameImageData.data.set(frameRgba);

    tempCanvas.width = frameInfo.width;
    tempCanvas.height = frameInfo.height;
    tempCtx.putImageData(frameImageData, 0, 0);

    // Save previous state if disposal is 3 (restore to previous)
    if (frameInfo.disposal === 3) {
      prevImageData = ctx.getImageData(0, 0, width, height);
    }

    // Composite current frame onto canvas
    ctx.drawImage(tempCanvas, frameInfo.x, frameInfo.y);

    // Grab full composed frame
    const composed = ctx.getImageData(0, 0, width, height);
    frames.push({
      data: new Uint8Array(composed.data),
      delay,
      width,
      height
    });

    // Handle disposal methods
    if (frameInfo.disposal === 2) {
      // Restore to background
      ctx.clearRect(frameInfo.x, frameInfo.y, frameInfo.width, frameInfo.height);
    } else if (frameInfo.disposal === 3 && prevImageData) {
      // Restore to previous
      ctx.putImageData(prevImageData, 0, 0);
    }
  }

  return {
    width,
    height,
    frames,
    duration: frames.reduce((acc, f) => acc + f.delay, 0) / 1000
  };
}

/**
 * Optimizes / compresses decoded frames according to target parameters
 */
export function processGifFramesForCompression(decoded, options = {}) {
  const {
    scale = 0.75, // downscale ratio (0.2 - 1.0)
    targetWidth = null,
    targetHeight = null,
    frameSkip = 1, // 1 = keep all, 2 = keep every 2nd frame, 3 = keep every 3rd
    onProgress = () => {}
  } = options;

  let { width, height, frames } = decoded;

  // Determine target dimensions
  let outW = width;
  let outH = height;

  if (targetWidth && targetHeight) {
    outW = targetWidth;
    outH = targetHeight;
  } else if (scale < 1.0) {
    outW = Math.max(32, Math.round(width * scale));
    outH = Math.max(32, Math.round(height * scale));
    // Ensure even dimensions
    if (outW % 2 !== 0) outW -= 1;
    if (outH % 2 !== 0) outH -= 1;
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });

  const resultFrames = [];
  const total = frames.length;

  for (let i = 0; i < total; i += frameSkip) {
    const frame = frames[i];
    
    // Accumulate delay of skipped frames so playback speed remains natural
    let combinedDelay = frame.delay;
    for (let s = 1; s < frameSkip && (i + s) < total; s++) {
      combinedDelay += frames[i + s].delay;
    }

    if (outW === width && outH === height) {
      // No scaling needed
      resultFrames.push({
        data: frame.data,
        delay: combinedDelay
      });
    } else {
      // Scale down frame
      const imgData = sourceCtx.createImageData(width, height);
      imgData.data.set(frame.data);
      sourceCtx.putImageData(imgData, 0, 0);

      ctx.clearRect(0, 0, outW, outH);
      ctx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, outW, outH);

      const scaledImgData = ctx.getImageData(0, 0, outW, outH);
      resultFrames.push({
        data: new Uint8Array(scaledImgData.data),
        delay: combinedDelay
      });
    }

    onProgress(Math.round(((i + 1) / total) * 100));
  }

  return {
    frames: resultFrames,
    width: outW,
    height: outH
  };
}
