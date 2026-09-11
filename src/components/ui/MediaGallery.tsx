import { useState } from 'react';
import { AlertTriangle, X, ZoomIn } from 'lucide-react';
import type { MediaItem } from '../../data/types';
import { cn } from '../../lib/cn';

interface Props {
  media: MediaItem[];
  className?: string;
}

export function MediaGallery({ media, className }: Props) {
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);

  if (media.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">No media attached.</p>
    );
  }

  return (
    <>
      <div className={cn('grid gap-2', media.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3', className)}>
        {media.map(item => (
          <div key={item.id} className="relative group">
            <button
              onClick={() => setLightbox(item)}
              className="relative w-full aspect-video overflow-hidden rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`View image${item.isRecycled ? ' — potential recycled media' : ''}`}
            >
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
                onError={e => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x225/e2e8f0/94a3b8?text=Image';
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
              </div>
            </button>

            {item.isRecycled && (
              <div
                className="absolute top-1.5 left-1.5 right-1.5 bg-amber-900/90 text-amber-100 text-xs font-medium px-2 py-1 rounded flex items-center gap-1.5"
                role="alert"
              >
                <AlertTriangle size={11} aria-hidden />
                Potential recycled media
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightbox(null)}
            aria-label="Close image"
          >
            <X size={24} />
          </button>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            {lightbox.isRecycled && (
              <div className="mb-3 bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} aria-hidden />
                {lightbox.recycledNote}
              </div>
            )}
            <img
              src={lightbox.url}
              alt=""
              className="w-full rounded-lg max-h-[80vh] object-contain"
              onError={e => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/800x450/e2e8f0/94a3b8?text=Image+not+available';
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
