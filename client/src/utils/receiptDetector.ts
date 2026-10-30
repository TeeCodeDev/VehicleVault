export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedReceipt {
  // 4 corner points in native video coordinates
  corners: [Point, Point, Point, Point]; // [TL, TR, BR, BL]
  // Bounding rect in native video coordinates (includes safe margin)
  boundingRect: Rect;
  confidence: number;
  isDetected: boolean;
}

// Reusable offscreen canvas for real-time edge processing to prevent GC churn
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

/**
 * Coordinate mapping from container (viewfinder UI) to native video coordinates.
 * Handles CSS object-cover scaling and centered letterboxing.
 */
export function containerToVideo(
  contX: number,
  contY: number,
  contW: number,
  contH: number,
  vidW: number,
  vidH: number
): { x: number; y: number; scale: number; offsetX: number; offsetY: number } {
  const scale = Math.max(contW / vidW, contH / vidH);
  const renderedW = vidW * scale;
  const renderedH = vidH * scale;
  const offsetX = (renderedW - contW) / 2;
  const offsetY = (renderedH - contH) / 2;

  const x = (contX + offsetX) / scale;
  const y = (contY + offsetY) / scale;
  return { x, y, scale, offsetX, offsetY };
}

/**
 * Coordinate mapping from native video coordinates to container (viewfinder UI).
 */
export function videoToContainer(
  vidX: number,
  vidY: number,
  contW: number,
  contH: number,
  vidW: number,
  vidH: number
): Point {
  const scale = Math.max(contW / vidW, contH / vidH);
  const renderedW = vidW * scale;
  const renderedH = vidH * scale;
  const offsetX = (renderedW - contW) / 2;
  const offsetY = (renderedH - contH) / 2;

  return {
    x: vidX * scale - offsetX,
    y: vidY * scale - offsetY,
  };
}

/**
 * Real-time receipt/document edge detector running in native HTML5 Canvas.
 * Processes a downsampled frame (240px width) in ~3ms without blocking the UI thread.
 */
