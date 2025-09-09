import React, { useState, useCallback, useRef } from 'react';

interface UploadAreaProps {
  onUpload: (files: File[]) => void;
  isLoading: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onUpload, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
    }
  };

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files) {
      processFiles(event.dataTransfer.files);
    }
  }, []);
  
  const processFiles = (files: FileList) => {
    const mediaFiles = Array.from(files).filter(file => file.type.startsWith('video/') || file.type.startsWith('image/'));
    if (mediaFiles.length > 40) {
        alert("You can upload a maximum of 40 files.");
        onUpload(mediaFiles.slice(0, 40));
    } else if (mediaFiles.length > 0) {
        onUpload(mediaFiles);
    } else {
        alert("No valid video or image files selected.");
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const dropzoneClasses = `flex flex-col items-center justify-center w-full h-full border-4 border-dashed rounded-lg cursor-pointer transition-colors duration-300
    ${isDragging ? 'border-cyan-400 bg-gray-700' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'}`;

  return (
    <div className="flex items-center justify-center w-full h-full" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className={dropzoneClasses} onClick={handleClick}>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="video/*,image/*"
          multiple
          onChange={handleFileChange}
          disabled={isLoading}
        />
        {isLoading ? (
            <div className="flex flex-col items-center justify-center text-gray-400">
                <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-lg">Processing files...</p>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
              <svg className="w-10 h-10 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
              </svg>
              <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-cyan-400">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-gray-500">Up to 40 video or image files</p>
            </div>
        )}
      </div>
    </div>
  );
};