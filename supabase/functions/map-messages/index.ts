import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action } = body;

    // Action: map - Save message mapping
    if (action === "map" || !action) {
      const { ghl_id, uazapi_id, text, timestamp, location_id, contact_id, from_me, message_type } = body;

      if (!ghl_id || !location_id) {
        return new Response(
          JSON.stringify({ error: "ghl_id and location_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert message mapping
      const { data, error } = await supabase
        .from("message_map")
        .upsert({
          ghl_message_id: ghl_id,
          uazapi_message_id: uazapi_id || null,
          location_id,
          contact_id: contact_id || null,
          message_text: text || null,
          message_type: message_type || "text",
          from_me: from_me ?? false,
          original_timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        }, { onConflict: "ghl_message_id" })
        .select()
        .single();

      if (error) {
        console.error("Failed to save message mapping:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: edit - Edit a message (with 15-minute validation)
    if (action === "edit") {
      const { ghl_id, new_text, location_id } = body;

      if (!ghl_id || !new_text) {
        return new Response(
          JSON.stringify({ error: "ghl_id and new_text are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the message mapping
      const { data: mapping, error: fetchError } = await supabase
        .from("message_map")
        .select("*")
        .eq("ghl_message_id", ghl_id)
        .maybeSingle();

      if (fetchError || !mapping) {
        return new Response(
          JSON.stringify({ error: "Message not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate 15-minute rule
      const originalTime = new Date(mapping.original_timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - originalTime.getTime()) / (1000 * 60);

      if (diffMinutes > 15) {
        return new Response(
          JSON.stringify({ error: "Cannot edit message older than 15 minutes", age_minutes: diffMinutes }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If we have UAZAPI ID, send edit to WhatsApp
      if (mapping.uazapi_message_id) {
        // Get instance info for UAZAPI call
        const { data: instance } = await supabase
          .from("instances")
          .select("*, ghl_subaccounts!inner(location_id, user_id)")
          .eq("ghl_subaccounts.location_id", mapping.location_id)
          .limit(1)
          .maybeSingle();

        if (instance) {
          const { data: settings } = await supabase
            .from("user_settings")
            .select("uazapi_base_url")
            .eq("user_id", instance.ghl_subaccounts.user_id)
            .maybeSingle();

          if (settings?.uazapi_base_url) {
            // Send edit to UAZAPI
            try {
              await fetch(`${settings.uazapi_base_url}/message/edit`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "token": instance.uazapi_instance_token,
                },
                body: JSON.stringify({
                  id: mapping.uazapi_message_id,
                  text: new_text,
                }),
              });
            } catch (e) {
              console.error("Failed to send edit to UAZAPI:", e);
            }
          }
        }
      }

      // Update message in database
      const { data: updated, error: updateError } = await supabase
        .from("message_map")
        .update({
          message_text: new_text,
          is_edited: true,
        })
        .eq("ghl_message_id", ghl_id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Broadcast update via realtime
      await supabase.channel("ghl_updates").send({
        type: "broadcast",
        event: "msg_update",
        payload: {
          ghl_id,
          type: "edit",
          new_text,
          location_id: mapping.location_id,
        },
      });

      return new Response(
        JSON.stringify({ success: true, data: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: react - Add reaction to message
    if (action === "react") {
      const { ghl_id, emoji, location_id } = body;

      if (!ghl_id || !emoji) {
        return new Response(
          JSON.stringify({ error: "ghl_id and emoji are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the message mapping
      const { data: mapping, error: fetchError } = await supabase
        .from("message_map")
        .select("*")
        .eq("ghl_message_id", ghl_id)
        .maybeSingle();

      if (fetchError || !mapping) {
        return new Response(
          JSON.stringify({ error: "Message not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send reaction to UAZAPI if we have the ID
      if (mapping.uazapi_message_id) {
        const { data: instance } = await supabase
          .from("instances")
          .select("*, ghl_subaccounts!inner(location_id, user_id)")
          .eq("ghl_subaccounts.location_id", mapping.location_id)
          .limit(1)
          .maybeSingle();

        if (instance) {
          const { data: settings } = await supabase
            .from("user_settings")
            .select("uazapi_base_url")
            .eq("user_id", instance.ghl_subaccounts.user_id)
            .maybeSingle();

          if (settings?.uazapi_base_url) {
            try {
              await fetch(`${settings.uazapi_base_url}/message/react`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "token": instance.uazapi_instance_token,
                },
                body: JSON.stringify({
                  id: mapping.uazapi_message_id,
                  emoji,
                }),
              });
            } catch (e) {
              console.error("Failed to send reaction to UAZAPI:", e);
            }
          }
        }
      }

      // Update reactions in database
      const currentReactions = (mapping.reactions as string[]) || [];
      const updatedReactions = [...currentReactions, emoji];

      const { data: updated, error: updateError } = await supabase
        .from("message_map")
        .update({ reactions: updatedReactions })
        .eq("ghl_message_id", ghl_id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Broadcast reaction
      await supabase.channel("ghl_updates").send({
        type: "broadcast",
        event: "msg_update",
        payload: {
          ghl_id,
          type: "react",
          emoji,
          location_id: mapping.location_id,
        },
      });

      return new Response(
        JSON.stringify({ success: true, data: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: delete - Mark message as deleted
    if (action === "delete") {
      const { ghl_id, from_me } = body;

      if (!ghl_id) {
        return new Response(
          JSON.stringify({ error: "ghl_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the message mapping
      const { data: mapping, error: fetchError } = await supabase
        .from("message_map")
        .select("*")
        .eq("ghl_message_id", ghl_id)
        .maybeSingle();

      if (fetchError || !mapping) {
        return new Response(
          JSON.stringify({ error: "Message not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send delete to UAZAPI if we have the ID and it's from_me
      if (mapping.uazapi_message_id && from_me) {
        const { data: instance } = await supabase
          .from("instances")
          .select("*, ghl_subaccounts!inner(location_id, user_id)")
          .eq("ghl_subaccounts.location_id", mapping.location_id)
          .limit(1)
          .maybeSingle();

        if (instance) {
          const { data: settings } = await supabase
            .from("user_settings")
            .select("uazapi_base_url")
            .eq("user_id", instance.ghl_subaccounts.user_id)
            .maybeSingle();

          if (settings?.uazapi_base_url) {
            try {
              await fetch(`${settings.uazapi_base_url}/message/delete`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "token": instance.uazapi_instance_token,
                },
                body: JSON.stringify({
                  id: mapping.uazapi_message_id,
                  fromMe: true,
                }),
              });
            } catch (e) {
              console.error("Failed to send delete to UAZAPI:", e);
            }
          }
        }
      }

      // Mark as deleted in database
      const { data: updated, error: updateError } = await supabase
        .from("message_map")
        .update({ is_deleted: true })
        .eq("ghl_message_id", ghl_id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Broadcast deletion
      await supabase.channel("ghl_updates").send({
        type: "broadcast",
        event: "msg_update",
        payload: {
          ghl_id,
          type: "delete",
          fromMe: from_me,
          location_id: mapping.location_id,
        },
      });

      return new Response(
        JSON.stringify({ success: true, data: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: lookup - Get mapping by UAZAPI ID (for webhook processing)
    if (action === "lookup") {
      const { uazapi_id, ghl_id } = body;

      let query = supabase.from("message_map").select("*");
      
      if (uazapi_id) {
        query = query.eq("uazapi_message_id", uazapi_id);
      } else if (ghl_id) {
        query = query.eq("ghl_message_id", ghl_id);
      } else {
        return new Response(
          JSON.stringify({ error: "uazapi_id or ghl_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error in map-messages:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
