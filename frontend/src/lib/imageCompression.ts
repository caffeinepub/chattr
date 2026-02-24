/**
 * Client-side image compression utility
 * Compresses images while preserving correct orientation and quality
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  mimeType: 'image/jpeg',
};

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @param onProgress - Optional progress callback (0-100)
 * @returns Compressed file or original if compression fails/not needed
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {},
  onProgress?: (percentage: number) => void
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Only compress image files
  if (!file.type.startsWith('image/')) {
    console.log('[ImageCompression] Not an image file, skipping compression');
    return file;
  }

  // Skip compression for GIFs (to preserve animation) and SVGs
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    console.log('[ImageCompression] Skipping compression for GIF/SVG');
    return file;
  }

  try {
    if (onProgress) onProgress(10);

    // Load image
    const img = await loadImage(file);
    
    if (onProgress) onProgress(30);

    // Calculate new dimensions
    let { width, height } = img;
    
    if (width > opts.maxWidth || height > opts.maxHeight) {
      const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      console.log('[ImageCompression] Resizing from', img.width, 'x', img.height, 'to', width, 'x', height);
    } else {
      console.log('[ImageCompression] Image dimensions within limits, only recompressing');
    }

    if (onProgress) onProgress(50);

    // Create canvas and draw image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Use high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw image (browser automatically handles EXIF orientation)
    ctx.drawImage(img, 0, 0, width, height);

    if (onProgress) onProgress(70);

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        opts.mimeType,
        opts.quality
      );
    });

    if (onProgress) onProgress(90);

    // Create new file from blob
    const compressedFile = new File([blob], file.name, {
      type: opts.mimeType,
      lastModified: Date.now(),
    });

    const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
    console.log(
      '[ImageCompression] Compressed:',
      formatBytes(file.size),
      '→',
      formatBytes(compressedFile.size),
      `(${compressionRatio}% reduction)`
    );

    if (onProgress) onProgress(100);

    // Only return compressed version if it's actually smaller
    if (compressedFile.size < file.size) {
      return compressedFile;
    } else {
      console.log('[ImageCompression] Compressed file is larger, using original');
      return file;
    }
  } catch (error) {
    console.error('[ImageCompression] Compression failed, using original file:', error);
    // Fallback to original file on any error
    return file;
  }
}

/**
 * Load an image file into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
