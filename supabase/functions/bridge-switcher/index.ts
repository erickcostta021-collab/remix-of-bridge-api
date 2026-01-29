import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Validate contactId to prevent saving preferences with placeholder values
  function isValidContactId(value: string | null): boolean {
    if (!value) return false;
    const v = value.trim();
    if (v.length < 10) return false;
    
    // Block known GHL placeholder values
    const blocked = new Set(['conversations', 'contacts', 'detail', 'inbox', 'chat']);
    if (blocked.has(v.toLowerCase())) return false;
    
    // Real IDs almost always have digits/underscores/hyphens, not pure alphabetic
    if (/^[a-zA-Z]+$/.test(v)) return false;
    
    return true;
  }

  try {
    // GET: Recuperar preferência atual do contato
    if (req.method === "GET") {
      const url = new URL(req.url);
      const contactId = url.searchParams.get("contactId");
      const locationId = url.searchParams.get("locationId");

      if (!contactId || !locationId) {
        return new Response(
          JSON.stringify({ error: "contactId and locationId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate contactId before processing
      if (!isValidContactId(contactId)) {
        console.log("Invalid contactId rejected:", contactId);
        return new Response(
          JSON.stringify({ activeInstanceId: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("GET preference request:", { contactId, locationId });

      // Query directly by contact_id + location_id (unique key)
      const { data: preference, error } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching preference:", error);
        return new Response(
          JSON.stringify({ activeInstanceId: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Found preference:", { contactId, instanceId: preference?.instance_id || null });

      return new Response(
        JSON.stringify({ activeInstanceId: preference?.instance_id || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: Salvar preferência de instância para o contato
    if (req.method === "POST") {
      const body = await req.json();
      const { instanceId, contactId, locationId } = body;

      if (!instanceId || !contactId || !locationId) {
        return new Response(
          JSON.stringify({ error: "instanceId, contactId and locationId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate contactId before saving
      if (!isValidContactId(contactId)) {
        console.log("POST rejected - invalid contactId:", contactId);
        return new Response(
          JSON.stringify({ success: false, error: "Invalid contactId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("POST save preference:", { contactId, instanceId, locationId });

      // Upsert using contact_id + location_id as unique key
      const { error } = await supabase
        .from("contact_instance_preferences")
        .upsert(
          {
            contact_id: contactId,
            location_id: locationId,
            instance_id: instanceId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "contact_id,location_id" }
        );

      if (error) {
        console.error("Error saving preference:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Preference saved successfully:", { contactId, instanceId });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
