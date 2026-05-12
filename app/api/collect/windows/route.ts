import { NextResponse } from 'next/server'

function legacyResponse() {
  return NextResponse.json(
    {
      error: 'Endpoint legado desativado. Use POST /api/agent/checkin com X-API-Key.',
    },
    { status: 410 }
  )
}

export async function GET() {
  return legacyResponse()
}

export async function POST() {
  return legacyResponse()
}

export async function PUT() {
  return legacyResponse()
}

export async function PATCH() {
  return legacyResponse()
}

export async function DELETE() {
  return legacyResponse()
}

export async function OPTIONS() {
  return legacyResponse()
}
