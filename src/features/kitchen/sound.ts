let audio: AudioContext | null = null;
let enabled = false;
export async function enableSound() {
  audio ??= new AudioContext();
  await audio.resume();
  enabled = true;
}
export function playNewOrder() {
  if (!enabled || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.frequency.setValueAtTime(660, audio.currentTime);
  oscillator.frequency.setValueAtTime(880, audio.currentTime + 0.13);
  gain.gain.setValueAtTime(0.12, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.4);
}
