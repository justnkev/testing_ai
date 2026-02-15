'use client';

import { useRef, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Eraser, Check, X } from 'lucide-react';

interface SignaturePadProps {
    onCapture: (signatureData: string, signerName: string) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export function SignaturePad({ onCapture, onCancel, isLoading }: SignaturePadProps) {
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [signerName, setSignerName] = useState('');
    const [hasSignature, setHasSignature] = useState(false);

    const handleClear = useCallback(() => {
        sigCanvas.current?.clear();
        setHasSignature(false);
    }, []);

    const handleComplete = useCallback(() => {
        if (!sigCanvas.current || !signerName.trim()) return;

        const signatureData = sigCanvas.current.toDataURL('image/png');
        onCapture(signatureData, signerName.trim());
    }, [signerName, onCapture]);

    const handleEnd = useCallback(() => {
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            setHasSignature(true);
        }
    }, []);

    const canSubmit = hasSignature && signerName.trim().length > 0;

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
            <div>
                <Label htmlFor="signer-name" className="text-white mb-2 block">
                    Customer Name
                </Label>
                <Input
                    id="signer-name"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="h-12 text-base bg-slate-700 border-slate-600"
                />
            </div>

            <div>
                <Label className="text-white mb-2 block">Customer Signature</Label>
                <div className="relative bg-white rounded-lg overflow-hidden">
                    <SignatureCanvas
                        ref={sigCanvas}
                        canvasProps={{
                            className: 'w-full h-48 touch-none',
                            style: { width: '100%', height: '192px' },
                        }}
                        backgroundColor="white"
                        penColor="black"
                        onEnd={handleEnd}
                    />
                    <div className="absolute bottom-2 left-4 right-4 border-b border-gray-300" />
                    <span className="absolute bottom-4 left-4 text-xs text-gray-400">
                        Sign above the line
                    </span>
                </div>
            </div>

            <div className="flex gap-3">
                <Button
                    onClick={handleClear}
                    variant="outline"
                    className="h-12 flex-1 border-slate-600"
                >
                    <Eraser className="w-4 h-4 mr-2" />
                    Clear
                </Button>
                <Button
                    onClick={onCancel}
                    variant="outline"
                    className="h-12 flex-1 border-slate-600"
                >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                </Button>
                <Button
                    onClick={handleComplete}
                    disabled={!canSubmit || isLoading}
                    className="h-12 flex-1 bg-green-600 hover:bg-green-700"
                >
                    <Check className="w-4 h-4 mr-2" />
                    {isLoading ? 'Saving...' : 'Confirm'}
                </Button>
            </div>

            {!canSubmit && (
                <p className="text-center text-xs text-amber-400">
                    {!signerName.trim()
                        ? 'Enter customer name'
                        : !hasSignature
                            ? 'Please sign above'
                            : ''}
                </p>
            )}
        </div>
    );
}
