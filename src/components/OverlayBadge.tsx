import React from 'react';
import { CameraSettings, TextColor, OverlayPosition, BackgroundStyle } from '../types';
import { generateTimestampText } from '../utils/dateFormatter';

interface OverlayBadgeProps {
  settings: CameraSettings;
  currentTime?: Date;
  isViewfinder?: boolean;
  onClick?: () => void;
}

const COLOR_CLASSES: Record<TextColor, { text: string; bgPill: string; outline: string }> = {
  white: {
    text: 'text-zinc-100',
    bgPill: 'bg-black/75 text-zinc-100',
    outline: 'text-zinc-100 [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]'
  },
  yellow: {
    text: 'text-amber-400',
    bgPill: 'bg-black/75 text-amber-400',
    outline: 'text-amber-400 [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]'
  },
  red: {
    text: 'text-rose-500',
    bgPill: 'bg-black/75 text-rose-400',
    outline: 'text-rose-400 [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]'
  },
  green: {
    text: 'text-emerald-400',
    bgPill: 'bg-black/75 text-emerald-400',
    outline: 'text-emerald-400 [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]'
  },
  black: {
    text: 'text-zinc-950',
    bgPill: 'bg-zinc-100/90 text-zinc-950',
    outline: 'text-zinc-950 [text-shadow:_-1px_-1px_0_#fff,_1px_-1px_0_#fff,_-1px_1px_0_#fff,_1px_1px_0_#fff]'
  },
};

const POSITION_CLASSES: Record<OverlayPosition, string> = {
  top_left: 'top-4 left-4 items-start text-left',
  top_right: 'top-4 right-4 items-end text-right',
  bottom_left: 'bottom-24 left-4 items-start text-left',
  bottom_right: 'bottom-24 right-4 items-end text-right',
};

export const OverlayBadge: React.FC<OverlayBadgeProps> = ({
  settings,
  currentTime = new Date(),
  isViewfinder = false,
  onClick,
}) => {
  const { fullLines } = generateTimestampText(settings, currentTime);
  const colorConfig = COLOR_CLASSES[settings.textColor] || COLOR_CLASSES.yellow;
  const isRight = settings.position === 'top_right' || settings.position === 'bottom_right';

  // Responsive font size clamp for on-screen live UI
  const displayFontSize = Math.max(12, Math.min(32, settings.fontSize));

  const bgStyle: BackgroundStyle = settings.backgroundStyle || 'pill';

  let containerClass = `flex flex-col select-none transition-all duration-150 font-mono ${
    onClick ? 'pointer-events-auto cursor-pointer active:scale-95 hover:opacity-90' : 'pointer-events-none'
  } `;

  if (bgStyle === 'pill') {
    containerClass += `${colorConfig.bgPill} backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 shadow-xl `;
  } else if (bgStyle === 'shadow') {
    containerClass += `${colorConfig.text} drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] `;
  } else if (bgStyle === 'outline') {
    containerClass += `${colorConfig.outline} `;
  } else {
    containerClass += `${colorConfig.text} `;
  }

  const content = (
    <div
      id="camera-overlay-badge"
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      title={onClick ? 'Tap to adjust custom time with on-screen slider' : undefined}
      className={containerClass}
      style={{
        fontSize: `${displayFontSize}px`,
        lineHeight: 1.3,
      }}
    >
      {fullLines.map((line, idx) => (
        <span
          key={idx}
          className={`font-semibold tracking-wide whitespace-nowrap ${isRight ? 'text-right' : 'text-left'}`}
        >
          {line}
        </span>
      ))}
    </div>
  );

  if (isViewfinder) {
    const posClass = POSITION_CLASSES[settings.position] || POSITION_CLASSES.bottom_right;
    return (
      <div className={`absolute z-20 ${onClick ? 'pointer-events-auto' : 'pointer-events-none'} flex ${posClass}`}>
        {content}
      </div>
    );
  }

  return content;
};
