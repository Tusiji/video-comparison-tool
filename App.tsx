import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadArea } from './components/UploadArea';
import { VideoPlayer } from './components/VideoPlayer';
import { Controls } from './components/Controls';
import { Layout, MediaFile } from './types';

const App: React.FC = () => {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [layout, setLayout] = useState<Layout>(Layout.Grid);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [shortestDuration, setShortestDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedMediaId, setDraggedMediaId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [shortestVideoId, setShortestVideoId] = useState<string | null>(null);

  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const dragCounter = useRef(0);
  
  const processMediaFile = (file: File): Promise<MediaFile> => {
    return new Promise((resolve) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const id = `${file.name}-${Date.now()}`;
      const src = URL.createObjectURL(file);

      if (type === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          if (isFinite(video.duration)) {
            resolve({
              id,
              name: file.name,
              src,
              type: 'video',
              duration: video.duration,
            });
          } else {
            URL.revokeObjectURL(src);
            resolve({
              id,
              name: file.name,
              src: '',
              type: 'error',
              error: 'Could not determine video duration.',
            });
          }
        };
        video.onerror = () => {
          URL.revokeObjectURL(src);
          resolve({
            id,
            name: file.name,
            src: '',
            type: 'error',
            error: 'Unsupported format or file is corrupt.',
          });
        };
        video.src = src;
      } else { // It's an image
        const img = new Image();
        img.onload = () => {
            resolve({
                id,
                name: file.name,
                src,
                type: 'image',
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(src);
            resolve({
                id,
                name: file.name,
                src: '',
                type: 'error',
                error: 'Could not load image file.',
            });
        };
        img.src = src;
      }
    });
  };

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setIsLoading(true);
    setIsPlaying(false);
    setProgress(0);

    // Clean up old object URLs
    media.forEach(m => m.src && URL.revokeObjectURL(m.src));

    try {
      const processedMedia = await Promise.all(files.map(processMediaFile));
      const validMedia = processedMedia.filter(m => m.type !== 'error');
      const erroredMedia = processedMedia.filter(m => m.type === 'error');

      if (erroredMedia.length > 0) {
        const errorMessages = erroredMedia.map(m => `  - ${m.name}: ${m.error}`).join('\n');
        alert(`Some files could not be loaded:\n${errorMessages}`);
      }
      
      if (validMedia.length === 0) {
        setMedia(erroredMedia); // Show errors even if no files are valid
        setIsLoading(false);
        return;
      }

      setMedia([...validMedia, ...erroredMedia]);
      
      const videos = validMedia.filter(m => m.type === 'video');
      const videoDurations = videos.map(v => v.duration as number);
      const minDuration = videoDurations.length > 0 ? Math.min(...videoDurations) : 0;
      setShortestDuration(minDuration);

      const shortestVideo = videos.find(v => v.duration === minDuration);
      setShortestVideoId(shortestVideo ? shortestVideo.id : null);
      
      if (validMedia.length === 2) {
        setLayout(Layout.SideBySide);
      } else {
        setLayout(Layout.Grid);
      }
    } catch (error) {
      console.error(error);
      alert('An unexpected error occurred during file processing. Please check the console.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppendVideos = async (files: File[]) => {
    const availableSlots = 40 - media.length;
    if (availableSlots <= 0) {
      alert("Maximum of 40 media files is already loaded.");
      return;
    }

    setIsLoading(true);

    const filesToAdd = files.slice(0, availableSlots);

    if (files.length > filesToAdd.length) {
      alert(`You can only add ${availableSlots} more file(s). ${filesToAdd.length} file(s) were added.`);
    }

    try {
      const processedMedia = await Promise.all(filesToAdd.map(processMediaFile));
      const validMedia = processedMedia.filter(m => m.type !== 'error');
      const erroredMedia = processedMedia.filter(m => m.type === 'error');

      if (erroredMedia.length > 0) {
        const errorMessages = erroredMedia.map(m => `  - ${m.name}: ${m.error}`).join('\n');
        alert(`Some new files could not be loaded:\n${errorMessages}`);
      }

      if (validMedia.length === 0 && erroredMedia.length === 0) {
        setIsLoading(false);
        return;
      }
      
      setMedia(prevMedia => {
        const combined = [...prevMedia, ...validMedia, ...erroredMedia];
        const videos = combined.filter(m => m.type === 'video' && m.duration);
        const videoDurations = videos.map(v => v.duration as number);
        const newMinDuration = videoDurations.length > 0 ? Math.min(...videoDurations) : 0;
        
        setShortestDuration(newMinDuration);
        const shortestVideo = videos.find(v => v.duration === newMinDuration);
        setShortestVideoId(shortestVideo ? shortestVideo.id : null);
        
        return combined;
      });

    } catch (error) {
      console.error(error);
      alert('An unexpected error occurred while adding new files.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSeek = useCallback((newTime: number) => {
    setProgress(newTime);
    videoRefs.current.forEach(videoEl => {
      if (videoEl) {
        videoEl.currentTime = newTime;
      }
    });
  }, []);

  const handlePlayPause = useCallback(() => {
    if (media.some(m => m.type === 'video')) {
      // If playback is finished and user clicks play, restart from the beginning.
      if (!isPlaying && shortestDuration > 0 && progress >= shortestDuration) {
        handleSeek(0);
      }
      setIsPlaying(prev => !prev);
    }
  }, [media, isPlaying, progress, shortestDuration, handleSeek]);

  const handleClear = () => {
    setIsPlaying(false);
    media.forEach(m => m.src && URL.revokeObjectURL(m.src));
    setMedia([]);
    videoRefs.current.clear();
    setShortestDuration(0);
    setShortestVideoId(null);
    setProgress(0);
    setPlaybackRate(1);
  };
  
  const handleDeleteMedia = (idToDelete: string) => {
    const mediaToDelete = media.find(m => m.id === idToDelete);
    if (mediaToDelete?.src) {
        URL.revokeObjectURL(mediaToDelete.src);
    }
    
    videoRefs.current.delete(idToDelete);

    const newMedia = media.filter(m => m.id !== idToDelete);
    
    if (newMedia.length === 0) {
        handleClear();
    } else {
        const videos = newMedia.filter(m => m.type === 'video');
        const videoDurations = videos.map(v => v.duration as number);
        const minDuration = videoDurations.length > 0 ? Math.min(...videoDurations) : 0;
        setShortestDuration(minDuration);

        const shortestVideo = videos.find(v => v.duration === minDuration);
        setShortestVideoId(shortestVideo ? shortestVideo.id : null);

        if (progress >= minDuration) {
            handleSeek(minDuration);
        }
        setMedia(newMedia);
    }
  };

  const getLayoutStyles = () => {
    const count = media.length;
    switch (layout) {
      case Layout.SideBySide:
        return {
          container: 'flex flex-row overflow-x-auto overflow-y-hidden h-full gap-2',
          item: `flex-shrink-0 h-full ${count === 1 ? 'w-full' : (count === 2 ? 'w-[calc(50%-0.25rem)]' : 'w-[48vw]')}`,
          containerStyle: {},
        };
      case Layout.TopBottom:
        return {
          container: 'flex flex-col overflow-y-auto overflow-x-hidden h-full gap-2',
          item: `flex-shrink-0 w-full ${count === 1 ? 'h-full' : (count === 2 ? 'h-[calc(50%-0.25rem)]' : 'h-[48vh]')}`,
          containerStyle: {},
        };
      case Layout.Grid:
      default:
        const gridClasses = 'grid gap-2 h-full';
        const itemClasses = 'w-full h-full min-h-0';
        let containerStyle: React.CSSProperties = {};

        if (count > 0) {
          const cols = Math.ceil(Math.sqrt(count));
          const rows = Math.ceil(count / cols);
          containerStyle.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
          containerStyle.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
        }
        return { container: gridClasses, item: itemClasses, containerStyle };
    }
  };

  // Effect for handling the 'ended' event to robustly manage playback completion.
  useEffect(() => {
    if (!shortestVideoId) return;
    
    const shortestVideo = videoRefs.current.get(shortestVideoId);
    if (!shortestVideo) return;

    const handleVideoEnded = () => {
      if (isLooping) {
        videoRefs.current.forEach(el => { 
          if(el) { 
            el.currentTime = 0;
            const playPromise = el.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                if (error.name !== 'AbortError') {
                  console.error("Video loop play interrupted:", error);
                }
              });
            }
          } 
        });
        setProgress(0);
      } else {
        setIsPlaying(false);
        handleSeek(shortestDuration);
      }
    };

    shortestVideo.addEventListener('ended', handleVideoEnded);
    return () => {
      if (shortestVideo) {
        shortestVideo.removeEventListener('ended', handleVideoEnded);
      }
    };
  }, [shortestVideoId, isLooping, shortestDuration, handleSeek]);

  // Effect for progress updates via the standard 'timeupdate' event.
  useEffect(() => {
    if (!shortestVideoId) return;
    const shortestVideo = videoRefs.current.get(shortestVideoId);
    if (!shortestVideo) return;
    
    const handleTimeUpdate = () => {
      // Cap progress at the shortest duration to keep the UI consistent
      // for videos of different lengths.
      const newProgress = Math.min(shortestVideo.currentTime, shortestDuration);
      setProgress(newProgress);
    };
    
    shortestVideo.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      if (shortestVideo) {
        shortestVideo.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [shortestVideoId, shortestDuration]);

  // Effect for playing/pausing videos.
  useEffect(() => {
    if (isPlaying) {
      videoRefs.current.forEach(videoEl => {
        if (videoEl?.paused) {
          const playPromise = videoEl.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              if (error.name !== 'AbortError') {
                console.error("Error attempting to play video:", error);
              }
            });
          }
        }
      });
    } else {
      videoRefs.current.forEach(videoEl => {
        if (videoEl && !videoEl.paused) {
          videoEl.pause();
        }
      });
    }
  }, [isPlaying]);
  
  // Effect for playback rate.
  useEffect(() => {
    videoRefs.current.forEach(videoEl => {
      if (videoEl) {
        videoEl.playbackRate = playbackRate;
      }
    });
  }, [playbackRate, media]);

  const { container: containerClasses, item: itemClasses, containerStyle } = getLayoutStyles();

  // Handlers for adding new files via drag-drop
  const handleFileDragEnter = (e: React.DragEvent) => {
    if (draggedMediaId) return; // Don't interfere with reordering
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0 && media.length > 0 && media.length < 40) {
      setIsDragging(true);
    }
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    if (draggedMediaId) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    if (draggedMediaId) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };
  
  const handleFileDrop = (e: React.DragEvent) => {
    if (draggedMediaId) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (media.length > 0 && e.dataTransfer.files) {
      const mediaFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('video/') || file.type.startsWith('image/'));
      if (mediaFiles.length > 0) {
        handleAppendVideos(mediaFiles);
      }
    }
  };


  // Handlers for reordering media
  const handleReorderDragStart = (e: React.DragEvent, mediaId: string) => {
    e.dataTransfer.setData('mediaId', mediaId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedMediaId(mediaId);
  };
  
  const handleReorderDragOver = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (draggedMediaId && draggedMediaId !== targetId && dropTargetId !== targetId) {
        setDropTargetId(targetId);
      }
  };

  const handleReorderDrop = (e: React.DragEvent, dropTargetId: string) => {
      e.preventDefault();
      e.stopPropagation(); // Prevents file drop handler on parent from firing
      const draggedId = e.dataTransfer.getData('mediaId');
      if (draggedId && draggedId !== dropTargetId) {
          setMedia(currentMedia => {
              const draggedIndex = currentMedia.findIndex(v => v.id === draggedId);
              const targetIndex = currentMedia.findIndex(v => v.id === dropTargetId);

              if (draggedIndex === -1 || targetIndex === -1) {
                  return currentMedia;
              }

              const newMedia = [...currentMedia];
              const [draggedItem] = newMedia.splice(draggedIndex, 1);
              newMedia.splice(targetIndex, 0, draggedItem);
              return newMedia;
          });
      }
      setDraggedMediaId(null);
      setDropTargetId(null);
  };

  const handleReorderDragEnd = () => {
      setDraggedMediaId(null);
      setDropTargetId(null);
  };

  return (
    <div 
      className="relative flex flex-col h-screen font-sans"
      style={{ backgroundColor: 'var(--bg-base)', backgroundImage: 'var(--bg-gradient-radial)', color: 'var(--text-color)' }}
      onDragEnter={handleFileDragEnter}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
    >
      <main className="flex-grow p-4 overflow-hidden flex flex-col">
        {media.length === 0 ? (
          <UploadArea onUpload={handleUpload} isLoading={isLoading} />
        ) : (
          <div className="flex-grow flex flex-col h-full min-h-0">
            <div 
              className={`flex-grow min-h-0 ${containerClasses}`}
              style={containerStyle}
              onDragLeave={() => setDropTargetId(null)}
            >
              {media.map(mediaItem => (
                <div 
                  key={mediaItem.id} 
                  className={`${itemClasses} video-reorder-item relative cursor-grab transition-all duration-300 ease-in-out ${draggedMediaId === mediaItem.id ? 'opacity-40 scale-95 z-10 cursor-grabbing' : 'opacity-100 scale-100'}`}
                  draggable
                  onDragStart={(e) => handleReorderDragStart(e, mediaItem.id)}
                  onDragOver={(e) => handleReorderDragOver(e, mediaItem.id)}
                  onDrop={(e) => handleReorderDrop(e, mediaItem.id)}
                  onDragEnd={handleReorderDragEnd}
                  data-is-dragging={draggedMediaId === mediaItem.id}
                >
                  <VideoPlayer
                    media={mediaItem}
                    ref={el => {
                      if (mediaItem.type === 'video') {
                        if (el) {
                          videoRefs.current.set(mediaItem.id, el);
                        } else {
                          videoRefs.current.delete(mediaItem.id);
                        }
                      }
                    }}
                    isMuted={true}
                    onDelete={() => handleDeleteMedia(mediaItem.id)}
                  />
                  {dropTargetId === mediaItem.id && draggedMediaId !== mediaItem.id && (
                    <div className="absolute inset-1 pointer-events-none rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--active)] backdrop-blur-sm"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {media.some(m => m.type !== 'error') && (
        <footer className="w-full p-4">
          <div className="glass p-4">
            <Controls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            isLooping={isLooping}
            onLoopToggle={() => setIsLooping(p => !p)}
            progress={progress}
            onSeek={handleSeek}
            duration={shortestDuration}
            currentLayout={layout}
            onLayoutChange={setLayout}
            onClear={handleClear}
            videoCount={media.length}
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
            />
          </div>
        </footer>
      )}
       {/* Special case footer for only-error states */}
       {media.length > 0 && media.every(m => m.type === 'error') && (
         <footer className="w-full p-4 flex justify-end">
            <button onClick={handleClear} className="bg-red-500/80 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-full transition-colors text-sm">
              Clear
            </button>
         </footer>
       )}


      {isDragging && media.length > 0 && media.length < 40 && (
        <div
          className="absolute inset-0 backdrop-blur-sm flex items-center justify-center z-50 border-2 border-dashed border-[var(--border-strong)] rounded-2xl m-4 bg-[var(--overlay)]"
        >
          <div className="text-center">
            <h2 className="text-3xl font-bold" style={{color: 'var(--text-color)'}}>Drop to Add Files</h2>
            <p className="mt-2" style={{color: 'var(--text-color)'}}>You can add up to {40 - media.length} more file(s).</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
