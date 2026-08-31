import React, { useState, useEffect } from 'react';
import {
  CameraSettings,
  TimestampMode,
  OverlayPosition,
  TextColor,
  BackgroundStyle,
  TimeSource,
  LocationFormat,
  CoordinateStyle,
  AddressDetailLevel
} from '../types';
import { COMMON_DATE_FORMAT_PRESETS } from '../utils/dateFormatter';
import { OverlayBadge } from './OverlayBadge';
import {
  getSystemCoordinates,
  reverseGeocodeCoordinates,
  formatCoordinates,
  searchAddress,
  getGpsAccuracyQuality,
} from '../utils/locationService';
import {
  X,
  Clock,
  Type,
  Move,
  Palette,
  Timer,
  Sliders,
  Check,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  MapPin,
  RefreshCw,
  Navigation,
  Compass,
  Smartphone,
  Download,
  ExternalLink,
  Copy,
  Zap,
  Terminal,
  Search,
  Crosshair,
  Radio,
  LocateFixed,
  Map,
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CameraSettings;
  onUpdateSettings: (newSettings: CameraSettings) => void;
}

const COLOR_OPTIONS: { id: TextColor; label: string; bgClass: string; textClass: string; borderClass: string }[] = [
  { id: 'white', label: 'White', bgClass: 'bg-zinc-100', textClass: 'text-zinc-950', borderClass: 'border-zinc-200' },
  { id: 'yellow', label: 'Yellow', bgClass: 'bg-amber-400', textClass: 'text-zinc-950', borderClass: 'border-amber-400' },
  { id: 'red', label: 'Red', bgClass: 'bg-rose-500', textClass: 'text-white', borderClass: 'border-rose-500' },
  { id: 'green', label: 'Green', bgClass: 'bg-emerald-500', textClass: 'text-zinc-950', borderClass: 'border-emerald-500' },
  { id: 'black', label: 'Black', bgClass: 'bg-zinc-950', textClass: 'text-zinc-100', borderClass: 'border-zinc-700' },
];

