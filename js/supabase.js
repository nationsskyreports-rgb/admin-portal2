// ═══════════════════════════════════════════
// NOS Admin — Supabase Config
// ⚠️  service_role key — لا تشاركه مع حد
// ═══════════════════════════════════════════

const SUPABASE_URL = 'https://xzxdaupwwwdcwfnqweub.supabase.co';

// ── احصل على الـ service_role key من:
// Supabase Dashboard → Project Settings → API → service_role (secret)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6eGRhdXB3d3dkY3dmbnF3ZXViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTMxMzk1MCwiZXhwIjoyMDkwODg5OTUwfQ.hloV3fkC_KIa36hYgxz33fdTWvH_0AX28cZaiohPcDQ';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }   // الأدمن مش محتاج session
});
window.db = db;
