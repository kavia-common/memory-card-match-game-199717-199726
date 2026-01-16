/**
 * Sound manager using Web Audio API to generate game sound effects
 * without requiring external assets.
 * 
 * Includes synthesis for:
 * - Flip (short tick)
 * - Match (major triad)
 * - Mismatch (low buzzer)
 * - Win (victory fanfare)
 */

let audioCtx = null;
let isMuted = false;

const VOLUMES = {
  flip: 0.15,
  match: 0.15,
  mismatch: 0.15,
  win: 0.25
};

// Simple synthesizer configurations
const synth = {
  flip: (ctx) => {
    // High-pitched "tick"
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(VOLUMES.flip, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  },
  
  match: (ctx) => {
    // Happy major triad (C-E-G)
    const notes = [523.25, 659.25, 783.99];
    const now = ctx.currentTime;
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = now + (i * 0.06);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(VOLUMES.match, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  },
  
  mismatch: (ctx) => {
    // Distinct mismatch: descending buzzer.
    //
    // Bugfix note:
    // Some devices (especially phones/laptops) attenuate low frequencies heavily.
    // The previous 350Hz -> 100Hz sweep could be perceived as "silent". We move
    // the sweep slightly higher and use a stronger envelope so it cuts through.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Gentle lowpass to avoid an overly harsh sawtooth while keeping loudness.
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.Q.setValueAtTime(0.7, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sawtooth";

    // Sweep kept above very low-end where small speakers drop off.
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.24);

    // Stronger attack + slightly longer release for audibility.
    const peak = Math.min(0.35, VOLUMES.mismatch * 1.7);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.32);
  },
  
  win: (ctx) => {
    // Victory fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
    const now = ctx.currentTime;
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'square'; // chiptune style
      osc.frequency.value = freq;
      
      // Arpeggio timing
      const startTime = now + (i * 0.12);
      const duration = i === notes.length - 1 ? 0.6 : 0.15;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(VOLUMES.win, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    });
  }
};

let lastFlipTime = 0;

// PUBLIC_INTERFACE
export const soundManager = {
  /**
   * Initialize AudioContext. Must be called after user interaction.
   */
  init: () => {
    if (typeof window === 'undefined') return;
    
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    // Resume if suspended (browser policy)
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  },

  /**
   * Enable or disable sound output.
   * @param {boolean} muted 
   */
  setMuted: (muted) => {
    isMuted = muted;
  },

  /**
   * Play a sound effect.
   * @param {'flip' | 'match' | 'mismatch' | 'win'} effectName 
   */
  play: (effectName) => {
    if (isMuted) return;
    
    // Attempt auto-init
    soundManager.init();
    if (!audioCtx) return;

    // Throttle rapid flip sounds to avoid phasing
    if (effectName === 'flip') {
      const now = Date.now();
      if (now - lastFlipTime < 60) return; 
      lastFlipTime = now;
    }

    const generator = synth[effectName];
    if (generator) {
      generator(audioCtx);
    }
  }
};
