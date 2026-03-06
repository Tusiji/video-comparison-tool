import { Layout, MediaFile } from '../types';

interface ExportOptions {
    layout: Layout;
    width?: number;
    height?: number;
    frameRate?: number;
    duration: number;
    onProgress?: (progress: number) => void;
    onComplete?: (blob: Blob, fps?: number) => void;
    onError?: (error: any) => void;
}

export class VideoExporter {
    private media: MediaFile[];
    private videoRefs: Map<string, HTMLVideoElement | null>;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private mediaRecorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private isRecording: boolean = false;
    private animationFrameId: number | null = null;
    private startTime: number = 0;
    private measuredFps: number | null = null;

    constructor(
        media: MediaFile[],
        videoRefs: Map<string, HTMLVideoElement | null>
    ) {
        this.media = media;
        this.videoRefs = videoRefs;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d')!;
    }

    private getSupportedMimeType(): string {
        const types = [
            'video/mp4',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return '';
    }

    public async export(options: ExportOptions) {
        const {
            layout,
            width = 1920,
            height = 1080,
            frameRate = 30,
            duration,
            onProgress,
            onComplete,
            onError
        } = options;

        if (duration <= 0) {
            onError?.(new Error("Invalid duration"));
            return;
        }

        const mimeType = this.getSupportedMimeType();
        if (!mimeType) {
            onError?.(new Error("No supported video mime type found"));
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;

        // Prepare videos
        const videos = Array.from(this.videoRefs.values()).filter((v): v is HTMLVideoElement => v !== null);
        if (videos.length === 0) {
            onError?.(new Error("No videos to export"));
            return;
        }

        try {
            // Pause and Seek to 0
            await Promise.all(videos.map(v => {
                v.pause();
                v.currentTime = 0;
                return new Promise<void>(resolve => {
                    const onSeeked = () => {
                        v.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    v.addEventListener('seeked', onSeeked);
                    // Force seek if already at 0, or just resolve if it doesn't fire?
                    // Safe to just set currentTime = 0 and wait.
                    // But if it's already 0, seeked might not fire in some browsers?
                    // Let's rely on a timeout fallback just in case.
                    setTimeout(resolve, 500); 
                });
            }));
        } catch (e) {
            console.warn("Seek error or timeout", e);
        }

        let targetFrameRate = frameRate;
        try {
            await Promise.all(videos.map(v => v.play().catch(() => {})));
            const measured = await this.estimateMaxFrameRate(videos, 7, 800);
            videos.forEach(v => v.pause());
            videos.forEach(v => { try { v.currentTime = 0; } catch(_) {} });
            if (measured && isFinite(measured) && measured > 0) {
                // Snap common broadcast rates to exact canonical values to avoid tiny mismatches:
                // 23.976 -> 24, 29.97 -> 30, 59.94 -> 60 (tolerances allow slight probe noise)
                const snapFps = (fps: number) => {
                    if (Math.abs(fps - 23.976) < 0.3 || Math.abs(fps - 24) < 0.2) return 24;
                    if (Math.abs(fps - 29.97)  < 0.3 || Math.abs(fps - 30) < 0.2) return 30;
                    if (Math.abs(fps - 59.94)  < 0.4 || Math.abs(fps - 60) < 0.3) return 60;
                    return Math.round(fps);
                };
                targetFrameRate = Math.min(60, Math.max(24, snapFps(measured)));
                this.measuredFps = targetFrameRate;
            }
        } catch (_) {
            this.measuredFps = null;
        }

        this.stream = this.canvas.captureStream(targetFrameRate);
        
        try {
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType,
                videoBitsPerSecond: 8000000 // 8 Mbps
            });
        } catch (e) {
            onError?.(e);
            return;
        }

        const chunks: Blob[] = [];
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        this.mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            onComplete?.(blob, this.measuredFps ?? targetFrameRate);
            this.cleanup();
        };

        // Align start: wait until all videos are ready and actually playing, then start recording
        const waitForEvent = (el: HTMLMediaElement, event: string, timeout = 2000) =>
            new Promise<void>(resolve => {
                let done = false;
                const handler = () => {
                    if (done) return;
                    done = true;
                    el.removeEventListener(event, handler);
                    resolve();
                };
                el.addEventListener(event, handler, { once: true });
                setTimeout(() => {
                    if (!done) {
                        el.removeEventListener(event, handler);
                        resolve();
                    }
                }, timeout);
            });

        await Promise.all(videos.map(v => waitForEvent(v, 'canplay')));
        await Promise.all(videos.map(v => new Promise<void>(resolve => {
            const onSeeked = () => {
                v.removeEventListener('seeked', onSeeked);
                resolve();
            };
            v.addEventListener('seeked', onSeeked, { once: true });
            try { v.currentTime = 0; } catch(_) {}
            setTimeout(resolve, 300);
        })));
        // Ensure all videos are paused exactly at 0 before recording begins
        videos.forEach(v => { try { v.pause(); } catch(_) {} });
        videos.forEach(v => { v.playbackRate = 1; (v as any).muted = true; });

        // Start recording first so the very first drawn frame (t=0) is captured
        this.mediaRecorder.start();
        this.isRecording = true;
        this.startTime = performance.now();

        // Compute an effective duration using the actual video elements to avoid metadata rounding mismatches
        const localMinDuration = Math.min(
            ...videos.map(v => (Number.isFinite(v.duration) ? v.duration : Infinity))
        );
        const effectiveDuration = Math.min(duration, localMinDuration);
        const fpsForWindow = (this.measuredFps ?? targetFrameRate) || 30;
        const frameWindow = 1 / fpsForWindow; // ~1 frame duration tolerance

        const draw = () => {
            if (!this.isRecording) return;

            const elapsed = (performance.now() - this.startTime) / 1000;

            // Gentle clock-sync: keep each video close to the shared master clock (elapsed)
            // Small playbackRate nudges reduce long-term drift without noticeable artifacts
            videos.forEach(v => {
                const drift = (v.currentTime || 0) - elapsed;
                if (Number.isFinite(drift)) {
                    if (drift > frameWindow) {
                        // video runs ahead; slow down slightly
                        v.playbackRate = 0.98;
                    } else if (drift < -frameWindow) {
                        // video lags; speed up slightly
                        v.playbackRate = 1.02;
                    } else {
                        v.playbackRate = 1;
                    }
                }
                // Near the end of its own duration, freeze to last frame to avoid tail overshoot
                const vd = Number.isFinite(v.duration) ? v.duration : Infinity;
                if (elapsed >= vd - frameWindow) {
                    try { v.pause(); } catch(_) {}
                    v.playbackRate = 1;
                }
            });

            // Draw background
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, width, height);

            // Draw videos based on layout
            this.drawVideos(layout, width, height);

            if (onProgress) {
                onProgress(Math.min(elapsed / effectiveDuration, 1));
            }

            // Stop slightly before/at the effective min duration boundary to prevent showing extra frames
            if (elapsed >= effectiveDuration - frameWindow * 0.5) {
                this.stop();
                return;
            }

            this.animationFrameId = requestAnimationFrame(draw);
        };

