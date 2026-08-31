import React, { useState, useEffect, useMemo } from 'react';
import { CameraSettings } from '../types';
import {
  toLocalIsoDateTime,
  parseDateSafe,
  formatOffsetMinutes,
  formatCustomDate,
  getActiveDate,
} from '../utils/dateFormatter';
import {
  Clock,
  RotateCcw,
  Calendar,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Sliders,
  Sun,
  Sunset,
  Moon,
  Zap,
} from 'lucide-react';

interface OnScreenTimeSliderProps {
  settings: CameraSettings;
  onUpdateSettings: (newSettings: CameraSettings) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const OnScreenTimeSlider: React.FC<OnScreenTimeSliderProps> = ({
  settings,
  onUpdateSettings,
  isOpen,
  onClose,
}) => {
  // Current live system reference time for computing offsets
  const [systemNow, setSystemNow] = useState<Date>(new Date());
  const [sliderRangeMode, setSliderRangeMode] = useState<'hours' | 'days' | 'minutes'>('hours');

  // Keep live system reference updated every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute active date from settings
  const activeDate = useMemo(() => {
    return getActiveDate(settings, systemNow);
  }, [settings, systemNow]);

  // Compute offset in minutes between current system time and the active date
  const offsetMinutes = useMemo(() => {
    if (settings.timeSource !== 'custom') return 0;
    const diffMs = activeDate.getTime() - systemNow.getTime();
    return Math.round(diffMs / 60000);
  }, [settings.timeSource, activeDate, systemNow]);

  // Apply new date from offset
  const handleApplyOffsetMinutes = (newOffsetMins: number) => {
    const newTargetTime = new Date(systemNow.getTime() + newOffsetMins * 60000);
    onUpdateSettings({
      ...settings,
      timeSource: newOffsetMins === 0 ? 'system' : 'custom',
      customDateTimeString: toLocalIsoDateTime(newTargetTime),
    });
  };

  // Direct date change from datetime-local input
  const handleDirectDateChange = (isoLocalStr: string) => {
    if (!isoLocalStr) return;
    const parsed = new Date(isoLocalStr);
    if (!isNaN(parsed.getTime())) {
      onUpdateSettings({
        ...settings,
        timeSource: 'custom',
        customDateTimeString: isoLocalStr,
      });
    }
  };

  // Reset to live system time
  const handleResetToLive = () => {
    onUpdateSettings({
      ...settings,
      timeSource: 'system',
      customDateTimeString: toLocalIsoDateTime(new Date()),
    });
  };

  // Step adjustment helper
  const handleStepDelta = (deltaMinutes: number) => {
    const currentBase = settings.timeSource === 'custom' ? activeDate : systemNow;
    const newTargetTime = new Date(currentBase.getTime() + deltaMinutes * 60000);
    onUpdateSettings({
      ...settings,
      timeSource: 'custom',
      customDateTimeString: toLocalIsoDateTime(newTargetTime),
    });
  };

  // Quick preset jump
  const handleSetTimeToday = (hours: number, minutes: number = 0) => {
    const target = new Date(activeDate);
    target.setHours(hours, minutes, 0, 0);
    onUpdateSettings({
      ...settings,
      timeSource: 'custom',
      customDateTimeString: toLocalIsoDateTime(target),
    });
  };

  if (!isOpen) return null;

  // Configure slider parameters based on range mode
  let sliderMin = -720; // -12 hours
  let sliderMax = 720;  // +12 hours
  let sliderStep = 1;

  if (sliderRangeMode === 'minutes') {
    sliderMin = -60;
    sliderMax = 60;
    sliderStep = 1;
  } else if (sliderRangeMode === 'days') {
    sliderMin = -10080; // -7 days
    sliderMax = 10080;  // +7 days
    sliderStep = 30;
  }

  // Clamped slider value
  const sliderValue = Math.max(sliderMin, Math.min(sliderMax, offsetMinutes));

  const isCustomActive = settings.timeSource === 'custom';
  const formattedDisplayTime = formatCustomDate(
    activeDate,
    settings.dateFormat || 'dd MMM yyyy, hh:mm:ss a'
  );

  return (
    <div
      id="on-screen-time-slider-panel"
      className="absolute bottom-28 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-40 bg-[#0f0f14]/95 backdrop-blur-xl border border-zinc-750/90 rounded-3xl p-4 shadow-2xl text-zinc-100 animate-in slide-in-from-bottom-4 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <span>On-Screen Time Adjuster</span>
              {isCustomActive ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-400 text-zinc-950 font-bold">
                  CUSTOM
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  LIVE
                </span>
              )}
            </h3>
            <p className="text-[11px] text-zinc-400">
              Drag slider to change time without opening settings
            </p>
          </div>
        </div>

        <button
          id="close-time-slider-btn"
          onClick={onClose}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          title="Minimize time slider"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Target Time Live Readout Box */}
      <div className="mt-3 p-2.5 rounded-2xl bg-[#17171e] border border-zinc-800 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider">
            Burned Photo Timestamp
          </span>
          <div className="font-mono text-sm font-bold text-amber-400 truncate">
            {formattedDisplayTime}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            Offset: <span className={isCustomActive ? 'text-amber-300 font-semibold' : 'text-zinc-400'}>{formatOffsetMinutes(offsetMinutes)}</span>
          </div>
        </div>

