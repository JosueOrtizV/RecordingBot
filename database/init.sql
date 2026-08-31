-- ============================================
-- RecordingBot Database Schema
-- Multi-User Recording & Dashboard System
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Usuarios registrados (login con Google OAuth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    picture_url TEXT,
    google_tokens JSONB NOT NULL,          -- {access_token, refresh_token, expiry_date, scope, token_type}
    bot_display_name VARCHAR(100) DEFAULT 'Notetaker',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Configuración de grabación por usuario
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enable_video BOOLEAN DEFAULT true,
    enable_audio BOOLEAN DEFAULT true,
    enable_transcription BOOLEAN DEFAULT true,
    drive_folder_name VARCHAR(255) DEFAULT 'RecordingBot',
    drive_folder_id VARCHAR(255),
    max_recording_minutes INTEGER DEFAULT 180,
    auto_join BOOLEAN DEFAULT true,        -- auto-join desde calendario
    telegram_chat_id VARCHAR(50),          -- notificaciones personalizadas
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Reuniones baneadas (no entrar nunca a estas)
CREATE TABLE IF NOT EXISTS meeting_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    match_type VARCHAR(20) NOT NULL DEFAULT 'url',  -- 'url', 'title_contains', 'event_id'
    match_value TEXT NOT NULL,                      -- URL, fragmento del título, o eventId
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Historial de grabaciones (para mostrar en el panel)
-- Videos NO se guardan en VPS, solo enlace a Drive del usuario
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- usuario cuyo Drive contiene el archivo
    meeting_title VARCHAR(500),
    meeting_url TEXT,
    calendar_event_id VARCHAR(255),
    drive_file_id VARCHAR(255),               -- ID del archivo en Google Drive del usuario
    drive_url TEXT,                           -- enlace directo al archivo en Drive
    transcript_text TEXT,                     -- transcripción completa guardada en DB
    duration_seconds INTEGER,
    recording_mode VARCHAR(20) DEFAULT 'video',  -- 'video', 'audio', 'transcript_only'
    status VARCHAR(20) DEFAULT 'pending',        -- 'pending', 'recording', 'completed', 'failed'
    error_message TEXT,
    dedup_group_id UUID,                      -- si fue reunión compartida, enlazar copias
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Reuniones programadas detectadas (visible en el panel)
CREATE TABLE IF NOT EXISTS scheduled_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    calendar_event_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    meet_url TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    will_record BOOLEAN DEFAULT true,      -- false si está en blocklist o deshabilitado
    recording_mode VARCHAR(20) DEFAULT 'video',
    dedup_group_id UUID,                   -- mismo ID = misma reunión, no duplicar bots
    dispatched BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, calendar_event_id)
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_user_id ON scheduled_meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_start_time ON scheduled_meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_blocklist_user_id ON meeting_blocklist(user_id);
