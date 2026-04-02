import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Endpoint legado desativado. Use POST /api/agent/checkin com X-API-Key.',
    },
    { status: 410 }
  )
}
