let audioContext = null;
let enabled = true;

export function isSoundEnabled() {
  return enabled;
}

export function toggleSound() {
  enabled = !enabled;
  if (enabled) playTone(500, 0.06, "triangle", 0.025);
  return enabled;
}

export function playTone(freq, duration, type = "sine", volume = 0.035) {
  if (!enabled) return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  audioContext ||= new AudioEngine();

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration);
}
