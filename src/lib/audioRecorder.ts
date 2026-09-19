const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export function pickAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function canRecordAudio() {
  return Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private startedAt = 0
  private audioContext: AudioContext | null = null
  private levelTimer = 0
  onLevel?: (level: number) => void

  async start() {
    if (!canRecordAudio()) {
      throw new Error('Este navegador no puede grabar audio.')
    }
    this.cleanup()
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    const mimeType = pickAudioMimeType()
    this.chunks = []
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream)
    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    })
    this.startedAt = Date.now()
    this.listenLevels()
    this.mediaRecorder.start()
  }

  stop() {
    return new Promise<{ blob: Blob; mimeType: string; durationMs: number }>((resolve, reject) => {
      const recorder = this.mediaRecorder
      if (!recorder) {
        reject(new Error('No hay una grabación en curso.'))
        return
      }
      recorder.addEventListener(
        'stop',
        () => {
          const mimeType = recorder.mimeType || pickAudioMimeType() || 'audio/webm'
          const blob = new Blob(this.chunks, { type: mimeType })
          const durationMs = Date.now() - this.startedAt
          this.cleanup()
          resolve({ blob, mimeType, durationMs })
        },
        { once: true },
      )
      if (recorder.state !== 'inactive') recorder.stop()
    })
  }

  cancel() {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop()
      }
    } catch {
      /* ignore */
    }
    this.cleanup()
  }

  private listenLevels() {
    if (!this.stream) return
    try {
      const context = new AudioContext()
      this.audioContext = context
      const source = context.createMediaStreamSource(this.stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const buffer = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(buffer)
        let sum = 0
        for (const sample of buffer) {
          const centered = (sample - 128) / 128
          sum += centered * centered
        }
        this.onLevel?.(Math.min(1, Math.sqrt(sum / buffer.length) * 4))
        this.levelTimer = window.setTimeout(tick, 80)
      }
      tick()
    } catch {
      this.levelTimer = window.setInterval(() => {
        this.onLevel?.(0.25 + Math.random() * 0.2)
      }, 80)
    }
  }

  private cleanup() {
    window.clearTimeout(this.levelTimer)
    window.clearInterval(this.levelTimer)
    this.levelTimer = 0
    void this.audioContext?.close()
    this.audioContext = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.mediaRecorder = null
    this.chunks = []
    this.onLevel = undefined
  }
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el audio.'))
    reader.readAsDataURL(blob)
  })
}

export function filenameForMime(mimeType: string) {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'nota.m4a'
  if (mimeType.includes('ogg')) return 'nota.ogg'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'nota.mp3'
  if (mimeType.includes('wav')) return 'nota.wav'
  return 'nota.webm'
}
