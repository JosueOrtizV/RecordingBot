import { ContentType } from '../types';

export const mp4ContentType: ContentType = 'video/mp4';
export const mp4Avc1MimeType = 'video/mp4;codecs=avc1';
export const mp4GenericMimeType = 'video/mp4';

export const webmContentType: ContentType = 'video/webm';
export const webmMimeType = `${webmContentType};codecs=vp9,opus`;
export const vp9ContentType: ContentType = 'video/webm';
export const vp9MimeType = `${vp9ContentType};codecs=vp09.00.10.08,opus`;

export const audioWebmMimeType = 'audio/webm;codecs=opus';
export const audioGenericWebmMimeType = 'audio/webm';
export const audioMp4MimeType = 'audio/mp4';

export const getRecordingMimeTypesForExtension = (extension: string, isAudioOnly: boolean = false) => {
  if (isAudioOnly) {
    return {
      mimeTypes: [audioWebmMimeType, audioGenericWebmMimeType, audioMp4MimeType],
      primaryMimeType: audioWebmMimeType,
      secondaryMimeType: audioGenericWebmMimeType,
    };
  }

  const webmVp9MimeTypes = [webmMimeType, vp9MimeType, 'video/webm;codecs=vp8,opus', 'video/webm'];

  if (extension === '.mp4') {
    return {
      mimeTypes: [mp4Avc1MimeType, mp4GenericMimeType, ...webmVp9MimeTypes],
      primaryMimeType: mp4Avc1MimeType,
      secondaryMimeType: webmMimeType,
    };
  }

  return {
    mimeTypes: webmVp9MimeTypes,
    primaryMimeType: webmMimeType,
    secondaryMimeType: vp9MimeType,
  };
};

