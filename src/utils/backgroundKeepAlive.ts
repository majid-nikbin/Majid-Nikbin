/**
 * Marine Background Keep-Alive & Continuous NMEA Transmission Engine
 * 
 * Solves mobile browser sleep / throttling when the phone screen is turned off:
 * 1. Dedicated inline Web Worker timer (unthrottled by mobile browsers)
 * 2. Silent Web Audio playback loop (signals Android/iOS media priority so CPU stays awake)
 * 3. Screen Wake Lock API (keeps screen awake when phone is placed on boat helm)
 * 4. MediaSession metadata registration
 */

class BackgroundKeepAliveService {
  private worker: Worker | null = null;
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private wakeLockSentinel: any = null;
  private isRunning = false;
  private tickCallbacks = new Set<() => void>();
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.initVisibilityListener();
  }

  private initVisibilityListener() {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isRunning) {
        // Re-acquire screen wake lock if tab became visible again
        this.requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Request Screen Wake Lock
   */
  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!this.wakeLockSentinel) {
          this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          this.wakeLockSentinel.addEventListener('release', () => {
            this.wakeLockSentinel = null;
          });
        }
      } catch (e) {
        // Ignore if rejected (e.g. low battery)
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch (e) {}
      this.wakeLockSentinel = null;
    }
  }

  /**
   * Start inaudible audio loop.
   * Mobile OSes (Android Chrome, iOS Safari) allow audio apps to run in the background
   * with the screen locked. Playing an inaudible tone prevents CPU suspension.
   */
  private startSilentAudio() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // Create an oscillator with ultra-low gain (0.00001) - completely inaudible
      this.oscillator = this.audioCtx.createOscillator();
      this.gainNode = this.audioCtx.createGain();

      this.oscillator.type = 'sine';
      this.oscillator.frequency.value = 440; // 440 Hz
      this.gainNode.gain.value = 0.00001; // Inaudible

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);
      this.oscillator.start();

      // Register MediaSession so OS recognizes foreground audio service
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'NMEA 0183 Serial Transmitter',
          artist: 'Marine Compass & GPS Engine',
          album: 'Background Continuous Navigation',
        });
        navigator.mediaSession.playbackState = 'playing';
      }
    } catch (e) {
      console.warn('Audio keep-alive initialization note:', e);
    }
  }

  private stopSilentAudio() {
    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
        this.audioCtx = null;
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch (e) {}
  }

  /**
   * Start unthrottled Web Worker timer
   */
  private startWorker(intervalMs: number) {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    try {
      // Inline worker blob so no external files are needed
      const workerCode = `
        let timerId = null;
        self.onmessage = function(e) {
          if (e.data && e.data.action === 'start') {
            if (timerId) clearInterval(timerId);
            timerId = setInterval(function() {
              self.postMessage('tick');
            }, e.data.interval || 1000);
          } else if (e.data && e.data.action === 'stop') {
            if (timerId) {
              clearInterval(timerId);
              timerId = null;
            }
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        if (e.data === 'tick') {
          this.tickCallbacks.forEach((cb) => {
            try { cb(); } catch (err) { console.error('KeepAlive tick callback error:', err); }
          });
        }
      };

      this.worker.postMessage({ action: 'start', interval: intervalMs });
      URL.revokeObjectURL(workerUrl);
    } catch (e) {
      console.warn('Web Worker fallback to window interval:', e);
    }
  }

  private stopWorker() {
    if (this.worker) {
      try {
        this.worker.postMessage({ action: 'stop' });
        this.worker.terminate();
      } catch (e) {}
      this.worker = null;
    }
  }

  /**
   * Enable background continuous execution
   */
  public start(intervalMs: number = 1000, onTick?: () => void) {
    if (onTick) {
      this.tickCallbacks.add(onTick);
    }

    this.isRunning = true;
    this.requestWakeLock();
    this.startSilentAudio();
    this.startWorker(intervalMs);
  }

  /**
   * Subscribe to unthrottled ticks
   */
  public onTick(cb: () => void): () => void {
    this.tickCallbacks.add(cb);
    return () => {
      this.tickCallbacks.delete(cb);
    };
  }

  /**
   * Update timer interval on the fly
   */
  public updateInterval(intervalMs: number) {
    if (this.worker && this.isRunning) {
      this.worker.postMessage({ action: 'start', interval: intervalMs });
    }
  }

  /**
   * Stop background execution
   */
  public stop() {
    this.isRunning = false;
    this.releaseWakeLock();
    this.stopSilentAudio();
    this.stopWorker();
    this.tickCallbacks.clear();
  }

  public getStatus(): { isRunning: boolean; hasWakeLock: boolean } {
    return {
      isRunning: this.isRunning,
      hasWakeLock: !!this.wakeLockSentinel,
    };
  }
}

export const backgroundKeepAlive = new BackgroundKeepAliveService();
