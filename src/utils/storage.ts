import { CameraSettings, CapturedPhoto } from '../types';
export { savePhotoToDeviceGallery } from './imageBurner';

const SETTINGS_STORAGE_KEY = 'timestamp_camera_settings_v1';
const DB_NAME = 'TimestampCameraDB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

export const DEFAULT_SETTINGS: CameraSettings = {
  mode: 'datetime',
  customText: 'Site Visit - Main Office',
  dateFormat: 'dd MMM yyyy, hh:mm:ss a',
  timeSource: 'system',
  customDateTimeString: new Date().toISOString().slice(0, 16),
  position: 'bottom_right',
  fontSize: 22,
  textColor: 'white',
  backgroundStyle: 'pill',
  showLocation: true,
  locationSource: 'system',
  locationText: '',
  locationFormat: 'coords_address',
  coordinateStyle: 'decimal_standard',
  addressDetailLevel: 'detailed_street',
  includeAltitude: false,
  includeAccuracy: false,
  continuousGpsTracking: true,
  autoCaptureEnabled: false,
  autoCaptureInterval: 10,
  facingMode: 'environment',
  showGrid: false,
  shutterSound: true,
  highResolution: true,
};

export function loadSettings(): CameraSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to read settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: CameraSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings to localStorage', e);
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePhotoToStorage(photo: CapturedPhoto): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(photo);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save photo to IndexedDB:', err);
  }
}

export async function loadAllPhotos(): Promise<CapturedPhoto[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = (request.result as CapturedPhoto[]) || [];
        // Sort descending by timestamp (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to load photos from IndexedDB:', err);
    return [];
  }
}

export async function deletePhotoFromStorage(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to delete photo from IndexedDB:', err);
  }
}

export async function clearAllPhotos(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to clear photos from IndexedDB:', err);
  }
}
