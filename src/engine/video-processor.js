/**
 * Video frame extractor and transform pipeline
 */

export async function extractVideoFrames(video, options = {}) {
  const {
    startTime = 0,
    endTime = video.duration || 5,
    fps = 12,
    outputWidth = 480,
    outputHeight = 270,
    crop = null, // { x: 0..1, y: 0..1, w: 0..1, h: 0..1 }
    playback = 'normal', // 'normal' | 'reverse' | 'boomerang'
    speed = 1.0,
    textOverlay = null,
    onProgress = () => {}
  } = options;

  const effectiveDuration = Math.max(0.1, endTime - startTime);
  const frameInterval = 1 / fps;
  const numFrames = Math.max(1, Math.floor(effectiveDuration * fps));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const rawFrames = [];
  const delay = Math.round((1000 / fps) / speed);

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;

  // Calculate crop source rect
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (crop && crop.w > 0 && crop.h > 0) {
    sx = Math.max(0, Math.floor(crop.x * vw));
    sy = Math.max(0, Math.floor(crop.y * vh));
    sw = Math.min(vw - sx, Math.floor(crop.w * vw));
    sh = Math.min(vh - sy, Math.floor(crop.h * vh));
  }

  // Pre-configure text overlay font settings if provided
  const hasText = textOverlay && (
    (textOverlay.topText && textOverlay.topText.trim()) ||
    (textOverlay.bottomText && textOverlay.bottomText.trim()) ||
    (textOverlay.watermark && textOverlay.watermark.trim())
  );

  for (let i = 0; i < numFrames; i++) {
    const targetTime = startTime + i * frameInterval;
    if (targetTime > video.duration) break;

    await seekVideo(video, targetTime);

    // Draw cropped video frame scaled to canvas
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

    // Draw text overlays if any
    if (hasText) {
      drawTextOverlay(ctx, outputWidth, outputHeight, textOverlay);
    }

    const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
    // Clone buffer for worker transfer
    const frameBuffer = new Uint8Array(imageData.data);

    rawFrames.push({
      data: frameBuffer,
      delay
    });

    onProgress(Math.round(((i + 1) / numFrames) * 100), i + 1, numFrames);
  }

  // Handle playback modes
  let processedFrames = rawFrames;
  if (playback === 'reverse') {
    processedFrames = [...rawFrames].reverse();
  } else if (playback === 'boomerang') {
    const reverseSlice = rawFrames.slice(1, -1).reverse();
    processedFrames = rawFrames.concat(reverseSlice);
  }

  return {
    frames: processedFrames,
    width: outputWidth,
    height: outputHeight,
    delay
  };
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.03) {
      return resolve();
    }

    let resolved = false;
    const onSeeked = () => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = time;

    // Safety timeout in case seeked event hangs
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }
    }, 400);
  });
}

function drawTextOverlay(ctx, width, height, textOverlay) {
  const {
    topText = '',
    bottomText = '',
    watermark = '',
    watermarkPos = 'br',
    textColor = '#ffffff',
    fontSizeRatio = 0.08
  } = textOverlay;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const baseFontSize = Math.max(14, Math.round(height * fontSizeRatio));
  ctx.font = `900 ${baseFontSize}px "Impact", "Arial Black", sans-serif`;
  ctx.fillStyle = textColor;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(2, Math.round(baseFontSize * 0.12));
  ctx.lineJoin = 'round';

  // Draw Top Meme Text
  if (topText && topText.trim()) {
    const text = topText.trim().toUpperCase();
    const y = baseFontSize * 0.9;
    ctx.strokeText(text, width / 2, y, width * 0.92);
    ctx.fillText(text, width / 2, y, width * 0.92);
  }

  // Draw Bottom Meme Text
  if (bottomText && bottomText.trim()) {
    const text = bottomText.trim().toUpperCase();
    const y = height - baseFontSize * 0.8;
    ctx.strokeText(text, width / 2, y, width * 0.92);
    ctx.fillText(text, width / 2, y, width * 0.92);
  }

  // Draw Watermark
  if (watermark && watermark.trim()) {
    const wmText = watermark.trim();
    const wmFontSize = Math.max(11, Math.round(baseFontSize * 0.55));
    ctx.font = `600 ${wmFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 2.5;

    const pad = 12;
    let wx = width - pad;
    let wy = height - pad;
    ctx.textAlign = 'right';

    if (watermarkPos === 'tl') {
      wx = pad; wy = pad + wmFontSize * 0.8; ctx.textAlign = 'left';
    } else if (watermarkPos === 'tr') {
      wx = width - pad; wy = pad + wmFontSize * 0.8; ctx.textAlign = 'right';
    } else if (watermarkPos === 'bl') {
      wx = pad; wy = height - pad; ctx.textAlign = 'left';
    } else if (watermarkPos === 'center') {
      wx = width / 2; wy = height / 2; ctx.textAlign = 'center';
    }

    ctx.strokeText(wmText, wx, wy);
    ctx.fillText(wmText, wx, wy);
  }

  ctx.restore();
}
