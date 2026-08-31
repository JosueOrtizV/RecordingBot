export interface User {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string;
  botDisplayName: string;
}

export interface UserSettings {
  user_id: string;
  enable_video: boolean;
  enable_audio: boolean;
  enable_transcription: boolean;
  drive_folder_name: string;
  drive_folder_id?: string;
  max_recording_minutes: number;
  auto_join: boolean;
  telegram_chat_id?: string;
}

export interface ScheduledMeeting {
  id: string;
  user_id: string;
  calendar_event_id: string;
  title: string;
  meet_url: string;
  start_time: string;
  end_time: string;
  will_record: boolean;
  recording_mode: 'video' | 'audio' | 'transcript_only';
  block_reason?: string | null;
}

export interface Recording {
  id: string;
  user_id: string;
  owner_user_id?: string;
  meeting_title: string;
  meeting_url: string;
  calendar_event_id?: string;
  drive_file_id?: string;
  drive_url?: string;
  duration_seconds?: number;
  recording_mode: 'video' | 'audio' | 'transcript_only';
  status: 'pending' | 'recording' | 'completed' | 'failed';
  error_message?: string;
  has_transcript: boolean;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

export interface BlocklistItem {
  id: string;
  user_id: string;
  match_type: 'url' | 'title_contains' | 'event_id';
  match_value: string;
  reason?: string;
  created_at: string;
}

export interface WorkerStatus {
  workers: {
    total: number;
    active: number;
    idle: number;
  };
  capacity?: {
    loadPercentage: number;
    videoCount: number;
    audioCount: number;
    textCount: number;
    maxVideo: number;
    maxAudio: number;
    availableVideoSlots: number;
    availableAudioSlots: number;
    statusLabel: string;
  };
  queue: {
    pending: number;
    processing: number;
  };
  activeRecordings: Array<{
    id: string;
    meeting_title: string;
    meeting_url: string;
    recording_mode: string;
    started_at: string;
    user_name: string;
  }>;
}

export interface RecordingStats {
  totalCount: number;
  totalSeconds: number;
  completedCount: number;
  withTranscriptCount: number;
  countsByRange: {
    today: number;
    week: number;
    month: number;
    all: number;
  };
}

