/**
 * Interactive Demo Sample Generator
 * Generates sample videos and GIFs directly in the browser for instant 1-tap testing
 */

export async function generateSampleVideo() {
  const width = 480;
  const height = 320;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
    ? 'video/webm'
    : 'video/mp4';

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  const totalFrames = 90; // 3 seconds at 30fps
  for (let i = 0; i < totalFrames; i++) {
    const t = i / 30; // seconds

    // Deep modern dark background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#131b2e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing nebula circles
    const radGrad = ctx.createRadialGradient(
      width / 2 + Math.cos(t * 2) * 80,
      height / 2 + Math.sin(t * 2) * 40,
      10,
      width / 2,
      height / 2,
      180
    );
    radGrad.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    radGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, width, height);

    // Bouncing neon orb
    const cx = width / 2 + Math.sin(t * 3) * 110;
    const cy = height / 2 + Math.abs(Math.sin(t * 4)) * -60 + 30;
    const orbGrad = ctx.createRadialGradient(cx - 15, cy - 15, 5, cx, cy, 50);
    orbGrad.addColorStop(0, '#34d399');
    orbGrad.addColorStop(0.6, '#059669');
    orbGrad.addColorStop(1, '#064e3b');
    ctx.beginPath();
    ctx.arc(cx, cy, 45, 0, Math.PI * 2);
    ctx.fillStyle = orbGrad;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 30;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Glowing rotating tech ring
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(t * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 95, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Modern typography badge
    ctx.font = '700 20px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('GIFPULSE STUDIO', width / 2, height - 40);

    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`00:0${t.toFixed(1)}s • 30 FPS HD`, width / 2, height - 20);

    // Yield frame
    await new Promise((r) => setTimeout(r, 1000 / 30));
  }

  recorder.stop();
  await new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  const blob = new Blob(chunks, { type: mimeType });
  const file = new File([blob], 'sample_motion.mp4', { type: mimeType });
  return file;
}
