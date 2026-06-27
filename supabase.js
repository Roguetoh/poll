// lib/supabase.js
// ─────────────────────────────────────────────────────────────────
// Single Supabase client shared across all pages.
// Import this wherever you need db/auth access.
//
// Usage (in any HTML page):
//   <script type="module">
//     import { sb } from './lib/supabase.js';
//     const { data, error } = await sb.from('polls').select('*');
//   </script>
// ─────────────────────────────────────────────────────────────────
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = import.meta.env?.VITE_SUPABASE_URL  || 'sb_publishable_nnT7isTWC-jS9ZZ2jOQ5TQ_MigbVx4L';
const SUPABASE_ANON = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtcHZvZ2Z2enV1dGZpenpzb2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MzEwMzcsImV4cCI6MjA5ODEwNzAzN30.BP3aWRPxURQqYYmvWrtzTNXElUvxkcPmG5BlMgmgAno';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers ──────────────────────────────────────────────
export async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function requireAuth(redirectTo = '/login.html') {
  const user = await getUser();
  if (!user) window.location.href = redirectTo;
  return user;
}

export function onAuthChange(callback) {
  return sb.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

// ── Poll helpers ──────────────────────────────────────────────
export async function createPoll({ question, description, options, isPublic = true, endsAt = null }) {
  const user = await requireAuth();

  const { data: poll, error: pollErr } = await sb
    .from('polls')
    .insert({ question, description, is_public: isPublic, ends_at: endsAt, user_id: user.id })
    .select()
    .single();

  if (pollErr) throw pollErr;

  const optionRows = options.map((label, i) => ({
    poll_id: poll.id,
    label,
    position: i,
  }));

  const { error: optErr } = await sb.from('poll_options').insert(optionRows);
  if (optErr) throw optErr;

  return poll;
}

export async function fetchPoll(pollId) {
  const { data, error } = await sb
    .from('polls')
    .select(`
      *,
      profiles (full_name, avatar_url),
      poll_options (id, label, position),
      votes (option_id, user_id)
    `)
    .eq('id', pollId)
    .single();

  if (error) throw error;
  return data;
}

export async function castVote(pollId, optionId) {
  const user = await requireAuth();
  const { error } = await sb
    .from('votes')
    .insert({ poll_id: pollId, option_id: optionId, user_id: user.id });
  if (error) throw error;
}

export async function listPublicPolls({ page = 0, limit = 12 } = {}) {
  const { data, error, count } = await sb
    .from('polls')
    .select(`
      id, question, created_at, ends_at,
      profiles (full_name),
      poll_options (id),
      votes (id)
    `, { count: 'exact' })
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (error) throw error;
  return { polls: data, total: count };
}
