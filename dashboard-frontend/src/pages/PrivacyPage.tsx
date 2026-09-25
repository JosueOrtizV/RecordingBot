import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Política de Privacidad</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Última actualización: Septiembre 2026</p>
            </div>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </Link>
        </div>

        <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">1. Información General</h2>
            <p>
              Esta Política de Privacidad describe cómo <strong>RecordingBot</strong> recopila, utiliza y protege la información del usuario al interactuar con nuestra plataforma de grabación y transcripción asistida de reuniones.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">2. Datos que Recopilamos</h2>
            <p>Al iniciar sesión con Google y autorizar los permisos correspondientes, recopilamos únicamente los datos necesarios para brindar el servicio:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Datos de perfil:</strong> Nombre, dirección de correo electrónico y foto de perfil para autenticación y control de acceso.</li>
              <li><strong>Google Calendar:</strong> Lectura de eventos de calendario próximos que contienen enlaces de reuniones (como Google Meet) para programar la asistencia del bot de grabación.</li>
              <li><strong>Grabaciones y transcripciones:</strong> Audio, video y transcripción de subtítulos generados durante las reuniones donde el usuario solicita o autoriza la presencia del bot.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">3. Uso de la Información</h2>
            <p>La información recopilada se utiliza estrictamente para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Detectar automáticamente las reuniones agendadas que requieren grabación.</li>
              <li>Permitir que el bot se una a la reunión en el horario programado.</li>
              <li>Subir los archivos de video y transcripción a la cuenta de Google Drive designada por la organización.</li>
              <li>Generar minutas estructuradas con inteligencia artificial para el equipo de trabajo.</li>
            </ul>
            <p><strong>No vendemos, alquilamos ni compartimos tus datos personales con terceros para fines comerciales o publicitarios.</strong></p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">4. Cumplimiento con la Política de Datos de Usuario de Google</h2>
            <p>
              El uso y la transferencia a cualquier otra aplicación de la información recibida a través de las API de Google por parte de RecordingBot se apegarán a la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 underline">Política de Datos de Usuario de los Servicios de API de Google</a>, incluidos los requisitos de Uso Limitado (Limited Use Requirements).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">5. Seguridad y Retención de Datos</h2>
            <p>
              Implementamos medidas técnicas y organizativas adecuadas para proteger tus datos contra accesos no autorizados, pérdida o alteración. Las sesiones están protegidas por HTTPS y tokens de autenticación cifrados.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">6. Control y Revocación de Permisos</h2>
            <p>
              Puedes revocar el acceso de RecordingBot a tu cuenta de Google en cualquier momento desde la configuración de seguridad de tu cuenta de Google en <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 underline">Permisos de Google</a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">7. Contacto</h2>
            <p>
              Si tienes dudas o preguntas sobre esta Política de Privacidad, puedes ponerte en contacto con nosotros en: <a href="mailto:josue.ortiz@clevercloud.mx" className="text-sky-600 dark:text-sky-400">josue.ortiz@clevercloud.mx</a>.
            </p>
          </section>
        </div>

      </div>
    </div>
  );
};
