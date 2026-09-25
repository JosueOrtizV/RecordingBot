import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Condiciones del Servicio</h1>
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
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">1. Aceptación de los Términos</h2>
            <p>
              Al acceder o utilizar <strong>RecordingBot</strong>, aceptas cumplir con estas Condiciones del Servicio. Si no estás de acuerdo con alguna parte de los términos, te sugerimos no utilizar la plataforma.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">2. Descripción del Servicio</h2>
            <p>
              RecordingBot es una solución tecnológica diseñada para automatizar la asistencia a reuniones virtuales (por ejemplo, Google Meet), capturar grabaciones de audio/video autorizadas, registrar subtítulos y sintetizar minutas de trabajo para uso de los equipos participantes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">3. Uso Responsable y Consentimiento</h2>
            <p>
              El usuario es responsable de asegurar que la grabación de reuniones cuente con el consentimiento correspondiente de los demás participantes de acuerdo con las normativas y políticas laborales o legales aplicables en su jurisdicción.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">4. Cuentas y Seguridad</h2>
            <p>
              El acceso al panel se realiza mediante autenticación OAuth 2.0 de Google. Eres responsable de mantener la confidencialidad de tu cuenta y de las actividades que ocurran bajo tu perfil autorizado.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">5. Propiedad de los Contenidos</h2>
            <p>
              Las grabaciones, transcripciones y minutas generadas pertenecen al usuario y a su organización. RecordingBot no adquiere derechos de propiedad sobre los contenidos de las reuniones grabadas.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">6. Modificaciones y Contacto</h2>
            <p>
              Nos reservamos el derecho de actualizar estas condiciones para reflejar mejoras operativas o legales. Para cualquier consulta relacionada con estos términos, contáctanos en: <a href="mailto:josue.ortiz@clevercloud.mx" className="text-indigo-600 dark:text-indigo-400">josue.ortiz@clevercloud.mx</a>.
            </p>
          </section>
        </div>

      </div>
    </div>
  );
};
