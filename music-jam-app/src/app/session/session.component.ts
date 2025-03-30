import { Component, OnInit, OnDestroy } from '@angular/core';
import { AudioService } from '../audio.service';

@Component({
  selector: 'app-session',
  templateUrl: './session.component.html'
})
export class SessionComponent implements OnInit, OnDestroy {
  participants = [
    { id: '1', name: 'Participant 1', volume: 80 },
    { id: '2', name: 'Participant 2', volume: 80 }
  ];
  isRecording = false;

  constructor(private audioService: AudioService) {}

  async ngOnInit() {
    // Initialize audio devices
    await this.audioService.getAudioDevices();
  }

  ngOnDestroy() {
    this.audioService.cleanup();
  }

  onVolumeChange(participantId: string, volume: number) {
    this.audioService.setParticipantVolume(participantId, volume);
  }

  async toggleRecording() {
    if (this.isRecording) {
      const audioBlob = await this.audioService.stopRecording();
      // TODO: Save recording via Tauri
    } else {
      await this.audioService.startRecording();
    }
    this.isRecording = !this.isRecording;
  }
}