        // Kick off drawing immediately to capture first frame at t=0 while videos are paused
        draw();

        // Then start playback; we don't wait for 'playing' to avoid skipping first frame in recording
        videos.forEach(v => {
            v.play().catch(() => {});
        });
        // draw loop continues
    }

    private drawVideos(layout: Layout, canvasWidth: number, canvasHeight: number) {
        // Filter only valid videos that are currently in the DOM/refs
        // We need to map media items to positions
        const activeMedia = this.media.filter(m => this.videoRefs.has(m.id) && this.videoRefs.get(m.id));
        const count = activeMedia.length;

        if (count === 0) return;

        let cols = 1;
        let rows = 1;

        if (layout === Layout.SideBySide) {
             // In App.tsx, SideBySide is usually for 2 items.
             // If more, it overflows. For export, we fit them all horizontally?
             // Or we respect the "2 items side-by-side" intent if count is 2.
             // If count > 2, App.tsx makes them scroll. 
             // Let's assume the user wants to see all of them.
             cols = count;
             rows = 1;
        } else if (layout === Layout.TopBottom) {
             cols = 1;
             rows = count;
        } else {
             // Grid
             cols = Math.ceil(Math.sqrt(count));
             rows = Math.ceil(count / cols);
        }

        const cellWidth = canvasWidth / cols;
        const cellHeight = canvasHeight / rows;

        activeMedia.forEach((mediaItem, index) => {
            const videoEl = this.videoRefs.get(mediaItem.id);
            if (!videoEl) return;

            const col = index % cols;
            const row = Math.floor(index / cols);

            const x = col * cellWidth;
            const y = row * cellHeight;

            this.drawImageContain(videoEl, x, y, cellWidth, cellHeight);
            const fontSize = Math.max(10, Math.min(18, Math.round(canvasHeight * 0.018)));
            const dot = mediaItem.name.lastIndexOf('.');
            const baseName = dot > 0 ? mediaItem.name.slice(0, dot) : mediaItem.name;
            this.drawLabel(baseName, x + 8, y + 8, cellWidth - 16, fontSize);
        });
    }

    private drawImageContain(img: HTMLVideoElement, x: number, y: number, w: number, h: number) {
        if (img.videoWidth === 0 || img.videoHeight === 0) return;

        const imgRatio = img.videoWidth / img.videoHeight;
        const targetRatio = w / h;

        let drawW, drawH, drawX, drawY;

        if (imgRatio > targetRatio) {
            // Image is wider than target
            drawW = w;
            drawH = w / imgRatio;
            drawX = x;
            drawY = y + (h - drawH) / 2;
        } else {
            // Image is taller than target
            drawH = h;
            drawW = h * imgRatio;
            drawX = x + (w - drawW) / 2;
            drawY = y;
        }

        this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }

    private drawLabel(text: string, x: number, y: number, maxWidth: number, fontSize: number) {
        this.ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'left';
        let displayText = text;
        const ellipsis = '…';
        while (this.ctx.measureText(displayText).width > maxWidth && displayText.length > 1) {
            displayText = displayText.slice(0, -2) + ellipsis;
        }
        const metrics = this.ctx.measureText(displayText);
        const paddingX = Math.max(6, Math.round(fontSize * 0.6));
        const paddingY = Math.max(2, Math.round(fontSize * 0.3));
        const bgW = Math.ceil(metrics.width + paddingX * 2);
        const bgH = Math.ceil(fontSize + paddingY * 2);
        this.drawRoundedRect(x, y, bgW, bgH, Math.max(6, Math.round(fontSize * 0.5)));
        this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.ctx.fill();
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(displayText, x + paddingX, y + paddingY);
    }

    private drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
        const ctx = this.ctx;
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
    }

    private async estimateMaxFrameRate(videos: HTMLVideoElement[], sampleFrames = 6, timeoutMs = 700): Promise<number> {
        const measures = await Promise.all(videos.map(v => this.measureVideoFPS(v, sampleFrames, timeoutMs).catch(() => 0)));
        const max = Math.max(...measures, 0);
        return max || 30;
    }

    private async measureVideoFPS(video: HTMLVideoElement, sampleFrames: number, timeoutMs: number): Promise<number> {
        const rvfc = (video as any).requestVideoFrameCallback?.bind(video);
        if (!rvfc) return 30;
        return new Promise<number>(resolve => {
            let count = 0;
            let first: number | null = null;
            let last: number | null = null;
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                if (first !== null && last !== null && last > first && count > 1) {
                    const fps = (count - 1) / (last - first);
                    resolve(fps);
                } else {
                    resolve(30);
                }
            };
            const timer = setTimeout(finish, timeoutMs);
            const cb = (_now: any, metadata: any) => {
                const t = typeof metadata?.mediaTime === 'number' ? metadata.mediaTime : null;
                if (t !== null) {
                    if (first === null) first = t;
                    last = t;
                }
                count++;
                if (count >= sampleFrames) {
                    clearTimeout(timer);
                    finish();
                } else {
                    rvfc(cb);
                }
            };
            rvfc(cb);
        });
    }

    public stop() {
        if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.videoRefs.forEach(video => {
            if (video) video.pause();
        });
    }

    private cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}
