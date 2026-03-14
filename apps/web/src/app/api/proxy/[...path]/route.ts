import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const apiBaseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function forwardRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const targetUrl = `${apiBaseUrl}/api/${path.join('/')}${request.nextUrl.search}`;
  const requestBody =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  const authorization = request.headers.get('authorization');
  const buildingId = request.headers.get('x-building-id');

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        ...(authorization ? { authorization } : {}),
        ...(buildingId ? { 'x-building-id': buildingId } : {}),
        ...(request.headers.get('content-type')
          ? { 'content-type': request.headers.get('content-type') as string }
          : {})
      },
      body: requestBody && requestBody.length > 0 ? requestBody : undefined,
      cache: 'no-store'
    });

    const responseText = await upstreamResponse.text();

    return new NextResponse(responseText, {
      status: upstreamResponse.status,
      headers: {
        'content-type': upstreamResponse.headers.get('content-type') ?? 'application/json'
      }
    });
  } catch {
    return NextResponse.json(
      {
        message: 'Arka uç servisine şu anda erişilemiyor.'
      },
      {
        status: 502
      }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}
