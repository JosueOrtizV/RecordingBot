import React from 'react';
import { Shield, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Política de Privacidad de RecordingBot</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Última actualización: 25 de septiembre de 2026</p>
            </div>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Página Principal</span>
          </Link>
        </div>

        {/* Content */}
        <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">1. Identidad del Desarrollador y Alcance</h2>
            <p>
              Esta Política de Privacidad rige el uso de la aplicación web <strong>RecordingBot</strong> (accesible en <a href="https://recordingbot.josueortiz.dev" className="text-sky-600 dark:text-sky-400 underline">https://recordingbot.josueortiz.dev</a>), desarrollada y administrada por el Ing. Josué Ortiz / Clever Cloud (contacto: <a href="mailto:josue.ortiz@clevercloud.mx" className="text-sky-600 dark:text-sky-400">josue.ortiz@clevercloud.mx</a>).
            </p>
            <p>
              RecordingBot es una herramienta de productividad laboral diseñada para asistir a videollamadas programadas de Google Meet, capturar audio/video de las sesiones de trabajo, sincronizar transcripciones en tiempo real y elaborar minutas ejecutivas con inteligencia artificial.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">2. Permisos Específicos de Google API y Justificación de Uso</h2>
            <p>
              Para operar, RecordingBot solicita autorización para acceder a scopes específicos de las APIs de Google mediante OAuth 2.0. A continuación se detalla la justificación exacta de cada uno:
            </p>

            <div className="space-y-3 pl-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                  https://www.googleapis.com/auth/calendar.readonly & calendar.events
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  Acceso y lectura de Google Calendar
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <strong>Propósito:</strong> Se utiliza exclusivamente para consultar los eventos próximos del calendario del usuario, identificar reuniones que contienen enlaces de Google Meet y programar automáticamente la asistencia del bot a la sesión en la hora programada. No se modifican calendarios ni se accede a detalles personales ajenos a las reuniones agendadas.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  https://www.googleapis.com/auth/drive.file
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  Subida a Google Drive
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <strong>Propósito:</strong> Se utiliza para crear la carpeta de grabaciones y subir los archivos multimedia (video MP4, audio MP3 y texto de transcripción) directamente a la unidad de Google Drive del usuario u organización. RecordingBot solo tiene acceso a los archivos creados por la propia aplicación, no a otros archivos existentes en tu Google Drive.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  https://www.googleapis.com/auth/userinfo.email & userinfo.profile
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  Perfil de usuario básico
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <strong>Propósito:</strong> Identificar al usuario en el sistema, mostrar su nombre y avatar en el panel de control y asociar sus grabaciones de manera privada y segura.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 - Google Limited Use Requirement */}
          <section className="space-y-3 p-5 rounded-2xl bg-sky-500/5 border border-sky-500/20 text-slate-700 dark:text-slate-200">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span>3. Cumplimiento de la Política de Datos de Usuario de los Servicios de API de Google</span>
            </h2>
            <p className="text-sm font-medium leading-relaxed">
              El uso y la transferencia a cualquier otra aplicación de la información recibida a través de las APIs de Google por parte de RecordingBot se apegarán estrictamente a la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 underline font-semibold">Política de Datos de Usuario de los Servicios de las API de Google</a>, incluidos los requisitos de Uso Limitado (Limited Use Requirements).
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>No utilizamos los datos de las API de Google para crear perfiles de publicidad personalizada o venta de información.</li>
              <li>No transferimos datos de las API de Google a terceros, excepto cuando sea estrictamente necesario para proporcionar o mejorar la funcionalidad del servicio orientada al usuario.</li>
              <li>No utilizamos datos de usuario para entrenar modelos de lenguaje o inteligencia artificial generalizados.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">4. Almacenamiento, Seguridad y Retención</h2>
            <p>
              Todos los datos procesados por RecordingBot se transfieren a través de conexiones seguras y cifradas mediante protocolos TLS/HTTPS modernos.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Credenciales y Tokens:</strong> Los tokens de acceso OAuth se almacenan cifrados en una base de datos PostgreSQL protegida con contraseñas seguras y acceso restringido exclusivamente a la red interna de contenedores.</li>
              <li><strong>Archivos de Grabación:</strong> El video y audio de las reuniones se almacena en el almacenamiento de Google Drive configurado por el usuario.</li>
              <li><strong>Período de Retención:</strong> Los datos se conservan únicamente mientras la cuenta de usuario esté activa en la plataforma o hasta que el usuario decida eliminarlos.</li>
            </ul>
          </section>

          {/* Section 5 - Data Deletion Instructions (MANDATORY FOR GOOGLE) */}
          <section className="space-y-3 p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              5. Procedimiento para la Eliminación de Datos (Data Deletion)
            </h2>
            <p className="text-sm">
              Garantizamos a todos los usuarios el derecho a eliminar sus datos en cualquier momento mediante cualquiera de los siguientes mecanismos:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs">
              <li>
                <strong>Desde la aplicación:</strong> Los usuarios pueden eliminar grabaciones, transcripciones y minutas individuales directamente desde la vista de detalle de cada reunión en el panel de control.
              </li>
              <li>
                <strong>Revocación de permisos:</strong> Puedes revocar el acceso a tus datos de Google en cualquier momento ingresando a <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 underline">Permisos de tu Cuenta de Google</a>.
              </li>
              <li>
                <strong>Solicitud de borrado total:</strong> Puedes solicitar la eliminación definitiva y completa de tu cuenta, historial y todos los datos asociados enviando un correo electrónico a <a href="mailto:josue.ortiz@clevercloud.mx" className="text-sky-600 dark:text-sky-400 underline font-semibold">josue.ortiz@clevercloud.mx</a> con el asunto "Solicitud de Eliminación de Datos". Las solicitudes se procesan en un plazo máximo de 48 horas hábiles.
              </li>
            </ol>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">6. Contacto</h2>
            <p>
              Para cualquier consulta, queja o ejercicio de derechos ARCO / privacidad referente a RecordingBot, puedes contactarnos directamente:
            </p>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <p><strong>Responsable del proyecto:</strong> Ing. Josué Ortiz / Clever Cloud</p>
              <p><strong>Correo electrónico de contacto:</strong> <a href="mailto:josue.ortiz@clevercloud.mx" className="text-sky-600 dark:text-sky-400">josue.ortiz@clevercloud.mx</a></p>
              <p><strong>Sitio web:</strong> <a href="https://recordingbot.josueortiz.dev" className="text-sky-600 dark:text-sky-400">https://recordingbot.josueortiz.dev</a></p>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};
