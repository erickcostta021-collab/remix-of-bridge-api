import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get valid access token (refresh if needed)
async function getValidToken(supabase: any, subaccount: any, settings: any): Promise<string> {
  const accessToken: string | null = subaccount.ghl_access_token ?? null;
  const refreshToken: string | null = subaccount.ghl_refresh_token ?? null;
  const expiresAtIso: string | null = subaccount.ghl_token_expires_at ?? null;

  if (!accessToken || !refreshToken || !expiresAtIso) return accessToken || "";

  const now = new Date();
  const expiresAt = new Date(expiresAtIso);
  const expiresIn1Hour = expiresAt.getTime() - now.getTime() < 60 * 60 * 1000;

  if (now >= expiresAt || expiresIn1Hour) {
    const tokenParams = new URLSearchParams({
      client_id: settings.ghl_client_id,
      client_secret: settings.ghl_client_secret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
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
      const err = await tokenResponse.text();
      console.error("Failed to refresh GHL token:", err);
      throw new Error("Failed to refresh GHL token");
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
      .eq("id", subaccount.id);

    return tokenData.access_token;
  }

  return accessToken;
}

async function fetchGhlContactPhone(token: string, contactId: string): Promise<string> {
  const contactRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
      },
    }
  );

  const bodyText = await contactRes.text();
  if (!contactRes.ok) {
    console.error("GHL contact lookup failed:", { status: contactRes.status, body: bodyText.substring(0, 300) });
    return "";
  }

  try {
    const parsed = JSON.parse(bodyText);
    return String(
      parsed?.contact?.phone ||
        parsed?.contact?.phoneNumber ||
        parsed?.contact?.primaryPhone ||
        ""
    );
  } catch {
    return "";
  }
}

// Helper to detect if phone is a group ID
function isGroupId(phone: string): boolean {
  // Clean the phone first to avoid issues with + prefix
  const cleaned = phone.replace(/\D/g, "");
  
  // Group IDs from GHL come as long numbers (typically 18+ digits starting with 120363...)
  // or already have @g.us suffix
  if (phone.includes("@g.us")) return true;
  // GHL stores group IDs as the numeric part - typically 18+ digits starting with 120363
  if (cleaned.length >= 18 && cleaned.startsWith("120363")) return true;
  return false;
}

// Format phone for UAZAPI - preserve group IDs with special chars
function formatPhoneForUazapi(phone: string): string {
  // If it's a group ID (has @g.us or hyphens), preserve it as-is
  if (phone.includes("@g.us") || phone.includes("-")) {
    return phone;
  }
  // For regular phone numbers, clean to digits only
  return phone.replace(/\D/g, "");
}

// Helper to detect media type from URL
function detectMediaType(url: string): string {
  const lower = url.toLowerCase();
  if (/\.(mp3|wav|ogg|m4a|aac)/.test(lower)) return "myaudio";
  if (/\.(mp4|mov|avi|mkv|webm)/.test(lower)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp)/.test(lower)) return "image";
  if (/\.(pdf|doc|docx|xls|xlsx|txt)/.test(lower)) return "document";
  return "file";
}

// Send text message via UAZAPI
async function sendTextMessage(base: string, instanceToken: string, phone: string, text: string): Promise<{ sent: boolean; status: number; body: string }> {
  const attempts: Array<{ path: string; headers: Record<string, string>; body: Record<string, string> }> = [
    // n8n style - primary
    {
      path: "/send/text",
      headers: { token: instanceToken },
      body: { number: phone, text, readchat: "true" },
    },
    {
      path: "/send/text",
      headers: { token: instanceToken },
      body: { number: phone, text, readchat: "1" },
    },
    {
      path: "/chat/send/text",
      headers: { Token: instanceToken },
      body: { Phone: phone, Body: text },
    },
    {
      path: "/chat/send/text",
      headers: { Token: instanceToken },
      body: { Phone: `${phone}@s.whatsapp.net`, Body: text },
    },
    {
      path: "/chat/send/text",
      headers: { Authorization: `Bearer ${instanceToken}` },
      body: { Phone: phone, Body: text },
    },
    {
      path: "/message/text",
      headers: { Token: instanceToken },
      body: { id: phone, message: text },
    },
    {
      path: "/api/sendText",
      headers: { Authorization: `Bearer ${instanceToken}` },
      body: { chatId: `${phone}@c.us`, text },
    },
  ];

  let lastStatus = 0;
  let lastBody = "";
  
  for (const attempt of attempts) {
    const url = `${base}${attempt.path}`;
    console.log("Trying UAZAPI text send:", { url, phone, headers: Object.keys(attempt.headers) });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...attempt.headers },
      body: JSON.stringify(attempt.body),
    });

    lastStatus = res.status;
    lastBody = await res.text();
    console.log("UAZAPI text response:", { url, status: lastStatus, body: lastBody.substring(0, 200) });

    if (res.ok) {
      return { sent: true, status: lastStatus, body: lastBody };
    }
  }

  return { sent: false, status: lastStatus, body: lastBody };
}

