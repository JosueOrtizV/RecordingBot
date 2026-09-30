import React, { useState, useEffect } from 'react';
import { Shield, ArrowLeft, CheckCircle2, Lock, Database, Trash2, Share2, Eye, Bookmark } from 'lucide-react';
import { Link } from 'react-router-dom';

const ENGLISH_ANCHORS = [
  'data-accessed',
  'data-use',
  'data-sharing',
  'data-protection',
  'data-retention-deletion',
  'limited-use',
];

const SPANISH_ANCHORS = [
  'datos-recopilados',
  'uso-de-datos',
  'transferencia-de-datos',
  'proteccion-de-datos',
  'retencion-y-eliminacion',
  'uso-limitado',
];

export const PrivacyPage: React.FC = () => {
  const [lang, setLang] = useState<'es' | 'en'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (ENGLISH_ANCHORS.includes(hash) || window.location.search.includes('lang=en')) {
        return 'en';
      }
    }
    return 'es';
  });

  useEffect(() => {
    const handleScrollToHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) return;

      if (ENGLISH_ANCHORS.includes(hash) && lang !== 'en') {
        setLang('en');
      } else if (SPANISH_ANCHORS.includes(hash) && lang !== 'es') {
        setLang('es');
      }

      // Allow React to re-render in case language changed
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-4', 'dark:ring-offset-slate-900', 'rounded-2xl', 'transition-all');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-4', 'dark:ring-offset-slate-900', 'rounded-2xl');
          }, 3000);
        }
      }, 100);
    };

    handleScrollToHash();
    window.addEventListener('hashchange', handleScrollToHash);
    return () => window.removeEventListener('hashchange', handleScrollToHash);
  }, [lang]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {lang === 'es' ? 'Política de Privacidad de RecordingBot' : 'RecordingBot Privacy Policy'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'es' ? 'Última actualización: 30 de septiembre de 2026' : 'Last Updated: September 30, 2026'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setLang('es')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  lang === 'es'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Español
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  lang === 'en'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                English
              </button>
            </div>

            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'es' ? 'Inicio' : 'Home'}</span>
            </Link>
          </div>
        </div>

        {/* Quick Navigation Index (TOC) */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
            <span>{lang === 'es' ? 'Índice de Navegación Rápida' : 'Quick Navigation Index'}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {lang === 'es' ? (
              <>
                <a href="#datos-recopilados" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  2. Datos Recopilados
                </a>
                <a href="#uso-de-datos" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  3. Uso de Datos
                </a>
                <a href="#transferencia-de-datos" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  4. Transferencia y Terceros
                </a>
                <a href="#proteccion-de-datos" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  5. Protección y Seguridad
                </a>
                <a href="#retencion-y-eliminacion" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  6. Retención y Eliminación
                </a>
                <a href="#uso-limitado" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  7. Uso Limitado Google
                </a>
              </>
            ) : (
              <>
                <a href="#data-accessed" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  2. Data Accessed
                </a>
                <a href="#data-use" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  3. Data Use
                </a>
                <a href="#data-sharing" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  4. Sharing & Disclosure
                </a>
                <a href="#data-protection" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  5. Protection & Security
                </a>
                <a href="#data-retention-deletion" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  6. Retention & Deletion
                </a>
                <a href="#limited-use" className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  7. Limited Use Policy
                </a>
              </>
            )}
          </div>
        </div>

        {/* SPANISH VERSION */}
        {lang === 'es' && (
          <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                1. Identidad del Desarrollador y Alcance
              </h2>
              <p>
                Esta Política de Privacidad describe cómo la aplicación <strong>RecordingBot</strong> (accesible en <a href="https://recordingbot.josueortiz.dev" className="text-indigo-600 dark:text-indigo-400 underline font-medium">https://recordingbot.josueortiz.dev</a>), desarrollada por el Ing. Josué Ortiz (contacto: <a href="mailto:josue_noob@hotmail.com" className="text-indigo-600 dark:text-indigo-400 font-medium">josue_noob@hotmail.com</a> / <a href="mailto:josue.ortiz@clevercloud.mx" className="text-indigo-600 dark:text-indigo-400 font-medium">josue.ortiz@clevercloud.mx</a>), recopila, utiliza, protege, almacena y elimina los datos de los usuarios, en particular los datos obtenidos a través de las APIs de Google mediante OAuth 2.0.
              </p>
              <p>
                RecordingBot es una plataforma de productividad laboral que asiste a reuniones virtuales de Google Meet programadas en el calendario del usuario, captura el audio/video con fines de registro interno, sincroniza las transcripciones y genera minutas ejecutivas estructuradas mediante inteligencia artificial.
              </p>
            </section>

            {/* Section 2 - GOOGLE USER DATA ACCESSED */}
            <section id="datos-recopilados" className="space-y-4 scroll-mt-24 p-2">
              <span id="data-accessed" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  2. Datos de Usuario de Google a los que se Accede (Data Accessed)
                </h2>
              </div>
              <p>
                RecordingBot solicita acceso exclusivamente a los siguientes scopes de Google API mediante el consentimiento explícito del usuario:
              </p>

              <div className="space-y-3 pl-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    https://www.googleapis.com/auth/userinfo.email & https://www.googleapis.com/auth/userinfo.profile
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Información básica de perfil y correo electrónico
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    <strong>Datos a los que se accede:</strong> Dirección de correo electrónico principal del usuario, nombre completo y foto de perfil público.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                    https://www.googleapis.com/auth/calendar.readonly & calendar.events.readonly
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Eventos de Google Calendar (Solo Lectura)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    <strong>Datos a los que se accede:</strong> Títulos de reuniones, horarios programados de inicio y fin, lista de participantes y el enlace de videoconferencia de Google Meet (<code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">meet.google.com/...</code>). <em>RecordingBot solo solicita permiso de lectura (readonly), nunca modifica, crea ni elimina eventos en el calendario del usuario.</em>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    https://www.googleapis.com/auth/drive.file
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Almacenamiento en Google Drive (Solo Archivos Creados por la App)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    <strong>Datos a los que se accede:</strong> Únicamente los archivos y carpetas creados por la propia aplicación RecordingBot en la unidad de Google Drive del usuario (archivos de video MP4, audio MP3 y texto de transcripción). <em>RecordingBot NO tiene acceso, lectura ni permisos sobre ningún otro archivo o carpeta preexistente en el Google Drive del usuario.</em>
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 - HOW GOOGLE USER DATA IS USED */}
            <section id="uso-de-datos" className="space-y-4 scroll-mt-24 p-2">
              <span id="data-use" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  3. Cómo se Usan los Datos de Usuario de Google (Data Use)
                </h2>
              </div>
              <p>
                Los datos de Google recopilados se utilizan estrictamente para las funcionalidades operativas esenciales de RecordingBot:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li>
                  <strong>Autenticación y Sesión:</strong> La dirección de correo electrónico y el nombre se utilizan para identificar al usuario, autenticar su sesión web y vincular las grabaciones de sus reuniones a su cuenta.
                </li>
                <li>
                  <strong>Automatización de Asistencia:</strong> La información del calendario se utiliza periódicamente para detectar reuniones que contengan un enlace de Google Meet. Con la fecha y hora de inicio, el sistema despacha automáticamente el bot de grabación para que se una a la llamada al iniciar la sesión.
                </li>
                <li>
                  <strong>Almacenamiento Seguro de Grabaciones:</strong> Los archivos resultantes de la grabación de la sesión (video, audio y transcripción) se suben directamente a la carpeta de Google Drive del usuario para que mantenga el control total y exclusivo sobre sus archivos multimedia.
                </li>
                <li>
                  <strong>Generación de Minutas Ejecutivas:</strong> El texto de la transcripción capturado durante la reunión se envía a la API de Google Gemini para producir un resumen ejecutivo estructurado con acuerdos, participantes y tareas pendientes.
                </li>
              </ul>

              {/* Explicit Prohibitions */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Compromisos Expresos de No Uso (Negative Disclosures):</span>
                </div>
                <p>• <strong>NO</strong> utilizamos los datos de Google para publicidad, marketing ni perfiles de comportamiento.</p>
                <p>• <strong>NO</strong> utilizamos los datos de Google para entrenar, mejorar o afinar modelos generales de inteligencia artificial o aprendizaje automático (AI/ML).</p>
                <p>• <strong>NO</strong> comercializamos, vendemos ni alquilamos datos de usuario de Google bajo ninguna circunstancia.</p>
              </div>
            </section>

            {/* Section 4 - DATA SHARING & DISCLOSURE */}
            <section id="transferencia-de-datos" className="space-y-4 scroll-mt-24 p-2">
              <span id="data-sharing" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  4. Con Quién se Comparten o Transfieren los Datos (Data Sharing and Disclosure)
                </h2>
              </div>
              <p>
                <strong>RecordingBot NO comparte, vende, alquila ni transfiere datos de usuarios de Google a terceros, anunciantes ni intermediarios de datos (data brokers).</strong>
              </p>
              <p className="text-xs">
                La transferencia de datos se limita estrictamente a los subprocesadores de infraestructura tecnológica indispensables para brindar el servicio:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li>
                  <strong>Google Gemini API (Google LLC):</strong> Se utiliza para procesar el texto de la transcripción y generar la minuta ejecutiva. Las llamadas se realizan mediante API segura y los términos de la API de Gemini prohíben expresamente el uso de los datos de las peticiones para entrenar modelos base.
                </li>
                <li>
                  <strong>Infraestructura de Alojamiento (VPS Privado en Hostinger):</strong> Servidor seguro dedicado donde se ejecutan los contenedores de la aplicación bajo reglas estrictas de firewall y redes privadas internas.
                </li>
              </ul>
              <p className="text-xs">
                No divulgamos información a ninguna otra entidad excepto si existiera una orden judicial legal vinculante emitida por una autoridad competente conforme a la legislación aplicable.
              </p>
            </section>

            {/* Section 5 - DATA PROTECTION & SECURITY */}
            <section id="proteccion-de-datos" className="space-y-4 scroll-mt-24 p-2">
              <span id="data-protection" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  5. Mecanismos de Protección y Seguridad de Datos Sensibles (Data Protection)
                </h2>
              </div>
              <p>
                Implementamos rigurosas medidas técnicas, administrativas y operativas para proteger la confidencialidad, integridad y disponibilidad de los datos sensibles:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li>
                  <strong>Cifrado en Tránsito:</strong> Todas las comunicaciones entre el navegador del usuario, los servidores de RecordingBot y las APIs de Google se transmiten cifradas de extremo a extremo mediante el protocolo TLS 1.3 / HTTPS con certificados SSL emitidos por Let's Encrypt con renovación automática.
                </li>
                <li>
                  <strong>Cifrado y Protección de Credenciales en Reposo:</strong> Los tokens de acceso OAuth 2.0 y refresh tokens de Google se almacenan en una base de datos PostgreSQL protegida por contraseñas robustas, sin acceso público a Internet y accesible únicamente mediante la red interna de contenedores Docker aislados.
                </li>
                <li>
                  <strong>Principio de Mínimo Privilegio:</strong> RecordingBot únicamente solicita los permisos indispensables para su funcionamiento (permisos de solo lectura para el calendario y alcance limitado a sus propios archivos en Google Drive).
                </li>
                <li>
                  <strong>Aislamiento de Entornos:</strong> Las instancias del bot y del navegador se ejecutan en contenedores efímeros sin persistencia innecesaria de cookies o sesiones ajenas a la llamada en curso.
                </li>
              </ul>
            </section>

            {/* Section 6 - DATA RETENTION & DELETION */}
            <section id="retencion-y-eliminacion" className="space-y-4 scroll-mt-24 p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span id="data-retention-deletion" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  6. Retención y Procedimiento de Eliminación de Datos (Data Retention and Deletion)
                </h2>
              </div>
              
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Períodos de Retención:</h3>
                <p>• <strong>Datos del Calendario:</strong> Se consultan en tiempo real para agendar reuniones y se descartan tras el procesamiento de la llamada.</p>
                <p>• <strong>Metadatos y Minutas:</strong> Se almacenan en la base de datos únicamente mientras la cuenta del usuario permanezca activa en la plataforma o hasta que el usuario decida borrarlos.</p>
                <p>• <strong>Archivos Multimedia en Google Drive:</strong> Se guardan directamente en la unidad de Google Drive del usuario, quien mantiene el control absoluto y puede conservarlos o borrarlos según sus propias políticas de retención.</p>
              </div>

              <div className="space-y-2 text-xs pt-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Mecanismos de Eliminación de Datos a Disposición del Usuario:</h3>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    <strong>Eliminación Individual desde el Panel:</strong> El usuario puede eliminar cualquier registro de reunión, transcripción o minuta generada en cualquier momento haciendo clic en el botón de eliminar (<Trash2 className="w-3 h-3 inline text-rose-500" />) en la lista o detalle de grabaciones.
                  </li>
                  <li>
                    <strong>Revocación Inmediata de Permisos OAuth:</strong> El usuario puede desconectar y revocar el acceso de RecordingBot a su cuenta de Google en cualquier momento ingresando a la consola de seguridad de Google: <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">Permisos de Cuenta de Google</a>.
                  </li>
                  <li>
                    <strong>Solicitud de Eliminación Total de Cuenta y Datos:</strong> El usuario puede solicitar la eliminación completa y permanente de su cuenta, tokens de acceso y todos los registros asociados enviando un correo electrónico a <a href="mailto:josue_noob@hotmail.com" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">josue_noob@hotmail.com</a> o <a href="mailto:josue.ortiz@clevercloud.mx" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">josue.ortiz@clevercloud.mx</a> con el asunto <em>"Solicitud de Eliminación de Datos"</em>. Todas las credenciales y registros en base de datos se purgarán definitivamente en un plazo máximo de 48 horas hábiles.
                  </li>
                </ol>
              </div>
            </section>

            {/* Section 7 - GOOGLE LIMITED USE REQUIREMENT */}
            <section id="uso-limitado" className="space-y-3 scroll-mt-24 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-slate-700 dark:text-slate-200">
              <span id="limited-use" className="block -mt-24 pt-24" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>7. Declaración de Cumplimiento: Requisitos de Uso Limitado de Google</span>
              </h2>
              <p className="text-sm font-semibold leading-relaxed text-indigo-950 dark:text-indigo-200">
                El uso y la transferencia a cualquier otra aplicación de la información recibida a través de las APIs de Google por parte de RecordingBot se apegará estrictamente a la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-bold">Política de Datos de Usuario de los Servicios de las API de Google</a>, incluidos los requisitos de Uso Limitado (Limited Use Requirements).
              </p>
            </section>

            {/* Section 8 - CONTACT */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">8. Contacto</h2>
              <p>
                Para cualquier consulta, queja o ejercicio de derechos de privacidad en relación con RecordingBot, puedes contactarnos directamente:
              </p>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <p><strong>Responsable:</strong> Ing. Josué Ortiz (Clever Cloud)</p>
                <p><strong>Correo principal:</strong> <a href="mailto:josue_noob@hotmail.com" className="text-indigo-600 dark:text-indigo-400">josue_noob@hotmail.com</a></p>
                <p><strong>Correo corporativo:</strong> <a href="mailto:josue.ortiz@clevercloud.mx" className="text-indigo-600 dark:text-indigo-400">josue.ortiz@clevercloud.mx</a></p>
                <p><strong>Página de la Aplicación:</strong> <a href="https://recordingbot.josueortiz.dev" className="text-indigo-600 dark:text-indigo-400">https://recordingbot.josueortiz.dev</a></p>
              </div>
            </section>

          </div>
        )}

        {/* ENGLISH VERSION */}
        {lang === 'en' && (
          <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                1. Developer Identity and Scope
              </h2>
              <p>
                This Privacy Policy describes how <strong>RecordingBot</strong> (accessible at <a href="https://recordingbot.josueortiz.dev" className="text-indigo-600 dark:text-indigo-400 underline font-medium">https://recordingbot.josueortiz.dev</a>), developed and operated by Josué Ortiz (contact: <a href="mailto:josue_noob@hotmail.com" className="text-indigo-600 dark:text-indigo-400 font-medium">josue_noob@hotmail.com</a> / <a href="mailto:josue.ortiz@clevercloud.mx" className="text-indigo-600 dark:text-indigo-400 font-medium">josue.ortiz@clevercloud.mx</a>), accesses, collects, uses, protects, shares, retains, and deletes user data, particularly Google user data obtained via Google APIs through OAuth 2.0.
              </p>
              <p>
                RecordingBot is a workspace productivity tool that attends scheduled Google Meet video conferences from the user's calendar, records audio/video for business recordkeeping, syncs meeting transcripts in real time, and produces structured executive meeting minutes powered by artificial intelligence.
              </p>
            </section>

            {/* Section 2 - GOOGLE USER DATA ACCESSED */}
            <section id="data-accessed" className="space-y-4 scroll-mt-24 p-2">
              <span id="datos-recopilados" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  2. Google User Data Accessed by RecordingBot
                </h2>
              </div>
              <p>
                RecordingBot accesses only the specific data items authorized through explicit Google OAuth 2.0 consent:
              </p>

              <div className="space-y-3 pl-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    https://www.googleapis.com/auth/userinfo.email & https://www.googleapis.com/auth/userinfo.profile
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Basic Profile & Email Information
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    <strong>Data accessed:</strong> Primary email address, full display name, and public profile picture.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                    https://www.googleapis.com/auth/calendar.readonly & calendar.events.readonly
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Google Calendar Events (Read-Only)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    <strong>Data accessed:</strong> Scheduled calendar event titles/summaries, start and end timestamps, attendee attendance status, and Google Meet conference URLs (<code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">meet.google.com/...</code>). <em>RecordingBot only requests read-only permissions and never creates, modifies, or deletes events on the user's calendar.</em>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    https://www.googleapis.com/auth/drive.file
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Google Drive Storage (App-Created Files Only)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    <strong>Data accessed:</strong> Only files and folders created or opened by RecordingBot itself inside the user's Google Drive account (video MP4 files, audio MP3 files, and transcript text files). <em>RecordingBot has NO access or visibility into any other pre-existing files or folders in the user's Google Drive.</em>
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 - HOW WE USE GOOGLE USER DATA */}
            <section id="data-use" className="space-y-4 scroll-mt-24 p-2">
              <span id="uso-de-datos" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  3. How RecordingBot Uses Google User Data
                </h2>
              </div>
              <p>
                All Google user data accessed is strictly utilized to operate the primary productivity features of RecordingBot:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li>
                  <strong>Authentication and Session Management:</strong> Email address and profile name are used to authenticate user identity, maintain secure web dashboard sessions, and associate meeting recordings with the correct account.
                </li>
                <li>
                  <strong>Automated Meeting Attendance:</strong> Calendar event metadata is polled periodically to identify upcoming meetings containing a Google Meet video conference link. The bot uses the scheduled date, time, and link to automatically dispatch the recording bot to join the call at the appointed start time.
                </li>
                <li>
                  <strong>Secure Cloud Storage:</strong> Audio, video, and transcript files recorded during the session are uploaded directly to the user's own Google Drive storage so the user retains complete ownership and governance of their multimedia assets.
                </li>
                <li>
                  <strong>AI Executive Minutes Generation:</strong> The meeting transcript captured by the bot is processed via Google Gemini API to synthesize structured executive minutes, including executive summaries, key decisions, action items, and topic breakdowns.
                </li>
              </ul>

              {/* Explicit Prohibitions / Negative Disclosures */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Mandatory Negative Disclosures:</span>
                </div>
                <p>• <strong>NO Advertising:</strong> We do NOT use Google user data for advertising, marketing, profiling, or behavioral targeting.</p>
                <p>• <strong>NO AI/ML Model Training:</strong> We do NOT use Google user data to train, develop, improve, or fine-tune generalized artificial intelligence (AI) or machine learning (ML) models.</p>
                <p>• <strong>NO Data Selling:</strong> We do NOT sell, rent, lease, or monetize Google user data under any circumstances.</p>
              </div>
            </section>

            {/* Section 4 - SHARING, TRANSFER AND DISCLOSURE */}
            <section id="data-sharing" className="space-y-4 scroll-mt-24 p-2">
              <span id="transferencia-de-datos" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  4. Sharing, Transfer, and Disclosure of Google User Data
                </h2>
              </div>
              <p>
                <strong>RecordingBot does NOT share, transfer, disclose, or sell Google user data to third parties, advertising networks, or data brokers.</strong>
              </p>
              <p className="text-xs">
                Data transfer occurs solely to essential sub-processors required to deliver the core service:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li>
                  <strong>Google Gemini API (Google LLC):</strong> Used to process transcripts and generate meeting minutes. Transcripts are sent over encrypted HTTPS connections. Google Gemini API enterprise terms expressly prohibit using customer prompt data to train foundation models.
                </li>
                <li>
                  <strong>Cloud Hosting Infrastructure (Hostinger Private VPS):</strong> A dedicated virtual private server running containerized application services protected by strict firewall rules and isolated internal Docker networks.
                </li>
              </ul>
              <p className="text-xs">
                We will not disclose any user information to government agencies or third parties unless legally compelled by a binding court order, subpoena, or applicable statutory law.
              </p>
            </section>

            {/* Section 5 - DATA PROTECTION & SECURITY */}
            <section id="data-protection" className="space-y-4 scroll-mt-24 p-2">
              <span id="proteccion-de-datos" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  5. Data Protection and Security Mechanisms for Sensitive Data
                </h2>
              </div>
              <p>
                RecordingBot employs robust technical, operational, and organizational security safeguards to ensure the security of sensitive user data:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li>
                  <strong>Encryption in Transit:</strong> All communications between client browsers, RecordingBot servers, and Google APIs are secured with TLS 1.3 / HTTPS encryption utilizing SSL certificates issued by Let's Encrypt with automated renewal.
                </li>
                <li>
                  <strong>Encryption at Rest & Token Protection:</strong> Google OAuth 2.0 access and refresh tokens are stored securely in a hardened PostgreSQL database with access restricted to the internal Docker container network. Database access is strictly barred from public internet exposure.
                </li>
                <li>
                  <strong>Principle of Least Privilege:</strong> Scopes requested are strictly minimal (`calendar.readonly` and `drive.file`), ensuring RecordingBot cannot view or modify unassociated Google Drive files or edit calendar events.
                </li>
                <li>
                  <strong>Containerized Environment Isolation:</strong> Bot recording sessions execute in isolated ephemeral containers that terminate upon meeting conclusion, minimizing residual memory or cache footprint.
                </li>
              </ul>
            </section>

            {/* Section 6 - RETENTION AND DELETION */}
            <section id="data-retention-deletion" className="space-y-4 scroll-mt-24 p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span id="retencion-y-eliminacion" className="block -mt-24 pt-24" />
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  6. Retention and Deletion of Google User Data
                </h2>
              </div>
              
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Data Retention Timeline:</h3>
                <p>• <strong>Google Calendar Data:</strong> Calendar event details are held temporarily in volatile memory/cache solely to dispatch the recording bot and are discarded after meeting execution.</p>
                <p>• <strong>Meeting Metadata & AI Minutes:</strong> Retained in the application database only for the duration of the user's active account or until deleted by the user.</p>
                <p>• <strong>Google Drive Media:</strong> Stored directly within the user's own Google Drive, governed by the user's individual Google Drive retention and trash settings.</p>
              </div>

              <div className="space-y-2 text-xs pt-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">User Data Deletion Procedures:</h3>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    <strong>In-App Deletion:</strong> Users can delete individual recording records, transcripts, and AI-generated minutes at any time by clicking the delete icon (<Trash2 className="w-3 h-3 inline text-rose-500" />) on the web dashboard.
                  </li>
                  <li>
                    <strong>Revoking OAuth Access:</strong> Users can immediately revoke RecordingBot's access to their Google account at any moment through Google's Security Settings page: <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">Google Account Permissions</a>.
                  </li>
                  <li>
                    <strong>Complete Account and Data Erasure Request:</strong> Users can request full, permanent deletion of their account, tokens, and all associated metadata by sending an email to <a href="mailto:josue_noob@hotmail.com" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">josue_noob@hotmail.com</a> or <a href="mailto:josue.ortiz@clevercloud.mx" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">josue.ortiz@clevercloud.mx</a> with the subject <em>"Data Deletion Request"</em>. All database records and tokens will be permanently purged within 48 business hours.
                  </li>
                </ol>
              </div>
            </section>

            {/* Section 7 - GOOGLE LIMITED USE DISCLOSURE */}
            <section id="limited-use" className="space-y-3 scroll-mt-24 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-slate-700 dark:text-slate-200">
              <span id="uso-limitado" className="block -mt-24 pt-24" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>7. Google API Services User Data Policy Compliance</span>
              </h2>
              <p className="text-sm font-semibold leading-relaxed text-indigo-950 dark:text-indigo-200">
                RecordingBot's use and transfer to any other app of information received from Google APIs will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-bold">Google API Services User Data Policy</a>, including the Limited Use requirements.
              </p>
            </section>

            {/* Section 8 - CONTACT */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">8. Contact Information</h2>
              <p>
                For questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact:
              </p>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <p><strong>Owner / Developer:</strong> Josué Ortiz (Clever Cloud)</p>
                <p><strong>Primary Contact Email:</strong> <a href="mailto:josue_noob@hotmail.com" className="text-indigo-600 dark:text-indigo-400">josue_noob@hotmail.com</a></p>
                <p><strong>Work Email:</strong> <a href="mailto:josue.ortiz@clevercloud.mx" className="text-indigo-600 dark:text-indigo-400">josue.ortiz@clevercloud.mx</a></p>
                <p><strong>Application URL:</strong> <a href="https://recordingbot.josueortiz.dev" className="text-indigo-600 dark:text-indigo-400">https://recordingbot.josueortiz.dev</a></p>
              </div>
            </section>

          </div>
        )}

      </div>
    </div>
  );
};
