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

    if (!locationId) {
      return new Response(
        JSON.stringify({ error: "locationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Check for active instance preference if contactId is provided
    let activeInstanceId: string | null = null;
    
    if (contactId && contactId.length >= 10) {
      const { data: preference } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .maybeSingle();
      
      if (preference?.instance_id) {
        // Verify the instance is still in our available list
        const exists = formattedInstances.some(i => i.id === preference.instance_id);
        if (exists) {
          activeInstanceId = preference.instance_id;
        }
      }
      
      console.log("Contact preference lookup:", { contactId, activeInstanceId });
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
