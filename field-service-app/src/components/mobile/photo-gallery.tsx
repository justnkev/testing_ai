'use client';

import { useState, useCallback, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { deleteJobPhoto } from '@/lib/actions/job-execution';
import { toast } from 'sonner';
import { Camera, Trash2, Loader2, ImagePlus, X } from 'lucide-react';
import Image from 'next/image';

interface Photo {
    id: string;
    photo_type: 'before' | 'during' | 'after' | 'other';
    storage_path: string;
    file_name: string;
    caption: string | null;
}

interface PhotoGalleryProps {
    jobId: string;
    photos: Photo[];
    onPhotosChange: () => void;
}

type PhotoType = 'before' | 'during' | 'after';

const PHOTO_TYPES: { type: PhotoType; label: string; color: string }[] = [
    { type: 'before', label: 'Before', color: 'bg-orange-500' },
    { type: 'during', label: 'During', color: 'bg-blue-500' },
    { type: 'after', label: 'After', color: 'bg-green-500' },
];

export function PhotoGallery({ jobId, photos, onPhotosChange }: PhotoGalleryProps) {
    const [activeTab, setActiveTab] = useState<PhotoType>('before');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredPhotos = photos.filter((p) => p.photo_type === activeTab);

    // Compress and upload image
    const handleFileSelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            setIsUploading(true);
            setUploadProgress(10);

            try {
                // Compress image
                setUploadProgress(30);
                const compressedFile = await imageCompression(file, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    onProgress: (p) => setUploadProgress(30 + p * 0.4),
                });

                setUploadProgress(70);

                // Create FormData for upload
                const formData = new FormData();
                formData.append('file', compressedFile, file.name);
                formData.append('jobId', jobId);
                formData.append('photoType', activeTab);

                // Upload via API route
                const response = await fetch('/api/photos/upload', {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();

                setUploadProgress(100);

                if (response.ok && result.success) {
                    toast.success(`${activeTab} photo uploaded!`);
                    onPhotosChange();
                } else {
                    toast.error(result.error || 'Failed to upload photo');
                }
            } catch (error) {
                console.error('Upload error:', error);
                toast.error('Failed to upload photo');
            } finally {
                setIsUploading(false);
                setUploadProgress(0);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        },
        [jobId, activeTab, onPhotosChange]
    );

    // Delete photo
    const handleDelete = useCallback(
        async (photoId: string) => {
            const result = await deleteJobPhoto(photoId);
            if (result.success) {
                toast.success('Photo deleted');
                onPhotosChange();
            } else {
                toast.error(result.error);
            }
        },
        [onPhotosChange]
    );

    // Get public URL for display
    const getDisplayUrl = useCallback((storagePath: string) => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        return `${supabaseUrl}/storage/v1/object/public/job-photos/${storagePath}`;
    }, []);

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-slate-700">
                {PHOTO_TYPES.map(({ type, label, color }) => {
                    const count = photos.filter((p) => p.photo_type === type).length;
                    return (
                        <button
                            key={type}
                            onClick={() => setActiveTab(type)}
                            className={`flex-1 py-3 px-2 text-sm font-medium transition-colors relative ${activeTab === type
                                ? 'text-white bg-slate-700'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {label}
                            {count > 0 && (
                                <span
                                    className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${color} text-white`}
                                >
                                    {count}
                                </span>
                            )}
                            {activeTab === type && (
                                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${color}`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Photo Grid */}
            <div className="p-4">
                {filteredPhotos.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No {activeTab} photos yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {filteredPhotos.map((photo) => (
                            <div
                                key={photo.id}
                                className="relative aspect-square rounded-lg overflow-hidden bg-slate-700 group"
                            >
                                <Image
                                    src={getDisplayUrl(photo.storage_path)}
                                    alt={photo.caption || photo.file_name}
                                    fill
                                    className="object-cover"
                                    onClick={() => setPreviewUrl(getDisplayUrl(photo.storage_path))}
                                />
                                <button
                                    onClick={() => handleDelete(photo.id)}
                                    className="absolute top-2 right-2 p-2 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Upload Button */}
                <div className="relative">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isUploading}
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full h-14 text-base"
                        variant="outline"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Uploading... {uploadProgress}%
                            </>
                        ) : (
                            <>
                                <ImagePlus className="w-5 h-5 mr-2" />
                                Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Photo
                            </>
                        )}
                    </Button>

                    {/* Progress bar */}
                    {isUploading && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-600 rounded-b-lg overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Full Screen Preview */}
            {previewUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                    onClick={() => setPreviewUrl(null)}
                >
                    <button
                        onClick={() => setPreviewUrl(null)}
                        className="absolute top-4 right-4 p-2 bg-white/10 rounded-full z-10"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                    <Image
                        src={previewUrl}
                        alt="Preview"
                        fill
                        className="object-contain"
                    />
                </div>
            )}
        </div>
    );
}