// Send media message via UAZAPI (based on n8n flow)
async function sendMediaMessage(base: string, instanceToken: string, phone: string, fileUrl: string, mediaType: string, caption?: string): Promise<{ sent: boolean; status: number; body: string }> {
  // Based on n8n: POST {base}/send/media with header token and body { number, type, file, readchat, text (optional caption) }
  const attempts: Array<{ path: string; headers: Record<string, string>; body: Record<string, any> }> = [
    // n8n style - primary
    {
      path: "/send/media",
      headers: { token: instanceToken },
      body: { number: phone, type: mediaType, file: fileUrl, readchat: "true", ...(caption ? { text: caption } : {}) },
    },
    {
      path: "/send/media",
      headers: { token: instanceToken },
      body: { number: phone, type: mediaType, file: fileUrl, readchat: "1", ...(caption ? { text: caption } : {}) },
    },
    // Alternative without type
    {
      path: "/send/media",
      headers: { token: instanceToken },
      body: { number: phone, file: fileUrl, readchat: "true", ...(caption ? { text: caption } : {}) },
    },
    // Wuzapi style
    {
      path: "/chat/send/media",
      headers: { Token: instanceToken },
      body: { Phone: phone, Url: fileUrl, Caption: caption || "" },
    },
    {
      path: "/chat/send/document",
      headers: { Token: instanceToken },
      body: { Phone: phone, Url: fileUrl },
    },
    // For audio specifically
    {
      path: "/send/audio",
      headers: { token: instanceToken },
      body: { number: phone, file: fileUrl, readchat: "true" },
    },
  ];

  let lastStatus = 0;
  let lastBody = "";
  
  for (const attempt of attempts) {
    const url = `${base}${attempt.path}`;
    console.log("Trying UAZAPI media send:", { url, phone, mediaType, headers: Object.keys(attempt.headers) });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...attempt.headers },
      body: JSON.stringify(attempt.body),
    });

    lastStatus = res.status;
    lastBody = await res.text();
    console.log("UAZAPI media response:", { url, status: lastStatus, body: lastBody.substring(0, 200) });

    if (res.ok) {
      return { sent: true, status: lastStatus, body: lastBody };
    }
  }

  return { sent: false, status: lastStatus, body: lastBody };
}