const POSITION_OPTIONS: { id: OverlayPosition; label: string; short: string }[] = [
  { id: 'top_left', label: 'Top Left', short: 'TL' },
  { id: 'top_right', label: 'Top Right', short: 'TR' },
  { id: 'bottom_left', label: 'Bottom Left', short: 'BL' },
  { id: 'bottom_right', label: 'Bottom Right', short: 'BR' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'timestamp' | 'location' | 'appearance' | 'autotimer' | 'apk'>('timestamp');
  const [previewTime, setPreviewTime] = useState<Date>(new Date());
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Address search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{
    displayName: string;
    latitude: number;
    longitude: number;
    addressDetails?: any;
  }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Manual Coordinate Input state
  const [manualLat, setManualLat] = useState<string>(
    settings.locationCoords ? String(settings.locationCoords.latitude) : ''
  );
  const [manualLng, setManualLng] = useState<string>(
    settings.locationCoords ? String(settings.locationCoords.longitude) : ''
  );
  const [showManualInputs, setShowManualInputs] = useState<boolean>(false);

  // Sync manual inputs when settings change
  useEffect(() => {
    if (settings.locationCoords) {
      setManualLat(String(settings.locationCoords.latitude));
      setManualLng(String(settings.locationCoords.longitude));
    }
  }, [settings.locationCoords]);

  // Update live preview clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setPreviewTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFetchSystemLocation = async () => {
    setIsLocating(true);
    setLocationStatus('Querying high-precision hardware GPS (zero-cache)...');
    try {
      // Force 0 maxAge to bypass stale cached network coords
      const coords = await getSystemCoordinates(true, 0, 15000);
      setLocationStatus('Resolving street-level address...');
      const address = await reverseGeocodeCoordinates(
        coords.latitude,
        coords.longitude,
        settings.addressDetailLevel || 'detailed_street'
      );
      
      onUpdateSettings({
        ...settings,
        showLocation: true,
        locationSource: 'system',
        locationCoords: coords,
        locationText: address,
      });
      setLocationStatus('High-accuracy GPS lock established!');
      setTimeout(() => setLocationStatus(null), 3500);
    } catch (err: unknown) {
      console.warn('Location retrieval failed:', err);
      const msg = err instanceof Error ? err.message : 'Unable to acquire location';
      setLocationStatus(`GPS error: ${msg}. Try Address Search or Manual Pin below.`);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSearchPlaces = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchAddress(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setLocationStatus('No places found for that query. Try a different city or street.');
      }
    } catch {
      setLocationStatus('Search failed. Check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlace = (item: { displayName: string; latitude: number; longitude: number }) => {
    onUpdateSettings({
      ...settings,
      showLocation: true,
      locationSource: 'custom',
      locationCoords: {
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy: 1, // exact pin
      },
      locationText: item.displayName.split(', ').slice(0, 3).join(', '),
    });
    setSearchResults([]);
    setSearchQuery('');
    setLocationStatus('Location pinned precisely to selected place!');
    setTimeout(() => setLocationStatus(null), 3000);
  };

  const handleApplyManualCoordinates = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Please enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Resolving address for custom coordinates...');
    try {
      const address = await reverseGeocodeCoordinates(
        lat,
        lng,
        settings.addressDetailLevel || 'detailed_street'
      );
      onUpdateSettings({
        ...settings,
        showLocation: true,
        locationSource: 'custom',
        locationCoords: {
          latitude: lat,
          longitude: lng,
          accuracy: 1,
        },
        locationText: address,
      });
      setLocationStatus('Custom GPS coordinates applied!');
      setTimeout(() => setLocationStatus(null), 3000);
    } catch {
      onUpdateSettings({
        ...settings,
        showLocation: true,
        locationSource: 'custom',
        locationCoords: {
          latitude: lat,
          longitude: lng,
        },
      });
    } finally {
      setIsLocating(false);
    }
  };

  if (!isOpen) return null;

  const handleChange = <K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) => {
    onUpdateSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleReset = () => {
    if (confirm('Reset all timestamp settings to factory defaults?')) {
      onUpdateSettings(DEFAULT_SETTINGS);
    }
  };

  return (
    <div
      id="timestamp-settings-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#0f0f13] w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl flex flex-col border border-zinc-800/80 shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header with Android Material 3 Styling */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#131317]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">Camera & Timestamp Settings</h2>
              <p className="text-xs text-zinc-400">Customize overlay, system location & auto-shutter</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="reset-settings-btn"
              onClick={handleReset}
              title="Reset to defaults"
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/80 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              id="close-settings-btn"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="px-6 py-3 bg-[#0a0a0d] border-b border-zinc-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Live Stamp Preview
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              Position: {settings.position.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="relative h-24 w-full bg-[#141418] rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center p-3">
            {/* Background simulated scenery grid */}
            <div className="absolute inset-0 bg-linear-to-br from-[#1c1c22] via-[#121216] to-[#0a0a0d] opacity-90" />
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <div className="w-full h-px bg-white" />
              <div className="h-full w-px bg-white absolute" />
            </div>

            {/* Positioned Live Stamp */}
            <div
              className={`absolute p-2.5 max-w-[90%] pointer-events-none ${
                settings.position === 'top_left'
                  ? 'top-1.5 left-1.5'
                  : settings.position === 'top_right'
                  ? 'top-1.5 right-1.5'
                  : settings.position === 'bottom_left'
                  ? 'bottom-1.5 left-1.5'
                  : 'bottom-1.5 right-1.5'
              }`}
            >
              <OverlayBadge settings={settings} currentTime={previewTime} />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800/80 bg-[#131317] px-4 overflow-x-auto no-scrollbar">
          <button
            id="tab-timestamp-settings"
            onClick={() => setActiveTab('timestamp')}
            className={`flex-1 min-w-[90px] py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'timestamp'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Time</span>
          </button>
          <button
            id="tab-location-settings"
            onClick={() => setActiveTab('location')}
            className={`flex-1 min-w-[95px] py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'location'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Location</span>
          </button>
          <button
            id="tab-appearance-settings"
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 min-w-[95px] py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'appearance'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Style</span>
          </button>
          <button
            id="tab-autotimer-settings"
            onClick={() => setActiveTab('autotimer')}
            className={`flex-1 min-w-[90px] py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'autotimer'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Auto</span>
          </button>
          <button
            id="tab-apk-settings"
            onClick={() => setActiveTab('apk')}
            className={`flex-1 min-w-[110px] py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'apk'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>APK / App</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">
          
          {/* TAB 1: TIMESTAMP MODE & CUSTOM FORMAT */}
          {activeTab === 'timestamp' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* 1. Timestamp Mode Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  1. Timestamp Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    id="mode-date-only"
                    onClick={() => handleChange('mode', 'date_only')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      settings.mode === 'date_only'
                        ? 'border-amber-400/80 bg-amber-400/10 text-white shadow-xs'
                        : 'border-zinc-800 bg-[#16161b] text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-amber-300">Date Only</span>
                      {settings.mode === 'date_only' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[11px] text-zinc-400">e.g. 30 Aug 2026</span>
                  </button>

                  <button
                    type="button"
                    id="mode-datetime"
                    onClick={() => handleChange('mode', 'datetime')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      settings.mode === 'datetime'
                        ? 'border-amber-400/80 bg-amber-400/10 text-white shadow-xs'
                        : 'border-zinc-800 bg-[#16161b] text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-amber-300">Date + Time</span>
                      {settings.mode === 'datetime' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[11px] text-zinc-400">Date + live clock</span>
                  </button>

                  <button
                    type="button"
                    id="mode-custom-text"
                    onClick={() => handleChange('mode', 'custom_text_timestamp')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      settings.mode === 'custom_text_timestamp'
                        ? 'border-amber-400/80 bg-amber-400/10 text-white shadow-xs'
                        : 'border-zinc-800 bg-[#16161b] text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-amber-300">Custom Text + Time</span>
                      {settings.mode === 'custom_text_timestamp' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[11px] text-zinc-400">Title label + timestamp</span>
                  </button>
                </div>
              </div>

              {/* Custom Text Field (If in custom_text_timestamp mode) */}
              {settings.mode === 'custom_text_timestamp' && (
                <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-amber-400" />
                    Custom Text Label / Note
                  </label>
                  <input
                    type="text"
                    id="custom-text-input"
                    value={settings.customText}
                    onChange={(e) => handleChange('customText', e.target.value)}
                    placeholder="e.g. Site Visit - Mumbai Office or Inspection Batch #4"
                    className="w-full bg-[#0d0d10] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-400"
                  />
                  <p className="text-[11px] text-zinc-400">
                    This custom label will be burned alongside the date and time.
                  </p>
                </div>
              )}

              {/* 2. Custom Date/Time Format Field */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    2. Date & Time Format Pattern
                  </label>
                  <span className="text-[11px] text-amber-400/90 font-mono">
                    Editable Pattern
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    id="date-format-input"
                    value={settings.dateFormat}
                    onChange={(e) => handleChange('dateFormat', e.target.value)}
                    placeholder="dd MMM yyyy, hh:mm:ss a"
                    className="w-full bg-[#16161b] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-zinc-500 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                {/* Quick Preset Pattern Chips */}
                <div>
                  <span className="text-[11px] text-zinc-400 block mb-1.5">Quick Format Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_DATE_FORMAT_PRESETS.map((preset) => (
                      <button
                        key={preset.pattern}
                        type="button"
                        onClick={() => handleChange('dateFormat', preset.pattern)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition-colors ${
                          settings.dateFormat === preset.pattern
                            ? 'bg-amber-400 text-zinc-950 font-bold border-amber-400 shadow-sm shadow-amber-400/20'
                            : 'bg-[#1c1c22] text-zinc-300 border-zinc-750 hover:bg-[#24242c]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0c0c0f] p-3 rounded-xl border border-zinc-800/90 text-[11px] text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-300">Format Token Reference:</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
                    <span><code className="text-amber-400">yyyy</code>: 2026, <code className="text-amber-400">yy</code>: 26</span>
                    <span><code className="text-amber-400">MMMM</code>: August, <code className="text-amber-400">MMM</code>: Aug</span>
                    <span><code className="text-amber-400">dd</code>: Day 01-31</span>
                    <span><code className="text-amber-400">HH</code>: 00-23 (24h)</span>
                    <span><code className="text-amber-400">hh</code>: 01-12 (12h)</span>
                    <span><code className="text-amber-400">mm</code>: Min, <code className="text-amber-400">ss</code>: Sec</span>
                    <span><code className="text-amber-400">a</code>: AM / PM</span>
                    <span><code className="text-amber-400">EEEE</code>: Day name</span>
                  </div>
                </div>
              </div>

              {/* Time Source (System Live Time vs Custom Customer Reference Time) */}
              <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-semibold text-white">Time Source</span>
                      <p className="text-[11px] text-zinc-400">Use device live clock or specific reference time</p>
                    </div>
                  </div>
                  
                  <div className="flex rounded-xl bg-[#0e0e11] p-1 border border-zinc-800 text-xs">
                    <button
                      type="button"
                      onClick={() => handleChange('timeSource', 'system')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        settings.timeSource === 'system'
                          ? 'bg-amber-400 text-zinc-950 font-bold shadow-xs'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      System Live
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange('timeSource', 'custom')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        settings.timeSource === 'custom'
                          ? 'bg-amber-400 text-zinc-950 font-bold shadow-xs'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Custom Time
                    </button>
                  </div>
                </div>

                {settings.timeSource === 'custom' && (
                  <div className="pt-2 border-t border-zinc-800 space-y-2 animate-in fade-in">
                    <label className="block text-[11px] font-semibold text-zinc-300">
                      Set Custom Date & Time Value
                    </label>
                    <input
                      type="datetime-local"
                      id="custom-datetime-picker"
                      value={settings.customDateTimeString}
                      onChange={(e) => handleChange('customDateTimeString', e.target.value)}
                      className="w-full bg-[#0d0d10] border border-zinc-750 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-400"
                    />
                    <p className="text-[10px] text-zinc-400">
                      All photos will be stamped with this user-specified customer time instead of current system time.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: SYSTEM LOCATION & GPS */}
          {activeTab === 'location' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Location Master Switch */}
              <div className="bg-[#16161b] p-5 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-bold text-white">System Location & GPS Tagging</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Burn pinpoint GPS coordinates, altitude, and street address directly onto photos
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="show-location-toggle"
                      checked={settings.showLocation}
                      onChange={(e) => handleChange('showLocation', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                  </label>
                </div>

                {/* Sub-controls if location enabled */}
                {settings.showLocation && (
                  <div className="space-y-5 pt-3 border-t border-zinc-800 animate-in fade-in">
                    
                    {/* Live GPS Device Status & Calibration Card */}
                    <div className="bg-[#0e0e12] p-4 rounded-xl border border-zinc-800/90 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          Live GPS Satellite Fix
                        </span>
                        <button
                          type="button"
                          id="refresh-gps-location-btn"
                          onClick={handleFetchSystemLocation}
                          disabled={isLocating}
                          className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                          <span>{isLocating ? 'Calibrating...' : 'Calibrate GPS (Fresh)'}</span>
                        </button>
                      </div>

                      {settings.locationCoords ? (
                        <div className="space-y-2 pt-1 border-t border-zinc-800/60">
                          {/* Accuracy Pill */}
                          {(() => {
                            const quality = getGpsAccuracyQuality(settings.locationCoords.accuracy);
                            return (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-400">Accuracy Status:</span>
                                <span className={`font-semibold flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-[#16161c] border border-zinc-800 ${quality.color}`}>
                                  <LocateFixed className="w-3 h-3" />
                                  {quality.label}
                                </span>
                              </div>
                            );
                          })()}

                          {/* Coordinates readout */}
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-zinc-400">Coordinates:</span>
                            <span className="text-amber-400 font-bold">
                              {formatCoordinates(
                                settings.locationCoords.latitude,
                                settings.locationCoords.longitude,
                                settings.coordinateStyle || 'decimal_standard'
                              )}
                            </span>
                          </div>

                          {/* Altitude & Heading if available */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 pt-1">
                            <div>
                              <span>Altitude: </span>
                              <span className="text-zinc-200">
                                {settings.locationCoords.altitude !== null && settings.locationCoords.altitude !== undefined
                                  ? `${Math.round(settings.locationCoords.altitude)}m MSL`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span>Accuracy: </span>
                              <span className="text-zinc-200">
                                {settings.locationCoords.accuracy !== undefined
                                  ? `±${Math.round(settings.locationCoords.accuracy)}m`
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Resolved address */}
                          {settings.locationText && (
                            <div className="flex items-start justify-between text-xs pt-1.5 border-t border-zinc-800/60">
                              <span className="text-zinc-400 shrink-0 mr-2">Address:</span>
                              <span className="text-zinc-200 text-right font-medium">
                                {settings.locationText}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-400 py-1 flex items-center justify-between">
                          <span>No GPS satellite fix acquired yet.</span>
                          <button
                            type="button"
                            onClick={handleFetchSystemLocation}
                            className="text-amber-400 underline font-semibold text-xs"
                          >
                            Acquire GPS Now
                          </button>
                        </div>
                      )}

                      {locationStatus && (
                        <p className="text-[11px] text-amber-300 bg-amber-400/10 p-2.5 rounded-lg border border-amber-400/20 font-mono animate-in fade-in">
                          {locationStatus}
                        </p>
                      )}

                      {/* Continuous tracking option */}
                      <label className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.continuousGpsTracking !== false}
                          onChange={(e) => handleChange('continuousGpsTracking', e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400"
                        />
                        <span>Continuous Live GPS Tracking (Refines accuracy in real-time)</span>
                      </label>
                    </div>

                    {/* Section: Coordinate Precision & Style */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        GPS Coordinate Format & Precision
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'decimal_standard', label: 'Standard (4 Decimals)', desc: '37.7749° N, 122.4194° W (~11m resolution)' },
                          { id: 'decimal_high_precision', label: 'High Precision (6 Decimals)', desc: '37.774929° N, 122.419416° W (Sub-meter)' },
                          { id: 'dms', label: 'DMS (Deg, Min, Sec)', desc: '37°46\'29.7"N, 122°25\'09.9"W (Survey grade)' },
                          { id: 'raw_decimal', label: 'Raw Decimal (lat, lon)', desc: '37.774929, -122.419416' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleChange('coordinateStyle', item.id as CoordinateStyle)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                              (settings.coordinateStyle || 'decimal_standard') === item.id
                                ? 'border-amber-400 bg-amber-400/10 text-white shadow-xs'
                                : 'border-zinc-800 bg-[#16161b] text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-xs text-amber-300">{item.label}</span>
                              {(settings.coordinateStyle || 'decimal_standard') === item.id && (
                                <Check className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400 leading-tight">{item.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section: Address Detail Level */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Address Detail Granularity
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'detailed_street', label: 'Street & Building', desc: '102 Market St, San Francisco, CA' },
                          { id: 'neighborhood_city', label: 'Neighborhood & City', desc: 'Financial District, San Francisco, CA' },
                          { id: 'city_region', label: 'City & Region', desc: 'San Francisco, California' },
                          { id: 'full_postal', label: 'Full Postal Address', desc: '102 Market St, San Francisco 94105, USA' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={async () => {
                              handleChange('addressDetailLevel', item.id as AddressDetailLevel);
                              if (settings.locationCoords) {
                                const newAddr = await reverseGeocodeCoordinates(
                                  settings.locationCoords.latitude,
                                  settings.locationCoords.longitude,
                                  item.id as AddressDetailLevel
                                );
                                handleChange('locationText', newAddr);
                              }
                            }}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                              (settings.addressDetailLevel || 'detailed_street') === item.id
                                ? 'border-amber-400 bg-amber-400/10 text-white shadow-xs'
                                : 'border-zinc-800 bg-[#16161b] text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-xs text-amber-300">{item.label}</span>
                              {(settings.addressDetailLevel || 'detailed_street') === item.id && (
                                <Check className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400 leading-tight">{item.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section: Display Format On Timestamp */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Overlay Line Format
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'coords_address', label: 'Coords + Address', desc: '37.77° N, 122.41° W • San Francisco' },
                          { id: 'coords_only', label: 'Coordinates Only', desc: '37.7749° N, 122.4194° W' },
                          { id: 'address_only', label: 'Address Only', desc: 'San Francisco, CA' },
                          { id: 'custom', label: 'Custom Place Name', desc: 'Use custom location label below' },
                        ].map((fmt) => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => handleChange('locationFormat', fmt.id as LocationFormat)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                              settings.locationFormat === fmt.id
                                ? 'border-amber-400 bg-amber-400/10 text-white shadow-xs'
                                : 'border-zinc-800 bg-[#16161b] text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-xs text-amber-300">{fmt.label}</span>
                              {settings.locationFormat === fmt.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                            </div>
                            <span className="text-[10px] text-zinc-400 truncate">{fmt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Extra Badges: Altitude & Accuracy Checkboxes */}
                    <div className="bg-[#121216] p-3.5 rounded-xl border border-zinc-800/80 space-y-2">
                      <span className="text-xs font-semibold text-zinc-300 block">
                        Additional Stamped Telemetry
                      </span>
                      <div className="grid grid-cols-2 gap-3 text-xs text-zinc-300">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(settings.includeAltitude)}
                            onChange={(e) => handleChange('includeAltitude', e.target.checked)}
                            className="rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400"
                          />
                          <span>Include Altitude (e.g. Alt: 48m)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(settings.includeAccuracy)}
                            onChange={(e) => handleChange('includeAccuracy', e.target.checked)}
                            className="rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400"
                          />
                          <span>Include GPS Accuracy (e.g. ±4m)</span>
                        </label>
                      </div>
                    </div>

                    {/* Section: Search Worldwide Address / Landmark / Pinpoint */}
                    <div className="bg-[#141419] p-4 rounded-xl border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Search className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pinpoint Place Search / Address Lookup</span>
                        </label>
                        <span className="text-[10px] text-zinc-400">OSM Geocoding</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Indoors or weak GPS? Search any street, landmark, or jobsite to pin coordinates exactly.
                      </p>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchPlaces()}
                          placeholder="e.g. 1600 Amphitheatre Pkwy, Mountain View, or Eiffel Tower"
                          className="flex-1 bg-[#0a0a0d] border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={handleSearchPlaces}
                          disabled={isSearching}
                          className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <Search className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                          <span>{isSearching ? 'Searching...' : 'Search'}</span>
                        </button>
                      </div>

                      {/* Search Results Dropdown List */}
                      {searchResults.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                          <span className="text-[11px] font-semibold text-zinc-400">Select Matching Location:</span>
                          {searchResults.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectPlace(item)}
                              className="w-full text-left p-2.5 rounded-lg bg-[#1a1a22] hover:bg-[#23232e] border border-zinc-800 text-xs transition-all flex items-start gap-2 text-zinc-200"
                            >
                              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-amber-300 truncate">{item.displayName.split(', ')[0]}</p>
                                <p className="text-[10px] text-zinc-400 truncate">{item.displayName}</p>
                                <p className="text-[9px] font-mono text-zinc-500">{item.latitude.toFixed(5)}°, {item.longitude.toFixed(5)}°</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section: Manual Coordinate Input / Fine-Tuning */}
                    <div className="bg-[#141419] p-4 rounded-xl border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setShowManualInputs((prev) => !prev)}
                          className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 hover:text-white"
                        >
                          <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                          <span>Manual Latitude & Longitude Override</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowManualInputs((prev) => !prev)}
                          className="text-[11px] text-amber-400 font-semibold"
                        >
                          {showManualInputs ? 'Hide' : 'Edit Coordinates'}
                        </button>
                      </div>

                      {showManualInputs && (
                        <div className="space-y-3 pt-2 border-t border-zinc-800 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                                Latitude (-90 to 90)
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={manualLat}
                                onChange={(e) => setManualLat(e.target.value)}
                                placeholder="e.g. 37.774929"
                                className="w-full bg-[#0a0a0d] border border-zinc-750 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                                Longitude (-180 to 180)
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={manualLng}
                                onChange={(e) => setManualLng(e.target.value)}
                                placeholder="e.g. -122.419416"
                                className="w-full bg-[#0a0a0d] border border-zinc-750 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-amber-400"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyManualCoordinates}
                            disabled={isLocating}
                            className="w-full py-2 bg-zinc-800 hover:bg-zinc-750 text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Apply Exact Coordinates</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Custom Place / Address Override Field */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-amber-400" />
                        Custom Location / Landmark Label Text
                      </label>
                      <input
                        type="text"
                        id="custom-location-input"
                        value={settings.locationText || ''}
                        onChange={(e) => handleChange('locationText', e.target.value)}
                        placeholder="e.g. North Terminal Site B, Central District"
                        className="w-full bg-[#0d0d10] border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-400"
                      />
                      <p className="text-[11px] text-zinc-400">
                        Customize or override the resolved address text stamped on your photos.
                      </p>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: APPEARANCE & POSITION */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* 3. Overlay Position */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  3. Overlay Position on Photo
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {POSITION_OPTIONS.map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      id={`pos-${pos.id}`}
                      onClick={() => handleChange('position', pos.id)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        settings.position === pos.id
                          ? 'border-amber-400/80 bg-amber-400/10 text-white'
                          : 'border-zinc-800 bg-[#16161b] text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Move className="w-4 h-4 text-amber-400" />
                        <span className="font-medium text-xs">{pos.label}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#1f1f26] text-zinc-400">
                        {pos.short}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Text Appearance: Color & Font Size */}
              <div className="space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  4. Text Appearance & Styling
                </label>

                {/* Text Color Picker */}
                <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-2.5">
                  <span className="text-xs font-semibold text-zinc-300 block">
                    Text Color
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        id={`color-${c.id}`}
                        onClick={() => handleChange('textColor', c.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all ${
                          settings.textColor === c.id
                            ? 'border-amber-400 bg-amber-400/10 scale-105 shadow-xs'
                            : 'border-zinc-800 bg-[#101014] hover:border-zinc-700'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full ${c.bgClass} flex items-center justify-center shadow-md border ${c.borderClass}`}>
                          {settings.textColor === c.id && (
                            <Check className={`w-4 h-4 ${c.textClass}`} />
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-300 font-medium">
                          {c.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size Slider */}
                <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">
                      Font Size
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-lg border border-amber-400/20">
                      {settings.fontSize} px
                    </span>
                  </div>
                  <input
                    type="range"
                    id="font-size-slider"
                    min="14"
                    max="42"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => handleChange('fontSize', parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Small (14px)</span>
                    <span>Medium (24px)</span>
                    <span>Large (42px)</span>
                  </div>
                </div>

                {/* Background Shadow / Pill Style */}
                <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      Overlay Background Style
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'pill', label: 'Dark Pill' },
                      { id: 'shadow', label: 'Drop Shadow' },
                      { id: 'outline', label: 'Outline' },
                      { id: 'none', label: 'Plain' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => handleChange('backgroundStyle', style.id as BackgroundStyle)}
                        className={`py-2 px-1 text-center rounded-xl border text-[11px] transition-all ${
                          settings.backgroundStyle === style.id
                            ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-semibold'
                            : 'border-zinc-800 bg-[#101014] text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: AUTO-CAPTURE TIMER & EXTRA CAMERA OPTIONS */}
          {activeTab === 'autotimer' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* 5. Auto-Capture On A Timer */}
              <div className="bg-[#16161b] p-5 rounded-2xl border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-bold text-white">Auto-Capture Timer</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Automatically takes photos repeatedly at a fixed interval
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="autocapture-toggle"
                      checked={settings.autoCaptureEnabled}
                      onChange={(e) => handleChange('autoCaptureEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                  </label>
                </div>

                {/* Interval seconds input */}
                <div className={`space-y-3 pt-3 border-t border-zinc-800 transition-opacity ${settings.autoCaptureEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <label className="block text-xs font-semibold text-zinc-300">
                    Interval Between Photos (in seconds)
                  </label>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      id="autocapture-interval-input"
                      min="2"
                      max="3600"
                      value={settings.autoCaptureInterval}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleChange('autoCaptureInterval', isNaN(val) ? 10 : Math.max(1, val));
                      }}
                      className="w-28 bg-[#0d0d10] border border-zinc-700 rounded-xl px-3 py-2 text-base font-mono font-bold text-amber-400 text-center focus:outline-hidden focus:border-amber-400"
                    />
                    <span className="text-sm text-zinc-400 font-medium">seconds</span>
                  </div>

                  {/* Quick Interval Preset Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[5, 10, 15, 30, 60, 120].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => handleChange('autoCaptureInterval', sec)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-colors ${
                          settings.autoCaptureInterval === sec
                            ? 'bg-amber-400 text-zinc-950 font-bold border-amber-400 shadow-xs'
                            : 'bg-[#1e1e25] text-zinc-300 border-zinc-750 hover:bg-[#252530]'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-zinc-400 bg-[#0d0d10] p-2.5 rounded-xl border border-zinc-800">
                    💡 When enabled, returning to the camera will immediately start the interval ticker and take stamped photos automatically.
                  </p>
                </div>
              </div>

              {/* Extra Camera Helper Options */}
              <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                  Camera Preferences
                </span>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-medium text-zinc-200">Shutter Audio & Haptics</span>
                    <p className="text-[11px] text-zinc-400">Play click sound on photo capture</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.shutterSound}
                    onChange={(e) => handleChange('shutterSound', e.target.checked)}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t border-zinc-800">
                  <div>
                    <span className="text-xs font-medium text-zinc-200">Composition 3x3 Grid</span>
                    <p className="text-[11px] text-zinc-400">Show rule-of-thirds grid on viewfinder</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showGrid}
                    onChange={(e) => handleChange('showGrid', e.target.checked)}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: CONVERT TO ANDROID APK & INSTALLATION */}
          {activeTab === 'apk' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Recommended 1-click cloud APK card */}
              <div className="bg-amber-400/10 border border-amber-400/20 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Instant 1-Click Android APK (PWABuilder)</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Generate a signed <strong>.apk</strong> or <strong>.aab</strong> package ready for phone installation or Google Play Store. The web manifest and app icons are already configured.
                </p>
                <div className="pt-2">
                  <a
                    href={`https://www.pwabuilder.com/?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href.split('?')[0] : '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-400/20 active:scale-98"
                  >
                    <span>Generate APK on PWABuilder</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Direct WebAPK Install on Android */}
              <div className="bg-[#16161b] p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Direct WebAPK Install (Chrome on Android)</span>
                </div>
                <div className="text-xs text-zinc-300 space-y-1.5 leading-relaxed">
                  <p>1. Open this app's URL in Google Chrome on your Android phone.</p>
                  <p>2. Tap the <strong>⋮</strong> (three dots) menu at top right.</p>
                  <p>3. Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</p>
                  <p>4. Android automatically builds a native WebAPK with full offline camera support.</p>
                </div>
              </div>

              {/* Native Android Studio & Capacitor Build */}
              <div className="bg-[#16161b] p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span>Android Studio / Capacitor Build Commands</span>
                  </div>
                  <button
                    onClick={() => {
                      const text = `npm install @capacitor/core @capacitor/cli @capacitor/android\nnpx cap init "Timestamp Camera" com.timestamp.camera --web-dir=dist\nnpm run build\nnpx cap add android\nnpx cap open android`;
                      navigator.clipboard.writeText(text);
                      setCopiedText('cap_settings');
                      setTimeout(() => setCopiedText(null), 2500);
                    }}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedText === 'cap_settings' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === 'cap_settings' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="bg-[#0a0a0d] p-3 rounded-xl border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                  <pre>{`npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Timestamp Camera" com.timestamp.camera --web-dir=dist
npm run build
npx cap add android
npx cap open android`}</pre>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-[#131317] flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            Auto-saved locally
          </span>
          <button
            type="button"
            id="apply-settings-btn"
            onClick={onClose}
            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-400/20 active:scale-95"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
