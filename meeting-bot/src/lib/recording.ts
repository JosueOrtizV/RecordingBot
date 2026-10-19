import { ContentType } from '../types';

export const mp4ContentType: ContentType = 'video/mp4';
export const mp4Avc1MimeType = 'video/mp4;codecs=avc1';
export const mp4GenericMimeType = 'video/mp4';

export const webmContentType: ContentType = 'video/webm';
export const vp8WebmMimeType = `${webmContentType};codecs=vp8,opus`;
export const webmMimeType = `${webmContentType};codecs=vp9,opus`;
export const vp9ContentType: ContentType = 'video/webm';
export const vp9MimeType = `${vp9ContentType};codecs=vp09.00.10.08,opus`;

export const audioWebmMimeType = 'audio/webm;codecs=opus';
export const audioGenericWebmMimeType = 'audio/webm';
export const audioMp4MimeType = 'audio/mp4';

export const getRecordingMimeTypesForExtension = (_extension: string, isAudioOnly: boolean = false) => {
  if (isAudioOnly) {
    return {
      mimeTypes: [audioWebmMimeType, audioGenericWebmMimeType, audioMp4MimeType],
      primaryMimeType: audioWebmMimeType,
      secondaryMimeType: audioGenericWebmMimeType,
    };
  }

  // Always prefer WebM (VP8 + Opus) during live browser MediaRecorder capture:
  // 1. VP8 software encoding in headless Xvfb uses ~3x less CPU than H.264/VP9, preventing audio packet drops.
  // 2. WebM handles dynamic Google Meet resolution changes without breaking stream headers.
  // 3. DiskUploader transcodes the captured WebM into standard MP4 (H.264 + AAC + faststart) after the call.
  const webmCaptureMimeTypes = [vp8WebmMimeType, webmMimeType, vp9MimeType, 'video/webm'];

  return {
    mimeTypes: webmCaptureMimeTypes,
    primaryMimeType: vp8WebmMimeType,
    secondaryMimeType: webmMimeType,
  };
};