// Database-based deduplication using ghl_processed_messages table
async function isDuplicate(supabase: any, messageId: string): Promise<boolean> {
  if (!messageId) return false;
  
  try {
    // Try to insert the messageId - if it already exists, it's a duplicate
    const { error } = await supabase
      .from("ghl_processed_messages")
      .insert({ message_id: messageId });
    
    if (error) {
      // If unique constraint violation, it's a duplicate
      if (error.code === "23505") {
        console.log("Duplicate detected via DB:", { messageId });
        return true;
      }
      console.error("Error checking duplicate:", error);
      // On other errors, allow processing to avoid blocking messages
      return false;
    }
    
    return false;
  } catch (e) {
    console.error("Dedup check failed:", e);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("✅ webhook-outbound HIT", {
    method: req.method,
    url: req.url,
    contentType: req.headers.get("content-type"),
    userAgent: req.headers.get("user-agent"),
  });

  // Parse body once
  let body: any;
  try {
    body = await req.json();
  } catch (error) {
    console.error("Failed to parse body:", error);
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // RESPOND IMMEDIATELY to avoid GHL timeout (15s limit)
  const response = new Response(JSON.stringify({ success: true, processing: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  // Process the message in background
  (async () => {
    try {
    const messageId: string = String(body.messageId ?? "");
    // IMPORTANT: Keep dedupe key format consistent across inbound/outbound.
    // webhook-inbound stores returned GHL message IDs as `ghl:<messageId>`.
    // If we dedupe using the raw ID here, we won't match and the loop continues.
    const dedupeKey = messageId ? `ghl:${messageId}` : "";
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check for duplicate webhook calls (GHL sometimes sends same message twice)
    if (dedupeKey && await isDuplicate(supabase, dedupeKey)) {
      console.log("Duplicate webhook ignored:", { messageId, dedupeKey });
      return; // Already responded
    }
    
    console.log("GHL Outbound payload:", JSON.stringify(body, null, 2));

    // Extract message data first to check if it's a valid outbound message
    const eventType = String(body.type ?? "");
    const direction = String(body.direction ?? "");
    const source = String(body.source ?? "");
    const messageText: string = String(body.message ?? body.body ?? "");
    const phoneRaw: string = String(body.phone ?? body.to ?? "");
    const attachments: string[] = Array.isArray(body.attachments) ? body.attachments : [];
    
    // Accept messages if:
    // 1. type is OutboundMessage OR direction is outbound
    // 2. OR type is SMS with phone and content (GHL sends SMS type for user-sent messages)
    const isOutbound = eventType === "OutboundMessage" || direction === "outbound";
    const isSmsWithContent = eventType === "SMS" && phoneRaw && (messageText || attachments.length > 0);
    
    if (!isOutbound && !isSmsWithContent) {
      console.log("Ignoring non-outbound event:", { eventType, direction });
      return; // Already responded
    }

    // CRITICAL: Check if this message was synced from WhatsApp via webhook-inbound
    // When a message is sent from the phone, webhook-inbound syncs it to GHL and stores the GHL messageId.
    // If source is NOT from GHL UI/workflow (source !== "workflow" && source !== "direct"), it might be a synced message.
    // We should only process messages that originated from GHL, not messages that were synced FROM WhatsApp.
    // 
    // Source values:
    // - "app" = GHL web interface
    // - "workflow" = GHL automation
    // - "direct" = direct API call from GHL
    // - Others = potentially synced from external source
    const isFromGhlInterface = source === "app" || source === "workflow" || source === "direct";
    
    // If the message has status "delivered" and is NOT from GHL interface, it's likely a synced message
    // from webhook-inbound - we should NOT re-send it
    const status = String(body.status ?? "");
    if (status === "delivered" && !isFromGhlInterface) {
      console.log("Ignoring already-delivered message (likely synced from WhatsApp):", { source, status, messageId });
      return; // Already responded
    }

    const locationId: string | undefined = body.locationId;
    const contactId: string | undefined = body.contactId;
    const conversationId: string | undefined = body.conversationId;

    // Validation ping check
    if (!messageText && !phoneRaw && !contactId && attachments.length === 0) {
      console.log("Validation ping received, responding 200 OK");
      return; // Already responded
    }

    if (!locationId) {
      console.error("Missing locationId in payload");
      return; // Already responded
    }

    // Find subaccount (usando limit(1) para evitar erro com duplicatas)
    const { data: subaccounts, error: subError } = await supabase
      .from("ghl_subaccounts")
      .select("id, user_id, location_id, ghl_access_token, ghl_refresh_token, ghl_token_expires_at")
      .eq("location_id", locationId)
      .limit(1);
    
    const subaccount = subaccounts?.[0] || null;

    if (subError || !subaccount) {
      console.error("Subaccount lookup failed:", { locationId, subError });
      return; // Already responded
    }

    // Buscar todas as instâncias da subconta
    const { data: instances, error: instErr } = await supabase
      .from("instances")
      .select("id, uazapi_instance_token")
      .eq("subaccount_id", subaccount.id)
      .order("created_at", { ascending: true });

    if (instErr || !instances || instances.length === 0) {
      console.error("No instance found for subaccount");
      return; // Already responded
    }

    // Verificar se há preferência de instância para este contato (Bridge Switcher)
    // O script GHL salva usando conversationId (que é o que aparece na URL do GHL)
    // então precisamos buscar por conversationId primeiro, depois por contactId
    let instance = instances[0]; // Default: primeira instância
    
    const lookupId = conversationId || contactId;
    if (lookupId) {
      const { data: preference } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id")
        .eq("contact_id", lookupId)
        .eq("location_id", locationId)
        .maybeSingle();
      
      if (preference?.instance_id) {
        // Encontrar a instância preferida
        const preferredInstance = instances.find(i => i.id === preference.instance_id);
        if (preferredInstance) {
          instance = preferredInstance;
          console.log("Using preferred instance from Bridge Switcher:", { instanceId: instance.id, lookupId });
        } else {
          console.log("Preferred instance not found in subaccount instances, using default");
        }
      } else {
        console.log("No preference found for:", { lookupId, locationId });
      }
    }

    const { data: settings, error: settingsErr } = await supabase
      .from("user_settings")
      .select("uazapi_base_url, uazapi_admin_token, ghl_client_id, ghl_client_secret")
      .eq("user_id", subaccount.user_id)
      .single();

    if (settingsErr || !settings?.uazapi_base_url || !instance.uazapi_instance_token) {
      console.error("UAZAPI not configured:", { settingsErr });
      return; // Already responded
    }

    // Get phone from contact - FIRST try our mapping table for the original WhatsApp ID
    let targetPhone = phoneRaw || "";
    let usedMappingTable = false;
    
    if (contactId) {
      // Try to get the original WhatsApp JID from our mapping table
      const { data: mapping } = await supabase
        .from("ghl_contact_phone_mapping")
        .select("original_phone")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .maybeSingle();
      
      if (mapping?.original_phone) {
        targetPhone = mapping.original_phone;
        usedMappingTable = true;
        console.log("Found original phone in mapping table:", { contactId, originalPhone: targetPhone });
      } else {
        // Fallback to GHL contact lookup
        try {
          if (settings?.ghl_client_id && settings?.ghl_client_secret) {
            const token = await getValidToken(supabase, subaccount, settings);
            if (token) {
              const contactPhone = await fetchGhlContactPhone(token, contactId);
              if (contactPhone) targetPhone = contactPhone;
            }
          }
        } catch (e) {
          console.error("Failed to resolve contact phone:", e);
        }
      }
    }

    // Check if this is a group message using the helper
    const isGroup = isGroupId(targetPhone);
    
    // Format phone for UAZAPI
    // If we got the phone from mapping table, it's already in correct format
    // For groups: add @g.us suffix if not present
    // For regular numbers: clean to digits only
    if (!usedMappingTable) {
      targetPhone = formatPhoneForUazapi(targetPhone);
      
      // If it's a group and doesn't have @g.us, add it
      if (isGroup && !targetPhone.includes("@g.us")) {
        targetPhone = `${targetPhone}@g.us`;
      }
    }

    if (!targetPhone) {
      console.error("No phone number available");
      return; // Already responded
    }

    console.log("Phone formatting:", { original: phoneRaw, formatted: targetPhone, isGroup, usedMappingTable });

    // Check if we have content to send
    if (!messageText && attachments.length === 0) {
      console.log("No message text or attachments provided; acknowledging");
      return; // Already responded
    }

    const base = settings.uazapi_base_url.replace(/\/$/, "");
    const instanceToken = instance.uazapi_instance_token;
    const results: Array<{ type: string; sent: boolean; status: number }> = [];

    // Send attachments first (media)
    for (const attachment of attachments) {
      const mediaType = detectMediaType(attachment);
      console.log("Sending media:", { attachment, mediaType, phone: targetPhone, isGroup });
      
      const result = await sendMediaMessage(base, instanceToken, targetPhone, attachment, mediaType, messageText || undefined);
      results.push({ type: `media:${mediaType}`, sent: result.sent, status: result.status });
      
      if (!result.sent) {
        console.error("Failed to send media:", { attachment, status: result.status, body: result.body });
      }
    }

    // Send text message if there's text AND no attachments (to avoid duplicate text)
    // If there were attachments, text was already sent as caption
    if (messageText && attachments.length === 0) {
      console.log("Sending text:", { text: messageText.substring(0, 50), phone: targetPhone, isGroup });
      const result = await sendTextMessage(base, instanceToken, targetPhone, messageText);
      results.push({ type: "text", sent: result.sent, status: result.status });
      
      if (!result.sent) {
        console.error("Failed to send text:", { status: result.status, body: result.body });
      }
    }

    const allSent = results.every(r => r.sent);
    const anySent = results.some(r => r.sent);

    console.log(`${anySent ? "✅" : "❌"} Message processing complete:`, { phone: targetPhone, isGroup, results });

  } catch (error) {
    console.error("Webhook outbound background processing error:", error);
  }
  })();

  return response;
});
