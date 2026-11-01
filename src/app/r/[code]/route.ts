import { NextRequest, NextResponse } from 'next/server';
import { normalizeReferral, REFERRAL_COOKIE, referralCookieOptions, resolveReferral } from '@/lib/referral-server';

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const code = normalizeReferral((await context.params).code);
  if (!code) return NextResponse.redirect(new URL('/bundles?referral=unavailable', request.url));
  try {
    const valid = await resolveReferral(code);
    const response = NextResponse.redirect(new URL(valid ? '/bundles' : '/bundles?referral=unavailable', request.url));
    response.headers.set('Cache-Control', 'private, no-store');
    if (valid) response.cookies.set(REFERRAL_COOKIE, valid, referralCookieOptions);
    return response;
  } catch {
    return new NextResponse('We could not check this partner link. Please refresh and try again.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
