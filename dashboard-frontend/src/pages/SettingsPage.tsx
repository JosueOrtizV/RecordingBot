import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../api/client';
import { BlocklistItem } from '../types';
import {
  Settings,
  ShieldAlert,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  Video,
  Mic,
  FileText,
  Folder,
  Bot,
  Bell,
  Check,
  HelpCircle,
  Send,
  Info,
  X,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

const DEFAULT_PROMPT_TEMPLATE = `Eres un asistente experto en análisis y síntesis de reuniones de trabajo y proyectos.
A partir de la siguiente transcripción de una reunión, genera una minuta profesional, clara, exhaustiva y bien organizada en formato Markdown.

La minuta debe contener la siguiente estructura:

# 📋 Minuta de Reunión: {{TITLE}}

## 🎯 Resumen Ejecutivo
Un resumen ejecutivo de alto nivel (1 a 2 párrafos) que sintetice el propósito central de la reunión y las conclusiones principales.

## 👥 Participantes e Intervenciones
- Lista de los participantes identificados y su aporte o rol en la sesión.

## 📌 Temas Tratados y Puntos Clave
Detalla los temas discutidos organizados con subtítulos claros, incluyendo contexto y puntos relevantes expresados por los participantes.

## ✅ Decisiones Tomadas
Enumera con precisión cada una de las decisiones o acuerdos a los que se llegó.

## 🚀 Acciones y Compromisos (Action Items)
| Tarea / Acción | Responsable | Fecha / Plazo | Prioridad |
| --- | --- | --- | --- |

## ❓ Puntos Abiertos y Seguimiento
Lista de temas diferidos para próximas sesiones o pendientes sin resolver.

---
*Reglas de estilo:*
- Escribe completamente en español profesional y con excelente redacción.
- Usa formato Markdown limpio con negritas, viñetas y tablas legibles.
- Sé fidedigno a la transcripción: no inventes acuerdos o datos que no existan.`;

export const SettingsPage: React.FC = () => {
  const { user, settings, updateSettings } = useAuth();

  // Form states
  const [botDisplayName, setBotDisplayName] = useState(user?.botDisplayName || "Josue's Notetaker");
  const [enableVideo, setEnableVideo] = useState(settings?.enable_video ?? false);
  const [enableAudio, setEnableAudio] = useState(settings?.enable_audio ?? true);
  const [enableTranscription, setEnableTranscription] = useState(settings?.enable_transcription ?? true);
  const [driveFolder, setDriveFolder] = useState(settings?.drive_folder_name || 'RecordingBot');
  const [telegramChatId, setTelegramChatId] = useState(settings?.telegram_chat_id || '');
  const [autoJoin, setAutoJoin] = useState(settings?.auto_join ?? true);
  const [minutesPrompt, setMinutesPrompt] = useState(settings?.minutes_prompt || '');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showTelegramHelp, setShowTelegramHelp] = useState(false);

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
      setMinutesPrompt(settings.minutes_prompt || '');
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
        minutes_prompt: minutesPrompt,
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
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
          <Settings className="w-6 h-6 text-sky-500" />
          Configuración y Preferencias
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ajusta el comportamiento del bot, carpetas de Google Drive y reglas de exclusión para tus reuniones.
        </p>
      </div>

      {/* General Settings */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 transition-colors">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200/80 dark:border-slate-800 pb-3">
          Preferencias de Grabación
        </h2>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bot Display Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-sky-500" />
                Nombre del Bot en la Llamada
              </label>
              <input
                type="text"
                value={botDisplayName}
                onChange={(e) => setBotDisplayName(e.target.value)}
                placeholder="ej. Ing. Josué Ortiz's Notetaker"
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                El nombre con el que el bot aparecerá en la lista de participantes de Google Meet (por defecto: Tu Nombre's Notetaker).
              </p>
            </div>

            {/* Drive Folder Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-emerald-500" />
                Carpeta en Google Drive
              </label>
              <input
                type="text"
                value={driveFolder}
                onChange={(e) => setDriveFolder(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Nombre de la carpeta principal en tu Drive donde se organizarán tus archivos.
              </p>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
              Módulos Predeterminados para Nuevas Grabaciones
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Toggle Video */}
              <div
                onClick={() => setEnableVideo(!enableVideo)}
                className={`p-4 rounded-2xl border flex items-start justify-between cursor-pointer transition-all ${
                  enableVideo
                    ? 'bg-sky-500/10 border-sky-500/40 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <Video className="w-4 h-4 text-sky-500" />
                    <span>Grabar Video</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Captura MP4</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                    enableVideo ? 'bg-sky-500 text-white' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  {enableVideo && <Check className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Toggle Audio */}
              <div
                onClick={() => setEnableAudio(!enableAudio)}
                className={`p-4 rounded-2xl border flex items-start justify-between cursor-pointer transition-all ${
                  enableAudio
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <Mic className="w-4 h-4 text-emerald-500" />
                    <span>Grabar Audio</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Captura MP3</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                    enableAudio ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  {enableAudio && <Check className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Toggle Transcription */}
              <div
                onClick={() => setEnableTranscription(!enableTranscription)}
                className={`p-4 rounded-2xl border flex items-start justify-between cursor-pointer transition-all ${
                  enableTranscription
                    ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>Transcripción</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Minuta en texto</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                    enableTranscription ? 'bg-indigo-500 text-white' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  {enableTranscription && <Check className="w-3.5 h-3.5" />}
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Notifications */}
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-500" />
                <span>Telegram Chat ID para Notificaciones Personales (Opcional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowTelegramHelp(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>¿Cómo obtener mi Chat ID?</span>
              </button>
            </div>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Ej. 123456789"
              className="w-full sm:w-80 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 transition-colors"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Si configuras tu Chat ID, recibirás mensajes directos cuando tus grabaciones concluyan.
            </p>
          </div>

          {/* AI Meeting Minutes Prompt Configuration */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Prompt Personalizado para Minuta con IA</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Instrucciones que recibirá la Inteligencia Artificial para resumir tus reuniones. Puedes usar <code className="text-indigo-600 dark:text-indigo-400 font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/60 px-1 py-0.5 rounded">{'{{TITLE}}'}</code> para el nombre de la reunión.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMinutesPrompt(DEFAULT_PROMPT_TEMPLATE)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95 self-start cursor-pointer"
                title="Cargar la plantilla de minuta por defecto"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Cargar Plantilla por Defecto</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                value={minutesPrompt}
                onChange={(e) => setMinutesPrompt(e.target.value)}
                placeholder={DEFAULT_PROMPT_TEMPLATE}
                rows={8}
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-y"
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
              * Si dejas este campo en blanco, se utilizará automáticamente la plantilla ejecutiva estándar de RecordingBot en español.
            </p>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-6 py-3 rounded-2xl text-xs transition-all shadow-md shadow-sky-600/25 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Preferencias'}</span>
            </button>

            {savedSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Preferencias actualizadas con éxito
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Meeting Blocklist Manager */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 transition-colors">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Reglas de Bloqueo (Reuniones Excluidas)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configura reglas para que el bot <strong>nunca ingrese</strong> a reuniones privadas, 1-on-1s o con ciertas palabras clave en el título.
          </p>
        </div>

        {/* Add rule form */}
        <form onSubmit={handleAddBlocklist} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Añadir nueva regla de exclusión:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <select
                value={newMatchType}
                onChange={(e) => setNewMatchType(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
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
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                required
              />
            </div>

            <div>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Razón / Nota (Opcional)"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingRule || !newMatchValue.trim()}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Regla</span>
            </button>
          </div>
        </form>

        {/* Existing rules list */}
        <div className="space-y-2">
          {loadingBlocklist ? (
            <p className="text-xs text-slate-400 py-4 text-center">Cargando reglas...</p>
          ) : blocklist.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              No tienes reuniones bloqueadas. El bot ingresará a las reuniones válidas de tu calendario.
            </p>
          ) : (
            blocklist.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-semibold">
                      {item.match_type === 'title_contains' ? 'Título contiene' : item.match_type === 'url' ? 'URL contiene' : 'ID evento'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">"{item.match_value}"</span>
                  </div>
                  {item.reason && <p className="text-[11px] text-slate-500 dark:text-slate-400">Razón: {item.reason}</p>}
                </div>

                <button
                  onClick={() => handleDeleteRule(item.id)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  title="Eliminar regla"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Telegram Help Modal */}
      {showTelegramHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Configurar Alertas de Telegram
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paso a paso para recibir alertas personales en tu Telegram.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTelegramHelp(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Steps list */}
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3">
                <span className="w-6 h-6 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-500/20">
                  1
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Abre el bot de información en Telegram
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    Entra a Telegram y busca{' '}
                    <a
                      href="https://t.me/userinfobot"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 dark:text-sky-400 font-semibold underline"
                    >
                      @userinfobot
                    </a>{' '}
                    (o también{' '}
                    <a
                      href="https://t.me/raw_data_bot"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 dark:text-sky-400 font-semibold underline"
                    >
                      @raw_data_bot
                    </a>
                    ) y pulsa <strong>Iniciar</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3">
                <span className="w-6 h-6 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-500/20">
                  2
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Copia tu número de Id
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    El bot te enviará un mensaje con tu información personal. Copia el número de la línea <strong>Id:</strong> (ej. <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">123456789</code>).
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3">
                <span className="w-6 h-6 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/20">
                  3
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Pégalo en el panel y guarda
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    Pega ese número en el campo <strong>Telegram Chat ID</strong> y haz clic en <strong>Guardar Preferencias</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Nota:</strong> Este campo es totalmente opcional. Si no lo configuras, el bot funcionará con normalidad y solo registrará la actividad en logs sin enviar mensajes a Telegram.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowTelegramHelp(false)}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-2xl shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
