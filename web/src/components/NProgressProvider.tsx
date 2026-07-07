'use client';

import { useEffect } from 'react';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

NProgress.configure({ showSpinner: false, minimum: 0.1, speed: 300 });

let activeRequests = 0;

function patchFetch() {
  const original = window.fetch;
  window.fetch = async function (...args) {
    if (activeRequests === 0) NProgress.start();
    activeRequests++;
    try {
      return await original.apply(this, args);
    } finally {
      activeRequests--;
      if (activeRequests === 0) NProgress.done();
    }
  };
}

export default function NProgressProvider() {
  useEffect(() => {
    patchFetch();
  }, []);
  return null;
}
