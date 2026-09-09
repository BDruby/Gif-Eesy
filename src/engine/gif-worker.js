import gifencPkg from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifencPkg;

self.onmessage = async (e) => {
  const { action, frames, width, height, paletteSize = 256, dither = true, loop = 0 } = e.data;

  if (action === 'encode') {
    try {
      const gif = GIFEncoder();
      const total = frames.length;

      for (let i = 0; i < total; i++) {
        const frame = frames[i];
        const rgbaData = frame.data instanceof Uint8Array 
          ? frame.data 
          : new Uint8Array(frame.data);

        // Quantize colors for this frame
        const format = 'rgb565';
        const palette = quantize(rgbaData, paletteSize, { format });
        
        // Apply palette with optional Floyd-Steinberg dithering
        const indexedData = applyPalette(
          rgbaData, 
          palette, 
          dither ? 'floyd-steinberg' : undefined
        );

        // Frame delay in milliseconds
        const delay = Math.max(20, Math.round(frame.delay || 100));

        gif.writeFrame(indexedData, width, height, {
          palette,
          delay,
          repeat: i === 0 ? loop : undefined
        });

        // Report progress every frame or at reasonable intervals
        if (i % 2 === 0 || i === total - 1) {
          const percent = Math.round(((i + 1) / total) * 100);
          self.postMessage({
            type: 'progress',
            current: i + 1,
            total,
            percent
          });
        }
      }

      gif.finish();
      const bytes = gif.bytes();

      // Return buffer transferable
      self.postMessage({
        type: 'done',
        buffer: bytes.buffer
      }, [bytes.buffer]);

    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err.message || String(err)
      });
    }
  }
};
