import React, { forwardRef, useState, useEffect, useCallback } from 'react';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { CloseIcon } from './icons/CloseIcon';
import { ErrorIcon } from './icons/ErrorIcon';
import { MediaFile } from '../types';
import { CameraIcon } from './icons/CameraIcon';

interface MediaPlayerProps {
  media: MediaFile;
  isMuted?: boolean;
  onDelete: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, MediaPlayerProps>(
  ({ media, isMuted = true, onDelete }, forwardedRef) => {
    const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);
    const [isPaused, setIsPaused] = useState(true);

    const setRefs = useCallback((node: HTMLVideoElement | null) => {
      if (media.type === 'video') {
        setVideoNode(node);
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      }
    }, [forwardedRef, media.type]);

    const handleTogglePlay = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!videoNode) return;
      if (videoNode.paused) {
        const playPromise = videoNode.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name !== 'AbortError') {
              console.error("Individual video play failed:", error);
            }
          });
        }
      } else {
        videoNode.pause();
      }
    };

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
    };

    const handleScreenshot = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!videoNode) return;
    
      const originalTime = videoNode.currentTime;
      const wasPaused = videoNode.paused;
    
      const onSeeked = () => {
          try {
              const canvas = document.createElement('canvas');
              canvas.width = videoNode.videoWidth;
              canvas.height = videoNode.videoHeight;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                  alert('Could not create screenshot.');
                  return;
              }
              ctx.drawImage(videoNode, 0, 0, canvas.width, canvas.height);
              
              const link = document.createElement('a');
              const baseName = media.name.lastIndexOf('.') > 0 
                  ? media.name.substring(0, media.name.lastIndexOf('.')) 
                  : media.name;
              link.download = `${baseName}-1.png`;
              link.href = canvas.toDataURL('image/png');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } catch (error) {
              console.error('Error capturing screenshot:', error);
              alert('Failed to capture screenshot.');
          } finally {
              // Restore video state
              videoNode.currentTime = originalTime;
              if (!wasPaused) {
                  videoNode.play().catch(e => console.error("Failed to resume playback", e));
              }
          }
      };
    
      if (!wasPaused) {
          videoNode.pause();
      }
    
      // Add event listener that will run only once
      videoNode.addEventListener('seeked', onSeeked, { once: true });
      
      // If we are already at the beginning, the 'seeked' event might not fire.
      // In that case, we can call it directly.
      if (videoNode.currentTime === 0) {
          videoNode.removeEventListener('seeked', onSeeked); // remove listener since we are calling it manually
          onSeeked();
      } else {
          videoNode.currentTime = 0;
      }
    };

    useEffect(() => {
      if (!videoNode) return;
      const onPlay = () => setIsPaused(false);
      const onPause = () => setIsPaused(true);
      videoNode.addEventListener('play', onPlay);
      videoNode.addEventListener('pause', onPause);
      setIsPaused(videoNode.paused);
      return () => {
        videoNode.removeEventListener('play', onPlay);
        videoNode.removeEventListener('pause', onPause);
      };
    }, [videoNode]);

    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl group">
        {media.type === 'video' && (
          <video
            ref={setRefs}
            src={media.src}
            muted={isMuted}
            className="w-full h-full object-contain"
            style={{ backgroundColor: 'var(--media-bg)' }}
          />
        )}
        {media.type === 'image' && (
          <img 
            src={media.src}
            alt={media.name}
            className="w-full h-full object-contain"
            style={{ backgroundColor: 'var(--media-bg)' }}
          />
        )}
        {media.type === 'error' && (
           <div className="w-full h-full flex flex-col items-center justify-center glass p-4 text-center">
            <ErrorIcon className="w-10 h-10 mb-3 text-red-500" />
            <p className="text-xs mt-1 break-all font-semibold" title={media.name} style={{color: 'var(--text-color)'}}>{media.name}</p>
            <p className="text-xs mt-2" style={{color: 'var(--text-color)'}}>{media.error}</p>
        </div>
        )}

        <div className="absolute inset-0 transition-opacity duration-300 flex items-center justify-center pointer-events-none" style={{ backgroundColor: 'transparent' }}>
          
          {/* Top-right: Delete Button (always available) */}
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto z-20">
             <button 
                onClick={handleDelete} 
                title="Remove file" 
                className="transition-colors icon-btn p-1.5 hover:text-red-500"
                aria-label="Remove file"
              >
                <CloseIcon className="w-4 h-4" />
             </button>
          </div>
          
          {/* Elements for valid media types only */}
          {media.type !== 'error' && (
            <>
              {/* Top-left: Filename */}
              <div className="absolute top-0 left-0 right-16 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                <span className="label-chip select-none max-w-full truncate inline-block" title={media.name}>
                  {media.name}
                </span>
              </div>
            
              {/* Center: Play/Pause Button (only for videos) */}
              {media.type === 'video' && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
                  <button 
                    onClick={handleTogglePlay} 
                    title={isPaused ? "Play" : "Pause"} 
                    aria-label={isPaused ? "Play video" : "Pause video"}
                    className="icon-btn p-4 transition-transform hover:scale-110"
                  >
                    {isPaused ? <PlayIcon className="w-10 h-10" /> : <PauseIcon className="w-10 h-10" />}
                  </button>
                </div>
              )}

              {/* Bottom-left: Screenshot Button (only for videos) */}
              {media.type === 'video' && (
                <div className="absolute bottom-0 left-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
                    <button 
                      onClick={handleScreenshot} 
                      title="Get screenshot (first frame)" 
                      className="transition-colors icon-btn p-1.5"
                      aria-label="Get screenshot of first frame"
                    >
                      <CameraIcon className="w-4 h-4" />
                   </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    );
  }
);
