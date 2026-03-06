import React, { useState, useRef, useEffect } from 'react';
import { Layout } from '../types';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { LayoutGridIcon } from './icons/LayoutGridIcon';
import { LayoutHorizontalIcon } from './icons/LayoutHorizontalIcon';
import { LayoutVerticalIcon } from './icons/LayoutVerticalIcon';
import { LoopIcon } from './icons/LoopIcon';
import { ExportIcon } from './icons/ExportIcon';
import { ClearIcon } from './icons/ClearIcon';
import { Tooltip } from './Tooltip';
import { SegmentedControl } from './SegmentedControl';


interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  isLooping: boolean;
  onLoopToggle: () => void;
  progress: number;
  onSeek: (value: number) => void;
  duration: number;
  currentLayout: Layout;
  onLayoutChange: (layout: Layout) => void;
  onClear: () => void;
  videoCount: number;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  onExport: () => void;
  isExporting: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlayPause,
  isLooping,
  onLoopToggle,
  progress,
  onSeek,
  duration,
  currentLayout,
  onLayoutChange,
  onClear,
  videoCount,
  playbackRate,
  onPlaybackRateChange,
  onExport,
  isExporting,
}) => {
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  const playbackRates = [2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.25];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setIsSpeedMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity) {
      return '00:00';
    }
    const rounded = Math.round(time);
    const minutes = Math.floor(rounded / 60);
    const seconds = rounded % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(parseFloat(e.target.value));
  };
  
  const layoutOptions = [
    { value: Layout.Grid, Icon: LayoutGridIcon, label: 'Grid' },
    { value: Layout.SideBySide, Icon: LayoutHorizontalIcon, label: 'Side-by-Side', disabled: videoCount < 2 },
    { value: Layout.TopBottom, Icon: LayoutVerticalIcon, label: 'Top/Bottom', disabled: videoCount < 2 },
  ];

  return (
    <div className="flex flex-col space-y-3">
      {/* Progress Bar */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-mono w-12 text-right" style={{color:'var(--text-color)'}}>{formatTime(progress)}</span>
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={progress}
          onChange={handleSeekChange}
          disabled={isExporting}
          className={`w-full h-2 bg-[var(--track-color)] rounded-lg appearance-none cursor-pointer range-thumb ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ '--thumb-color': 'var(--accent-color)', accentColor: 'var(--accent-color)' } as React.CSSProperties}
        />
        <span className="text-xs font-mono w-12 text-left" style={{color:'var(--text-color)'}}>{formatTime(duration)}</span>
      </div>
      <style>{`
        .range-thumb::-webkit-slider-thumb { background-color: var(--thumb-color); }
        .range-thumb::-moz-range-thumb { background-color: var(--thumb-color); }
      `}</style>
      
      {/* Main Controls */}
      <div className="grid items-center gap-4 w-full" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        {/* Left Side: Layout Controls */}
        <SegmentedControl
          value={currentLayout}
          onChange={onLayoutChange}
          options={layoutOptions.map(opt => ({ ...opt, disabled: opt.disabled || isExporting }))}
          showLabels={false}
          className={`justify-self-start max-w-max ${isExporting ? 'opacity-50 pointer-events-none' : ''}`}
        />
        
        {/* Center: Play/Pause */}
        <button 
            onClick={onPlayPause} 
            disabled={isExporting}
            className={`icon-btn p-3 transition-transform transform hover:scale-110 shadow-xl justify-self-center ${isExporting ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
        >
          {isPlaying ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
        </button>
        
        {/* Right Side: Loop & Clear */}
        <div className="flex items-center space-x-2 justify-self-end whitespace-nowrap">
          <div className="relative" ref={speedMenuRef}>
            {isSpeedMenuOpen && (
              <div className="absolute bottom-full mb-2 w-28 popover z-10 overflow-hidden">
                <ul>
                  {playbackRates.map(rate => (
                    <li key={rate}>
                      <button
                        onClick={() => {
                          onPlaybackRateChange(rate);
                          setIsSpeedMenuOpen(false);
                        }}
                        disabled={isExporting}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          playbackRate === rate
                            ? 'bg-[var(--active)] text-[var(--text-color)]'
                            : 'text-[var(--text-color)] hover:bg-[var(--control-hover)]'
                        }`}
                      >
                        {rate === 1 ? 'Normal' : `${rate}x`}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Tooltip text="Playback speed">
              <button
                onClick={() => setIsSpeedMenuOpen(prev => !prev)}
                disabled={isExporting}
                aria-label="Playback speed"
                className={`px-3 py-2 min-w-[60px] text-center transition-colors pill text-sm ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {`${playbackRate}x`}
              </button>
            </Tooltip>
          </div>
          <Tooltip text={isLooping ? "Disable loop" : "Enable loop"}>
            <button
              onClick={onLoopToggle}
              disabled={isExporting}
              aria-label={isLooping ? "Disable loop" : "Enable loop"}
              className={`pill p-2 transition-colors ${isLooping ? 'pill-active' : ''} ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <LoopIcon className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip text={videoCount < 2 ? "Add more videos to export" : "Export video"}>
            <button
              onClick={onExport}
              disabled={isExporting || videoCount < 2}
              aria-label="Export video"
              className={`pill p-2 transition-colors ${isExporting || videoCount < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ExportIcon className={`w-5 h-5 ${isExporting ? 'animate-pulse' : ''}`} />
            </button>
          </Tooltip>
          <Tooltip text="Clear all">
            <button 
              onClick={onClear} 
              disabled={isExporting}
              aria-label="Clear all"
              className={`bg-red-500/80 hover:bg-red-500 text-white rounded-full p-2 transition-colors ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ClearIcon className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
