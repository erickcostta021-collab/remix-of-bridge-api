import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const locationId = url.searchParams.get("locationId");
    const contactId = url.searchParams.get("contactId");
    const phone = url.searchParams.get("phone"); // New: direct phone parameter

    if (!locationId) {
      return new Response(
        JSON.stringify({ error: "locationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Get instances request:", { locationId, contactId, phone });
    console.log(`Query recebida: phone=${phone}, contactId=${contactId}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find subaccount by location_id
    const { data: subaccounts, error: subError } = await supabase
      .from("ghl_subaccounts")
      .select("id")
      .eq("location_id", locationId)
      .limit(1);
    
    const subaccount = subaccounts?.[0] || null;

    if (subError) {
      console.error("Error fetching subaccount:", subError);
      return new Response(
        JSON.stringify({ error: "Error fetching subaccount", instances: [], activeInstanceId: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subaccount) {
      console.log("No subaccount found for locationId:", locationId);
      return new Response(
        JSON.stringify({ instances: [], activeInstanceId: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch connected instances for this subaccount, ordered alphabetically
    const { data: instances, error: instError } = await supabase
      .from("instances")
      .select("id, instance_name, phone, profile_pic_url, instance_status")
      .eq("subaccount_id", subaccount.id)
      .eq("instance_status", "connected")
      .order("instance_name", { ascending: true });

    if (instError) {
      console.error("Error fetching instances:", instError);
      return new Response(
        JSON.stringify({ error: "Error fetching instances", instances: [], activeInstanceId: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format instances
    const formattedInstances = (instances || []).map((i) => ({
      id: i.id,
      name: i.instance_name,
      phone: i.phone,
      profilePic: i.profile_pic_url,
    }));

    // Check for active instance preference
    let activeInstanceId: string | null = null;
    
    // Priority 1: Direct phone parameter (most reliable - comes from GHL UI)
    if (phone && phone.length >= 10) {
      console.log("Looking up preference by direct phone:", phone);
      
      // Normalize the phone to match stored format
      const normalizedPhone = phone.replace(/\D/g, '');
      
      const { data: preference } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id")
        .eq("location_id", locationId)
        .or(`lead_phone.eq.${normalizedPhone},lead_phone.like.%${normalizedPhone.slice(-10)}`)
        .maybeSingle();
      
      if (preference?.instance_id) {
        const exists = formattedInstances.some(i => i.id === preference.instance_id);
        if (exists) {
          activeInstanceId = preference.instance_id;
          console.log("Found preference by direct phone:", { phone: normalizedPhone, activeInstanceId });
        }
      }
    }
    
    // Priority 2: ContactId -> Phone mapping (fallback)
    if (!activeInstanceId && contactId && contactId.length >= 10) {
      // Step 1: Get the lead's original phone from the contact mapping
      const { data: phoneMapping } = await supabase
        .from("ghl_contact_phone_mapping")
        .select("original_phone")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .maybeSingle();
      
      console.log("Phone mapping lookup:", { contactId, originalPhone: phoneMapping?.original_phone });
      
      if (phoneMapping?.original_phone) {
        // Step 2: Look up preference by lead_phone (this works across all GHL contacts for the same lead)
        const { data: preference } = await supabase
          .from("contact_instance_preferences")
          .select("instance_id")
          .eq("lead_phone", phoneMapping.original_phone)
          .eq("location_id", locationId)
          .maybeSingle();
        
        if (preference?.instance_id) {
          // Verify the instance is still in our available list
          const exists = formattedInstances.some(i => i.id === preference.instance_id);
          if (exists) {
            activeInstanceId = preference.instance_id;
          }
        }
        
        console.log("Lead phone preference lookup:", { leadPhone: phoneMapping.original_phone, activeInstanceId });
      } else {
        // Fallback: Try old method with contact_id for backward compatibility
        const { data: preference } = await supabase
          .from("contact_instance_preferences")
          .select("instance_id")
          .eq("contact_id", contactId)
          .eq("location_id", locationId)
          .maybeSingle();
        
        if (preference?.instance_id) {
          const exists = formattedInstances.some(i => i.id === preference.instance_id);
          if (exists) {
            activeInstanceId = preference.instance_id;
          }
        }
        
        console.log("Contact ID fallback preference lookup:", { contactId, activeInstanceId });
      }
    }

    console.log(`Returning ${formattedInstances.length} instances for locationId: ${locationId}, activeInstanceId: ${activeInstanceId}`);

    return new Response(
      JSON.stringify({ 
        instances: formattedInstances,
        activeInstanceId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", instances: [], activeInstanceId: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
