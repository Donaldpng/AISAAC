import { AUDIO_CONTEXT } from '../constants';

class AudioService {
  private bgmOscillators: OscillatorNode[] = [];
  private isMuted: boolean = false;
  private masterGain: GainNode;
  private volume: number = 0.3;

  constructor() {
    this.masterGain = AUDIO_CONTEXT.createGain();
    this.masterGain.connect(AUDIO_CONTEXT.destination);
    this.masterGain.gain.value = this.volume;
  }

  setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (!this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, AUDIO_CONTEXT.currentTime, 0.1);
    }
  }

  getVolume() {
      return this.volume;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.masterGain.gain.setTargetAtTime(0, AUDIO_CONTEXT.currentTime, 0.1);
    } else {
      this.masterGain.gain.setTargetAtTime(this.volume, AUDIO_CONTEXT.currentTime, 0.1);
    }
    return this.isMuted;
  }

  playShoot() {
    if (this.isMuted) return;
    const osc = AUDIO_CONTEXT.createOscillator();
    const gain = AUDIO_CONTEXT.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, AUDIO_CONTEXT.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, AUDIO_CONTEXT.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, AUDIO_CONTEXT.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, AUDIO_CONTEXT.currentTime + 0.1);

    osc.start();
    osc.stop(AUDIO_CONTEXT.currentTime + 0.1);
  }

  playHit() {
    if (this.isMuted) return;
    const osc = AUDIO_CONTEXT.createOscillator();
    const gain = AUDIO_CONTEXT.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, AUDIO_CONTEXT.currentTime);
    osc.frequency.linearRampToValueAtTime(50, AUDIO_CONTEXT.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.5, AUDIO_CONTEXT.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, AUDIO_CONTEXT.currentTime + 0.2);

    osc.start();
    osc.stop(AUDIO_CONTEXT.currentTime + 0.2);
  }

  playItemGet() {
    if (this.isMuted) return;
    const now = AUDIO_CONTEXT.currentTime;
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    
    frequencies.forEach((freq, i) => {
      const osc = AUDIO_CONTEXT.createOscillator();
      const gain = AUDIO_CONTEXT.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = now + i * 0.1;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
      
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }
  
  playDoor() {
      if (this.isMuted) return;
      const osc = AUDIO_CONTEXT.createOscillator();
      const gain = AUDIO_CONTEXT.createGain();
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, AUDIO_CONTEXT.currentTime);
      gain.gain.setValueAtTime(0.2, AUDIO_CONTEXT.currentTime);
      gain.gain.linearRampToValueAtTime(0, AUDIO_CONTEXT.currentTime + 0.3);
      
      osc.start();
      osc.stop(AUDIO_CONTEXT.currentTime + 0.3);
  }
}

export const audioManager = new AudioService();