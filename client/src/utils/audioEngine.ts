/**
 * audioEngine.ts
 * Web Audio API 四种音效引擎
 * 1. 待机嗡鸣（80Hz低频）
 * 2. 预警雷达声（2kHz嘀嘀×3）
 * 3. 阀门咔哒声（机械噪声）
 * 4. 完成确认音（iOS风格"叮"C5→C6）
 */

class AudioEngine {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** 1. 待机嗡鸣 — 返回stop函数 */
  playIdleHum(): () => void {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.frequency.value = 80;
      osc.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      gain.gain.value = 0;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      // fade in
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.5);

      return () => {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
        osc.stop(ctx.currentTime + 1);
      };
    } catch {
      return () => {};
    }
  }

  /** 2. 预警雷达声 — 嘀嘀嘀×3 */
  playAlertBeep(): void {
    try {
      const ctx = this.getCtx();
      [0, 0.22, 0.44].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 2000;
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(ctx.destination);

        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.12);
      });
    } catch {}
  }

  /** 3. 阀门咔哒声 — 机械白噪声低通 */
  playValveClick(): void {
    try {
      const ctx = this.getCtx();
      const sampleRate = ctx.sampleRate;
      const bufferSize = Math.floor(sampleRate * 0.08);
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;

      const gain = ctx.createGain();
      gain.gain.value = 0.12;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {}
  }

  /** 4. 完成确认音 — C5→C6 叮 */
  playSuccessChime(): void {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);       // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.12); // C6

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } catch {}
  }
}

// singleton
export const audio = new AudioEngine();
