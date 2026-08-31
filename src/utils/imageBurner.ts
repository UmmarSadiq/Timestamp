import { CameraSettings, TextColor, OverlayPosition, BackgroundStyle, LocationCoordinates } from '../types';
import { generateTimestampText } from './dateFormatter';

const COLOR_MAP: Record<TextColor, string> = {
  white: '#FFFFFF',
  yellow: '#FFDF00',
  red: '#FF3B30',
  green: '#34C759',
  black: '#111111',
};

/**
 * Draws a rounded rectangle path
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export interface BurnImageOptions {
  videoElement?: HTMLVideoElement | null;
  sourceCanvas?: HTMLCanvasElement | null;
  settings: CameraSettings;
  captureTime?: Date;
}

export interface BurnResult {
  id?: string;
  timestamp?: number;
  dataUrl: string;
  blob: Blob;
  filename: string;
  formattedTimestamp: string;
  customText?: string;
  locationText?: string;
  coordinates?: LocationCoordinates;
  width: number;
  height: number;
}

/**
 * Captures image from video stream and burns timestamp overlay directly into pixels.
 */
export async function captureAndBurnImage(options: BurnImageOptions): Promise<BurnResult> {
  const { videoElement, sourceCanvas, settings, captureTime = new Date() } = options;

  let width = 1920;
  let height = 1080;

  if (videoElement && videoElement.videoWidth && videoElement.videoHeight) {
    width = videoElement.videoWidth;
    height = videoElement.videoHeight;
  } else if (sourceCanvas && sourceCanvas.width && sourceCanvas.height) {
    width = sourceCanvas.width;
    height = sourceCanvas.height;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  // Draw source frame
  if (videoElement && videoElement.readyState >= 2) {
    // If front camera, mirror image for natural selfie feel if needed
    if (settings.facingMode === 'user') {
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoElement, 0, 0, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(videoElement, 0, 0, width, height);
    }
  } else if (sourceCanvas) {
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  } else {
    // Simulated frame for preview/testing when hardware camera is offline
    renderSimulatedCameraScene(ctx, width, height, settings);
  }

  // Calculate text scale relative to resolution (baseline is 1080p width: 1920)
  const scale = Math.max(0.6, width / 1280);
  const baseFontSize = settings.fontSize || 24;
  const scaledFontSize = Math.round(baseFontSize * scale);
  const lineSpacing = Math.round(scaledFontSize * 0.35);
  const paddingX = Math.round(20 * scale);
  const paddingY = Math.round(14 * scale);
  const marginX = Math.round(36 * scale);
  const marginY = Math.round(36 * scale);

  // Generate text lines
  const { fullLines, primaryText, secondaryText, locationLine } = generateTimestampText(settings, captureTime);
  const textColorHex = COLOR_MAP[settings.textColor] || '#FFFFFF';

  // Setup font
  const fontFamily = '"Roboto Mono", "Courier New", monospace, sans-serif';
  ctx.font = `600 ${scaledFontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';

  // Measure lines
  const measuredWidths = fullLines.map(line => ctx.measureText(line).width);
  const maxTextWidth = Math.max(...measuredWidths, 100);
  const totalTextHeight = fullLines.length * scaledFontSize + (fullLines.length - 1) * lineSpacing;

  const boxWidth = maxTextWidth + paddingX * 2;
  const boxHeight = totalTextHeight + paddingY * 2;

  // Calculate overlay coordinates based on position
  let boxX = marginX;
  let boxY = marginY;

  switch (settings.position) {
    case 'top_left':
      boxX = marginX;
      boxY = marginY;
      break;
    case 'top_right':
      boxX = width - boxWidth - marginX;
      boxY = marginY;
      break;
    case 'bottom_left':
      boxX = marginX;
      boxY = height - boxHeight - marginY;
      break;
    case 'bottom_right':
      boxX = width - boxWidth - marginX;
      boxY = height - boxHeight - marginY;
      break;
  }

  const isRightAligned = settings.position === 'top_right' || settings.position === 'bottom_right';

  // Background rendering
  const bgStyle: BackgroundStyle = settings.backgroundStyle || 'pill';

  if (bgStyle === 'pill' || bgStyle === 'none') {
    if (bgStyle === 'pill') {
      ctx.save();
      const pillBg = settings.textColor === 'black' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(10, 10, 10, 0.65)';
      ctx.fillStyle = pillBg;
      drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, Math.round(12 * scale));
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw Text with outline/shadow for high contrast
  ctx.save();
  ctx.font = `600 ${scaledFontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = textColorHex;

  if (bgStyle === 'shadow' || bgStyle === 'pill' || bgStyle === 'none') {
    ctx.shadowColor = settings.textColor === 'black' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = Math.round(6 * scale);
    ctx.shadowOffsetX = Math.round(2 * scale);
    ctx.shadowOffsetY = Math.round(2 * scale);
  }

  if (bgStyle === 'outline') {
    ctx.strokeStyle = settings.textColor === 'black' ? '#FFFFFF' : '#000000';
    ctx.lineWidth = Math.max(3, Math.round(4 * scale));
    ctx.lineJoin = 'round';
  }

  let currentY = boxY + paddingY;
  for (let i = 0; i < fullLines.length; i++) {
    const line = fullLines[i];
    const lineWidth = measuredWidths[i];
    let lineX = boxX + paddingX;

    if (isRightAligned) {
      lineX = boxX + boxWidth - paddingX - lineWidth;
    }

    if (bgStyle === 'outline') {
      ctx.strokeText(line, lineX, currentY);
    }
    ctx.fillText(line, lineX, currentY);

    currentY += scaledFontSize + lineSpacing;
  }
  ctx.restore();

  // Create clean formatted filename: TimestampCamera_YYYYMMDD_HHMMSS.jpg
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = captureTime;
  const filename = `TimestampCamera_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b || new Blob()),
      'image/jpeg',
      0.92
    );
  });

  return {
    id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    dataUrl,
    blob,
    filename,
    formattedTimestamp: secondaryText ? `${primaryText} | ${secondaryText}` : primaryText,
    customText: settings.mode === 'custom_text_timestamp' ? settings.customText : undefined,
    locationText: locationLine || undefined,
    coordinates: settings.locationCoords,
    width,
    height,
  };
}

/**
 * Creates a simulated high-contrast real-time scene when camera feed is not accessible
 */
export function renderSimulatedCameraScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: CameraSettings
) {
  // Rich photographic gradient simulating outdoor scenery / workspace
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#1a233a');
  grad.addColorStop(0.4, '#2d4059');
  grad.addColorStop(0.7, '#395b64');
  grad.addColorStop(1, '#1b262c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Decorative grid lines representing camera sensor viewfinder
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  const thirdW = width / 3;
  const thirdH = height / 3;
  ctx.beginPath();
  ctx.moveTo(thirdW, 0); ctx.lineTo(thirdW, height);
  ctx.moveTo(thirdW * 2, 0); ctx.lineTo(thirdW * 2, height);
  ctx.moveTo(0, thirdH); ctx.lineTo(width, thirdH);
  ctx.moveTo(0, thirdH * 2); ctx.lineTo(width, thirdH * 2);
  ctx.stroke();

  // Center focus reticle
  const cx = width / 2;
  const cy = height / 2;
  const reticleSize = 40;
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - reticleSize / 2, cy - reticleSize / 2, reticleSize, reticleSize);

  // Scene label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '500 24px "Roboto", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TIMESTAMP CAMERA SENSOR FEED', cx, cy + 50);
  ctx.font = '400 16px "Roboto", sans-serif';
  ctx.fillText(`Camera: ${settings.facingMode.toUpperCase()} | Lens: 24mm f/1.8`, cx, cy + 76);
  ctx.textAlign = 'left';
}

/**
 * Triggers native Android / browser download to device Pictures/TimestampCamera
 */
export function savePhotoToDeviceGallery(dataUrl: string, filename: string): void {
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to trigger download:', err);
  }
}
