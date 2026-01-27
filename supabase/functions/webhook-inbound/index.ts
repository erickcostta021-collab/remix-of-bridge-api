import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to download media from UAZAPI and get public URL
// Based on n8n workflow: POST /message/download with { "id": messageId }
async function getPublicMediaUrl(
  baseUrl: string, 
  instanceToken: string, 
  messageId: string
): Promise<string | null> {
  const downloadUrl = `${baseUrl}/message/download`;
  console.log("Trying UAZAPI media download:", { downloadUrl, messageId });

  try {
    const res = await fetch(downloadUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "token": instanceToken, // lowercase as per n8n
      },
      body: JSON.stringify({ id: messageId }),
    });

    const responseText = await res.text();
    console.log("UAZAPI download response:", { status: res.status, body: responseText.substring(0, 500) });

    if (res.ok) {
      try {
        const data = JSON.parse(responseText);
        // n8n uses $json.fileURL
        const fileUrl = data.fileURL || data.fileUrl || data.url || data.URL || 
                       data.file || data.File || data.data?.fileURL || null;
        if (fileUrl) {
          console.log("Got public media URL:", fileUrl);
          return fileUrl;
        }
      } catch {
        // Response might be the URL directly
        if (responseText.startsWith("http")) {
          console.log("Got public media URL (direct):", responseText.substring(0, 100));
          return responseText.trim();
        }
      }
    }
  } catch (e) {
    console.error("Media download attempt failed:", e);
  }

  return null;
}

// Helper to get valid access token (refresh if needed)
async function getValidToken(supabase: any, integration: any, settings: any): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(integration.ghl_token_expires_at);
  const expiresIn1Hour = (expiresAt.getTime() - now.getTime()) < 3600000;

  if (now >= expiresAt || expiresIn1Hour) {
    // Refresh token
    const tokenParams = new URLSearchParams({
      client_id: settings.ghl_client_id,
      client_secret: settings.ghl_client_secret,
      grant_type: "refresh_token",
      refresh_token: integration.ghl_refresh_token,
      user_type: "Location",
    });

    const tokenResponse = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokenData = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await supabase
      .from("ghl_subaccounts")
      .update({
        ghl_access_token: tokenData.access_token,
        ghl_refresh_token: tokenData.refresh_token,
        ghl_token_expires_at: newExpiresAt.toISOString(),
        ghl_subaccount_token: tokenData.access_token,
        oauth_last_refresh: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return tokenData.access_token;
  }

  return integration.ghl_access_token;
}

// Helper to search/create contact in GHL
async function findOrCreateContact(
  phone: string,
  name: string,
  locationId: string,
  token: string
): Promise<any> {
  // Search for existing contact
  const searchResponse = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${phone}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
      },
    }
  );

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    if (searchData.contacts && searchData.contacts.length > 0) {
      return searchData.contacts[0];
    }
  }

  // Create new contact
  const createResponse = await fetch("https://services.leadconnectorhq.com/contacts/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      firstName: name || "WhatsApp Contact",
      phone: `+${phone}`,
      locationId,
      source: "WhatsApp Integration",
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error("Failed to create contact:", errorText);

    // Some locations disallow duplicates and return an existing contactId in meta.
    // Example: { statusCode: 400, message: "This location does not allow duplicated contacts.", meta: { contactId: "..." } }
    try {
      const parsed = JSON.parse(errorText);
      const maybeExistingId = parsed?.meta?.contactId;
      const msg = String(parsed?.message || "");

      if (createResponse.status === 400 && maybeExistingId && msg.toLowerCase().includes("duplicated")) {
        console.log("Duplicate contact detected, reusing existing contactId:", maybeExistingId);
        return { id: maybeExistingId };
      }
    } catch {
      // ignore JSON parse errors
    }

    throw new Error("Failed to create contact in GHL");
  }

  const createData = await createResponse.json();
  return createData.contact;
}

// Helper to update contact profile photo in GHL
async function updateContactPhoto(contactId: string, photoUrl: string, token: string): Promise<void> {
  if (!photoUrl) return;
  
  console.log("Updating contact photo:", { contactId, photoUrl: photoUrl.substring(0, 50) });
  
  const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      profilePhoto: photoUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to update contact photo:", errorText);
    // Don't throw - photo update is not critical
  } else {
    console.log("Contact photo updated successfully");
  }
}

// Helper to assign contact to a GHL user
async function assignContactToUser(contactId: string, userId: string, token: string): Promise<void> {
  if (!userId) return;
  
  console.log("Assigning contact to user:", { contactId, userId });
  
  const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      assignedTo: userId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to assign contact to user:", errorText);
    // Don't throw - assignment is not critical for message flow
  } else {
    console.log("Contact assigned to user successfully:", userId);
  }
}

