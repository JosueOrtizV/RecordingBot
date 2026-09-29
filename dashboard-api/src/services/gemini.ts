export const DEFAULT_MINUTES_PROMPT = `Eres un asistente experto en análisis y síntesis de reuniones de trabajo y proyectos.
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
- Sé fidedigno a la transcripción: no inventes acuerdos, compromisos o participantes que no existan en la conversación.`;

export interface GenerateMinutesOptions {
  transcript: string;
  meetingTitle?: string;
  customPrompt?: string;
  apiKey?: string;
  model?: string;
}

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

const DEPRECATED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-flash-latest',
]);

/**
 * Call the Google Gemini API to generate structured meeting minutes from a transcript.
 */
export async function generateMeetingMinutes(options: GenerateMinutesOptions): Promise<string> {
  const { transcript, meetingTitle = 'Reunión', customPrompt, apiKey } = options;

  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('No se ha configurado la API Key de Gemini (GEMINI_API_KEY).');
  }

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('La transcripción está vacía. No es posible generar una minuta.');
  }

  const basePrompt = (customPrompt && customPrompt.trim().length > 0)
    ? customPrompt.replace(/\{\{TITLE\}\}/g, meetingTitle)
    : DEFAULT_MINUTES_PROMPT.replace(/\{\{TITLE\}\}/g, meetingTitle);

  const fullPrompt = `${basePrompt}

=====================================================
TRANSCRIPCIÓN DE LA REUNIÓN: ${meetingTitle}
=====================================================

${transcript}
`;

  const requestedModel = options.model || process.env.GEMINI_MODEL;
  const preferredModel = (requestedModel && !DEPRECATED_MODELS.has(requestedModel))
    ? requestedModel
    : 'gemini-3.5-flash-lite';

  const modelsToTry = [
    preferredModel,
    ...CANDIDATE_MODELS.filter((m) => m !== preferredModel),
  ];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedMessage = errorText;
        try {
          const errJson = JSON.parse(errorText);
          parsedMessage = errJson.error?.message || errorText;
        } catch {}
        
        console.warn(`[Gemini] Model ${model} returned HTTP ${response.status}: ${parsedMessage}. Trying next candidate model...`);
        lastError = new Error(`Error en modelo ${model} (${response.status}): ${parsedMessage}`);

        // If rate limited (429) or temporary server overload (503), add a brief backoff
        // before switching to the next candidate model to avoid tripping burst limits.
        if (response.status === 429 || response.status === 503) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        continue;
      }

      const data: any = await response.json();
      const candidate = data.candidates?.[0];
      const generatedText = candidate?.content?.parts?.[0]?.text;

      if (generatedText && generatedText.trim().length > 0) {
        return generatedText.trim();
      }
    } catch (err: any) {
      console.warn(`[Gemini] Exception calling model ${model}:`, err.message);
      lastError = err;
    }
  }

  if (lastError && (lastError.message.includes('429') || lastError.message.includes('503'))) {
    throw new Error(
      'Los servidores de Gemini están experimentando alta demanda momentánea o alcanzaron el límite de solicitudes por minuto de la capa gratuita. Por favor, espera unos segundos e inténtalo de nuevo.'
    );
  }

  throw lastError || new Error('No se pudo generar la minuta con ninguno de los modelos de Gemini disponibles.');
}
