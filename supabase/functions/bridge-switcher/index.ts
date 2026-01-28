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

      console.log("GET preference request:", { contactId, locationId });

      // Strategy 1: Try to find preference directly by contactId
      let preference = null;
      const { data: directPref, error: directError } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id, contact_id, updated_at")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .maybeSingle();

      if (directPref) {
        console.log("Found preference by contactId:", directPref);
        preference = directPref;
      } else {
        // Strategy 2: Look for the most recently updated preference for this location
        // This handles when the same phone has multiple GHL contact IDs
        // Find all preferences for this location, ordered by updated_at DESC
        const { data: allPrefs, error: allError } = await supabase
          .from("contact_instance_preferences")
          .select("instance_id, contact_id, updated_at")
          .eq("location_id", locationId)
          .order("updated_at", { ascending: false })
          .limit(50);

        if (allPrefs && allPrefs.length > 0) {
          // Check if any of these contacts might be the same person
          // by looking at the most recent one that was updated
          console.log("No direct match, checking recent preferences:", allPrefs.length);
          
          // For now, just return null - the contact will need to send a message
          // to establish preference. In the future, we could cross-reference by phone.
        }
      }

      return new Response(
        JSON.stringify({ 
          activeInstanceId: preference?.instance_id || null,
          debug: { 
            foundBy: preference ? "direct_match" : "none",
            contactId,
            locationId 
          }
        }),
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

      console.log(`POST save preference: contact=${contactId}, instance=${instanceId}, action=${action}`);

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
