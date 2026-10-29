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

  // Always prefer WebM VP8 during live browser MediaRecorder capture:
  // 1. VP8 software encoding in headless Xvfb uses minimal CPU when capturing video-only.
  // 2. WebM handles dynamic Google Meet resolution changes without breaking stream headers.
  // 3. DiskUploader muxes the video with pristine PulseAudio audio into standard MP4 after the call.
  const webmCaptureMimeTypes = ['video/webm;codecs=vp8', vp8WebmMimeType, webmMimeType, 'video/webm'];

  return {
    mimeTypes: webmCaptureMimeTypes,
    primaryMimeType: vp8WebmMimeType,
    secondaryMimeType: webmMimeType,
  };
};
