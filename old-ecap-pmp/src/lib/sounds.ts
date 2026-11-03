// Tiny Web Audio synth — mirrors the one in dqa-dashboard so both apps
// produce identical cues without shipping any MP3 assets.
let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

const beep = (
  ac: AudioContext,
  freqStart: number,
  freqEnd: number,
  duration: number,
  startAt: number,
  type: OscillatorType = "sine",
  gain = 0.06,
) => {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, ac.currentTime + startAt);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(freqEnd, 1),
    ac.currentTime + startAt + duration,
  );
  g.gain.setValueAtTime(0, ac.currentTime + startAt);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + startAt + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startAt + duration);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(ac.currentTime + startAt);
  osc.stop(ac.currentTime + startAt + duration + 0.05);
};

export const playBell = () => {
  const ac = getCtx();
  if (!ac) return;
  beep(ac, 1320, 1320, 0.18, 0, "triangle", 0.07);
  beep(ac, 1760, 1760, 0.24, 0.09, "triangle", 0.05);
};

export const playDrop = () => {
  const ac = getCtx();
  if (!ac) return;
  beep(ac, 900, 220, 0.28, 0, "sine", 0.08);
};
