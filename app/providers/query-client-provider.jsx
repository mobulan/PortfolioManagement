'use client';

import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '../lib/get-query-client';

function QueryDevtools() {
  const [hasValidLocale, setHasValidLocale] = useState(false);

  useEffect(() => {
    try {
      Intl.getCanonicalLocales(navigator.language || 'en-US');
      setHasValidLocale(true);
    } catch {
      setHasValidLocale(false);
    }
  }, []);

  return hasValidLocale ? <ReactQueryDevtools initialIsOpen={false} /> : null;
}

export function QueryClientProviderWrapper({ children }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' ? <QueryDevtools /> : null}
    </QueryClientProvider>
  );
}