export function detectReceiptInVideo(
  video: HTMLVideoElement,
  prevDetection?: DetectedReceipt | null
): DetectedReceipt | null {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  const vidW = video.videoWidth;
  const vidH = video.videoHeight;

  // Downsample to 240px wide for real-time performance
  const procW = 240;
  const procH = Math.max(120, Math.round(procW * (vidH / vidW)));

  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
  }
  if (sharedCanvas.width !== procW || sharedCanvas.height !== procH) {
    sharedCanvas.width = procW;
    sharedCanvas.height = procH;
    sharedCtx = null;
  }

  if (!sharedCtx) {
    sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!sharedCtx) return null;

  try {
    sharedCtx.drawImage(video, 0, 0, procW, procH);
    const imgData = sharedCtx.getImageData(0, 0, procW, procH);
    const data = imgData.data;

    // 1. Calculate luminance and find average brightness in center region
    const totalPixels = procW * procH;
    let sumCenterL = 0;
    let centerCount = 0;

    const startX = Math.round(procW * 0.15);
    const endX = Math.round(procW * 0.85);
    const startY = Math.round(procH * 0.15);
    const endY = Math.round(procH * 0.85);

    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const idx = (y * procW + x) * 4;
        const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        sumCenterL += l;
        centerCount++;
      }
    }

    const avgL = centerCount > 0 ? sumCenterL / centerCount : 100;
    // Thermal receipts are white / bright with low saturation
    const threshold = Math.max(115, Math.min(195, avgL * 1.25));

    // 2. Scan paper pixels (high luminance, low saturation)
    let minX = procW;
    let maxX = 0;
    let minY = procH;
    let maxY = 0;
    let paperCount = 0;

    const rowPaperCount = new Uint16Array(procH);
    const colPaperCount = new Uint16Array(procW);

    for (let y = 0; y < procH; y += 2) {
      for (let x = 0; x < procW; x += 2) {
        const idx = (y * procW + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);

        if (l > threshold && sat < 50) {
          paperCount++;
          rowPaperCount[y]++;
          colPaperCount[x]++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const paperRatio = paperCount / (totalPixels / 4);

    // Filter out obvious non-receipts (e.g. completely white sheet or total darkness)
    if (paperRatio < 0.06 || paperRatio > 0.88 || maxX <= minX || maxY <= minY) {
      return null;
    }

    // Refine bounds to discard stray reflection noise by finding high-density paper limits
    const rowThreshold = Math.max(4, Math.round((maxX - minX) * 0.15));
    while (minY < maxY && rowPaperCount[minY] < rowThreshold) minY++;
    while (maxY > minY && rowPaperCount[maxY] < rowThreshold) maxY--;

    const colThreshold = Math.max(4, Math.round((maxY - minY) * 0.12));
    while (minX < maxX && colPaperCount[minX] < colThreshold) minX++;
    while (maxX > minX && colPaperCount[maxX] < colThreshold) maxX--;

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    if (boxW < procW * 0.15 || boxH < procH * 0.2) {
      return null;
    }

    // Receipt aspect ratio check (typically taller than wide)
    const aspect = boxH / boxW;
    if (aspect < 0.7 || aspect > 5.5) {
      return null;
    }

    // Scale back up to native video coordinates
    const scaleX = vidW / procW;
    const scaleY = vidH / procH;

    // Add safe 4% padding around the detected document so no edge text is lost
    const padX = Math.round(boxW * 0.04 * scaleX);
    const padY = Math.round(boxH * 0.03 * scaleY);

    const targetRect: Rect = {
      x: Math.max(0, Math.round(minX * scaleX - padX)),
      y: Math.max(0, Math.round(minY * scaleY - padY)),
      width: Math.min(vidW, Math.round(boxW * scaleX + padX * 2)),
      height: Math.min(vidH, Math.round(boxH * scaleY + padY * 2)),
    };

    // Construct 4 corners (TL, TR, BR, BL)
    let rawCorners: [Point, Point, Point, Point] = [
      { x: targetRect.x, y: targetRect.y },
      { x: targetRect.x + targetRect.width, y: targetRect.y },
      { x: targetRect.x + targetRect.width, y: targetRect.y + targetRect.height },
      { x: targetRect.x, y: targetRect.y + targetRect.height },
    ];

    // Smooth movement with previous frame using exponential moving average (LERP)
    if (prevDetection && prevDetection.isDetected) {
      const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
      const smoothFactor = 0.35; // Responsive yet smooth tracking

      rawCorners = [
        {
          x: lerp(prevDetection.corners[0].x, rawCorners[0].x, smoothFactor),
          y: lerp(prevDetection.corners[0].y, rawCorners[0].y, smoothFactor),
        },
        {
          x: lerp(prevDetection.corners[1].x, rawCorners[1].x, smoothFactor),
          y: lerp(prevDetection.corners[1].y, rawCorners[1].y, smoothFactor),
        },
        {
          x: lerp(prevDetection.corners[2].x, rawCorners[2].x, smoothFactor),
          y: lerp(prevDetection.corners[2].y, rawCorners[2].y, smoothFactor),
        },
        {
          x: lerp(prevDetection.corners[3].x, rawCorners[3].x, smoothFactor),
          y: lerp(prevDetection.corners[3].y, rawCorners[3].y, smoothFactor),
        },
      ];
    }

    const confidence = Math.min(0.98, Math.max(0.65, 0.5 + paperRatio));

    return {
      corners: rawCorners,
      boundingRect: {
        x: Math.min(rawCorners[0].x, rawCorners[3].x),
        y: Math.min(rawCorners[0].y, rawCorners[1].y),
        width: Math.max(rawCorners[1].x, rawCorners[2].x) - Math.min(rawCorners[0].x, rawCorners[3].x),
        height: Math.max(rawCorners[2].y, rawCorners[3].y) - Math.min(rawCorners[0].y, rawCorners[1].y),
      },
      confidence,
      isDetected: true,
    };
  } catch (err) {
    console.warn('Receipt detection error:', err);
    return null;
  }
}

/**
 * Draws the real-time HUD (animated polygon, corner brackets, and scanning indicator)
 * onto the viewfinder overlay canvas.
 */
export function renderReceiptHud(
  canvas: HTMLCanvasElement,
  contW: number,
  contH: number,
  vidW: number,
  vidH: number,
  detected: DetectedReceipt | null,
  guideRect: Rect,
  themeColor = '#10b981' // Emerald 500
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, contW, contH);

  if (detected && detected.isDetected) {
    // 1. Map native video corners to on-screen container canvas coordinates
    const pTL = videoToContainer(detected.corners[0].x, detected.corners[0].y, contW, contH, vidW, vidH);
    const pTR = videoToContainer(detected.corners[1].x, detected.corners[1].y, contW, contH, vidW, vidH);
    const pBR = videoToContainer(detected.corners[2].x, detected.corners[2].y, contW, contH, vidW, vidH);
    const pBL = videoToContainer(detected.corners[3].x, detected.corners[3].y, contW, contH, vidW, vidH);

    // Dim the surrounding background table outside the receipt
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, contW, contH);
    ctx.moveTo(pTL.x, pTL.y);
    ctx.lineTo(pBL.x, pBL.y);
    ctx.lineTo(pBR.x, pBR.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill('evenodd');
    ctx.restore();

    // Draw glowing receipt contour
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pTL.x, pTL.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.lineTo(pBR.x, pBR.y);
    ctx.lineTo(pBL.x, pBL.y);
    ctx.closePath();

    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.fill();
    ctx.restore();

    // Draw corner brackets/markers
    const corners = [pTL, pTR, pBR, pBL];
    ctx.save();
    corners.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
    ctx.restore();
  } else {
    // Dim outside the static guide frame
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, contW, contH);
    ctx.rect(guideRect.x, guideRect.y, guideRect.width, guideRect.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill('evenodd');
    ctx.restore();

    // Draw crisp static guide frame with corner brackets
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(guideRect.x, guideRect.y, guideRect.width, guideRect.height);
    ctx.setLineDash([]);

    // Corner brackets
    const arm = Math.min(24, Math.round(guideRect.width * 0.12));
    ctx.strokeStyle = '#38bdf8'; // Sky blue / accent
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(guideRect.x, guideRect.y + arm);
    ctx.lineTo(guideRect.x, guideRect.y);
    ctx.lineTo(guideRect.x + arm, guideRect.y);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(guideRect.x + guideRect.width - arm, guideRect.y);
    ctx.lineTo(guideRect.x + guideRect.width, guideRect.y);
    ctx.lineTo(guideRect.x + guideRect.width, guideRect.y + arm);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(guideRect.x + guideRect.width, guideRect.y + guideRect.height - arm);
    ctx.lineTo(guideRect.x + guideRect.width, guideRect.y + guideRect.height);
    ctx.lineTo(guideRect.x + guideRect.width - arm, guideRect.y + guideRect.height);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(guideRect.x + arm, guideRect.y + guideRect.height);
    ctx.lineTo(guideRect.x, guideRect.y + guideRect.height);
    ctx.lineTo(guideRect.x, guideRect.y + guideRect.height - arm);
    ctx.stroke();
    ctx.restore();
  }
}

