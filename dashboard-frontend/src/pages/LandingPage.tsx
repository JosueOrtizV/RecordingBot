import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Radio, Calendar, HardDrive, Cpu, Shield, 
  ArrowRight, Video, Sparkles, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, loginWithGoogle } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-sky-500 selection:text-white transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 text-white shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg sm:text-xl tracking-tight">RecordingBot</span>
              <span className="text-[10px] ml-2 font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-mono">
                v2.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all shadow-md shadow-sky-500/25"
              >
                <span>Ir al Panel</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm transition-all shadow-md"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Iniciar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 dark:bg-sky-400/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Asistente Inteligente de Reuniones y Minutas</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight sm:leading-tight">
            Graba, transcribe y sintetiza tus reuniones de <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">Google Meet</span> automáticamente
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            RecordingBot se sincroniza con tu calendario de Google para unirse puntualmente a tus videollamadas, grabar video y audio, sincronizar transcripciones palabra por palabra y redactar minutas ejecutivas con Inteligencia Artificial.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={loginWithGoogle}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-base transition-all shadow-lg shadow-sky-500/30 hover:scale-[1.02]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Acceder con Google</span>
            </button>

            <Link
              to="/privacy"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-base transition-all border border-slate-200 dark:border-slate-800"
            >
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Privacidad y Seguridad</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Features Grid (Explaining App Purpose for Google Verification) */}
      <section className="py-16 bg-white dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              ¿Cómo funciona RecordingBot?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Diseñado para equipos de desarrollo, líderes técnicos y empresas que buscan maximizar el aprovechamiento de cada conversación.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold">1. Sincronización con Google Calendar</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Al conectar tu cuenta de Google, RecordingBot inspecciona tus eventos de calendario próximos y detecta enlaces de Google Meet para programar la presencia del bot en el horario exacto.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold">2. Grabación y Captura Automatizada</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                El bot ingresa a la sesión como un asistente virtual con consentimiento del anfitrión, capturando audio y video de alta definición sin interrumpir la dinámica de la reunión.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold">3. Transcripción Sincronizada</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Cada intervención se marca con el minuto exacto del reproductor. Haz clic sobre cualquier frase de la transcripción para saltar instantáneamente a ese momento del video.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold">4. Minutas Ejecutivas con Inteligencia Artificial</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Genera resúmenes estructurados, listas de participantes, decisiones adoptadas y tablas de compromisos (action items) con plazos y responsables mediante Gemini.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <HardDrive className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold">5. Almacenamiento en Google Drive</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Los archivos finales se suben a tu propio almacenamiento de Google Drive, garantizando la soberanía de los datos de tu empresa y organización.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold">6. Control y Privacidad por Diseño</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Configura reglas de exclusión personalizadas para que el bot nunca ingrese a reuniones confidenciales o personales. Tus datos no se comparten con terceros.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Permissions Transparency Section (For Google OAuth Reviewers) */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Permisos solicitados y Transparencia
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              RecordingBot solicita exclusivamente los permisos de API necesarios para cumplir su función operativa:
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-4">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                  .../auth/calendar.readonly & .../auth/calendar.events
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Lectura de eventos del calendario
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Utilizado únicamente para identificar la fecha, hora y enlace de videoconferencia (Google Meet) de las reuniones que tú programas, para automatizar la asistencia del bot.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-4">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  .../auth/drive.file
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Almacenamiento de grabaciones
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Permite a la aplicación crear la carpeta de reuniones y almacenar tus grabaciones de video/audio directamente en tu propio Google Drive.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm">RecordingBot</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
              © {new Date().getFullYear()} Todos los derechos reservados.
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/privacy" className="hover:underline hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Política de Privacidad
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:underline hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Condiciones del Servicio
            </Link>
            <span>•</span>
            <a href="mailto:josue.ortiz@clevercloud.mx" className="hover:underline hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Contacto y Soporte
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
