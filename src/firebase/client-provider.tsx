'use client';

import React, { useMemo, useEffect, type ReactNode, useState } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Loader2, WifiOff } from 'lucide-react';
import Image from 'next/image';
import logoIcon from '../../public/icon.png';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [showSlowConnectionMsg, setShowSlowConnectionMsg] = useState(false);
  
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  useEffect(() => {
    // Splash screen minimum duration timer (3 seconds)
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 3000);

    // Safety fallback: If connection is taking too long (mobile data issues), force initialize after 8 seconds
    const safetyTimer = setTimeout(() => {
      setIsFirebaseInitialized(true);
      setShowSlowConnectionMsg(true);
    }, 8000);

    if (!firebaseServices) return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
    
    const { auth } = firebaseServices;
    
    // Perform silent anonymous sign-in in the background
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          // Non-blocking sign in
          signInAnonymously(auth).catch(e => console.error("Silent sign-in failed", e));
        } catch (error) {
          console.error("Auto sign-in logic error", error);
        }
      }
      // Mark as initialized as soon as we have a state (auth responds)
      setIsFirebaseInitialized(true);
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, [firebaseServices]);

  // Combine conditions: proceed only when Firebase is initialized AND 3 seconds have passed
  const isReady = isFirebaseInitialized && minTimeElapsed;

  if (!isReady || !firebaseServices) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[10000] animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-6 animate-in zoom-in duration-700">
          <div className="relative h-28 w-28 md:h-36 md:w-32 flex items-center justify-center">
            <Image 
              src={logoIcon}
              width={120}
              height={120}
              alt="Somikoron Logo" 
              className="object-contain"
              priority
            />
          </div>
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-black text-primary tracking-tighter">SOMIKORON</h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-1 w-12 bg-primary/10 rounded-full" />
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="h-1 w-12 bg-primary/10 rounded-full" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] opacity-60">
              Hostel Management Platform
            </p>
            {showSlowConnectionMsg && (
              <div className="pt-4 animate-in slide-in-from-top-2 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                  <WifiOff size={10} /> Slow Connection Detected
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Please wait while we establish a secure session...</p>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-12 left-0 right-0 text-center">
           <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
             Version 2.5.0 • Protected by Somikoron
           </p>
        </div>
      </div>
    );
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
