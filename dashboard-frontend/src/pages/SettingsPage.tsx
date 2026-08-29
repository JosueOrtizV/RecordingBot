import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../api/client';
import { BlocklistItem } from '../types';
import { Settings, ShieldAlert, Plus, Trash2, CheckCircle2, Save, Video, Mic, FileText, Folder, Bot, Bell } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, settings, updateSettings } = useAuth();

  // Form states
  const [botDisplayName, setBotDisplayName] = useState(user?.botDisplayName || "Josue's Notetaker");
  const [enableVideo, setEnableVideo] = useState(settings?.enable_video ?? true);
  const [enableAudio, setEnableAudio] = useState(settings?.enable_audio ?? true);
  const [enableTranscription, setEnableTranscription] = useState(settings?.enable_transcription ?? true);
  const [driveFolder, setDriveFolder] = useState(settings?.drive_folder_name || 'RecordingBot');
  const [telegramChatId, setTelegramChatId] = useState(settings?.telegram_chat_id || '');
  const [autoJoin, setAutoJoin] = useState(settings?.auto_join ?? true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Blocklist states
  const [blocklist, setBlocklist] = useState<BlocklistItem[]>([]);
  const [loadingBlocklist, setLoadingBlocklist] = useState(true);
  const [newMatchType, setNewMatchType] = useState<'title_contains' | 'url' | 'event_id'>('title_contains');
  const [newMatchValue, setNewMatchValue] = useState('');
  const [newReason, setNewReason] = useState('');
  const [addingRule, setAddingRule] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnableVideo(settings.enable_video);
      setEnableAudio(settings.enable_audio);
      setEnableTranscription(settings.enable_transcription);
      setDriveFolder(settings.drive_folder_name || 'RecordingBot');
      setTelegramChatId(settings.telegram_chat_id || '');
      setAutoJoin(settings.auto_join ?? true);
    }
    if (user?.botDisplayName) {
      setBotDisplayName(user.botDisplayName);
    }
  }, [settings, user]);

  const loadBlocklist = async () => {
    try {
      const data = await fetchApi<{ blocklist: BlocklistItem[] }>('/api/settings/blocklist');
      setBlocklist(data.blocklist || []);
    } catch {} finally {
      setLoadingBlocklist(false);
    }
  };

  useEffect(() => {
    loadBlocklist();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateSettings({
        botDisplayName,
        enable_video: enableVideo,
        enable_audio: enableAudio,
        enable_transcription: enableTranscription,
        drive_folder_name: driveFolder,
        telegram_chat_id: telegramChatId,
        auto_join: autoJoin,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert('Error al guardar configuración: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlocklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchValue.trim()) return;

    setAddingRule(true);
    try {
      const data = await fetchApi<{ success: boolean; item: BlocklistItem }>('/api/settings/blocklist', {
        method: 'POST',
        body: JSON.stringify({
          matchType: newMatchType,
          matchValue: newMatchValue.trim(),
          reason: newReason.trim() || undefined,
        }),
      });

      if (data.item) {
        setBlocklist([data.item, ...blocklist]);
      }
      setNewMatchValue('');
      setNewReason('');
    } catch (err: any) {
      alert('Error al añadir regla: ' + err.message);
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await fetchApi(`/api/settings/blocklist/${id}`, { method: 'DELETE' });
      setBlocklist(blocklist.filter((b) => b.id !== id));
    } catch (err: any) {
      alert('Error al eliminar regla: ' + err.message);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-sky-400" />
          Configuración y Preferencias
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Ajusta el comportamiento del bot, carpetas de destino y reglas de exclusión para tus reuniones.
        </p>
      </div>

      {/* General Settings */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <h2 className="text-base font-bold text-slate-100 border-b border-slate-800 pb-3">
          Preferencias de Grabación
        </h2>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bot Display Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-sky-400" />
                Nombre del Bot en la Llamada
              </label>
              <input
                type="text"
                value={botDisplayName}
                onChange={(e) => setBotDisplayName(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                El nombre con el que el bot aparecerá en la lista de participantes de Google Meet.
              </p>
            </div>

            {/* Drive Folder Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-emerald-400" />
                Carpeta en Google Drive
              </label>
              <input
                type="text"
                value={driveFolder}
                onChange={(e) => setDriveFolder(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Nombre de la carpeta principal donde se organizarán tus grabaciones por fecha.
              </p>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Módulos Predeterminados para Nuevas Grabaciones
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={enableVideo}
                  onChange={(e) => setEnableVideo(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <Video className="w-4 h-4 text-sky-400" />
                    Grabar Video
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Captura pantalla y video WebM</p>
                </div>
              </label>

              <label className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={enableAudio}
                  onChange={(e) => setEnableAudio(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    Grabar Audio
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Audio nítido de la sala</p>
                </div>
              </label>

              <label className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={enableTranscription}
                  onChange={(e) => setEnableTranscription(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Transcripción
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Minuta en texto e IA</p>
                </div>
              </label>
            </div>
          </div>

          {/* Telegram Notifications */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-amber-400" />
              Telegram Chat ID para Notificaciones Personales (Opcional)
            </label>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Ej. 6859555639"
              className="w-full sm:w-80 bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Si configuras tu ID, recibirás alertas automáticas cuando tus grabaciones concluyan.
            </p>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-6 py-3 rounded-2xl text-xs transition-all shadow-lg shadow-sky-600/25 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Preferencias'}</span>
            </button>

            {savedSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Preferencias guardadas exitosamente
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Meeting Blocklist Manager */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            Reglas de Bloqueo (Reuniones Baneadas)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configura reglas para que el bot <strong>nunca ingrese</strong> a reuniones privadas, 1-on-1s o con ciertas palabras clave en el título.
          </p>
        </div>

        {/* Add rule form */}
        <form onSubmit={handleAddBlocklist} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
          <p className="text-xs font-semibold text-slate-300">Añadir nueva regla de exclusión:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <select
                value={newMatchType}
                onChange={(e) => setNewMatchType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="title_contains">Título contiene palabra</option>
                <option value="url">URL contiene fragmento</option>
                <option value="event_id">ID de evento exacto</option>
              </select>
            </div>

            <div>
              <input
                type="text"
                value={newMatchValue}
                onChange={(e) => setNewMatchValue(e.target.value)}
                placeholder={newMatchType === 'title_contains' ? 'Ej. 1:1, Privada, Personal' : 'Ej. meet.google.com/xxx...'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                required
              />
            </div>

            <div>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Razón / Nota (Opcional)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingRule || !newMatchValue.trim()}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Regla</span>
            </button>
          </div>
        </form>

        {/* Existing rules list */}
        <div className="space-y-2">
          {loadingBlocklist ? (
            <p className="text-xs text-slate-500 py-4 text-center">Cargando reglas...</p>
          ) : blocklist.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-800 rounded-2xl">
              No tienes reuniones bloqueadas. El bot ingresará a las reuniones válidas de tu calendario.
            </p>
          ) : (
            blocklist.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {item.match_type === 'title_contains' ? 'Título contiene' : item.match_type === 'url' ? 'URL contiene' : 'ID evento'}
                    </span>
                    <span className="font-semibold text-slate-200">"{item.match_value}"</span>
                  </div>
                  {item.reason && <p className="text-[11px] text-slate-500">Razón: {item.reason}</p>}
                </div>

                <button
                  onClick={() => handleDeleteRule(item.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Eliminar regla"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
