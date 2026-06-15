import { Suspense } from 'react';
import ResultsClient from './ResultsClient';

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading results…</div>}>
      <ResultsClient />
    </Suspense>
  );
}
