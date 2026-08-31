/**
 * Web Audio API synthesized camera shutter sound
 * Does not require external audio assets and works offline/instantly.
 */
class CameraSoundManager {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playShutterSound(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. Shutter mechanical click (burst 1)
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(3, now);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.8, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      whiteNoise.start(now);

      // 2. High snap click
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now + 0.03);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.09);

      oscGain.gain.setValueAtTime(0.5, now + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now + 0.03);
      osc.stop(now + 0.12);

      // Trigger haptic vibration on Android
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([40, 30, 60]);
      }
    } catch {
      // Audio or vibration not permitted or supported
    }
  }

  public playBeep(freq = 880, duration = 0.08): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(25);
      }
    } catch {
      // ignore
    }
  }
}

export const soundManager = new CameraSoundManager();
