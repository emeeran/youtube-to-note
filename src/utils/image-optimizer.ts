/**
 * Advanced Image Optimization Utilities
 * Provides image compression, resizing, format conversion, and performance optimization
 */

interface ImageOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0-100
    format?: 'webp' | 'jpeg' | 'png' | 'auto';
    progressive?: boolean;
    optimizeSize?: boolean;
    stripMetadata?: boolean;
    generateThumbnails?: boolean;
    thumbnailSizes?: number[];
}

interface ImageInfo {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    dimensions: { width: number; height: number };
    format: string;
    optimizedFormat: string;
    processingTime: number;
}

interface OptimizedImage {
    blob: Blob;
    url: string;
    info: ImageInfo;
    thumbnails?: Record<string, string>; // size -> url
}

interface ThumbnailConfig {
    size: number;
    quality: number;
    format: string;
}

export class ImageOptimizer {
    private supportedFormats: Set<string>;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D | null;
    private workerPool: Worker[] = [];
    private workerAvailable = false;

    constructor() {
        this.supportedFormats = new Set(['jpeg', 'png', 'webp', 'gif']);
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.initializeWorkerPool();
    }

    /**
     * Initialize worker pool for parallel processing
     */
    private async initializeWorkerPool(): Promise<void> {
        if (!window.Worker) {
            console.warn('[Image Optimizer] Web Workers not supported');
            return;
        }

        try {
            // Create worker code as blob
            const workerCode = `
                self.addEventListener('message', async (e) => {
                    const { imageData, options, id } = e.data;

                    try {
                        const result = await processImage(imageData, options);
                        self.postMessage({
                            id,
                            success: true,
                            result
                        });
                    } catch (error) {
                        self.postMessage({
                            id,
                            success: false,
                            error: error.message
                        });
                    }
                });

                async function processImage(imageData, options) {
                    const { data, width, height } = imageData;

                    // Create offscreen canvas
                    const canvas = new OffscreenCanvas(width, height);
                    const ctx = canvas.getContext('2d');

                    // Put image data
                    const imageDataObj = new ImageData(
                        new Uint8ClampedArray(data),
                        width,
                        height
                    );

                    ctx.putImageData(imageDataObj, 0, 0);

                    // Calculate new dimensions
                    const { newWidth, newHeight } = calculateDimensions(
                        width, height, options.maxWidth, options.maxHeight
                    );

                    // Resize image
                    const resizedCanvas = new OffscreenCanvas(newWidth, newHeight);
                    const resizedCtx = resizedCanvas.getContext('2d');
                    resizedCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

                    // Convert to blob
                    const quality = options.quality ? options.quality / 100 : 0.8;
                    const format = options.format || 'image/webp';

                    const blob = await resizedCanvas.convertToBlob({
                        type: format,
                        quality
                    });

                    return {
                        blob,
                        width: newWidth,
                        height: newHeight,
                        size: blob.size
                    };
                }

                function calculateDimensions(width, height, maxWidth, maxHeight) {
                    let newWidth = width;
                    let newHeight = height;

                    if (maxWidth && width > maxWidth) {
                        newWidth = maxWidth;
                        newHeight = (height * maxWidth) / width;
                    }

                    if (maxHeight && newHeight > maxHeight) {
                        newHeight = maxHeight;
                        newWidth = (width * maxHeight) / height;
                    }

                    return {
                        newWidth: Math.round(newWidth),
                        newHeight: Math.round(newHeight)
                    };
                }
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);

            // Create pool of workers
            const poolSize = Math.min(navigator.hardwareConcurrency || 4, 4);
            for (let i = 0; i < poolSize; i++) {
                this.workerPool.push(new Worker(workerUrl));
            }

            this.workerAvailable = true;
            console.log(`[Image Optimizer] Worker pool initialized with ${poolSize} workers`);

        } catch (error) {
            console.warn('[Image Optimizer] Failed to initialize worker pool:', error);
        }
    }

    /**
     * Optimize image from file
     */
    async optimizeImage(file: File, options: ImageOptions = {}): Promise<OptimizedImage> {
        const startTime = performance.now();

        // Validate input
        if (!this.isImageFile(file)) {
            throw new Error('Invalid image file');
        }

        const defaultOptions: ImageOptions = {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 80,
            format: 'auto',
            progressive: true,
            optimizeSize: true,
            stripMetadata: true,
            generateThumbnails: true,
            thumbnailSizes: [150, 300, 600],
            ...options
        };

        try {
            // Get image info
            const imageInfo = await this.getImageInfo(file);

            // Determine optimal format
            const optimalFormat = this.getOptimalFormat(file.type, defaultOptions.format);

            // Process image
            const result = await this.processImage(file, {
                ...defaultOptions,
                format: optimalFormat
            });

            const processingTime = performance.now() - startTime;

            // Create optimized image object
            const optimizedImage: OptimizedImage = {
                blob: result.blob,
                url: URL.createObjectURL(result.blob),
                info: {
                    originalSize: file.size,
                    optimizedSize: result.size,
                    compressionRatio: file.size / result.size,
                    dimensions: { width: imageInfo.width, height: imageInfo.height },
                    format: file.type,
                    optimizedFormat: result.blob.type,
                    processingTime
                }
            };

            // Generate thumbnails if requested
            if (defaultOptions.generateThumbnails) {
                optimizedImage.thumbnails = await this.generateThumbnails(
                    file,
                    defaultOptions.thumbnailSizes || []
                );
            }

            console.log(`[Image Optimizer] Image optimized in ${processingTime.toFixed(2)}ms`);
            return optimizedImage;

        } catch (error) {
            console.error('[Image Optimizer] Image optimization failed:', error);
            throw error;
        }
    }

    /**
     * Optimize multiple images in parallel
     */
    async optimizeImages(files: File[], options: ImageOptions = {}): Promise<OptimizedImage[]> {
        if (!this.workerAvailable) {
            // Fallback to sequential processing
            const results: OptimizedImage[] = [];
            for (const file of files) {
                results.push(await this.optimizeImage(file, options));
            }
            return results;
        }

        // Process in parallel using worker pool
        const promises = files.map(file => this.optimizeImage(file, options));
        return Promise.all(promises);
    }

    /**
     * Process image using appropriate method
     */
    private async processImage(file: File, options: ImageOptions): Promise<any> {
        const imageData = await this.loadImageData(file);
        const { width, height } = imageData;

        // Calculate new dimensions
        const { newWidth, newHeight } = this.calculateDimensions(
            width, height, options.maxWidth, options.maxHeight
        );

        // If no resizing needed and no format conversion, return original
        if (newWidth === width && newHeight === height && !this.needsFormatConversion(file.type, options.format)) {
            return {
                blob: file,
                size: file.size,
                width,
                height
            };
        }

        // Use worker pool if available
        if (this.workerAvailable && this.workerPool.length > 0) {
            return await this.processWithWorker(imageData, options);
        } else {
            return await this.processInMainThread(imageData, options);
        }
    }

    /**
     * Load image data from file
     */
    private async loadImageData(file: File): Promise<{ data: ArrayBuffer; width: number; height: number }> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx!.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    if (blob) {
                        blob.arrayBuffer().then(buffer => {
                            resolve({
                                data: buffer,
                                width: img.width,
                                height: img.height
                            });
                        });
                    } else {
                        reject(new Error('Failed to convert image to blob'));
                    }
                });
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Process image using worker
     */
    private async processWithWorker(imageData: any, options: ImageOptions): Promise<any> {
        return new Promise((resolve, reject) => {
            const worker = this.workerPool.pop()!;
            const id = Math.random().toString(36);

            const handleMessage = (e: MessageEvent) => {
                if (e.data.id === id) {
                    worker.removeEventListener('message', handleMessage);
                    this.workerPool.push(worker);

                    if (e.data.success) {
                        resolve(e.data.result);
                    } else {
                        reject(new Error(e.data.error));
                    }
                }
            };

            worker.addEventListener('message', handleMessage);
            worker.postMessage({ imageData, options, id });
        });
    }

    /**
     * Process image in main thread
     */
    private async processInMainThread(imageData: any, options: ImageOptions): Promise<any> {
        const { data, width, height } = imageData;

        // Create image data object
        const imageArray = new Uint8ClampedArray(data);
        const imgData = new ImageData(imageArray, width, height);

        // Put on canvas
        if (!this.ctx) {
            throw new Error('Canvas context not available');
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.putImageData(imgData, 0, 0);

        // Calculate new dimensions
        const { newWidth, newHeight } = this.calculateDimensions(
            width, height, options.maxWidth, options.maxHeight
        );

        // Create new canvas for resized image
        const resizedCanvas = document.createElement('canvas');
        const resizedCtx = resizedCanvas.getContext('2d');
        if (!resizedCtx) {
            throw new Error('Failed to create resized canvas context');
        }

        resizedCanvas.width = newWidth;
        resizedCanvas.height = newHeight;
        resizedCtx.drawImage(this.canvas, 0, 0, newWidth, newHeight);

        // Convert to blob
        const quality = (options.quality || 80) / 100;
        const format = this.getOutputFormat(options.format);

        return new Promise((resolve) => {
            resizedCanvas.toBlob((blob) => {
                resolve({
                    blob: blob!,
                    size: blob!.size,
                    width: newWidth,
                    height: newHeight
                });
            }, format, quality);
        });
    }

    /**
     * Generate thumbnails for different sizes
     */
    async generateThumbnails(file: File, sizes: number[]): Promise<Record<string, string>> {
        const thumbnails: Record<string, string> = {};

        for (const size of sizes) {
            try {
                const thumbnail = await this.optimizeImage(file, {
                    maxWidth: size,
                    maxHeight: size,
                    quality: 70,
                    format: 'webp',
                    generateThumbnails: false
                });

                thumbnails[size.toString()] = thumbnail.url;
            } catch (error) {
                console.warn(`[Image Optimizer] Failed to generate ${size}px thumbnail:`, error);
            }
        }

        return thumbnails;
    }

    /**
     * Get optimal format for image
     */
    private getOptimalFormat(originalFormat: string, preferredFormat: string): string {
        if (preferredFormat !== 'auto') {
            return this.getMimeType(preferredFormat);
        }

        // Always prefer WebP for better compression
        if (this.supportsFormat('webp')) {
            return 'image/webp';
        }

        // Fallback to original or JPEG
        return originalFormat === 'image/png' && !this.needsTransparency(originalFormat)
            ? 'image/jpeg'
            : originalFormat;
    }

    /**
     * Get output MIME type
     */
    private getOutputFormat(format: string): string {
        const formatMap: Record<string, string> = {
            'webp': 'image/webp',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'auto': 'image/webp'
        };

        return formatMap[format] || 'image/jpeg';
    }

    /**
     * Check if browser supports format
     */
    private supportsFormat(format: string): boolean {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        return this.supportedFormats.has(format);
    }

    /**
     * Check if image needs transparency
     */
    private needsTransparency(format: string): boolean {
        return format === 'image/png' || format === 'image/webp';
    }

    /**
     * Check if format conversion is needed
     */
    private needsFormatConversion(originalFormat: string, targetFormat: string): boolean {
        if (targetFormat === 'auto') {
            return this.getOptimalFormat(originalFormat, targetFormat) !== originalFormat;
        }
        return this.getOutputFormat(targetFormat) !== originalFormat;
    }

    /**
     * Calculate new dimensions maintaining aspect ratio
     */
    private calculateDimensions(
        width: number,
        height: number,
        maxWidth?: number,
        maxHeight?: number
    ): { newWidth: number; newHeight: number } {
        let newWidth = width;
        let newHeight = height;

        if (maxWidth && width > maxWidth) {
            newWidth = maxWidth;
            newHeight = (height * maxWidth) / width;
        }

        if (maxHeight && newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = (newWidth * maxHeight) / newHeight;
        }

        return {
            newWidth: Math.round(newWidth),
            newHeight: Math.round(newHeight)
        };
    }

    /**
     * Get image info without loading the full image
     */
    private async getImageInfo(file: File): Promise<{ width: number; height: number }> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height
                });
                URL.revokeObjectURL(img.src);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Check if file is a valid image
     */
    private isImageFile(file: File): boolean {
        return file.type.startsWith('image/') && this.supportedFormats.has(
            file.type.split('/')[1]?.toLowerCase() || ''
        );
    }

    /**
     * Validate image before optimization
     */
    async validateImage(file: File): Promise<boolean> {
        // Check file type
        if (!this.isImageFile(file)) {
            return false;
        }

        // Check file size (max 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return false;
        }

        // Try to load image
        try {
            await this.getImageInfo(file);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get supported formats
     */
    getSupportedFormats(): string[] {
        return Array.from(this.supportedFormats);
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        // Terminate workers
        this.workerPool.forEach(worker => {
            worker.terminate();
        });
        this.workerPool = [];
        this.workerAvailable = false;

        // Clear canvas
        this.ctx = null;
    }
}

// Export singleton instance
export const imageOptimizer = new ImageOptimizer();

/**
 * Convenience function to optimize image
 */
export async function optimizeImage(file: File, options?: ImageOptions): Promise<OptimizedImage> {
    return imageOptimizer.optimizeImage(file, options);
}

/**
 * Convenience function to validate image
 */
export async function validateImage(file: File): Promise<boolean> {
    return imageOptimizer.validateImage(file);
}