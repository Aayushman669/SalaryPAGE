import type { ClientEmailEventRequest } from "@/lib/email/types";
import { supabase } from "@/lib/supabase";

export async function enqueueClientEmailEvent(event: ClientEmailEventRequest) {
  try {
    if (!supabase) {
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      return;
    }

    await fetch("/api/email/events", {
      body: JSON.stringify(event),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[email-client] enqueue failed", error);
    }
  }
}
