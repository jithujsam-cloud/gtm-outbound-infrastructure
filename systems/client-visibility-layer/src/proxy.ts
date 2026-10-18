import { NextRequest, NextResponse } from 'next/server';

// Agency pages and every API route are operator-only. The public client
// portal (/c/[slug]) is not matched and stays open, scoped by slug.
export const config = {
  matcher: ['/', '/agency/:path*', '/api/:path*'],
};

export function proxy(request: NextRequest) {
  const password = process.env.AGENCY_PASSWORD;

  // Fail closed: without a configured password the agency side is unreachable.
  if (!password) {
    return new NextResponse('Agency access is disabled: set AGENCY_PASSWORD.', { status: 503 });
  }

  if (isAuthorized(request.headers.get('authorization'), password)) {
    return NextResponse.next();
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Agency", charset="UTF-8"' },
  });
}

function isAuthorized(header: string | null, password: string): boolean {
  if (!header?.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice('Basic '.length));
  } catch {
    return false;
  }

  // Any username is accepted; only the password is checked.
  const supplied = decoded.slice(decoded.indexOf(':') + 1);
  return constantTimeEqual(supplied, password);
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < right.length; i++) {
    diff |= (left[i] ?? 0) ^ right[i];
  }
  return diff === 0;
}
