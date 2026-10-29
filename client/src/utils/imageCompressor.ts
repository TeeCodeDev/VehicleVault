/**
 * Client-Side Image Compressor for VehicleVault.
 * Compresses smartphone camera photos (often 3-10 MB) down to ~150-350 KB in < 150ms
 * using the HTML5 Canvas API prior to network upload.
 *
 * This dramatically accelerates AI vision extraction (Gemini/OpenAI/Tesseract),
 * saves mobile cellular data, and prevents server storage bloat.
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 2200,
  quality = 0.82
): Promise<File> {
  // If not an image or is SVG/GIF, return unchanged
  if (!file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
    return file;
  }

  // If already under 350 KB and is JPEG or WebP, return original
  if (file.size < 350 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while bounding within maxWidth x maxHeight
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        // Fill background with clean solid white (in case transparent PNGs are uploaded)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw and scale image smoothly
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compression somehow didn't decrease size, return original file
              return resolve(file);
            }

            const cleanBaseName = file.name.replace(/\.[^/.]+$/, '');
            const compressedFile = new File([blob], `${cleanBaseName}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            console.log(
              `[ImageCompressor] Compressed "${file.name}" from ${(file.size / 1024 / 1024).toFixed(2)} MB to ${(compressedFile.size / 1024).toFixed(1)} KB`
            );

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

