export interface MediaFile {
  id: string;
  name: string;
  src: string;
  type: 'video' | 'image' | 'error';
  duration?: number;
  error?: string;
}

export enum Layout {
  Grid = 'grid',
  SideBySide = 'side-by-side',
  TopBottom = 'top-bottom',
}