# RecordingBot 🤖🎥

Bot automatizado para Google Meet con grabación de video/audio, extracción de subtítulos y transcripción con nombres en tiempo real, integración con Google Calendar y sincronización a Google Drive.

---

## 🏗️ Arquitectura del Sistema

```
[Google Calendar API] ──(Polling cada 2m)──► [Scheduler]
                                                    │
                                         (Job 5m antes de reunión)
                                                    ▼
                                              [Redis Queue]
                                                    │
                                                    ▼
                                            [Meeting Bot Worker]
                                                    │
                                 ┌──────────────────┴──────────────────┐
                                 ▼                                     ▼
                      [Google Meet (Playwright)]             [Chrome CDP + Xvfb]
                       - Entra como invitado                   - Virtual Display
                         ("Josue's Notetaker")                 - Audio capture
                       - Activa subtítulos en español          - FFmpeg recording
                       - MutationObserver captura
                         diálogo con nombres
                                 │                                     │
                                 └──────────────────┬──────────────────┘
                                                    ▼
                                         [Upload a Google Drive]
                                          - Video .webm
                                          - Transcripción .txt
                                                    │
                                                    ▼
                                            [Telegram Alerts]
                                          - Notificaciones de estado
```

---

## 🚀 Guía de Inicio Rápido

### 1. Autenticación con Google (OAuth 2.0)

Para autorizar la lectura de tu Google Calendar y subida a tu Google Drive:

1. Asegúrate de tener `credentials.json` en la raíz.
2. Ejecuta el asistente de autenticación:
   ```bash
   node scripts/auth-google.js
   ```
3. Abre el enlace proporcionado, otorga permisos y pega el código devuelto. Se generará automáticamente `token.json`.

### 2. Despliegue con Docker Compose

```bash
# Copiar variables de entorno
cp .env.example .env

# Levantar todos los servicios (Redis, Chrome CDP, Bot, Scheduler)
docker compose up -d --build
```

### 3. Monitoreo de Logs

```bash
# Ver logs del bot
docker compose logs -f meeting-bot

# Ver logs del scheduler de Calendar
docker compose logs -f scheduler
```

---

## ⚙️ Configuración (`.env`)

| Variable | Descripción | Default |
|:---|:---|:---|
| `BOT_DISPLAY_NAME` | Nombre con el que el bot entra a la llamada | `Josue's Notetaker` |
| `STORAGE_PROVIDER` | Proveedor de almacenamiento (`drive`, `s3`, `azure`) | `drive` |
| `GOOGLE_DRIVE_FOLDER_NAME` | Nombre de la carpeta raíz en Google Drive | `RecordingBot` |
| `JOIN_WAIT_TIME_MINUTES` | Minutos de espera en lobby para ser admitido | `5` |
| `CALENDAR_POLL_INTERVAL_MINUTES` | Intervalo de polling a Google Calendar | `2` |
| `TIMEZONE` | Zona horaria del scheduler y marcas de tiempo | `America/Mexico_City` |

---

## 🚢 Despliegue en VPS (CI/CD)

El proyecto incluye `.github/workflows/deploy.yml` configurado para desplegar automáticamente al hacer `git push` a `main`/`master` hacia `/var/www/RecordingBot` en el VPS.
