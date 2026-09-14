// High-tech synthesized audio notification engine using Web Audio API
// No external asset downloads required - zero latency tactical tones

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function isAudioEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem('landguard_audio_alerts')
  return saved === null ? true : saved === 'true'
}

export function setAudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('landguard_audio_alerts', enabled ? 'true' : 'false')
}

// Tactical sonar ping for live sync / telemetry pulse
export function playSonarPing(): void {
  if (!isAudioEnabled()) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12)

    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch (err) {
    console.debug('[Audio] Unable to play ping:', err)
  }
}

// Tactical dual-tone alert siren for critical landslide risk
export function playHazardAlertSound(severity: 'critical' | 'high' | 'moderate' | 'low' | 'casual' = 'high'): void {
  if (!isAudioEnabled()) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    if (severity === 'critical') {
      // Rapid urgent warble (880Hz to 620Hz alternating)
      osc1.type = 'sawtooth'
      osc1.frequency.setValueAtTime(780, now)
      osc1.frequency.linearRampToValueAtTime(540, now + 0.15)
      osc1.frequency.linearRampToValueAtTime(820, now + 0.3)
      osc1.frequency.linearRampToValueAtTime(520, now + 0.45)

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55)

      osc1.connect(gain)
      gain.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.55)
    } else if (severity === 'high') {
      // High alert chime
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(659.25, now) // E5
      osc1.frequency.setValueAtTime(880, now + 0.12) // A5

      gain.gain.setValueAtTime(0.09, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

      osc1.connect(gain)
      gain.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.4)
    } else {
      // Subtle notification chime
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(523.25, now) // C5
      osc2.frequency.setValueAtTime(659.25, now + 0.1) // E5

      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

      osc2.connect(gain)
      gain.connect(ctx.destination)
      osc2.start(now)
      osc2.stop(now + 0.3)
    }
  } catch (err) {
    console.debug('[Audio] Unable to play alert:', err)
  }
}
