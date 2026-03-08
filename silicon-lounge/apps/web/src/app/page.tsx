'use client';

import { useState } from 'react';
import { VerificationLevel } from '@silicon-lounge/shared';
import { VerificationGate } from '@/components/VerificationGate';
import { Lounge } from '@/components/Lounge';

export default function Home() {
  const [isVerified, setIsVerified] = useState(false);
  const [token, setToken] = useState('');
  const [level, setLevel] = useState<VerificationLevel>('basic');
  const [fingerprint, setFingerprint] = useState('');

  const handleVerified = (newToken: string, newLevel: VerificationLevel, fp: string) => {
    setToken(newToken);
    setLevel(newLevel);
    setFingerprint(fp);
    setIsVerified(true);
  };

  return (
    <main className="min-h-screen bg-sl-bg-primary">
      {!isVerified ? (
        <VerificationGate onVerified={handleVerified} />
      ) : (
        <Lounge token={token} level={level} fingerprint={fingerprint} />
      )}
    </main>
  );
}