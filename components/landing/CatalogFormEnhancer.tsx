'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Progressive enhancement for the /tours GET form (client component because it needs a submit
 * listener and the router): drops empty fields and defaults so result URLs stay short, and navigates
 * client-side. Without JavaScript the form still submits normally.
 */
export default function CatalogFormEnhancer({ formId }: { formId: string }) {
  const router = useRouter();

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value !== 'string' || value.trim() === '') continue;
        if (key === 'sort' && value === 'soonest') continue;
        params.set(key, value.trim());
      }
      const qs = params.toString();
      router.push(qs ? `/tours?${qs}` : '/tours');
    };

    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [formId, router]);

  return null;
}
