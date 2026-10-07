import { NextResponse } from 'next/server';
import { QuizError } from './runtime';
export function quizFailure(error: unknown) {
 if (error instanceof QuizError) return NextResponse.json({ error: error.message }, { status: error.status });
 console.error('Live quiz request failed', error instanceof Error ? error.name : 'Unknown error');
 return NextResponse.json({ error: 'Connection interrupted. Please retry; a saved answer will not be counted twice.' }, { status: 503 });
}
export async function quizBody(request: Request) {
 const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host');
 try { if (new URL(request.headers.get('origin') || '').host !== host) throw new Error(); } catch { throw new QuizError('Please use your portal to submit.', 403); }
 if (Number(request.headers.get('content-length') || 0) > 12000) throw new QuizError('Request too large.', 413);
 const text = await request.text(); if (text.length > 12000) throw new QuizError('Request too large.', 413);
 let input; try { input = JSON.parse(text); } catch { throw new QuizError('Invalid request.'); }
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new QuizError('Invalid request.');
 return input as Record<string, unknown>;
}
export function quizString(value: unknown, max = 150) { if (typeof value !== 'string' || !value || value.length > max) throw new QuizError('Invalid quiz details.'); return value; }
