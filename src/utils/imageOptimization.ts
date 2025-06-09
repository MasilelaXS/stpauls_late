// Image optimization utility using browser-image-compression
import imageCompression from "browser-image-compression";

export interface ImageOptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  useWebWorker?: boolean;
}

export interface OptimizationResult {
  optimizedFile: File;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
}

/**
 * Default optimization settings for offence images
 */
export const DEFAULT_OPTIMIZATION_OPTIONS: ImageOptimizationOptions = {
  maxSizeMB: 1, // Maximum file size in MB
  maxWidthOrHeight: 1920, // Maximum width or height for good quality
  quality: 0.8, // Image quality (0.1 to 1)
  useWebWorker: true, // Use web worker for better performance
};

/**
 * High quality optimization settings for important images
 */
export const HIGH_QUALITY_OPTIONS: ImageOptimizationOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2560,
  quality: 0.9,
  useWebWorker: true,
};

/**
 * Fast compression settings for quick uploads
 */
export const FAST_COMPRESSION_OPTIONS: ImageOptimizationOptions = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1280,
  quality: 0.7,
  useWebWorker: true,
};

/**
 * Validate if a file is a supported image type
 */
export function isValidImageFile(file: File): boolean {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  return allowedTypes.includes(file.type);
}

/**
 * Check if file size is within acceptable limits (before optimization)
 */
export function isFileSizeAcceptable(
  file: File,
  maxSizeMB: number = 10
): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

/**
 * Optimize an image file with the given options
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = DEFAULT_OPTIMIZATION_OPTIONS
): Promise<OptimizationResult> {
  if (!isValidImageFile(file)) {
    throw new Error(
      "Invalid image file type. Please select JPEG, PNG, GIF, or WebP."
    );
  }

  if (!isFileSizeAcceptable(file)) {
    throw new Error(
      "File size is too large. Please select a file smaller than 10MB."
    );
  }

  const originalSize = file.size;

  console.log(`Starting image optimization...`);
  console.log(`Original file: ${file.name}`);
  console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  try {
    const optimizedFile = await imageCompression(file, options);
    const optimizedSize = optimizedFile.size;
    const compressionRatio =
      ((originalSize - optimizedSize) / originalSize) * 100;

    console.log(
      `Optimized size: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`Compression ratio: ${compressionRatio.toFixed(1)}%`);

    // Create a new file with the original name but optimized content
    const finalFile = new File([optimizedFile], file.name, {
      type: optimizedFile.type,
      lastModified: Date.now(),
    });

    return {
      optimizedFile: finalFile,
      originalSize,
      optimizedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error("Image optimization failed:", error);
    throw new Error(
      "Failed to optimize image. Please try again or use a different image."
    );
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get compression quality recommendation based on file size
 */
export function getRecommendedQuality(fileSizeBytes: number): number {
  const sizeMB = fileSizeBytes / (1024 * 1024);

  if (sizeMB < 1) return 0.9; // Small files can use high quality
  if (sizeMB < 3) return 0.8; // Medium files use good quality
  if (sizeMB < 5) return 0.7; // Large files use reduced quality
  return 0.6; // Very large files use lower quality
}
