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
    const phone = url.searchParams.get("phone"); // Direct phone parameter (legacy support)

    if (!locationId) {
      return new Response(
        JSON.stringify({ error: "locationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[get-instances] Request:", { locationId, contactId: contactId?.slice(0, 10), phone: phone?.slice(0, 10) });

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
      console.error("[get-instances] Error fetching subaccount:", subError);
      return new Response(
        JSON.stringify({ error: "Error fetching subaccount", instances: [], activeInstanceId: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subaccount) {
      console.log("[get-instances] No subaccount found for locationId:", locationId);
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
      console.error("[get-instances] Error fetching instances:", instError);
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
    let resolvedPhone: string | null = null;

    // =====================================================
    // PRIORITY 1: Direct phone parameter (from GHL UI)
    // =====================================================
    if (phone && phone.length >= 10) {
      console.log("[get-instances] Lookup by direct phone:", phone.slice(0, 10));
      resolvedPhone = phone.replace(/\D/g, '');
    }

    // =====================================================
    // PRIORITY 2: ContactId -> Silent phone lookup from mapping table
    // =====================================================
    if (!resolvedPhone && contactId && contactId.length >= 10) {
      console.log("[get-instances] Looking up phone from ghl_contact_phone_mapping for contactId:", contactId.slice(0, 10));
      
      const { data: phoneMapping } = await supabase
        .from("ghl_contact_phone_mapping")
        .select("original_phone")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .maybeSingle();
      
      if (phoneMapping?.original_phone) {
        resolvedPhone = phoneMapping.original_phone;
        console.log("[get-instances] Found phone in mapping:", phoneMapping.original_phone.slice(0, 15));
      } else {
        console.log("[get-instances] No phone mapping found for contactId");
      }
    }

    // =====================================================
    // LOOKUP PREFERENCE BY PHONE (unified path)
    // =====================================================
    if (resolvedPhone) {
      // Normalize phone for matching
      const normalizedPhone = resolvedPhone.replace(/\D/g, '');
      const last10Digits = normalizedPhone.slice(-10);
      
      console.log("[get-instances] Searching preference by phone:", { normalizedPhone: normalizedPhone.slice(0, 10), last10: last10Digits });
      
      // Try exact match first, then partial match
      const { data: preferences } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id, lead_phone")
        .eq("location_id", locationId)
        .or(`lead_phone.eq.${resolvedPhone},lead_phone.like.%${normalizedPhone},lead_phone.like.%${last10Digits}%`);
      
      if (preferences && preferences.length > 0) {
        const preference = preferences[0];
        const exists = formattedInstances.some(i => i.id === preference.instance_id);
        if (exists) {
          activeInstanceId = preference.instance_id;
          console.log("[get-instances] ✅ Found preference by phone:", { activeInstanceId, leadPhone: preference.lead_phone?.slice(0, 15) });
        }
      }
    }

    // =====================================================
    // FALLBACK: Direct contactId lookup (backward compatibility)
    // =====================================================
    if (!activeInstanceId && contactId && contactId.length >= 10) {
      console.log("[get-instances] Fallback: looking up by contact_id directly");
      
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
          console.log("[get-instances] ✅ Found preference by contactId fallback:", activeInstanceId);
        }
      }
    }

    const activeInstanceName = formattedInstances.find(i => i.id === activeInstanceId)?.name || null;
    console.log(`[get-instances] Returning ${formattedInstances.length} instances, active: ${activeInstanceName || 'none'}`);

    return new Response(
      JSON.stringify({ 
        instances: formattedInstances,
        activeInstanceId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[get-instances] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", instances: [], activeInstanceId: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
