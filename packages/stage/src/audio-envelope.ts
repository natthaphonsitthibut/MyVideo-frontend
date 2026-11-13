export type SpeechDuck = {
  gainDb: number;
  attackFrames: number;
  releaseFrames: number;
  speech: { startFrame: number; endFrame: number }[];
};
/** Same linear-amplitude envelope for preview and export. Attack precedes speech; release follows it. */
export function duckingGain(duck: SpeechDuck | undefined, frame: number): number {
  if (!duck) return 1;
  const low = 10 ** (duck.gainDb / 20);
  return duck.speech.reduce((gain, s) => {
    const attack = Math.max(1, duck.attackFrames),
      release = Math.max(1, duck.releaseFrames);
    const amount =
      frame < s.startFrame
        ? Math.max(0, 1 - (s.startFrame - frame) / attack)
        : frame <= s.endFrame
          ? 1
          : Math.max(0, 1 - (frame - s.endFrame) / release);
    return Math.min(gain, 1 - (1 - low) * amount);
  }, 1);
}
export function fadeGain(local: number, duration: number, fadeIn = 0, fadeOut = 0): number {
  return Math.max(
    0,
    Math.min(1, fadeIn > 0 ? local / fadeIn : 1, fadeOut > 0 ? (duration - local) / fadeOut : 1),
  );
}
export function duckingExpression(duck: SpeechDuck, fps: { num: number; den: number }): string {
  const low = 10 ** (duck.gainDb / 20),
    rate = fps.num / fps.den;
  const parts = duck.speech.map((s) => {
    const start = s.startFrame / rate,
      end = s.endFrame / rate,
      attack = Math.max(1, duck.attackFrames) / rate,
      release = Math.max(1, duck.releaseFrames) / rate;
    return `1-${1 - low}*max(0,min(1,min((t-${start - attack})/${attack},(${end + release}-t)/${release})))`;
  });
  return parts.reduce((prev, p) => `min(${prev},${p})`, '1');
}
