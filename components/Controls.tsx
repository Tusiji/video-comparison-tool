import React, { useState, useRef, useEffect } from 'react';
import { Layout } from '../types';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { LayoutGridIcon } from './icons/LayoutGridIcon';
import { LayoutHorizontalIcon } from './icons/LayoutHorizontalIcon';
import { LayoutVerticalIcon } from './icons/LayoutVerticalIcon';
import { LoopIcon } from './icons/LoopIcon';
import { Tooltip } from './Tooltip';


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
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(parseFloat(e.target.value));
  };
  
  const layoutButtons = [
    { type: Layout.Grid, Icon: LayoutGridIcon, label: 'Grid' },
    { type: Layout.SideBySide, Icon: LayoutHorizontalIcon, label: 'Side-by-Side' },
    { type: Layout.TopBottom, Icon: LayoutVerticalIcon, label: 'Top/Bottom' },
  ];

  return (
    <div className="flex flex-col space-y-3">
      {/* Progress Bar */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-mono w-12 text-right">{formatTime(progress)}</span>
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={progress}
          onChange={handleSeekChange}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-thumb"
          style={{ '--thumb-color': '#22d3ee' } as React.CSSProperties}
        />
        <span className="text-xs font-mono w-12 text-left">{formatTime(duration)}</span>
      </div>
      <style>{`
        .range-thumb::-webkit-slider-thumb { background-color: var(--thumb-color); }
        .range-thumb::-moz-range-thumb { background-color: var(--thumb-color); }
      `}</style>
      
      {/* Main Controls */}
      <div className="flex justify-between items-center">
        {/* Left Side: Layout Controls */}
        <div className="flex items-center space-x-2">
            {layoutButtons.map(({ type, Icon, label }) => (
                <Tooltip key={type} text={label}>
                    <button
                        onClick={() => onLayoutChange(type)}
                        disabled={videoCount < 2 && (type === Layout.SideBySide || type === Layout.TopBottom)}
                        aria-label={label}
                        className={`p-2 rounded-md transition-colors ${
                            currentLayout === type
                                ? 'bg-cyan-500 text-white'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <Icon className="w-5 h-5" />
                    </button>
                </Tooltip>
            ))}
        </div>
        
        {/* Center: Play/Pause */}
        <button onClick={onPlayPause} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold p-3 rounded-full transition-transform transform hover:scale-110">
          {isPlaying ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
        </button>
        
        {/* Right Side: Loop & Clear */}
        <div className="flex items-center space-x-2">
          <div className="relative" ref={speedMenuRef}>
            {isSpeedMenuOpen && (
              <div className="absolute bottom-full mb-2 w-28 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-10 overflow-hidden">
                <ul>
                  {playbackRates.map(rate => (
                    <li key={rate}>
                      <button
                        onClick={() => {
                          onPlaybackRateChange(rate);
                          setIsSpeedMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          playbackRate === rate
                            ? 'bg-cyan-500 text-white'
                            : 'text-gray-200 hover:bg-gray-700'
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
                aria-label="Playback speed"
                className="px-3 py-2 min-w-[60px] text-center rounded-md transition-colors bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm"
              >
                {`${playbackRate}x`}
              </button>
            </Tooltip>
          </div>
          <Tooltip text={isLooping ? "Disable loop" : "Enable loop"}>
            <button
              onClick={onLoopToggle}
              aria-label={isLooping ? "Disable loop" : "Enable loop"}
              className={`p-2 rounded-md transition-colors ${
                  isLooping
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <LoopIcon className="w-5 h-5" />
            </button>
          </Tooltip>
          <button onClick={onClear} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm">
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};
