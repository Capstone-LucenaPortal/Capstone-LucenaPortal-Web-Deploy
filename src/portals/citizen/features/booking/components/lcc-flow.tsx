'use client';

import { useState } from 'react';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import LCCAbout from './lcc-about';
import LCCBooking from './lcc-booking';

export default function LCCFlow() {
  const [activeTab, setActiveTab] = useState<'about' | 'booking'>('about');
  const { user, openAuthModal, isPasswordRecovery } = useAuth();
  const canBook = user && !isPasswordRecovery;

  const tabBtnStyle = (active: boolean) =>
    `rounded border-2 border-[#003DA5] font-semibold cursor-pointer transition-all ${
      active
        ? 'bg-[#003DA5] text-white'
        : 'bg-white text-[#003DA5]'
    }`;

  return (
    <>
      {activeTab === 'about' && <LCCAbout onBook={() => setActiveTab('booking')} />}
      {activeTab === 'booking' && (
        !canBook ? (
          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '32px', textAlign: 'center', maxWidth: 560, margin: '24px auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Sign in to book the Lucena Convention Center (LCC)</h3>
            <p style={{ fontSize: 14, color: '#666666', marginBottom: 20 }}>
              You need a portal account to reserve the Lucena Convention Center.
            </p>
            <button onClick={() => openAuthModal('login')} className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer" style={{ padding: '12px 28px', background: '#003DA5' }}>
              Sign In / Create Account
            </button>
          </div>
        ) : (
          <LCCBooking />
        )
      )}

      <div className="fixed flex justify-center z-10" style={{ bottom: 24, left: 24, right: 24, gap: 12 }}>
        <button className={tabBtnStyle(activeTab === 'about')} style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10 }} onClick={() => setActiveTab('about')}>
          About Venue
        </button>
        <button className={tabBtnStyle(activeTab === 'booking')} style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10 }} onClick={() => setActiveTab('booking')}>
          Book Now
        </button>
      </div>
    </>
  );
}
