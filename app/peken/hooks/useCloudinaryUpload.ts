// app/peken/hooks/useCloudinaryUpload.ts
'use client';

import { useState, useCallback } from 'react';

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  duration: number;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

interface UploadOptions {
  folder?: string;
  transformation?: Record<string, any>;
  onProgress?: (progress: number) => void;
}

export const useCloudinaryUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ): Promise<CloudinaryUploadResult | null> => {
    const { folder = 'peken/videos', onProgress } = options;

    if (!file.type.startsWith('video/')) {
      setError('File harus berupa video');
      return null;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('Ukuran video maksimal 100MB');
      return null;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'peken_upload'); // Buat di Cloudinary Dashboard
    formData.append('folder', folder);
    formData.append('resource_type', 'video');

    // Optional: Tambahkan transformation untuk optimasi
    if (options.transformation) {
      formData.append('transformation', JSON.stringify(options.transformation));
    }

    try {
      // Simulate progress (Cloudinary doesn't provide native progress)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + 10, 90);
          onProgress?.(newProgress);
          return newProgress;
        });
      }, 500);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/daoqovlxt/video/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload gagal');
      }

      const data = await response.json();
      setProgress(100);
      onProgress?.(100);

      return {
        secure_url: data.secure_url,
        public_id: data.public_id,
        duration: data.duration,
        format: data.format,
        width: data.width,
        height: data.height,
        bytes: data.bytes
      };
    } catch (err) {
      console.error('Cloudinary upload error:', err);
      setError(err instanceof Error ? err.message : 'Gagal upload video');
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const uploadThumbnail = useCallback(async (
    file: File,
    folder: string = 'peken/thumbnails'
  ): Promise<string | null> => {
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar');
      return null;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran thumbnail maksimal 5MB');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'peken_upload');
    formData.append('folder', folder);
    formData.append('resource_type', 'image');

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/daoqovlxt/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Upload thumbnail gagal');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (err) {
      console.error('Thumbnail upload error:', err);
      setError(err instanceof Error ? err.message : 'Gagal upload thumbnail');
      return null;
    }
  }, []);

  const generateVideoThumbnail = useCallback((videoPublicId: string, timeInSeconds: number = 0): string => {
    // Cloudinary auto generate thumbnail dari video
    return `https://res.cloudinary.com/daoqovlxt/video/upload/so_${timeInSeconds}/${videoPublicId}.jpg`;
  }, []);

  return {
    uploadVideo,
    uploadThumbnail,
    generateVideoThumbnail,
    uploading,
    progress,
    error
  };
};