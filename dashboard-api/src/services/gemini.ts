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

// High-quota models in Gemini free tier: 15 RPM, 500 RPD, 250K TPM
const HIGH_QUOTA_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

// Fallback models in Gemini free tier: 5 RPM, 20 RPD, 250K TPM
// Used only when high-quota models are momentarily overloaded to avoid burning RPM/RPD
const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
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

  // Clean and normalize transcript
  const cleanedTranscript = transcript
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const basePrompt = (customPrompt && customPrompt.trim().length > 0)
    ? customPrompt.replace(/\{\{TITLE\}\}/g, meetingTitle)
    : DEFAULT_MINUTES_PROMPT.replace(/\{\{TITLE\}\}/g, meetingTitle);

  const fullPrompt = `${basePrompt}

=====================================================
TRANSCRIPCIÓN DE LA REUNIÓN: ${meetingTitle}
=====================================================

${cleanedTranscript}
`;

  const requestedModel = options.model || process.env.GEMINI_MODEL;
  const preferredModel = (requestedModel && !DEPRECATED_MODELS.has(requestedModel))
    ? requestedModel
    : 'gemini-3.5-flash-lite';

  // Construct models to try: preferred first, then remaining high-quota, then fallbacks
  const modelsToTry = [
    preferredModel,
    ...HIGH_QUOTA_MODELS.filter((m) => m !== preferredModel),
    ...FALLBACK_MODELS.filter((m) => m !== preferredModel),
  ];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const isHighQuota = HIGH_QUOTA_MODELS.includes(model);
    // Allow up to 2 attempts for high-quota models (backoff handles transient 503 cluster overload)
    const maxAttempts = isHighQuota ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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

          console.warn(`[Gemini] Model ${model} (attempt ${attempt}/${maxAttempts}) returned HTTP ${response.status}: ${parsedMessage}`);
          lastError = new Error(`Error en modelo ${model} (${response.status}): ${parsedMessage}`);

          // If rate limited (429) or temporary server overload (503), add backoff
          if (response.status === 429 || response.status === 503) {
            if (attempt < maxAttempts) {
              console.log(`[Gemini] Retrying high-quota model ${model} after 2.5s backoff...`);
              await new Promise((resolve) => setTimeout(resolve, 2500));
              continue;
            } else {
              // Wait 2s before testing the next model to avoid cascading burst rate limits
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          break; // Move to next model
        }

        const data: any = await response.json();
        const candidate = data.candidates?.[0];
        const generatedText = candidate?.content?.parts?.[0]?.text;

        if (generatedText && generatedText.trim().length > 0) {
          return generatedText.trim();
        }
      } catch (err: any) {
        console.warn(`[Gemini] Exception calling model ${model} (attempt ${attempt}/${maxAttempts}):`, err.message);
        lastError = err;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  if (lastError && (lastError.message.includes('429') || lastError.message.includes('503'))) {
    throw new Error(
      'Los servidores de Gemini están experimentando alta demanda momentánea o alcanzaron el límite de solicitudes por minuto de la capa gratuita. Por favor, espera unos segundos e inténtalo de nuevo.'
    );
  }

  throw lastError || new Error('No se pudo generar la minuta con ninguno de los modelos de Gemini disponibles.');
}
