import { StorageProvider } from './storage-provider';
import { S3StorageProvider } from './s3-storage-provider';
import { AzureBlobStorageProvider } from './azure-blob-storage-provider';
import { GoogleDriveStorageProvider } from './google-drive-storage-provider';
import config from '../../config';

export function getStorageProvider(): StorageProvider {
  if (config.storageProvider === 'drive') {
    return new GoogleDriveStorageProvider();
  }
  if (config.storageProvider === 'azure') {
    return new AzureBlobStorageProvider();
  }
  return new S3StorageProvider();
}
