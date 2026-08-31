export type TimestampMode = 'date_only' | 'datetime' | 'custom_text_timestamp';

export type OverlayPosition = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';

export type TextColor = 'white' | 'yellow' | 'red' | 'green' | 'black';

export type BackgroundStyle = 'shadow' | 'pill' | 'outline' | 'none';

export type TimeSource = 'system' | 'custom';

export type LocationFormat = 'coords_address' | 'coords_only' | 'address_only' | 'custom';

export type CoordinateStyle = 'decimal_standard' | 'decimal_high_precision' | 'dms' | 'raw_decimal';

export type AddressDetailLevel = 'detailed_street' | 'neighborhood_city' | 'city_region' | 'full_postal';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

export interface CameraSettings {
  mode: TimestampMode;
  customText: string;
  dateFormat: string;
  timeSource: TimeSource;
  customDateTimeString: string; // Used when timeSource is 'custom'
  position: OverlayPosition;
  fontSize: number; // e.g. 14 to 48
  textColor: TextColor;
  backgroundStyle: BackgroundStyle;
  // System Location Settings
  showLocation: boolean;
  locationSource: 'system' | 'custom';
  locationText: string;
  locationCoords?: LocationCoordinates;
  locationFormat: LocationFormat;
  coordinateStyle?: CoordinateStyle;
  addressDetailLevel?: AddressDetailLevel;
  includeAltitude?: boolean;
  includeAccuracy?: boolean;
  continuousGpsTracking?: boolean;
  // Camera & Capture Settings
  autoCaptureEnabled: boolean;
  autoCaptureInterval: number; // in seconds
  facingMode: 'environment' | 'user';
  showGrid: boolean;
  shutterSound: boolean;
  highResolution: boolean;
}

export interface CapturedPhoto {
  id: string;
  timestamp: number;
  dataUrl: string;
  filename: string;
  formattedTimestamp: string;
  customText?: string;
  locationText?: string;
  coordinates?: LocationCoordinates;
  width: number;
  height: number;
}
