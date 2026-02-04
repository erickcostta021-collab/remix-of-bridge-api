import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to try multiple API endpoints/formats
async function tryUazapiEndpoints(
  baseUrl: string,
  instanceToken: string,
  attempts: Array<{ path: string; body: Record<string, any> }>
): Promise<{ success: boolean; status: number; body: string }> {
  let lastStatus = 0;
  let lastBody = "";

  for (const attempt of attempts) {
    const url = `${baseUrl}${attempt.path}`;
    console.log("🔄 Trying UAZAPI endpoint:", { url, body: attempt.body });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": instanceToken,
        },
        body: JSON.stringify(attempt.body),
      });

      lastStatus = res.status;
      lastBody = await res.text();
      console.log("📥 UAZAPI response:", { url, status: lastStatus, body: lastBody.substring(0, 300) });

      if (res.ok) {
        return { success: true, status: lastStatus, body: lastBody };
      }
    } catch (e) {
      console.error("❌ Fetch error for", url, e);
      lastBody = e instanceof Error ? e.message : String(e);
    }
  }

  return { success: false, status: lastStatus, body: lastBody };
}

// Get instance and settings for a location
async function getInstanceForLocation(supabase: any, locationId: string) {
  const { data: instance } = await supabase
    .from("instances")
    .select("*, ghl_subaccounts!inner(location_id, user_id)")
    .eq("ghl_subaccounts.location_id", locationId)
    .eq("instance_status", "connected")
    .limit(1)
    .maybeSingle();

  if (!instance) {
    console.log("⚠️ No connected instance found for location:", locationId);
    return null;
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("uazapi_base_url")
    .eq("user_id", instance.ghl_subaccounts.user_id)
    .maybeSingle();

  if (!settings?.uazapi_base_url) {
    console.log("⚠️ No UAZAPI base URL configured for user");
    return null;
  }

  return {
    instance,
    baseUrl: settings.uazapi_base_url,
    token: instance.uazapi_instance_token,
  };
}

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

    console.log("📨 map-messages received:", { action, ...body });

    // Action: map - Save message mapping
    if (action === "map" || !action) {
      const { ghl_id, uazapi_id, text, timestamp, location_id, contact_id, from_me, message_type } = body;

      if (!ghl_id || !location_id) {
        return new Response(
          JSON.stringify({ error: "ghl_id and location_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
      const { ghl_id, new_text } = body;

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
        console.log("❌ Message not found:", ghl_id);
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

      let uazapiSuccess = false;

      // If we have UAZAPI ID, send edit to WhatsApp
      if (mapping.uazapi_message_id) {
        const config = await getInstanceForLocation(supabase, mapping.location_id);

        if (config) {
          console.log("✏️ Edit payload:", { id: mapping.uazapi_message_id, text: new_text });
          
          // UAZAPI exact format: POST /message/edit with { id, text }
          const result = await tryUazapiEndpoints(config.baseUrl, config.token, [
            { path: "/message/edit", body: { id: mapping.uazapi_message_id, text: new_text } },
          ]);

          uazapiSuccess = result.success;
          if (!result.success) {
            console.error("❌ All edit attempts failed:", result.status, result.body);
            return new Response(
              JSON.stringify({ error: "Failed to edit on WhatsApp", details: result.body }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
          original_text: mapping.message_text,
          location_id: mapping.location_id 
        },
      });

      return new Response(
        JSON.stringify({ success: true, data: updated, whatsapp_sent: uazapiSuccess }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: react - Add reaction to message
    if (action === "react") {
      const { ghl_id, emoji } = body;

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
        console.log("❌ Message not found:", ghl_id);
        return new Response(
          JSON.stringify({ error: "Message not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let uazapiSuccess = false;

      // Send reaction to UAZAPI if we have the ID
      if (mapping.uazapi_message_id) {
        const config = await getInstanceForLocation(supabase, mapping.location_id);

        if (config) {
          // Need to get the contact's phone number to build the WhatsApp JID
          let contactPhone = "";
          
          if (mapping.contact_id) {
            // Try to get phone from contact_instance_preferences or ghl_contact_phone_mapping
            const { data: phoneMapping } = await supabase
              .from("ghl_contact_phone_mapping")
              .select("original_phone")
              .eq("contact_id", mapping.contact_id)
              .maybeSingle();
            
            if (phoneMapping?.original_phone) {
              contactPhone = phoneMapping.original_phone.replace(/\D/g, "");
            }
          }

          // Build the WhatsApp JID (number@s.whatsapp.net)
          const whatsappJid = contactPhone ? `${contactPhone}@s.whatsapp.net` : "";
          
          console.log("📱 React payload:", { 
            number: whatsappJid, 
            text: emoji, 
            id: mapping.uazapi_message_id,
            contact_id: mapping.contact_id 
          });

          // UAZAPI format: POST /message/react with { number, text (emoji), id }
          const result = await tryUazapiEndpoints(config.baseUrl, config.token, [
            // Exact UAZAPI format from user documentation
            { path: "/message/react", body: { number: whatsappJid, text: emoji, id: mapping.uazapi_message_id } },
            // Try without JID suffix if needed
            { path: "/message/react", body: { number: contactPhone, text: emoji, id: mapping.uazapi_message_id } },
          ]);

          uazapiSuccess = result.success;
          if (!result.success) {
            console.error("❌ React failed:", result.status, result.body);
            return new Response(
              JSON.stringify({ error: "Failed to react on WhatsApp", details: result.body }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
        payload: { ghl_id, type: "react", emoji, location_id: mapping.location_id },
      });

      return new Response(
        JSON.stringify({ success: true, data: updated, whatsapp_sent: uazapiSuccess }),
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
        console.log("❌ Message not found:", ghl_id);
        return new Response(
          JSON.stringify({ error: "Message not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let uazapiSuccess = false;

      // Send delete to UAZAPI if we have the ID and it's from_me
      if (mapping.uazapi_message_id && from_me) {
        const config = await getInstanceForLocation(supabase, mapping.location_id);

        if (config) {
          // Try multiple endpoint formats for delete
          const result = await tryUazapiEndpoints(config.baseUrl, config.token, [
            // UAZAPI style
            { path: "/message/delete", body: { id: mapping.uazapi_message_id, fromMe: true } },
            { path: "/chat/delete", body: { Id: mapping.uazapi_message_id, FromMe: true } },
            { path: "/chat/delete", body: { messageId: mapping.uazapi_message_id, fromMe: true } },
            // Evolution style
            { path: "/message/delete", body: { key: { id: mapping.uazapi_message_id, fromMe: true } } },
          ]);

          uazapiSuccess = result.success;
          if (!result.success) {
            console.error("❌ All delete attempts failed:", result.status, result.body);
            // For delete, we still mark as deleted in DB even if WhatsApp fails
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
        payload: { ghl_id, type: "delete", fromMe: from_me, location_id: mapping.location_id },
      });

      return new Response(
        JSON.stringify({ success: true, data: updated, whatsapp_sent: uazapiSuccess }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: reply - Send a reply message with quoted context
    if (action === "reply") {
      const { ghl_id, text, contact_phone, location_id } = body;

      if (!ghl_id || !text || !location_id) {
        return new Response(
          JSON.stringify({ error: "ghl_id, text and location_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the original message mapping to get the UAZAPI message ID
      const { data: mapping, error: fetchError } = await supabase
        .from("message_map")
        .select("*")
        .eq("ghl_message_id", ghl_id)
        .maybeSingle();

      if (fetchError) {
        console.error("❌ Error fetching mapping:", fetchError);
        return new Response(
          JSON.stringify({ error: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!mapping?.uazapi_message_id) {
        console.log("❌ Message not mapped or missing UAZAPI ID:", ghl_id);
        return new Response(
          JSON.stringify({ error: "Message not found or not mapped to WhatsApp" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get instance configuration for this location
      const config = await getInstanceForLocation(supabase, location_id);

      if (!config) {
        return new Response(
          JSON.stringify({ error: "No connected instance found for this location" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build the phone number - try from mapping first, then from request
      let phoneNumber = contact_phone;
      
      if (!phoneNumber && mapping.contact_id) {
        const { data: phoneMapping } = await supabase
          .from("ghl_contact_phone_mapping")
          .select("original_phone")
          .eq("contact_id", mapping.contact_id)
          .maybeSingle();
        
        if (phoneMapping?.original_phone) {
          phoneNumber = phoneMapping.original_phone.replace(/\D/g, "");
        }
      }

      if (!phoneNumber) {
        return new Response(
          JSON.stringify({ error: "Could not determine phone number for reply" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("↩️ Reply payload:", { 
        number: phoneNumber, 
        text, 
        replyid: mapping.uazapi_message_id 
      });

      // Send reply using /send/text with replyid
      const result = await tryUazapiEndpoints(config.baseUrl, config.token, [
        { 
          path: "/send/text", 
          body: { 
            number: phoneNumber, 
            text: text, 
            replyid: mapping.uazapi_message_id 
          } 
        },
      ]);

      if (!result.success) {
        console.error("❌ Reply failed:", result.status, result.body);
        return new Response(
          JSON.stringify({ error: "Failed to send reply on WhatsApp", details: result.body }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse the response to get the new message ID
      let newMessageId = null;
      try {
        const responseData = JSON.parse(result.body);
        newMessageId = responseData.key?.id || responseData.messageId || responseData.id;
      } catch (e) {
        console.log("⚠️ Could not parse reply response for message ID");
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          whatsapp_sent: true,
          new_message_id: newMessageId
        }),
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