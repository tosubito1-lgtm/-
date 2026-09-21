// =============================================================================
// Yadam Audio & Subtitle Utilities
// Web Audio API based MP3/M4A -> 48kHz 16-bit PCM WAV Converter (100% Client-Side)
// =============================================================================

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob (48,000 Hz broadcast standard)
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // Write RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // Write fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // Write data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write interleaved PCM samples (16-bit)
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Clamp sample between -1.0 and 1.0
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer (-32768 to 32767)
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Converts any audio file (MP3, AAC, M4A, OGG) to broadcast-standard 48kHz 16-bit Stereo PCM WAV
 */
export async function convertAudioFileToWav(
  fileOrBlob: File | Blob,
  targetSampleRate = 48000
): Promise<{ wavBlob: Blob; duration: number; sampleRate: number; channels: number }> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  
  // Use AudioContext to decode MP3/any audio
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: targetSampleRate,
  });

  const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);

  // Render to 48kHz OfflineAudioContext
  const channels = Math.min(2, Math.max(1, decodedAudio.numberOfChannels));
  const offlineCtx = new OfflineAudioContext(
    channels,
    Math.ceil(decodedAudio.duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedAudio;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  await audioCtx.close();

  const wavBlob = audioBufferToWavBlob(renderedBuffer);

  return {
    wavBlob,
    duration: renderedBuffer.duration,
    sampleRate: targetSampleRate,
    channels,
  };
}

/**
 * Helper to download any Blob file directly to user's computer
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
