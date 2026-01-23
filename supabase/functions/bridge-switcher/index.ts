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

      // Buscar preferência existente
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

      return new Response(
        JSON.stringify({ activeInstanceId: preference?.instance_id || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: Salvar preferência de instância para o contato
    if (req.method === "POST") {
      const body = await req.json();
      const { instanceId, contactId, locationId, action } = body;

      if (!instanceId || !contactId || !locationId) {
        return new Response(
          JSON.stringify({ error: "instanceId, contactId and locationId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Saving preference: contact=${contactId}, instance=${instanceId}, action=${action}`);

      // Upsert da preferência (insert ou update)
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

      console.log("Preference saved successfully");

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
