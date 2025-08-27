// Client/src/lib/supabaseBridge.ts
// Single source of truth for the Supabase client + auth hook.
// The widget and any helpers should import ONLY from this file.
// In this DurmahStandalone repo we re-export from your AuthContext.
// (When you plug into MyDurhamLaw later, you will only change the
// import path below—no other files need edits.)

export { supabase, useAuth } from "../contexts/AuthContext";
