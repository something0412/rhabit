import { createClient } from "@supabase/supabase-js";
import { localDb } from "./localDb";

// This is the ONLY place the backend connects to the database.
// Every other file imports `supabase` from here and uses it like:
//   const { data, error } = await supabase.from("tasks").select("*").eq("id", 5);
//
// - Supabase keys in apps/backend/.env  -> the real Supabase database
// - No keys yet                         -> a local demo database (see localDb.ts)

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const hasKeys = Boolean(url && secretKey);

const realSupabase = hasKeys
  ? createClient(url!, secretKey!, {
      auth: { persistSession: false }, // a server doesn't keep a login session
    })
  : null;

if (!hasKeys) {
  console.log("No Supabase keys found -> using the local demo database (apps/backend/.local-db.json)");
}

// (the "as" just tells TypeScript to treat localDb like the Supabase client)
export const supabase = realSupabase ?? (localDb as unknown as ReturnType<typeof createClient>);
