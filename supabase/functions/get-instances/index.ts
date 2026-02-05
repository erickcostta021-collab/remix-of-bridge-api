import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
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
        JSON.stringify({ error: "locationId is required", instances: [], activeInstanceId: null }),
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
      // FALLBACK: Retorna array vazio em vez de erro, para o dropdown não sumir
      return new Response(
        JSON.stringify({ instances: [], activeInstanceId: null, error: "Error fetching subaccount" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subaccount) {
      console.log("[get-instances] No subaccount found for locationId:", locationId);
      // FALLBACK: Retorna array vazio em vez de null
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
      // FALLBACK: Retorna array vazio em vez de erro
      return new Response(
        JSON.stringify({ instances: [], activeInstanceId: null, error: "Error fetching instances" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format instances - SEMPRE retorna um array, mesmo que vazio
    const formattedInstances = (instances || []).map((i) => ({
      id: i.id,
      name: i.instance_name,
      phone: i.phone,
      profilePic: i.profile_pic_url,
    }));

    console.log("[get-instances] Found instances:", formattedInstances.length);

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
        console.log("[get-instances] No direct phone mapping found for contactId, trying contact_instance_preferences...");
        
        // FALLBACK: Try to find the phone from contact_instance_preferences using contact_id
        const { data: prefWithPhone } = await supabase
          .from("contact_instance_preferences")
          .select("lead_phone")
          .eq("contact_id", contactId)
          .eq("location_id", locationId)
          .not("lead_phone", "is", null)
          .limit(1);
        
        if (prefWithPhone && prefWithPhone.length > 0 && prefWithPhone[0].lead_phone) {
          resolvedPhone = prefWithPhone[0].lead_phone;
          console.log("[get-instances] Found phone from preferences table:", resolvedPhone?.slice(0, 15));
        } else {
          console.log("[get-instances] No phone mapping found for contactId");
        }
      }
    }

    // =====================================================
    // LOOKUP PREFERENCE BY PHONE (unified path) - PRIORITY 1
    // =====================================================
    if (resolvedPhone) {
      // Normalize phone for matching
      const normalizedPhone = resolvedPhone.replace(/\D/g, '');
      const last10Digits = normalizedPhone.slice(-10);
      
      console.log("[get-instances] Searching preference by phone:", { normalizedPhone: normalizedPhone.slice(0, 10), last10: last10Digits });
      
      // Try exact match first, then partial match - ORDER BY updated_at DESC to get the latest
      const { data: preferences } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id, lead_phone, updated_at")
        .eq("location_id", locationId)
        .or(`lead_phone.eq.${resolvedPhone},lead_phone.like.%${normalizedPhone},lead_phone.like.%${last10Digits}%`)
        .order("updated_at", { ascending: false })
        .limit(1);
      
      if (preferences && preferences.length > 0) {
        const preference = preferences[0];
        const exists = formattedInstances.some(i => i.id === preference.instance_id);
        if (exists) {
          activeInstanceId = preference.instance_id;
          console.log("[get-instances] ✅ Found preference by phone (latest):", { 
            activeInstanceId, 
            leadPhone: preference.lead_phone?.slice(0, 15),
            updatedAt: preference.updated_at
          });
        }
      }
    }

    // =====================================================
    // FALLBACK: Direct contactId lookup (backward compatibility)
    // Only use if we have contactId AND either no phone OR no preference found by phone
    // =====================================================
    if (!activeInstanceId && contactId && contactId.length >= 10) {
      console.log("[get-instances] Fallback: looking up by contact_id directly:", contactId.slice(0, 15));
      
      // First, check if THIS specific contactId has a preference with a lead_phone
      // If it does, use that phone to find the LATEST preference across all contacts with same phone
      const { data: contactPref } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id, lead_phone, updated_at")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .limit(1);
      
      const pref = contactPref?.[0];
      
      if (pref?.lead_phone) {
        // This contact has a phone - find the LATEST preference for this phone across ALL contacts
        const normalizedPhone = pref.lead_phone.replace(/\D/g, '');
        const last10 = normalizedPhone.slice(-10);
        
        console.log("[get-instances] Contact has phone, searching latest preference for phone:", last10);
        
        const { data: phonePrefs } = await supabase
          .from("contact_instance_preferences")
          .select("instance_id, updated_at")
          .eq("location_id", locationId)
          .or(`lead_phone.eq.${pref.lead_phone},lead_phone.like.%${normalizedPhone},lead_phone.like.%${last10}%`)
          .order("updated_at", { ascending: false })
          .limit(1);
        
        if (phonePrefs && phonePrefs.length > 0) {
          const latestPref = phonePrefs[0];
          const exists = formattedInstances.some(i => i.id === latestPref.instance_id);
          if (exists) {
            activeInstanceId = latestPref.instance_id;
            console.log("[get-instances] ✅ Found preference by contact's phone (latest):", activeInstanceId);
          }
        }
      } else if (pref?.instance_id) {
        // Contact has no phone, just use its direct preference
        const exists = formattedInstances.some(i => i.id === pref.instance_id);
        if (exists) {
          activeInstanceId = pref.instance_id;
          console.log("[get-instances] ✅ Found preference by contactId (no phone):", activeInstanceId);
        }
      }
    }

    // Se não encontrou preferência mas tem instâncias, usa a primeira como fallback
    if (!activeInstanceId && formattedInstances.length > 0) {
      activeInstanceId = formattedInstances[0].id;
      console.log("[get-instances] Using first instance as fallback:", activeInstanceId);
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
    // FALLBACK: Sempre retorna estrutura válida, nunca null
    return new Response(
      JSON.stringify({ error: "Internal server error", instances: [], activeInstanceId: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});