import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private tauriSupported = typeof window !== 'undefined' && '__TAURI__' in window;
  private audioContext: AudioContext;
  private inputStream: MediaStream | null = null;
  private participants: Map<string, {gain: GainNode, source: MediaStreamAudioSourceNode}> = new Map();
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    if (this.tauriSupported) {
      try {
        const devices = await invoke<[string, string][]>('get_audio_devices');
        return devices.map(([id, label]: [string, string]) => ({
          deviceId: id,
          groupId: id,
          kind: id.startsWith('input') ? 'audioinput' : 'audiooutput',
          label,
          toJSON: () => ({})
        } as MediaDeviceInfo));
      } catch (error) {
        console.error('Failed to get devices via Tauri:', error);
      }
    }
    
    // Fallback to Web API
    await navigator.mediaDevices.getUserMedia({audio: true});
    return (await navigator.mediaDevices.enumerateDevices())
      .filter(device => device.kind.includes('audio'));
  }

  async startAudioInput(deviceId: string): Promise<void> {
    this.inputStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } }
    });
  }

  addParticipant(participantId: string, stream: MediaStream): void {
    const source = this.audioContext.createMediaStreamSource(stream);
    const gain = this.audioContext.createGain();
    gain.gain.value = 1.0;
    source.connect(gain).connect(this.audioContext.destination);
    this.participants.set(participantId, {gain, source});
  }

  setParticipantVolume(participantId: string, volume: number): void {
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.gain.gain.value = volume / 100;
    }
  }

  async startRecording(): Promise<void> {
    if (!this.inputStream) return;
    
    this.recordedChunks = [];
    const combinedStream = new MediaStream();
    
    this.participants.forEach(participant => {
      participant.source.mediaStream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
    });

    this.mediaRecorder = new MediaRecorder(combinedStream);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (!this.mediaRecorder) {
        reject('No active recording');
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
        
        if (this.tauriSupported) {
          try {
            const arrayBuffer = await blob.arrayBuffer();
            const data = Array.from(new Uint8Array(arrayBuffer));
            const fileName = `recording_${new Date().toISOString()}.wav`;
            const result = await invoke<string>('save_audio_file', {
              file_name: fileName,
              data
            });
            resolve(result);
          } catch (error) {
            reject(`Failed to save recording: ${error}`);
          }
        } else {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject('Failed to read recording');
          reader.readAsDataURL(blob);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  cleanup(): void {
    this.participants.forEach(participant => {
      participant.source.disconnect();
    });
    this.participants.clear();
    if (this.inputStream) {
      this.inputStream.getTracks().forEach(track => track.stop());
    }
  }
}