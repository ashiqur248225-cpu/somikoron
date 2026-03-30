
'use client';

import React, { useMemo, useEffect, useState, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  const { auth, firestore } = firebaseServices;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Auto sign-in failed", error);
          setIsBootstrapping(false);
        }
      } else {
        // Ensure user is in the managers collection for dev/prototype
        const managerRef = doc(firestore, 'managers', user.uid);
        try {
          const snap = await getDoc(managerRef);
          if (!snap.exists()) {
            await setDoc(managerRef, { 
              uid: user.uid,
              role: 'admin',
              createdAt: serverTimestamp() 
            });
          }
        } catch (error) {
          console.error("Manager setup failed", error);
        } finally {
          setIsBootstrapping(false);
        }
      }
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  if (isBootstrapping) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing HostelLedger...</p>
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
