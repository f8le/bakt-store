'use client';
import Script from 'next/script';
import { useCallback } from 'react';

type Cfg = { orderId: string; amount: number; description: string; publishableKey: string; callbackUrl: string };
declare global { interface Window { Moyasar?: { init: (c: Record<string, unknown>) => void } } }

export default function PayForm(c: Cfg) {
  const init = useCallback(() => {
    if (!window.Moyasar || document.querySelector('.mysr-form')?.childElementCount) return;
    window.Moyasar.init({
      element: '.mysr-form', amount: c.amount, currency: 'SAR', description: c.description,
      publishable_api_key: c.publishableKey, callback_url: c.callbackUrl, methods: ['creditcard'],
      metadata: { order_id: c.orderId },
    });
  }, [c.amount, c.callbackUrl, c.description, c.orderId, c.publishableKey]);

  return (
    <>
      <link rel="stylesheet" href="https://cdn.moyasar.com/mpf/1.15.0/moyasar.css" />
      <Script src="https://cdn.moyasar.com/mpf/1.15.0/moyasar.js" strategy="afterInteractive" onReady={init} />
      <div className="mysr-form" />
    </>
  );
}
