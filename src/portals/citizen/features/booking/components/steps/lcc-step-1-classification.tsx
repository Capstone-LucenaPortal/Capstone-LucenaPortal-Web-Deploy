'use client';

import { useEffect, useState } from 'react';
import type { BookingFormData } from '@/portals/citizen/features/booking/types';
import { Button } from '@/portals/citizen/components/ui/button';
import { catalogService, type CatalogOption } from '@/portals/citizen/lib/supabase/catalogs';

interface Props {
  bookingData: BookingFormData;
  onUpdate: (fields: Partial<BookingFormData>) => void;
  onNext: () => void;
}

export default function LCCStep1Classification({ bookingData, onUpdate, onNext }: Props) {
  const { classificationCode } = bookingData;
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogService.getBookingClassifications()
      .then((o) => {
        setOptions(o);
      })
      .catch(() => {
        setOptions([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
      <div className="text-center" style={{ marginBottom: 32 }}>
        <h2 className="text-2xl font-bold text-[#003DA5]" style={{ marginBottom: 12 }}>Step 1: Classification</h2>
        <p className="text-[#666666] text-[15px]">To help us provide the correct rates and eligibility, please select your organization type.</p>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#666666', marginBottom: 32 }}>Loading options…</p>
      ) : (
        <div className="flex flex-col" style={{ gap: 16, marginBottom: 32 }}>
          {options.map((o) => (
            <div
              key={o.code}
              role="radio"
              aria-checked={classificationCode === o.code}
              tabIndex={0}
              onClick={() => onUpdate({ classificationCode: o.code })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onUpdate({ classificationCode: o.code });
                }
              }}
              className="rounded-xl cursor-pointer flex items-center transition-all duration-200"
              style={{
                padding: 24,
                gap: 20,
                border: `2px solid ${classificationCode === o.code ? '#003DA5' : '#e5e7eb'}`,
                background: classificationCode === o.code ? 'rgba(0,61,165,0.05)' : '#fff',
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  border: `2px solid ${classificationCode === o.code ? '#003DA5' : '#d1d5db'}`,
                  background: classificationCode === o.code ? '#003DA5' : 'transparent',
                }}
              >
                {classificationCode === o.code && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
              </div>
              <div className="font-bold text-base text-[#333333]">{o.label}</div>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="primary"
        onClick={onNext}
        disabled={!classificationCode}
        className="w-full text-base font-bold rounded-lg"
        style={{ paddingTop: 16, paddingBottom: 16 }}
      >
        Continue to Venue Selection
      </Button>

      <p className="text-center text-xs text-[#666666]" style={{ marginTop: 16 }}>
        Note: Certain classifications may be eligible for discounted venue rates, subject to verification.
      </p>
    </div>
  );
}
