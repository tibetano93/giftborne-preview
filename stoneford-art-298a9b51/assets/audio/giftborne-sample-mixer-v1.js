/* global AudioWorkletProcessor, registerProcessor, sampleRate */

const BUS_OUTPUTS = Object.freeze({ sfx: 0, voice: 1, ui: 2 });
const MAX_ACTIVE_VOICES = 48;

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

class GiftborneSampleMixer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.atlases = new Map();
    this.voices = [];
    this.disposed = false;
    this.port.onmessage = (event) => this.handleMessage(event.data);
  }

  handleMessage(message) {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'init') {
      this.atlases.clear();
      for (const atlas of message.atlases ?? []) {
        if (
          typeof atlas?.id !== 'string' ||
          !Number.isFinite(atlas.sampleRate) ||
          !Array.isArray(atlas.channels) ||
          atlas.channels.length === 0
        )
          continue;
        this.atlases.set(atlas.id, atlas);
      }
      this.port.postMessage({ type: 'ready' });
      return;
    }
    if (message.type === 'dispose') {
      this.voices.length = 0;
      this.atlases.clear();
      this.disposed = true;
      return;
    }
    if (message.type !== 'cue') return;

    const atlas = this.atlases.get(message.atlas);
    const output = BUS_OUTPUTS[message.bus];
    if (!atlas || output === undefined) return;
    const firstChannel = atlas.channels[0];
    const offset = Math.max(0, Number(message.offset) || 0);
    const duration = Math.max(0, Number(message.duration) || 0);
    const start = Math.floor(offset * atlas.sampleRate);
    const end = Math.min(
      firstChannel.length,
      Math.ceil((offset + duration) * atlas.sampleRate),
    );
    if (end <= start) return;

    if (this.voices.length >= MAX_ACTIVE_VOICES) this.voices.shift();
    const pan = clamp(Number(message.pan) || 0, -1, 1);
    const angle = ((pan + 1) * Math.PI) / 4;
    this.voices.push({
      atlas,
      output,
      position: start,
      end,
      step:
        (atlas.sampleRate / sampleRate) *
        clamp(Number(message.playbackRate) || 1, 0.94, 1.06),
      gain: Math.max(0, Number(message.gain) || 0),
      left: Math.cos(angle),
      right: Math.sin(angle),
    });
  }

  process(_inputs, outputs) {
    if (this.disposed) return false;
    for (const output of outputs) {
      output[0]?.fill(0);
      output[1]?.fill(0);
    }
    const frameCount = outputs[0]?.[0]?.length ?? 0;
    for (
      let voiceIndex = this.voices.length - 1;
      voiceIndex >= 0;
      voiceIndex -= 1
    ) {
      const voice = this.voices[voiceIndex];
      const output = outputs[voice.output];
      const leftOutput = output?.[0];
      const rightOutput = output?.[1] ?? leftOutput;
      if (!leftOutput || !rightOutput) continue;
      const leftSource = voice.atlas.channels[0];
      const rightSource = voice.atlas.channels[1] ?? leftSource;
      let ended = false;
      for (let frame = 0; frame < frameCount; frame += 1) {
        if (voice.position >= voice.end) {
          ended = true;
          break;
        }
        const index = Math.floor(voice.position);
        const next = Math.min(index + 1, voice.end - 1);
        const blend = voice.position - index;
        const leftSample =
          leftSource[index] + (leftSource[next] - leftSource[index]) * blend;
        const rightSample =
          rightSource[index] + (rightSource[next] - rightSource[index]) * blend;
        leftOutput[frame] += leftSample * voice.gain * voice.left;
        rightOutput[frame] += rightSample * voice.gain * voice.right;
        voice.position += voice.step;
      }
      if (ended || voice.position >= voice.end)
        this.voices.splice(voiceIndex, 1);
    }
    return true;
  }
}

registerProcessor('giftborne-sample-mixer-v1', GiftborneSampleMixer);
