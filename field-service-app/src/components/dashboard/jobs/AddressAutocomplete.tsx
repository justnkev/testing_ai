'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Dynamically import SearchBox to avoid SSR issues with window/document
const SearchBox = dynamic(
    () => import('@mapbox/search-js-react').then((mod) => mod.SearchBox),
    { ssr: false }
);

interface AddressAutocompleteProps {
    onSelect: (result: {
        address: string;
        latitude: number;
        longitude: number;
    }) => void;
    accessToken: string;
}

export default function AddressAutocomplete({ onSelect, accessToken }: AddressAutocompleteProps) {
    const [isVerified, setIsVerified] = useState(false);

    const handleRetrieve = (res: any) => {
        if (!res || !res.features || res.features.length === 0) return;

        const feature = res.features[0];
        const { geometry, properties } = feature;

        if (geometry && geometry.coordinates) {
            const [longitude, latitude] = geometry.coordinates;

            onSelect({
                address: properties.full_address || properties.address || 'Unknown Address',
                latitude,
                longitude
            });
            setIsVerified(true);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-slate-300">
                    Job Location <span className="text-red-400">*</span>
                </label>
                {isVerified && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 gap-1">
                        <Check className="w-3 h-3" />
                        Verified
                    </Badge>
                )}
            </div>

            <div
                className="address-autocomplete-wrapper [&_input]:bg-slate-700/50 [&_input]:border-slate-600 [&_input]:text-white [&_input]:rounded-md"
                onKeyDown={(e) => {
                    // Reset verification if user modifies text manually
                    if (isVerified && e.key.length === 1) {
                        setIsVerified(false);
                    }
                }}
            >
                <SearchBox
                    accessToken={accessToken}
                    options={{
                        language: 'en',
                        country: 'US', // Bias towards US results as requested
                    }}
                    onRetrieve={handleRetrieve}
                    theme={{
                        variables: {
                            fontFamily: 'inherit',
                            unit: '16px',
                            border: '1px solid #475569',
                            borderRadius: '6px',
                            boxShadow: 'none',
                        }
                    }}
                />
            </div>
            {!isVerified && (
                <p className="text-xs text-slate-500">
                    Please select a valid address from the dropdown suggestions.
                </p>
            )}
        </div>
    );
}