// Helper to send text message to GHL (inbound = from lead)
async function sendMessageToGHL(contactId: string, message: string, token: string): Promise<void> {
  const response = await fetch("https://services.leadconnectorhq.com/conversations/messages/inbound", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-04-15",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      type: "SMS",
      contactId,
      message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send message to GHL:", errorText);
    throw new Error("Failed to send message to GHL");
  }
}

// Helper to send outbound text message to GHL (render what WE sent)
// Docs: POST /conversations/messages requires contactId (and returns conversationId)
async function sendOutboundMessageToGHL(contactId: string, message: string, token: string): Promise<void> {
  const payload: Record<string, unknown> = {
    type: "SMS",
    contactId,
    message,
    status: "delivered",
  };

  console.log("Sending outbound message to GHL API:", {
    contactId,
    messagePreview: message?.substring(0, 30),
  });

  const response = await fetch(`https://services.leadconnectorhq.com/conversations/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-04-15",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("Failed to send outbound message to GHL:", responseText);
    throw new Error("Failed to send outbound message to GHL");
  }

  console.log("✅ Outbound message sent successfully to GHL:", responseText.substring(0, 300));
}

// Helper to get or create conversation for a contact
async function getOrCreateConversation(contactId: string, locationId: string, token: string): Promise<string> {
  // First try to get existing conversation
  const searchResponse = await fetch(
    `https://services.leadconnectorhq.com/conversations/search?locationId=${locationId}&contactId=${contactId}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-04-15",
        "Accept": "application/json",
      },
    }
  );

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    if (searchData.conversations && searchData.conversations.length > 0) {
      return searchData.conversations[0].id;
    }
  }

  // Create new conversation if not found
  const createResponse = await fetch("https://services.leadconnectorhq.com/conversations/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-04-15",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      locationId,
      contactId,
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error("Failed to create conversation:", errorText);
    throw new Error("Failed to create conversation in GHL");
  }

  const createData = await createResponse.json();
  return createData.conversation?.id || createData.id;
}

// Helper to send media message to GHL with attachments (inbound = from lead)
async function sendMediaToGHL(contactId: string, attachmentUrls: string[], token: string, caption?: string): Promise<void> {
  const response = await fetch("https://services.leadconnectorhq.com/conversations/messages/inbound", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-04-15",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      type: "SMS",
      contactId,
      message: caption || "", // Empty string instead of [Media]
      attachments: attachmentUrls,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send media to GHL:", errorText);
    throw new Error("Failed to send media to GHL");
  }
}

