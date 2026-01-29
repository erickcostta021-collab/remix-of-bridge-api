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

  // Helper to get lead phone from contact mapping
  async function getLeadPhone(contactId: string, locationId: string): Promise<string | null> {
    const { data } = await supabase
      .from("ghl_contact_phone_mapping")
      .select("original_phone")
      .eq("contact_id", contactId)
      .eq("location_id", locationId)
      .maybeSingle();
    return data?.original_phone || null;
  }

  try {
    // GET: Recuperar preferência atual do contato
    if (req.method === "GET") {
      const url = new URL(req.url);
      const contactId = url.searchParams.get("contactId");
      const locationId = url.searchParams.get("locationId");
      const phone = url.searchParams.get("phone"); // New: direct phone parameter

      if (!locationId) {
        return new Response(
          JSON.stringify({ error: "locationId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Need at least contactId or phone
      if (!contactId && !phone) {
        return new Response(
          JSON.stringify({ activeInstanceId: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("GET preference request:", { contactId, locationId, phone });

      let preference = null;

      // Priority 1: Direct phone lookup (most reliable)
      if (phone && phone.length >= 10) {
        const normalizedPhone = phone.replace(/\D/g, '');
        
        const { data, error } = await supabase
          .from("contact_instance_preferences")
          .select("instance_id")
          .eq("location_id", locationId)
          .or(`lead_phone.eq.${normalizedPhone},lead_phone.like.%${normalizedPhone.slice(-10)}`)
          .maybeSingle();

        if (error) {
          console.error("Error fetching preference by phone:", error);
        } else {
          preference = data;
        }
        
        console.log("Direct phone preference result:", { phone: normalizedPhone, instanceId: preference?.instance_id });
      }

      // Priority 2: ContactId lookup (fallback)
      if (!preference && contactId && isValidContactId(contactId)) {
        // Step 1: Get the lead's phone from contact mapping
        const leadPhone = await getLeadPhone(contactId, locationId);
        console.log("Lead phone lookup:", { contactId, leadPhone });

        if (leadPhone) {
          // Step 2: Query by lead_phone (works across all GHL contacts for the same lead)
          const { data, error } = await supabase
            .from("contact_instance_preferences")
            .select("instance_id")
            .eq("lead_phone", leadPhone)
            .eq("location_id", locationId)
            .maybeSingle();

          if (error) {
            console.error("Error fetching preference by lead_phone:", error);
          } else {
            preference = data;
          }
          
          console.log("Lead phone preference result:", { leadPhone, instanceId: preference?.instance_id });
        }

        // Fallback to contact_id if no lead_phone match
        if (!preference) {
          const { data, error } = await supabase
            .from("contact_instance_preferences")
            .select("instance_id")
            .eq("contact_id", contactId)
            .eq("location_id", locationId)
            .maybeSingle();

          if (error) {
            console.error("Error fetching preference by contact_id:", error);
          } else {
            preference = data;
          }
          
          console.log("Contact ID fallback result:", { contactId, instanceId: preference?.instance_id });
        }
      }

      return new Response(
        JSON.stringify({ activeInstanceId: preference?.instance_id || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: Salvar preferência de instância para o contato
    if (req.method === "POST") {
      const body = await req.json();
      const { instanceId, contactId, locationId, phone } = body;

      if (!instanceId || !locationId) {
        return new Response(
          JSON.stringify({ error: "instanceId and locationId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Need at least contactId or phone
      if (!contactId && !phone) {
        return new Response(
          JSON.stringify({ error: "contactId or phone is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("POST save preference:", { contactId, instanceId, locationId, phone });

      // Determine the lead phone to use
      let leadPhone: string | null = null;
      
      // Priority 1: Direct phone from request
      if (phone && phone.length >= 10) {
        leadPhone = phone.replace(/\D/g, ''); // Normalize to digits
      }
      
      // Priority 2: Get phone from contact mapping
      if (!leadPhone && contactId && isValidContactId(contactId)) {
        leadPhone = await getLeadPhone(contactId, locationId);
      }
      
      console.log("Resolved leadPhone:", leadPhone);

      if (leadPhone) {
        // Save by lead_phone (primary method - works across all GHL contacts)
        const { error } = await supabase
          .from("contact_instance_preferences")
          .upsert(
            {
              contact_id: contactId || `phone_${leadPhone}`,
              location_id: locationId,
              instance_id: instanceId,
              lead_phone: leadPhone,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "lead_phone,location_id" }
          );

        if (error) {
          console.error("Error saving preference by lead_phone:", error);
          // Try fallback to contact_id if we have it
          if (contactId && isValidContactId(contactId)) {
            const { error: fallbackError } = await supabase
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

            if (fallbackError) {
              console.error("Fallback error saving preference:", fallbackError);
              return new Response(
                JSON.stringify({ success: false, error: fallbackError.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      } else if (contactId && isValidContactId(contactId)) {
        // Fallback: save by contact_id only
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
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "No valid identifier to save preference" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Preference saved successfully:", { contactId, instanceId, leadPhone });

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
