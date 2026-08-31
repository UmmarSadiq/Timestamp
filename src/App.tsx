import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraSettings, CapturedPhoto } from './types';
import { loadSettings, saveSettings, loadAllPhotos, savePhotoToStorage } from './utils/storage';
import { captureAndBurnImage, savePhotoToDeviceGallery } from './utils/imageBurner';
import { CameraView } from './components/CameraView';
import { SettingsModal } from './components/SettingsModal';
import { GalleryModal } from './components/GalleryModal';
import { InstallApkModal } from './components/InstallApkModal';
import { soundManager } from './utils/cameraAudio';

export default function App() {
  const [settings, setSettings] = useState<CameraSettings>(loadSettings);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
  const [cameraPermissionState, setCameraPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');

  const latestVideoElementRef = useRef<HTMLVideoElement | null>(null);

  // Load saved photos from IndexedDB on startup
  useEffect(() => {
    loadAllPhotos().then((stored) => {
      setPhotos(stored);
    });
  }, []);

  // Request camera permission explicitly on first launch
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((permissionStatus) => {
          setCameraPermissionState(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          permissionStatus.onchange = () => {
            setCameraPermissionState(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          };
        })
        .catch(() => {
          // Fallback if query not supported for camera
        });
    }
  }, []);

  const handleRequestPermission = async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraPermissionState('granted');
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setCameraPermissionState('denied');
    }
  };

  // Update and persist settings
  const handleUpdateSettings = (newSettings: CameraSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Capture photo with burned timestamp
  const handleCapturePhoto = useCallback(
    async (videoElement: HTMLVideoElement | null = latestVideoElementRef.current) => {
      if (isCapturing) return;
      setIsCapturing(true);

      try {
        if (videoElement) {
          latestVideoElementRef.current = videoElement;
        }

        const captureTime = new Date();
        const result = await captureAndBurnImage({
          videoElement: videoElement || latestVideoElementRef.current,
          settings,
          captureTime,
        });

        const newPhoto: CapturedPhoto = {
          id: result.id || `photo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          timestamp: captureTime.getTime(),
          dataUrl: result.dataUrl,
          filename: result.filename,
          formattedTimestamp: result.formattedTimestamp,
          customText: settings.mode === 'custom_text_timestamp' ? settings.customText : undefined,
          locationText: result.locationText,
          coordinates: result.coordinates,
          width: result.width,
          height: result.height,
        };

        // 1. Save photo directly to device gallery (Pictures/TimestampCamera download)
        savePhotoToDeviceGallery(result.dataUrl, result.filename);

        // 2. Persist in IndexedDB
        await savePhotoToStorage(newPhoto);

        // 3. Update in-memory state
        setPhotos((prev) => [newPhoto, ...prev]);
      } catch (error) {
        console.error('Failed to capture and burn photo:', error);
      } finally {
        setIsCapturing(false);
      }
    },
    [isCapturing, settings]
  );

  // Auto-capture interval loop
  useEffect(() => {
    if (!settings.autoCaptureEnabled) {
      setAutoCaptureCountdown(null);
      return;
    }

    const intervalSec = Math.max(1, settings.autoCaptureInterval || 10);
    setAutoCaptureCountdown(intervalSec);

    const intervalId = setInterval(() => {
      setAutoCaptureCountdown((prev) => {
        if (prev === null || prev <= 1) {
          // Trigger capture
          if (settings.shutterSound) {
            soundManager.playShutterSound();
          }
          handleCapturePhoto();
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [settings.autoCaptureEnabled, settings.autoCaptureInterval, settings.shutterSound, handleCapturePhoto]);

  return (
    <div id="timestamp-camera-app" className="relative w-screen h-screen bg-black overflow-hidden select-none">
      {/* Main Fullscreen Camera View */}
      <CameraView
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGallery={() => setIsGalleryOpen(true)}
        onOpenApkModal={() => setIsApkModalOpen(true)}
        onCapture={handleCapturePhoto}
        photos={photos}
        autoCaptureCountdown={autoCaptureCountdown}
        isCapturing={isCapturing}
        cameraPermissionState={cameraPermissionState}
        onRequestPermission={handleRequestPermission}
      />

      {/* Settings Screen */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* In-App Device Gallery */}
      <GalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        photos={photos}
        onPhotosUpdated={setPhotos}
      />

      {/* Convert to APK / Install Modal */}
      <InstallApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </div>
  );
}
