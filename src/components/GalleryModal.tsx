import React, { useState } from 'react';
import { CapturedPhoto } from '../types';
import { deletePhotoFromStorage, clearAllPhotos } from '../utils/storage';
import { savePhotoToDeviceGallery } from '../utils/imageBurner';
import {
  X,
  Download,
  Share2,
  Trash2,
  Calendar,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  CheckCircle,
  FolderDown,
  MapPin
} from 'lucide-react';

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: CapturedPhoto[];
  onPhotosUpdated: (photos: CapturedPhoto[]) => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  isOpen,
  onClose,
  photos,
  onPhotosUpdated,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedPhoto = selectedPhotoIndex !== null ? photos[selectedPhotoIndex] : null;

  const showToast = (msg: string) => {
    setDownloadSuccessToast(msg);
    setTimeout(() => setDownloadSuccessToast(null), 2500);
  };

  const handleDownload = (photo: CapturedPhoto) => {
    savePhotoToDeviceGallery(photo.dataUrl, photo.filename);
    showToast(`Saved to Pictures/TimestampCamera!`);
  };

  const handleDownloadAll = () => {
    photos.forEach((p, idx) => {
      setTimeout(() => {
        savePhotoToDeviceGallery(p.dataUrl, p.filename);
      }, idx * 250);
    });
    showToast(`Saving ${photos.length} photos to gallery...`);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this photo from app gallery?')) {
      await deletePhotoFromStorage(id);
      const updated = photos.filter((p) => p.id !== id);
      onPhotosUpdated(updated);
      if (selectedPhotoIndex !== null) {
        if (updated.length === 0) {
          setSelectedPhotoIndex(null);
        } else {
          setSelectedPhotoIndex(Math.min(selectedPhotoIndex, updated.length - 1));
        }
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm(`Delete all ${photos.length} photos from timestamp gallery?`)) {
      await clearAllPhotos();
      onPhotosUpdated([]);
      setSelectedPhotoIndex(null);
    }
  };

  const handleShare = async (photo: CapturedPhoto) => {
    try {
      if (navigator.share && navigator.canShare) {
        // Convert dataUrl to blob for native share
        const res = await fetch(photo.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], photo.filename, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Timestamp Camera Photo',
            text: photo.formattedTimestamp,
          });
          return;
        }
      }
      handleDownload(photo);
    } catch {
      handleDownload(photo);
    }
  };

  return (
    <div
      id="timestamp-gallery-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#0f0f13] w-full h-full sm:h-[90vh] sm:max-w-4xl sm:rounded-3xl flex flex-col border border-zinc-800/80 shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Gallery Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-[#131317]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Device Gallery
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#1d1d24] text-amber-400 font-mono border border-zinc-700/50">
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">Folder: Pictures/TimestampCamera</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {photos.length > 0 && (
              <>
                <button
                  id="save-all-photos-btn"
                  onClick={handleDownloadAll}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a20] hover:bg-[#23232b] text-xs font-semibold text-zinc-200 rounded-xl transition-all border border-zinc-700/80 active:scale-95"
                >
                  <FolderDown className="w-3.5 h-3.5 text-amber-400" />
                  Save All
                </button>
                <button
                  id="clear-all-photos-btn"
                  onClick={handleClearAll}
                  title="Clear all photos"
                  className="p-2 text-zinc-400 hover:text-rose-400 rounded-xl hover:bg-zinc-800/80 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              id="close-gallery-btn"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {downloadSuccessToast && (
          <div className="bg-amber-400 text-zinc-950 px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 animate-in slide-in-from-top duration-150">
            <CheckCircle className="w-4 h-4" />
            {downloadSuccessToast}
          </div>
        )}

        {/* Main Body: Grid or Empty State */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0c0c0f]">
          {photos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#17171d] border border-zinc-800 flex items-center justify-center text-zinc-500">
                <ImageIcon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-300">No photos captured yet</p>
                <p className="text-xs text-zinc-500 max-w-xs mt-1">
                  Take photos with the shutter button or enable auto-timer to start saving timestamped photos.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className="group relative aspect-4/3 bg-[#16161c] rounded-2xl overflow-hidden border border-zinc-800/80 cursor-pointer hover:border-amber-400/60 transition-all hover:scale-[1.02] shadow-md"
                >
                  <img
                    src={photo.dataUrl}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Subtle gradient vignette overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                  
                  {/* Info label on thumbnail */}
                  <div className="absolute bottom-2 left-2 right-2 flex flex-col text-[10px] text-white">
                    <span className="font-mono truncate font-medium text-amber-300">
                      {photo.formattedTimestamp}
                    </span>
                    <span className="text-zinc-400 text-[9px]">
                      {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lightbox / Fullscreen Viewer */}
        {selectedPhoto && selectedPhotoIndex !== null && (
          <div className="fixed inset-0 z-60 bg-black/95 flex flex-col animate-in fade-in duration-150">
            {/* Lightbox Header */}
            <div className="flex items-center justify-between p-4 bg-[#0e0e12]/90 border-b border-zinc-800/80 z-10">
              <div className="flex items-center space-x-3 truncate">
                <button
                  onClick={() => setSelectedPhotoIndex(null)}
                  className="p-2 text-zinc-300 hover:text-white rounded-xl hover:bg-zinc-800"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="truncate">
                  <p className="text-xs font-mono text-white truncate">{selectedPhoto.filename}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{selectedPhoto.formattedTimestamp}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleShare(selectedPhoto)}
                  title="Share Photo"
                  className="p-2.5 text-zinc-300 hover:text-white rounded-xl bg-[#181820] border border-zinc-700/80 hover:bg-zinc-800 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownload(selectedPhoto)}
                  title="Download to Gallery"
                  className="p-2.5 text-zinc-950 font-bold bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg shadow-amber-400/20 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(selectedPhoto.id)}
                  title="Delete Photo"
                  className="p-2.5 text-rose-400 hover:text-rose-300 rounded-xl bg-[#181820] border border-zinc-700/80 hover:bg-zinc-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Main Image */}
            <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden bg-[#070709]">
              <img
                src={selectedPhoto.dataUrl}
                alt={selectedPhoto.filename}
                className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none"
              />

              {/* Prev / Next controls */}
              {selectedPhotoIndex > 0 && (
                <button
                  onClick={() => setSelectedPhotoIndex(selectedPhotoIndex - 1)}
                  className="absolute left-4 p-3 rounded-2xl bg-black/70 text-white hover:bg-black/90 border border-zinc-800/80 backdrop-blur-sm transition-all active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {selectedPhotoIndex < photos.length - 1 && (
                <button
                  onClick={() => setSelectedPhotoIndex(selectedPhotoIndex + 1)}
                  className="absolute right-4 p-3 rounded-2xl bg-black/70 text-white hover:bg-black/90 border border-zinc-800/80 backdrop-blur-sm transition-all active:scale-95"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Lightbox Footer Details */}
            <div className="p-3.5 bg-[#0e0e12] border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 px-6">
              <span className="font-mono">
                {selectedPhotoIndex + 1} of {photos.length}
              </span>
              {selectedPhoto.locationText && (
                <span className="flex items-center gap-1 text-zinc-300 font-mono text-[11px] truncate max-w-[280px]">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{selectedPhoto.locationText}</span>
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className="font-mono text-zinc-500 hidden sm:inline">
                  {selectedPhoto.width} &times; {selectedPhoto.height} px
                </span>
                <span className="text-amber-400/90 font-medium font-mono text-[11px] bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  Timestamp Burned
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
