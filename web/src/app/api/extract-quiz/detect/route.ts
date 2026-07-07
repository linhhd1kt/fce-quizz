import { NextRequest, NextResponse } from 'next/server';
import { detectMCQPageRanges } from '../route';
import { getAuthTeacherId } from '@/lib/server-auth';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const userId = await getAuthTeacherId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Please upload a PDF file.' }, { status: 400 });
  }
  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 100MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const detected = await detectMCQPageRanges(buffer);
    const ranges = detected.map((r, i) => ({
      id: `r-${i + 1}`,
      name: `Part ${i + 1}`,
      from: r.from,
      to: r.to,
    }));
    return NextResponse.json({ ranges });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Detection failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
