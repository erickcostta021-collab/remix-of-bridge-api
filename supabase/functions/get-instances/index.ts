import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const locationId = url.searchParams.get("locationId");
    const contactId = url.searchParams.get("contactId");
    const phone = url.searchParams.get("phone");

    console.log("[get-instances] Request:", { locationId, contactId: contactId?.slice(0, 10), phone: phone?.slice(0, 10) });

    if (!locationId) {
      return new Response(
        JSON.stringify({ error: "locationId is required", instances: [], activeInstanceId: null }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find subaccount
    const { data: subaccounts, error: subError } = await supabase
      .from("ghl_subaccounts")
      .select("id")
      .eq("location_id", locationId)
      .limit(1);

    if (subError || !subaccounts?.[0]) {
      console.log("[get-instances] No subaccount found:", { locationId, error: subError?.message });
      return new Response(
        JSON.stringify({ instances: [], activeInstanceId: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subaccountId = subaccounts[0].id;

    // Fetch connected instances
    const { data: instances, error: instError } = await supabase
      .from("instances")
      .select("id, instance_name, phone, profile_pic_url")
      .eq("subaccount_id", subaccountId)
      .eq("instance_status", "connected")
      .order("instance_name", { ascending: true });

    if (instError) {
      console.error("[get-instances] Error fetching instances:", instError);
      return new Response(
        JSON.stringify({ instances: [], activeInstanceId: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedInstances = (instances || []).map((i) => ({
      id: i.id,
      name: i.instance_name,
      phone: i.phone,
      profilePic: i.profile_pic_url,
    }));

    console.log("[get-instances] Found instances:", formattedInstances.length);

    // Simplified preference lookup
    let activeInstanceId: string | null = null;
    const resolvedPhone = phone?.replace(/\D/g, '') || null;

    if (resolvedPhone || contactId) {
      const { data: prefs } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id")
        .eq("location_id", locationId)
        .or(resolvedPhone 
          ? `lead_phone.like.%${resolvedPhone.slice(-10)}%` 
          : `contact_id.eq.${contactId}`)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (prefs?.[0] && formattedInstances.some(i => i.id === prefs[0].instance_id)) {
        activeInstanceId = prefs[0].instance_id;
      }
    }

    // Fallback to first instance
    if (!activeInstanceId && formattedInstances.length > 0) {
      activeInstanceId = formattedInstances[0].id;
    }

    console.log("[get-instances] Returning:", { count: formattedInstances.length, activeInstanceId });

    return new Response(
      JSON.stringify({ instances: formattedInstances, activeInstanceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[get-instances] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", instances: [], activeInstanceId: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});