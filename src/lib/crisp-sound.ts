/** Short crackle — like a crust coming off the stone. */
export function playCrisp(volume = 0.22) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const dur = 0.28;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      const envelope = Math.pow(1 - t, 2.4);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);

    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tick.type = "triangle";
    tick.frequency.setValueAtTime(1640, now);
    tick.frequency.exponentialRampToValueAtTime(420, now + 0.12);
    tickGain.gain.setValueAtTime(volume * 0.55, now);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    tick.connect(tickGain).connect(ctx.destination);
    tick.start(now);
    tick.stop(now + 0.16);
  } catch {
    /* audio unavailable */
  }
}
