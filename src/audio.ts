export class ForestAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  windGain: GainNode | null = null;
  waterGain: GainNode | null = null;
  volume = 0.45;
  birdTimer: ReturnType<typeof setInterval> | null = null;
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume * 0.32;
    this.master.connect(ctx.destination);
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.018) / 1.019;
      data[i] = last * 12;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.24;
    source.connect(filter).connect(this.windGain).connect(this.master);
    source.start();
    const water = ctx.createBufferSource();
    water.buffer = buffer;
    water.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = "highpass";
    wf.frequency.value = 1100;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0.01;
    water.connect(wf).connect(this.waterGain).connect(this.master);
    water.start();
    this.birdTimer = setInterval(() => this.bird(), 4200);
  }
  setVolume(value: number) {
    this.volume = value;
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        value * 0.32,
        this.ctx.currentTime,
        0.15,
      );
  }
  update(z: number) {
    if (this.ctx && this.waterGain)
      this.waterGain.gain.setTargetAtTime(
        Math.max(0.02, 1 - Math.abs(z + 39.5) / 20) * 0.7,
        this.ctx.currentTime,
        0.4,
      );
  }
  tone(
    freq: number,
    length: number,
    volume = 0.3,
    type: OscillatorType = "sine",
    delay = 0,
  ) {
    if (!this.ctx || !this.master) return;
    const time = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(),
      gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + length);
    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + length + 0.03);
  }
  bird() {
    if (!this.ctx || !this.master) return;
    for (let i = 0; i < 3; i++) {
      const at = this.ctx.currentTime + i * 0.17;
      const o = this.ctx.createOscillator(),
        g = this.ctx.createGain(),
        p = this.ctx.createStereoPanner();
      p.pan.value = Math.sin(at);
      o.frequency.setValueAtTime(1800 + i * 270, at);
      o.frequency.exponentialRampToValueAtTime(2900 + i * 120, at + 0.09);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.06, at + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.13);
      o.connect(g).connect(p).connect(this.master);
      o.start(at);
      o.stop(at + 0.14);
    }
  }
  step(wood = false) {
    this.tone(wood ? 130 : 80, 0.075, wood ? 0.18 : 0.13, "triangle");
  }
  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.65, 0.23, "sine", i * 0.13),
    );
  }
  click() {
    this.tone(440, 0.1, 0.14, "sine");
  }
}
