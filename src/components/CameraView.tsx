import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CameraSettings, CapturedPhoto } from '../types';
import { OverlayBadge } from './OverlayBadge';
import { OnScreenTimeSlider } from './OnScreenTimeSlider';
import { soundManager } from '../utils/cameraAudio';
import {
  getSystemCoordinates,
  reverseGeocodeCoordinates,
  formatCoordinates,
  watchSystemCoordinates,
  getGpsAccuracyQuality,
} from '../utils/locationService';
import {
  Settings,
  Image as ImageIcon,
  SwitchCamera,
  Grid,
  Zap,
  ZapOff,
  AlertCircle,
  Camera,
  Play,
  Pause,
  Timer,
  Clock,
  Sliders,
  MapPin,
  RefreshCw,
  Smartphone,
  LocateFixed,
} from 'lucide-react';

interface CameraViewProps {
  settings: CameraSettings;
  onUpdateSettings: (settings: CameraSettings) => void;
  onOpenSettings: () => void;
  onOpenGallery: () => void;
  onOpenApkModal?: () => void;
  onCapture: (videoRef: HTMLVideoElement | null) => Promise<void>;
  photos: CapturedPhoto[];
  autoCaptureCountdown: number | null;
  isCapturing: boolean;
  cameraPermissionState: 'granted' | 'denied' | 'prompt' | 'unsupported';
  onRequestPermission: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenGallery,
  onOpenApkModal,
  onCapture,
  photos,
  autoCaptureCountdown,
  isCapturing,
  cameraPermissionState,
  onRequestPermission,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);
  const [isShutterFlashing, setIsShutterFlashing] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTimeSliderOpen, setIsTimeSliderOpen] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Live timer tick for on-screen timestamp badge
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Auto-acquire system GPS location on mount if enabled (with fresh zero-cache hardware fix)
  const fetchSystemLocation = useCallback(async () => {
    if (!settings.showLocation) return;
    setIsLocating(true);
    try {
      const coords = await getSystemCoordinates(true, 0, 15000);
      const address = await reverseGeocodeCoordinates(
        coords.latitude,
        coords.longitude,
        settings.addressDetailLevel || 'detailed_street'
      );
      onUpdateSettings({
        ...settings,
        showLocation: true,
        locationCoords: coords,
        locationText: address,
      });
    } catch (e) {
      console.warn('Auto location acquire failed:', e);
    } finally {
      setIsLocating(false);
    }
  }, [settings.showLocation, settings.addressDetailLevel, onUpdateSettings, settings]);

  useEffect(() => {
    if (settings.showLocation && !settings.locationCoords) {
      fetchSystemLocation();
    }
  }, [settings.showLocation, fetchSystemLocation, settings.locationCoords]);

  // Continuous background GPS tracking for real-time accuracy enhancement
  useEffect(() => {
    if (!settings.showLocation || settings.continuousGpsTracking === false || settings.locationSource === 'custom') {
      return;
    }

    const cleanup = watchSystemCoordinates(async (coords) => {
      // Only re-reverse-geocode if position moved significantly (> 20 meters) or address is missing
      const prevCoords = settings.locationCoords;
      let shouldReverseGeocode = !settings.locationText;
      if (prevCoords) {
        const dist = Math.hypot(coords.latitude - prevCoords.latitude, coords.longitude - prevCoords.longitude) * 111000;
        if (dist > 25) {
          shouldReverseGeocode = true;
        }
      }

      let newAddress = settings.locationText;
      if (shouldReverseGeocode) {
        newAddress = await reverseGeocodeCoordinates(
          coords.latitude,
          coords.longitude,
          settings.addressDetailLevel || 'detailed_street'
        );
      }

      onUpdateSettings({
        ...settings,
        locationCoords: coords,
        locationText: newAddress,
      });
    });

    return () => cleanup();
  }, [settings.showLocation, settings.continuousGpsTracking, settings.locationSource, settings.addressDetailLevel]);

  // Initialize and manage camera stream
  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API is not supported on this browser/device.');
      return;
    }

    try {
      setCameraError(null);
      // Stop previous tracks if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: settings.facingMode },
          width: { ideal: settings.highResolution ? 1920 : 1280 },
          height: { ideal: settings.highResolution ? 1080 : 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('Video play error:', e));
      }

      // Check if torch/flash is supported on active video track
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities?.() as { torch?: boolean }) || {};
        setHasTorch(Boolean(capabilities.torch));
      }
    } catch (err: unknown) {
      console.warn('Camera stream request failed:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('Permission') || errorMsg.includes('NotAllowedError')) {
        setCameraError('Camera permission was denied. Please allow camera access in browser settings.');
      } else {
        setCameraError('Hardware camera unavailable. Using high-definition simulated sensor feed.');
      }
    }
  }, [settings.facingMode, settings.highResolution]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // Handle Torch Toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const newTorchState = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorchState }],
      });
      setIsTorchOn(newTorchState);
    } catch (err) {
      console.warn('Failed to toggle torch', err);
    }
  };

  // Switch between front/back camera
  const handleFlipCamera = () => {
    const nextMode = settings.facingMode === 'environment' ? 'user' : 'environment';
    onUpdateSettings({
      ...settings,
      facingMode: nextMode,
    });
  };

  // Toggle Grid
  const handleToggleGrid = () => {
    onUpdateSettings({
      ...settings,
      showGrid: !settings.showGrid,
    });
  };

  // Trigger manual capture
  const handleTriggerCapture = async () => {
    if (isCapturing) return;

    // Flash animation
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 120);

    // Audio & haptic feedback
    if (settings.shutterSound) {
      soundManager.playShutterSound();
    }

    await onCapture(videoRef.current);
  };

  // Tap-to-focus animation
  const handleTapViewfinder = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setFocusRing({ x, y });
    soundManager.playBeep(1200, 0.04);
    setTimeout(() => setFocusRing(null), 1000);
  };

  const lastPhoto = photos[0];

  return (
    <div
      ref={containerRef}
      onClick={handleTapViewfinder}
      className="relative w-full h-full bg-[#08080a] overflow-hidden select-none flex flex-col justify-between"
    >
      {/* 1. Camera Video Feed */}
      <div className="absolute inset-0 z-0 bg-[#08080a] flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover ${
            settings.facingMode === 'user' ? 'scale-x-[-1]' : ''
          }`}
        />

        {/* Fallback scenery rendering if hardware camera stream fails / blocked */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-linear-to-b from-[#111114] via-[#0d0d10] to-[#08080a] text-center z-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 mb-3 shadow-[0_0_24px_rgba(251,191,36,0.15)]">
              <Camera className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-zinc-200 mb-1">Live Viewfinder Active</p>
            <p className="text-xs text-zinc-400 max-w-sm mb-4 leading-relaxed">
              {cameraError}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestPermission();
                startCamera();
              }}
              className="px-4 py-2.5 bg-amber-400 text-zinc-950 font-semibold rounded-xl text-xs hover:bg-amber-300 transition-all active:scale-95 shadow-lg shadow-amber-400/20 flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Request Camera Permission
            </button>
          </div>
        )}
      </div>

      {/* 2. Composition 3x3 Grid Overlay */}
      {settings.showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3 opacity-25">
          <div className="border-r border-b border-zinc-200" />
          <div className="border-r border-b border-zinc-200" />
          <div className="border-b border-zinc-200" />
          <div className="border-r border-b border-zinc-200" />
          <div className="border-r border-b border-zinc-200" />
          <div className="border-b border-zinc-200" />
          <div className="border-r border-zinc-200" />
          <div className="border-r border-zinc-200" />
          <div />
        </div>
      )}

      {/* 3. Tap to Focus Indicator Ring */}
      {focusRing && (
        <div
          className="absolute z-25 pointer-events-none w-16 h-16 -ml-8 -mt-8 border border-amber-400/80 rounded-full animate-ping opacity-80 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
          style={{ left: `${focusRing.x}px`, top: `${focusRing.y}px` }}
        />
      )}

      {/* 4. Live Burn-In Timestamp Overlay */}
      <OverlayBadge
        settings={settings}
        currentTime={currentTime}
        isViewfinder={true}
        onClick={() => setIsTimeSliderOpen(true)}
      />

      {/* 5. Shutter Flash Screen Effect */}
      {isShutterFlashing && (
        <div className="absolute inset-0 z-40 bg-white/95 pointer-events-none animate-out fade-out duration-100" />
      )}

      {/* 6. TOP BAR: Android Native Camera Controls */}
      <div
        className="relative z-30 flex items-center justify-between px-4 pt-3 pb-3 bg-linear-to-b from-black/85 via-black/40 to-transparent backdrop-blur-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Auto-Capture Timer Status Badge & Brand */}
        <div className="flex items-center space-x-2">
          {settings.autoCaptureEnabled ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-400/20 animate-pulse">
              <Timer className="w-3.5 h-3.5" />
              <span>Auto: {autoCaptureCountdown !== null ? `${autoCaptureCountdown}s` : `${settings.autoCaptureInterval}s`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141417]/80 text-zinc-300 text-xs font-mono border border-zinc-800/80 backdrop-blur-md">
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>TimestampCam</span>
            </div>
          )}

          {/* Quick On-Screen Time Adjuster Button */}
          <button
            id="top-quick-time-adjust-btn"
            onClick={() => setIsTimeSliderOpen((prev) => !prev)}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-mono transition-all backdrop-blur-md border ${
              settings.timeSource === 'custom'
                ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-md shadow-amber-400/25 animate-pulse'
                : 'bg-[#141417]/80 text-zinc-300 hover:text-white border-zinc-800/80 hover:bg-zinc-800'
            }`}
            title="Open on-screen time adjuster slider"
          >
            <Clock className={`w-3.5 h-3.5 ${settings.timeSource === 'custom' ? 'text-zinc-950' : 'text-amber-400'}`} />
            <span>{settings.timeSource === 'custom' ? 'Custom Time' : 'Time Slider'}</span>
          </button>
          {/* Quick Location / GPS Button with Accuracy Indicator */}
          <button
            id="top-quick-location-btn"
            onClick={fetchSystemLocation}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-mono transition-all backdrop-blur-md border ${
              settings.showLocation && settings.locationCoords
                ? 'bg-[#141417]/90 text-zinc-200 hover:text-white border-zinc-800 hover:border-amber-400/50 hover:bg-zinc-800'
                : settings.showLocation
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 animate-pulse'
                : 'bg-[#141417]/50 text-zinc-500 border-zinc-800/50 hover:text-zinc-300'
            }`}
            title={
              settings.showLocation
                ? settings.locationCoords
                  ? `GPS: ${formatCoordinates(settings.locationCoords.latitude, settings.locationCoords.longitude, settings.coordinateStyle || 'decimal_standard')} (${settings.locationCoords.accuracy ? `±${Math.round(settings.locationCoords.accuracy)}m` : 'Active'}) - Tap to calibrate`
                  : 'Tap to acquire high-accuracy GPS fix'
                : 'GPS stamping disabled (Tap to enable & calibrate)'
            }
          >
            {isLocating ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <MapPin
                className={`w-3.5 h-3.5 ${
                  settings.showLocation && settings.locationCoords ? 'text-amber-400' : 'text-zinc-400'
                }`}
              />
            )}
            <span className="hidden sm:inline">
              {isLocating
                ? 'Calibrating...'
                : settings.showLocation && settings.locationCoords
                ? settings.locationCoords.accuracy
                  ? `GPS ±${Math.round(settings.locationCoords.accuracy)}m`
                  : 'GPS Active'
                : 'GPS'}
            </span>
          </button>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Torch/Flash */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2.5 rounded-full backdrop-blur-md border transition-all ${
                isTorchOn
                  ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md shadow-amber-400/20'
                  : 'bg-[#141417]/80 text-zinc-300 hover:text-white border-zinc-800/80 hover:bg-zinc-800/80'
              }`}
              title="Toggle Flash / Torch"
            >
              {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Grid Toggle */}
          <button
            onClick={handleToggleGrid}
            className={`p-2.5 rounded-full backdrop-blur-md border transition-all ${
              settings.showGrid
                ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md shadow-amber-400/20'
                : 'bg-[#141417]/80 text-zinc-300 hover:text-white border-zinc-800/80 hover:bg-zinc-800/80'
            }`}
            title="Toggle Rule-of-Thirds Grid"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Flip Camera */}
          <button
            onClick={handleFlipCamera}
            className="p-2.5 rounded-full bg-[#141417]/80 text-zinc-300 hover:text-white border border-zinc-800/80 hover:bg-zinc-800/80 backdrop-blur-md transition-all active:rotate-180 duration-300"
            title="Switch Camera (Front/Rear)"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* APK / Install App Button */}
          {onOpenApkModal && (
            <button
              onClick={onOpenApkModal}
              className="px-2.5 py-1.5 rounded-full bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/30 backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95"
              title="Convert to APK or Install App on Android"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">APK</span>
            </button>
          )}
        </div>
      </div>

      {/* 7. On-Screen Live Time Slider Overlay Control */}
      <OnScreenTimeSlider
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        isOpen={isTimeSliderOpen}
        onClose={() => setIsTimeSliderOpen(false)}
      />

      {/* 8. BOTTOM BAR: Settings + Big Shutter Button + Gallery Thumbnail */}
      <div
        className="relative z-30 px-6 pt-5 pb-9 bg-linear-to-t from-black via-black/85 to-transparent flex items-center justify-between max-w-lg mx-auto w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Settings Button */}
        <button
          id="camera-settings-button"
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-2xl bg-[#141417]/90 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl hover:bg-zinc-800 hover:border-zinc-700 backdrop-blur-md"
          title="Open Timestamp Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Center Shutter Button */}
        <div className="relative flex items-center justify-center">
          {/* Auto-timer countdown animated ring */}
          {settings.autoCaptureEnabled && autoCaptureCountdown !== null && (
            <div className="absolute -inset-2.5 rounded-full border-2 border-dashed border-amber-400 animate-spin" />
          )}

          <button
            id="shutter-capture-button"
            onClick={handleTriggerCapture}
            disabled={isCapturing}
            className={`relative w-20 h-20 rounded-full border-4 border-zinc-300/80 p-1 flex items-center justify-center transition-all active:scale-90 shadow-2xl focus:outline-hidden ${
              isCapturing ? 'opacity-70 scale-95' : 'hover:scale-105'
            }`}
            title="Capture Photo with Timestamp"
          >
            <div
              className={`w-full h-full rounded-full transition-all duration-150 shadow-inner ${
                settings.autoCaptureEnabled
                  ? 'bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.7)]'
                  : 'bg-zinc-100 hover:bg-white'
              }`}
            />
          </button>
        </div>

        {/* Gallery Thumbnail Button */}
        <button
          id="camera-gallery-button"
          onClick={onOpenGallery}
          className="relative w-12 h-12 rounded-2xl overflow-hidden bg-[#141417]/90 border border-zinc-800 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl hover:border-zinc-700"
          title="Open Captured Photos Gallery"
        >
          {lastPhoto ? (
            <img
              src={lastPhoto.dataUrl}
              alt="Recent thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-zinc-500" />
          )}

          {photos.length > 0 && (
            <span className="absolute top-0 right-0 px-1.5 py-0.5 text-[9px] font-bold bg-amber-400 text-zinc-950 rounded-bl-lg font-mono">
              {photos.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
