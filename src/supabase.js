import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tgcpyakkpamdjmfovkjv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3B5YWtrcGFtZGptZm92a2p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTYyODYsImV4cCI6MjA4OTc3MjI4Nn0.WHdhhNdf6YWafBUpWIkMpw8zYMQNmArp17Dv4GQZM8g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
