'use client';
import { createClient } from '@supabase/supabase-js';

// قاعدة بيانات منفصلة لمولدات الفروانية (مشروع Supabase: generators-public)
// المفتاح العام (publishable) — مصمم ليكون بالمتصفح، والصلاحيات محكومة بـ RLS
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jjpkwejkgnhrgjmioshh.supabase.co';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_862A-N6ABCamX5MbLA1NDQ_z78kH9UI';

export const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
