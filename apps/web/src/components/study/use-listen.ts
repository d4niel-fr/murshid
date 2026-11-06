'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { speechRecognition } from '@/lib/practice';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Listen with the browser's speech recognition: the final text so far, what it is hearing now, and the silences
 * between phrases. It restarts itself when the browser stops early, until you press stop.
 */
export function useListen(lang: 'en' | 'ar') {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<any>(null);
  const want = useRef(false);
  const last = useRef(0);
  const pauses = useRef<number[]>([]);
  const finals = useRef('');
  useEffect(() => { setSupported(Boolean(speechRecognition())); }, []);

  const begin = useCallback(() => {
    const SR = speechRecognition(); if (!SR) return;
    const r = new SR();
    r.lang = lang === 'ar' ? 'ar-AE' : 'en-GB'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const now = performance.now();
      if (last.current) { const gap = (now - last.current) / 1000; if (gap > 1.2) pauses.current.push(Math.round(gap * 10) / 10); }
      last.current = now;
      let fin = ''; let mid = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += `${t} `; else mid += t; }
      if (fin) { finals.current = `${finals.current}${fin}`.replace(/\s+/g, ' '); setText(finals.current.trim()); }
      setInterim(mid);
    };
    r.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      want.current = false;
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'mic' : e.error === 'network' ? 'network' : 'other');
    };
    r.onend = () => { if (want.current) { try { r.start(); } catch { setListening(false); } } else setListening(false); };
    rec.current = r;
    try { r.start(); setListening(true); } catch { setError('other'); }
  }, [lang]);

  const start = useCallback(() => {
    finals.current = ''; pauses.current = []; last.current = 0;
    setText(''); setInterim(''); setError(null);
    want.current = true; begin();
  }, [begin]);
  const stop = useCallback(() => {
    want.current = false;
    try { rec.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
    // anything still being heard counts
    if (interim) { finals.current = `${finals.current} ${interim}`; setText(finals.current.trim()); setInterim(''); }
    return { text: `${finals.current} ${interim}`.trim(), pauses: [...pauses.current] };
  }, [interim]);
  useEffect(() => () => { want.current = false; try { rec.current?.abort(); } catch { /* ignore */ } }, []);

  return { supported, listening, text, interim, error, start, stop };
}

/** Plain-language reason a microphone did not work. */
export function micError(code: string | null, tx: (en: string, ar: string) => string) {
  if (!code) return null;
  if (code === 'mic') return tx('Murshid could not use the microphone. Allow it in the browser’s address bar (or Settings › Safari › Microphone on iPhone and iPad), then try again.', 'تعذّر استخدام الميكروفون. اسمح به من شريط العنوان (أو الإعدادات › سفاري › الميكروفون على iPhone وiPad) ثم حاول مجدداً.');
  if (code === 'network') return tx('Speech recognition needs an internet connection in this browser.', 'يحتاج التعرّف على الكلام إلى اتصال بالإنترنت في هذا المتصفح.');
  return tx('Listening stopped. Try again.', 'توقّف الاستماع. حاول مجدداً.');
}
