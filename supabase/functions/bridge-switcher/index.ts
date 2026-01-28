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
          JSON.stringify({ activeInstanceId: null, debug: { rejected: true, reason: "invalid_contact_id", contactId } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("GET preference request:", { contactId, locationId });

      // Strategy 1: Try to find preference directly by contactId
      let preference = null;
      let foundBy = "none";
      
      const { data: directPref } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id, contact_id, updated_at")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .maybeSingle();

      if (directPref) {
        console.log("Found preference by contactId:", directPref);
        preference = directPref;
        foundBy = "direct_match";
      } else {
        // Strategy 2: Use phone mapping to find preferences for the same phone number
        // First, check if this contactId has a phone mapping
        const { data: phoneMapping } = await supabase
          .from("ghl_contact_phone_mapping")
          .select("original_phone")
          .eq("contact_id", contactId)
          .eq("location_id", locationId)
          .maybeSingle();

        if (phoneMapping?.original_phone) {
          // Find other contactIds with the same phone
          const { data: relatedMappings } = await supabase
            .from("ghl_contact_phone_mapping")
            .select("contact_id")
            .eq("original_phone", phoneMapping.original_phone)
            .eq("location_id", locationId);

          if (relatedMappings && relatedMappings.length > 0) {
            const relatedContactIds = relatedMappings.map(m => m.contact_id);
            
            // Find preferences for any of these related contactIds
            const { data: relatedPrefs } = await supabase
              .from("contact_instance_preferences")
              .select("instance_id, contact_id, updated_at")
              .in("contact_id", relatedContactIds)
              .eq("location_id", locationId)
              .order("updated_at", { ascending: false })
              .limit(1);

            if (relatedPrefs && relatedPrefs.length > 0) {
              console.log("Found preference via phone mapping:", relatedPrefs[0]);
              preference = relatedPrefs[0];
              foundBy = "phone_mapping";
              
              // Also save this preference for the current contactId for faster future lookups
              await supabase
                .from("contact_instance_preferences")
                .upsert({
                  contact_id: contactId,
                  location_id: locationId,
                  instance_id: relatedPrefs[0].instance_id,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "contact_id,location_id" });
            }
          }
        }

        // Strategy 3 REMOVED: Do NOT use preferences from other contacts
        // Each contact must have its own isolated preference
        if (!preference) {
          console.log("No preference found for contact:", contactId);
        }
      }

      return new Response(
        JSON.stringify({ 
          activeInstanceId: preference?.instance_id || null,
          debug: { 
            foundBy,
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

      // Validate contactId before saving - CRITICAL to prevent cross-contact pollution
      if (!isValidContactId(contactId)) {
        console.log("POST rejected - invalid contactId:", contactId);
        return new Response(
          JSON.stringify({ success: false, error: "Invalid contactId - cannot save preference for placeholder values" }),
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
