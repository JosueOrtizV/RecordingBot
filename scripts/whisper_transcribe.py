import sys
import os
import argparse
from datetime import timedelta

def format_timestamp(seconds: float) -> str:
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    return f"[{hours:02d}:{minutes:02d}:{secs:02d}]"

def transcribe(input_file: str, output_file: str, model_size: str = "small", language: str = "es"):
    if not os.path.exists(input_file):
        print(f"Error: Input file does not exist: {input_file}", file=sys.stderr)
        sys.exit(1)

    print(f"[Whisper] Loading model '{model_size}' (CPU int8)...")
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("Error: faster_whisper is not installed in the current environment.", file=sys.stderr)
        sys.exit(1)

    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    print(f"[Whisper] Transcribing '{input_file}' in language '{language}'...")
    segments, info = model.transcribe(input_file, language=language, beam_size=5)

    print(f"[Whisper] Detected language '{info.language}' with probability {info.language_probability:.2f}")

    lines = []
    lines.append("=====================================================")
    lines.append(f"  TRANSCRIPCION DE RESPALDO (WHISPER AI) - IDIOMA: {language.upper()}")
    lines.append("=====================================================\n")

    for segment in segments:
        ts = format_timestamp(segment.start)
        text = segment.text.strip()
        line = f"{ts} Audio: {text}"
        lines.append(line)
        print(line)

    output_dir = os.path.dirname(output_file)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"[Whisper] Successfully saved transcription to '{output_file}' ({len(lines)-3} segments).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transcribe audio/video using faster-whisper")
    parser.add_argument("input_file", help="Path to input audio/video file (.webm, .wav, .mp4)")
    parser.add_argument("output_file", help="Path to output transcript file (.txt)")
    parser.add_argument("--model", default="small", help="Whisper model size (tiny, base, small, medium)")
    parser.add_argument("--lang", default="es", help="Language code (default: es)")

    args = parser.parse_args()
    transcribe(args.input_file, args.output_file, model_size=args.model, language=args.lang)
