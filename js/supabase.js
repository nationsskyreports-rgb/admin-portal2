// ═══════════════════════════════════════════
// NOS Admin — Supabase Config
// ═══════════════════════════════════════════
const SUPABASE_URL = 'https://xzxdaupwwwdcwfnqweub.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6eGRhdXB3d3dkY3dmbnF3ZXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTM5NTAsImV4cCI6MjA5MDg4OTk1MH0.KjNZpFvLxh8XfDDoWdpVsIQZAh1PjzGXOrfDmApZ4K8';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.db = db;