        {/* Live Reset Button */}
        {isCustomActive && (
          <button
            id="reset-live-time-btn"
            onClick={handleResetToLive}
            className="ml-2 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1 border border-zinc-700 transition-all active:scale-95 shadow-xs"
            title="Snap back to current live time"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Now</span>
          </button>
        )}
      </div>

      {/* Range Mode Switcher Tabs */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Slider Range
        </span>
        <div className="flex bg-[#121217] p-0.5 rounded-xl border border-zinc-800 text-[10px] font-medium">
          <button
            onClick={() => setSliderRangeMode('minutes')}
            className={`px-2 py-1 rounded-lg transition-all ${
              sliderRangeMode === 'minutes'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ±60 Mins
          </button>
          <button
            onClick={() => setSliderRangeMode('hours')}
            className={`px-2 py-1 rounded-lg transition-all ${
              sliderRangeMode === 'hours'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ±12 Hours
          </button>
          <button
            onClick={() => setSliderRangeMode('days')}
            className={`px-2 py-1 rounded-lg transition-all ${
              sliderRangeMode === 'days'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ±7 Days
          </button>
        </div>
      </div>

      {/* Main Interactive Time Slider */}
      <div className="mt-2.5 space-y-1">
        <div className="relative flex items-center">
          <input
            id="on-screen-time-slider"
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={sliderValue}
            onChange={(e) => handleApplyOffsetMinutes(parseInt(e.target.value, 10))}
            className="w-full h-3 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400 border border-zinc-700/80"
          />
        </div>

        {/* Slider Labels */}
        <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
          <span>{sliderRangeMode === 'days' ? '-7 Days' : sliderRangeMode === 'minutes' ? '-60m' : '-12h'}</span>
          <span className="text-zinc-500 font-semibold cursor-pointer hover:text-amber-400" onClick={handleResetToLive}>
            ● 0 (Now)
          </span>
          <span>{sliderRangeMode === 'days' ? '+7 Days' : sliderRangeMode === 'minutes' ? '+60m' : '+12h'}</span>
        </div>
      </div>

      {/* Stepper Quick-Jump Buttons */}
      <div className="mt-3 grid grid-cols-6 gap-1 text-[11px] font-mono font-semibold">
        <button
          onClick={() => handleStepDelta(-1440)}
          className="p-1.5 bg-[#17171e] hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 hover:border-zinc-700 text-center transition-all active:scale-95"
          title="Subtract 1 Day"
        >
          -1d
        </button>
        <button
          onClick={() => handleStepDelta(-60)}
          className="p-1.5 bg-[#17171e] hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 hover:border-zinc-700 text-center transition-all active:scale-95"
          title="Subtract 1 Hour"
        >
          -1h
        </button>
        <button
          onClick={() => handleStepDelta(-10)}
          className="p-1.5 bg-[#17171e] hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 hover:border-zinc-700 text-center transition-all active:scale-95"
          title="Subtract 10 Minutes"
        >
          -10m
        </button>
        <button
          onClick={() => handleStepDelta(10)}
          className="p-1.5 bg-[#17171e] hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 hover:border-zinc-700 text-center transition-all active:scale-95"
          title="Add 10 Minutes"
        >
          +10m
        </button>
        <button
          onClick={() => handleStepDelta(60)}
          className="p-1.5 bg-[#17171e] hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 hover:border-zinc-700 text-center transition-all active:scale-95"
          title="Add 1 Hour"
        >
          +1h
        </button>
        <button
          onClick={() => handleStepDelta(1440)}
          className="p-1.5 bg-[#17171e] hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 hover:border-zinc-700 text-center transition-all active:scale-95"
          title="Add 1 Day"
        >
          +1d
        </button>
      </div>

      {/* Preset Times / Exact Picker Toggle */}
      <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleSetTimeToday(9, 0)}
            className="px-2 py-1 rounded-lg bg-[#14141a] hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1 transition-all"
            title="Set to 09:00 AM"
          >
            <Sun className="w-3 h-3 text-amber-400" />
            <span>09:00 AM</span>
          </button>
          <button
            onClick={() => handleSetTimeToday(14, 30)}
            className="px-2 py-1 rounded-lg bg-[#14141a] hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1 transition-all"
            title="Set to 02:30 PM"
          >
            <Sunset className="w-3 h-3 text-amber-400" />
            <span>02:30 PM</span>
          </button>
          <button
            onClick={() => handleSetTimeToday(20, 0)}
            className="px-2 py-1 rounded-lg bg-[#14141a] hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1 transition-all"
            title="Set to 08:00 PM"
          >
            <Moon className="w-3 h-3 text-blue-400" />
            <span>08:00 PM</span>
          </button>
        </div>

        {/* Native Datetime Picker Input button */}
        <label
          htmlFor="on-screen-exact-datetime-input"
          className="cursor-pointer px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] font-medium text-zinc-200 flex items-center gap-1 transition-all"
          title="Pick exact calendar date & time"
        >
          <Calendar className="w-3 h-3 text-amber-400" />
          <span>Pick Date</span>
          <input
            id="on-screen-exact-datetime-input"
            type="datetime-local"
            value={toLocalIsoDateTime(activeDate)}
            onChange={(e) => handleDirectDateChange(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
};