// Helper to send outbound media message to GHL (render what WE sent)
async function sendOutboundMediaToGHL(contactId: string, attachmentUrls: string[], token: string, caption?: string): Promise<void> {
  const payload: Record<string, unknown> = {
    type: "SMS",
    contactId,
    message: caption || "",
    attachments: attachmentUrls,
    status: "delivered",
  };

  console.log("Sending outbound media to GHL API:", {
    contactId,
    attachments: attachmentUrls.length,
  });

  const response = await fetch(`https://services.leadconnectorhq.com/conversations/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-04-15",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("Failed to send outbound media to GHL:", responseText);
    throw new Error("Failed to send outbound media to GHL");
  }

  console.log("✅ Outbound media sent successfully to GHL:", responseText.substring(0, 300));
}

// Dedup helper using public.ghl_processed_messages (unique message_id)
async function markIfNew(supabase: any, messageId: string): Promise<boolean> {
  if (!messageId) return true;
  try {
    const { error } = await supabase.from("ghl_processed_messages").insert({ message_id: messageId });
    if (error) {
      if (error.code === "23505") return false; // duplicate
      console.error("Dedup insert error (allowing processing):", error);
      return true;
    }
    return true;
  } catch (e) {
    console.error("Dedup insert exception (allowing processing):", e);
    return true;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("UAZAPI Webhook received:", JSON.stringify(body, null, 2));

    // Handle different event types from UAZAPI
    // EventType is a string, but event can be an object
    const eventType = body.EventType || body.type || "";
    
    // Check if it's a message event (string check)
    const isMessageEvent = typeof eventType === "string" && eventType.toLowerCase().includes("message");
    
    if (!isMessageEvent) {
      // Not a message event, acknowledge
      console.log("Not a message event, ignoring:", eventType);
      return new Response(
        JSON.stringify({ received: true, ignored: true, eventType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract message data from UAZAPI payload (new structure)
    const messageData = body.message || body.data || {};
    const chatData = body.chat || {};
    const eventData = body.event || {};
    
    // Check if message was sent by the connected WhatsApp instance (fromMe)
    // If fromMe is true, this is a message WE sent - we'll sync it as outbound message in GHL
    const isFromMe = messageData.fromMe === true;
    
    // Check if message was sent by API (agente_ia) - should be rendered as outbound in GHL
    // Note: wasSentByApi may come at root level or inside message object
    const wasSentByApi = body.wasSentByApi === true || messageData.wasSentByApi === true;
    const trackId = String(body.track_id || messageData.track_id || "").trim();
    
    console.log("API Agent check:", { wasSentByApi, trackId, isFromMe });

    // IMPORTANT:
    // If UAZAPI marks the message as API-sent but there's no track_id,
    // we must discard it to avoid infinite loops (e.g., messages mirrored from GHL -> UAZAPI).
    // The track_id validation against user's configured track_id happens later after we fetch the instance.
    if (wasSentByApi && !trackId) {
      console.log("Discarding API-sent message without track_id:", {
        wasSentByApi,
        trackId,
        isFromMe,
        messageid: messageData.messageid || messageData.id,
      });

      return new Response(
        JSON.stringify({
          received: true,
          ignored: true,
          reason: "discard_api_message_no_track_id",
          wasSentByApi,
          trackId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get sender info - PRIORITY: chatid/wa_chatid contains the real phone number
    // The "sender" field often contains internal LID (linked ID) which is NOT a valid phone
    const from = chatData.wa_chatid || messageData.chatid || eventData.Chat || messageData.sender || "";
    const instanceToken = body.token || body.instanceToken || messageData.instanceToken || "";
    
    // For groups, check if it's a group chat and use group name
    const isGroupChat = from.endsWith("@g.us") || messageData.isGroup === true || chatData.wa_isGroup === true;
    
    // Extract names correctly:
    // - senderName: the person who sent the message (member in a group)
    // - groupName: the name of the group (from messageData.groupName or chatData.wa_name/name)
    const senderName = messageData.senderName || "";
    
    // For group name, prioritize messageData.groupName, then fallback to chat data
    // Only use chat.wa_name/name for groups - these contain the group name, not sender name
    let groupName = "";
    if (isGroupChat) {
      groupName = (messageData.groupName && messageData.groupName !== "Unknown") 
        ? messageData.groupName 
        : (chatData.wa_name || chatData.name || "");
    }
    
    // For individual chats, use sender name from chat data as fallback
    const individualName = senderName || chatData.wa_name || chatData.name || "";
    
    // Use group name for contact creation with 👥 emoji prefix for groups
    const pushName = isGroupChat ? `👥 ${groupName || "Grupo"}` : individualName;
    // Store member name for group message formatting
    const memberName = isGroupChat ? (senderName || individualName) : "";
    
    // Detect media vs text message - including stickers
    const contentRaw = messageData.content;
    const messageType = (messageData.messageType || messageData.mediaType || "").toLowerCase();
    const isSticker = messageType === "stickermessage" || messageType === "sticker";
    const isMediaMessage = (contentRaw && typeof contentRaw === "object" && (contentRaw.URL || contentRaw.url)) || isSticker;
    const mediaUrl = isMediaMessage ? (contentRaw?.URL || contentRaw?.url || null) : null;
    const mediaType = messageData.mediaType || messageData.messageType || "";
    
    // Extract text message - handle both string and object content
    let textMessage = "";
    if (typeof contentRaw === "string") {
      textMessage = contentRaw;
    } else if (typeof contentRaw === "object" && contentRaw?.text) {
      // Content can be an object with a text field (e.g., ExtendedTextMessage)
      textMessage = contentRaw.text;
    } else if (messageData.text) {
      textMessage = messageData.text;
    } else if (messageData.conversation) {
      textMessage = messageData.conversation;
    }

    console.log("Extracted data:", { 
      from, 
      textMessage: textMessage?.substring(0, 50), 
      isMediaMessage, 
      mediaUrl: mediaUrl?.substring(0, 50),
      mediaType,
      pushName,
      isFromMe,
      trackId,
      isSticker,
      instanceToken: instanceToken?.substring(0, 20) + "..." 
    });

    // Need either text or media
    if (!from || (!textMessage && !mediaUrl)) {
      console.log("Missing from or content in payload");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "missing data", from, textMessage, mediaUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if from a group
    const isGroup = from.endsWith("@g.us");

    // Extract phone number
    const phoneNumber = from.split("@")[0];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // UAZAPI may fire the same 'fromMe' message multiple times; dedupe by UAZAPI messageid.
    // This prevents creating the same outbound message repeatedly in GHL (which then triggers outbound webhooks and loops).
    const uazapiMessageId = String(messageData.messageid || messageData.id || "");
    if (uazapiMessageId) {
      const isNew = await markIfNew(supabase, `uazapi:${uazapiMessageId}`);
      if (!isNew) {
        console.log("Duplicate UAZAPI message ignored:", { uazapiMessageId });
        return new Response(
          JSON.stringify({ received: true, ignored: true, reason: "duplicate_uazapi_message", uazapiMessageId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Find the instance by token
    const { data: instance, error: instanceError } = await supabase
      .from("instances")
      .select("*, ghl_subaccounts!inner(*)")
      .eq("uazapi_instance_token", instanceToken)
      .single();

    if (instanceError || !instance) {
      console.log("Instance not found for token:", instanceToken);
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "instance not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if should ignore groups
    if (isGroup && instance.ignore_groups) {
      console.log("Ignoring group message");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "group ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subaccount = instance.ghl_subaccounts;

    // Check if OAuth is configured
    if (!subaccount.ghl_access_token || !subaccount.ghl_refresh_token) {
      console.log("OAuth not configured for this subaccount");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "oauth not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user settings for OAuth credentials AND uazapi_base_url AND track_id
    const { data: settings } = await supabase
      .from("user_settings")
      .select("ghl_client_id, ghl_client_secret, uazapi_base_url, track_id")
      .eq("user_id", subaccount.user_id)
      .single();

    if (!settings?.ghl_client_id) {
      console.log("OAuth credentials not found in user settings");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "oauth credentials missing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate track_id: if message was sent by API but doesn't match user's configured track_id, discard it
    // This prevents loops from other systems while allowing authorized AI agent messages through
    const userTrackId = settings.track_id || "";
    const isAgentIaMessage = wasSentByApi && trackId && trackId === userTrackId;
    
    if (wasSentByApi && trackId && trackId !== userTrackId) {
      console.log("Discarding API-sent message with mismatched track_id:", {
        wasSentByApi,
        incomingTrackId: trackId,
        expectedTrackId: userTrackId,
        messageid: messageData.messageid || messageData.id,
      });

      return new Response(
        JSON.stringify({
          received: true,
          ignored: true,
          reason: "discard_mismatched_track_id",
          incomingTrackId: trackId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Track ID validation:", { incomingTrackId: trackId, userTrackId, isAgentIaMessage });

    // Get valid token
    const token = await getValidToken(supabase, subaccount, settings);

    // Find or create contact
    const contact = await findOrCreateContact(
      phoneNumber,
      pushName,
      subaccount.location_id,
      token
    );

    // Save the original WhatsApp ID (with @g.us or @s.whatsapp.net) for groups
    // This allows webhook-outbound to look up the correct ID when GHL sends a different number
    if (contact.id && from) {
      try {
        await supabase
          .from("ghl_contact_phone_mapping")
          .upsert({
            contact_id: contact.id,
            location_id: subaccount.location_id,
            original_phone: from, // Full WhatsApp JID like "558181055296-1620737537@g.us"
          }, { onConflict: "contact_id,location_id" });
        console.log("Saved phone mapping:", { contactId: contact.id, originalPhone: from });
      } catch (e) {
        console.error("Failed to save phone mapping:", e);
        // Don't fail the message processing
      }
    }

    // Update contact photo from WhatsApp profile
    const profilePhoto = chatData.imagePreview || chatData.image || "";
    if (profilePhoto && contact.id) {
      await updateContactPhoto(contact.id, profilePhoto, token);
    }

    // Auto-assign contact to GHL user if configured on this instance
    if (instance.ghl_user_id && contact.id) {
      console.log("Auto-assigning contact to GHL user:", instance.ghl_user_id);
      await assignContactToUser(contact.id, instance.ghl_user_id, token);
    }
    // Prepare media URL if needed
    let publicMediaUrl = mediaUrl;
    if (isMediaMessage && mediaUrl) {
      const baseUrl = settings.uazapi_base_url?.replace(/\/$/, "") || body.BaseUrl?.replace(/\/$/, "") || "";
      const messageId = messageData.messageid || messageData.id || "";
      
      // Try to get public URL via UAZAPI download endpoint (POST /message/download)
      if (baseUrl && messageId) {
        console.log("Attempting to get public media URL via UAZAPI download:", { baseUrl, messageId });
        const downloadedUrl = await getPublicMediaUrl(baseUrl, instanceToken, messageId);
        if (downloadedUrl) {
          publicMediaUrl = downloadedUrl;
        } else {
          console.log("Could not get public URL, using original encrypted URL");
        }
      }
    }

    // Send message to GHL - differentiate between inbound (from lead) and outbound (from us/agent)
    // isAgentIaMessage: message sent by API with track_id="agente_ia" - render as outbound (attendant message)
    const shouldSyncAsOutbound = isFromMe || isAgentIaMessage;
    
    if (shouldSyncAsOutbound) {
      // This is a message WE sent via WhatsApp OR from AI agent - render as outbound in GHL
      // NOTE: GHL's /conversations/messages supports userId only for InternalComment.
      // For SMS, attribution should be handled by contact assignment (already done above).

      console.log("Syncing outbound message:", {
        isFromMe,
        isAgentIaMessage,
        wasSentByApi,
        instanceAssignedUserId: instance.ghl_user_id || null,
        textMessage: textMessage?.substring(0, 50),
        isMedia: isMediaMessage,
      });

      if (isMediaMessage && publicMediaUrl) {
        console.log("Sending outbound media to GHL:", { publicMediaUrl, textMessage });
        const before = Date.now();
        const res = await fetch(`https://services.leadconnectorhq.com/conversations/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Version": "2021-04-15",
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            type: "SMS",
            contactId: contact.id,
            message: textMessage || "",
            attachments: [publicMediaUrl],
            status: "delivered",
          }),
        });
        const bodyText = await res.text();
        console.log("GHL outbound-media response:", { status: res.status, ms: Date.now() - before, body: bodyText.substring(0, 500) });
        if (!res.ok) throw new Error("Failed to send outbound media to GHL");
        try {
          const parsed = JSON.parse(bodyText);
          const ghlMessageId = String(parsed?.messageId || "");
          if (ghlMessageId) await markIfNew(supabase, `ghl:${ghlMessageId}`);
        } catch {
          // ignore
        }
      } else if (textMessage) {
        console.log("Sending outbound text to GHL:", { textMessage: textMessage?.substring(0, 50) });
        const before = Date.now();
        const res = await fetch(`https://services.leadconnectorhq.com/conversations/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Version": "2021-04-15",
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            type: "SMS",
            contactId: contact.id,
            message: textMessage,
            status: "delivered",
          }),
        });
        const bodyText = await res.text();
        console.log("GHL outbound-text response:", { status: res.status, ms: Date.now() - before, body: bodyText.substring(0, 500) });
        if (!res.ok) throw new Error("Failed to send outbound message to GHL");
        try {
          const parsed = JSON.parse(bodyText);
          const ghlMessageId = String(parsed?.messageId || "");
          if (ghlMessageId) await markIfNew(supabase, `ghl:${ghlMessageId}`);
        } catch {
          // ignore
        }
      }

      const source = isAgentIaMessage ? "agent_ia" : (wasSentByApi ? "api" : "manual");
      console.log(`✅ Outbound message synced to GHL (${source}): ${phoneNumber} -> ${contact.id}`);
    } else {
      // This is a message FROM the lead - send as inbound
      // For group messages, format with member identification prefix with line break for clear reading
      let formattedMessage = textMessage;
      let formattedCaption = textMessage || undefined;
      if (isGroupChat && memberName && textMessage) {
        formattedMessage = `👤[ ${memberName} ]:\n${textMessage}`;
      }
      if (isGroupChat && memberName && formattedCaption) {
        formattedCaption = `👤[ ${memberName} ]:\n${formattedCaption}`;
      }
      
      if (isMediaMessage && publicMediaUrl) {
        console.log("Sending inbound media to GHL:", { publicMediaUrl, formattedCaption });
        await sendMediaToGHL(contact.id, [publicMediaUrl], token, formattedCaption);
      } else {
        console.log("Sending inbound text to GHL:", { formattedMessage: formattedMessage?.substring(0, 50) });
        await sendMessageToGHL(contact.id, formattedMessage, token);
      }
      
      console.log(`✅ Inbound message forwarded to GHL: ${phoneNumber} -> ${contact.id}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        contactId: contact.id,
        direction: shouldSyncAsOutbound ? "outbound" : "inbound",
        source: isAgentIaMessage ? "agent_ia" : (isFromMe ? "manual" : "lead"),
        message: shouldSyncAsOutbound ? "Outbound message synced to GHL" : "Inbound message forwarded to GHL"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
