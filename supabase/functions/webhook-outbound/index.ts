import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(
  url: string,
  instanceToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; text: string }> {
  const methods: Array<"POST" | "PUT"> = ["POST", "PUT"];
  let last = { ok: false, status: 0, text: "" };

  for (const method of methods) {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        token: instanceToken,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    last = { ok: res.ok, status: res.status, text };
    if (res.ok) return last;
  }

  return last;
}

async function updateGroupSubjectBestEffort(
  baseUrl: string,
  instanceToken: string,
  groupIdOrJid: string,
  subject: string,
  instanceName?: string,
) {
  const urls = (
    [
      // Instance-in-path variants (common in Evolution/UAZAPI deployments)
      instanceName ? `${baseUrl}/group/updateGroupSubject/${instanceName}` : null,
      instanceName ? `${baseUrl}/group/updateSubject/${instanceName}` : null,
      // Non-instance variants
      `${baseUrl}/group/updateGroupSubject`,
      `${baseUrl}/group/updateSubject`,
    ].filter(Boolean) as string[]
  );
  const attempts: Array<Record<string, unknown>> = [
    { groupJid: groupIdOrJid, subject },
    { groupId: groupIdOrJid, subject },
    { jid: groupIdOrJid, subject },
    { id: groupIdOrJid, subject },
  ];

  for (const url of urls) {
    for (const payload of attempts) {
      const r = await postJson(url, instanceToken, payload);
      console.log("Subject update attempt:", {
        endpoint: url.split("/").slice(-2).join("/"),
        payloadKeys: Object.keys(payload),
        status: r.status,
        body: r.text.substring(0, 200),
      });
      if (r.ok) return;
    }
  }
}

async function updateGroupPictureBestEffort(
  baseUrl: string,
  instanceToken: string,
  groupIdOrJid: string,
  imageUrl: string,
  _instanceName?: string,
) {
  // Per n8n test: POST /group/updateImage with { groupjid (lowercase), image }
  const url = `${baseUrl}/group/updateImage`;
  const payload = { groupjid: groupIdOrJid, image: imageUrl };
  
  console.log("Updating group image:", { url, groupjid: groupIdOrJid, image: imageUrl });
  
  const r = await postJson(url, instanceToken, payload);
  console.log("Picture update response:", { status: r.status, body: r.text.substring(0, 300) });
  
  if (!r.ok) {
    console.error("Failed to update group image:", r.status, r.text);
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

// Returns { phone, email } from GHL contact
async function fetchGhlContact(token: string, contactId: string): Promise<{ phone: string; email: string }> {
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
    return { phone: "", email: "" };
  }

  try {
    const parsed = JSON.parse(bodyText);
    const phone = String(
      parsed?.contact?.phone ||
        parsed?.contact?.phoneNumber ||
        parsed?.contact?.primaryPhone ||
        ""
    );
    const email = String(parsed?.contact?.email || "");
    return { phone, email };
  } catch {
    return { phone: "", email: "" };
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

// =====================================================================
// GROUP MANAGEMENT COMMANDS PROCESSOR
// Commands: #criargrupo, #removerdogrupo, #addnogrupo, #promoveradmin, 
//           #revogaradmin, #attfotogrupo, #attnomegrupo, #attdescricao,
//           #somenteadminmsg, #msgliberada, #somenteadminedit, #editliberado, #linkgrupo
// =====================================================================

interface GroupCommandResult {
  isCommand: boolean;
  success?: boolean;
  command?: string;
  message?: string;
}

function parseGroupCommand(text: string): { command: string; params: string[] } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("#")) return null;
  
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) {
    return { command: trimmed.toLowerCase(), params: [] };
  }
  
  const command = trimmed.substring(0, firstSpace).toLowerCase();
  const paramsStr = trimmed.substring(firstSpace + 1);
  const params = paramsStr.split("|").map(p => p.trim());
  
  return { command, params };
}

async function findGroupByName(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  instanceName?: string,
): Promise<{ id: string; name: string } | null> {
  const endpoints = (
    [
      // Most common
      `${baseUrl}/group/all`,
      // Some deployments require instance in path
      instanceName ? `${baseUrl}/group/all/${instanceName}` : null,
      instanceName ? `${baseUrl}/${instanceName}/group/all` : null,

      // Alternative group listing endpoints seen in different UAZAPI/Evolution builds
      `${baseUrl}/group/list`,
      instanceName ? `${baseUrl}/group/list/${instanceName}` : null,
      instanceName ? `${baseUrl}/${instanceName}/group/list` : null,

      `${baseUrl}/group/findAll`,
      instanceName ? `${baseUrl}/group/findAll/${instanceName}` : null,
      instanceName ? `${baseUrl}/${instanceName}/group/findAll` : null,
    ].filter(Boolean) as string[]
  );

  // Try multiple header combinations - UAZAPI may accept 'token' or 'apikey'
  const headerVariants: Record<string, string>[] = [
    { "Content-Type": "application/json", token: instanceToken },
    { "Content-Type": "application/json", apikey: instanceToken },
  ];

  let groups: any[] | null = null;

  for (const url of endpoints) {
    for (const headers of headerVariants) {
      try {
        console.log(
          "Attempting to list groups:",
          { endpoint: url.replace(baseUrl, ""), headers: Object.keys(headers).filter((k) => k !== "Content-Type") },
        );

        const response = await fetch(url, { method: "GET", headers });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            groups = data;
            console.log(`Successfully listed ${groups.length} groups`, { endpoint: url.replace(baseUrl, "") });
            break;
          }

          // Some APIs wrap arrays inside objects
          if (data && Array.isArray((data as any).groups)) {
            const wrapped = (data as any).groups as any[];
            groups = wrapped;
            console.log(`Successfully listed ${wrapped.length} groups (wrapped)`, { endpoint: url.replace(baseUrl, "") });
            break;
          }
        } else {
          console.log(`List groups failed (${response.status})`, {
            endpoint: url.replace(baseUrl, ""),
            body: (await response.text()).substring(0, 300),
          });
        }
      } catch (err) {
        console.log("Error listing groups attempt:", { endpoint: url.replace(baseUrl, "") }, err);
      }
    }
    if (groups) break;
  }

  if (!groups) {
    console.error("Failed to list groups using all endpoint/header variants", { instanceName });
    return null;
  }
  
  // Normalize for flexible matching: lowercase, remove accents
  const normalize = (s: string) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const extractGroupName = (g: any): string => {
    return (
      g?.subject ||
      g?.name ||
      g?.groupName ||
      g?.group_name ||
      g?.groupSubject ||
      g?.group?.subject ||
      g?.group?.name ||
      g?.groupMetadata?.subject ||
      g?.groupMetadata?.name ||
      g?.metadata?.subject ||
      g?.metadata?.name ||
      ""
    );
  };

  const extractGroupId = (g: any): string => {
    // Cover common shapes across UAZAPI/Evolution builds
    return (
      g?.id ||
      g?.jid ||
      g?.groupId ||
      g?.groupJid ||
      g?.groupjid ||
      g?.group_jid ||
      g?.group?.id ||
      g?.group?.jid ||
      g?.groupMetadata?.id ||
      g?.groupMetadata?.jid ||
      g?.metadata?.id ||
      g?.metadata?.jid ||
      ""
    );
  };

  const targetName = normalize(groupName);

  // Debug: show sample shape (truncated) so we can adapt extractors when API changes
  console.log("Group list sample (first item):", JSON.stringify(groups[0] ?? null).substring(0, 800));
  console.log(
    "Available groups:",
    groups.map((g: any) => extractGroupName(g) || "(no name)").slice(0, 10),
  );

  // Try exact match first
  let found = groups.find((g: any) => normalize(extractGroupName(g)) === targetName);

  // If no exact match, try partial match (contains)
  if (!found) {
    found = groups.find((g: any) => {
      const n = normalize(extractGroupName(g));
      return n.includes(targetName) || targetName.includes(n);
    });
  }

  if (found) {
    const id = extractGroupId(found);
    const name = extractGroupName(found);

    // Prevent false positives (we can't update without an id/jid)
    if (!id) {
      console.error("Group matched by name but missing id/jid:", JSON.stringify(found).substring(0, 800));
      return null;
    }

    return { id, name };
  }
  
  return null;
}

// Context for GHL operations inside group commands
interface GhlContext {
  supabase: any;
  subaccount: any;
  settings: any;
  contactId?: string;
}

// Update GHL contact photo - tries multiple approaches
async function updateGhlContactPhoto(
  ctx: GhlContext,
  photoUrl: string,
): Promise<void> {
  if (!ctx.contactId || !ctx.settings?.ghl_client_id || !ctx.settings?.ghl_client_secret) {
    console.log("[GHL] Skipping contact photo update - missing context:", {
      hasContactId: !!ctx.contactId,
      hasClientId: !!ctx.settings?.ghl_client_id,
    });
    return;
  }

  try {
    const token = await getValidToken(ctx.supabase, ctx.subaccount, ctx.settings);
    if (!token) {
      console.error("[GHL] No valid token for photo update");
      return;
    }

    console.log("[GHL] Updating contact photo:", { contactId: ctx.contactId, photoUrl });

    // Approach 1: Try multipart upload by downloading image and uploading
    // First, download the image
    let imageBlob: Blob | null = null;
    try {
      const imgResponse = await fetch(photoUrl);
      if (imgResponse.ok) {
        imageBlob = await imgResponse.blob();
        console.log("[GHL] Downloaded image:", { size: imageBlob.size, type: imageBlob.type });
      }
    } catch (e) {
      console.log("[GHL] Failed to download image, will try direct URL approach:", e);
    }

    // If we got the image, try multipart upload to photo endpoint
    if (imageBlob && imageBlob.size > 0) {
      try {
        const formData = new FormData();
        formData.append("file", imageBlob, "group-photo.jpg");
        
        const uploadResponse = await fetch(
          `https://services.leadconnectorhq.com/contacts/${ctx.contactId}/photo`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              Version: "2021-07-28",
            },
            body: formData,
          }
        );
        
        const uploadText = await uploadResponse.text();
        if (uploadResponse.ok) {
          console.log("[GHL] ✅ Contact photo uploaded successfully via multipart");
          return;
        } else {
          console.log("[GHL] Photo upload endpoint failed:", uploadResponse.status, uploadText.substring(0, 200));
        }
      } catch (e) {
        console.log("[GHL] Multipart upload failed:", e);
      }
    }

    // Approach 2: Try different field names in PUT /contacts
    const fieldAttempts = [
      { avatar: photoUrl },
      { profilePhoto: photoUrl },
      { photo: photoUrl },
      { profilePicture: photoUrl },
      { image: photoUrl },
    ];

    for (const fields of fieldAttempts) {
      try {
        const response = await fetch(
          `https://services.leadconnectorhq.com/contacts/${ctx.contactId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              Version: "2021-07-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fields),
          }
        );

        const responseText = await response.text();
        const fieldName = Object.keys(fields)[0];
        
        if (response.ok) {
          // Check if the response contains the photo URL to confirm it worked
          if (responseText.includes(photoUrl.substring(0, 50)) || responseText.includes("avatar") || responseText.includes("photo")) {
            console.log(`[GHL] ✅ Contact photo updated successfully using field: ${fieldName}`);
            return;
          }
          console.log(`[GHL] Request succeeded but photo may not have updated (field: ${fieldName})`);
        } else {
          console.log(`[GHL] Field ${fieldName} failed:`, response.status);
        }
      } catch (e) {
        console.log(`[GHL] Error trying field:`, e);
      }
    }

    console.log("[GHL] ⚠️ Could not update contact photo - GHL may not support direct URL photo updates");

  } catch (e) {
    console.error("[GHL] Error updating contact photo:", e);
  }
}

async function processGroupCommand(
  baseUrl: string,
  instanceToken: string,
  messageText: string,
  instanceName?: string,
  currentGroupJid?: string, // JID do grupo se a mensagem veio de dentro de um grupo
  ghlContext?: GhlContext, // Context for GHL operations
): Promise<GroupCommandResult> {
  const parsed = parseGroupCommand(messageText);
  if (!parsed) return { isCommand: false };
  
  const { command, params } = parsed;
  console.log("Processing group command:", { command, params });
  
  const validCommands = [
    "#criargrupo", "#removerdogrupo", "#addnogrupo", "#promoveradmin",
    "#revogaradmin", "#attfotogrupo", "#attnomegrupo", "#attdescricao",
    "#somenteadminmsg", "#msgliberada", "#somenteadminedit", "#editliberado", "#linkgrupo"
  ];
  
  if (!validCommands.includes(command)) {
    return { isCommand: false };
  }

  // Commands that REQUIRE being sent from inside a group (except #criargrupo and #linkgrupo)
  const requiresGroupContext = [
    "#removerdogrupo", "#addnogrupo", "#promoveradmin", "#revogaradmin",
    "#attfotogrupo", "#attnomegrupo", "#attdescricao",
    "#somenteadminmsg", "#msgliberada", "#somenteadminedit", "#editliberado"
  ];

  if (requiresGroupContext.includes(command) && !currentGroupJid) {
    return {
      isCommand: true,
      success: false,
      command,
      message: `⚠️ O comando ${command} deve ser enviado de DENTRO do grupo que você quer gerenciar.`
    };
  }
  
  try {
    switch (command) {
      case "#criargrupo": {
        if (params.length < 4) {
          return { isCommand: true, success: false, command, message: "Formato: #criargrupo nome|descrição|urldafoto|telefone" };
        }
        const [name, description, photoUrl, ...phones] = params;
        const formattedParticipants = phones.map(p => p.replace(/\D/g, ""));
        
        console.log("Creating group with:", { name, description, photoUrl, formattedParticipants });
        
        const createResponse = await fetch(`${baseUrl}/group/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ name, participants: formattedParticipants }),
        });
        
        const createData = await createResponse.json();
        console.log("Group create response:", JSON.stringify(createData));
        
        if (!createResponse.ok) {
          return { isCommand: true, success: false, command, message: `Erro ao criar grupo: ${createData.message || createResponse.status}` };
        }
        
        const groupJid = createData.group?.JID || createData.id || createData.jid || createData.gid || createData.groupId || createData.group?.id;
        console.log("Group created with JID:", groupJid);
        
        if (!groupJid) {
          return { isCommand: true, success: true, command, message: `⚠️ Grupo criado mas JID não encontrado para aplicar configurações` };
        }
        
        await sleep(500);
        
        if (description) {
          console.log("Updating group description to:", description);
          const descResponse = await fetch(`${baseUrl}/group/updateDescription`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": instanceToken },
            body: JSON.stringify({ groupJid, description }),
          });
          console.log("Description update response:", descResponse.status, await descResponse.text());
        }
        
        if (photoUrl) {
          console.log("Updating group photo to:", photoUrl);
          await updateGroupPictureBestEffort(baseUrl, instanceToken, groupJid, photoUrl, instanceName);
        }
        
        await sleep(500);
        console.log("Sending confirmation message to group:", groupJid);
        await sendTextMessage(baseUrl, instanceToken, groupJid, "✅");
        
        return { isCommand: true, success: true, command, message: `Grupo "${name}" criado com sucesso!` };
      }
      
      case "#removerdogrupo": {
        // Formato: #removerdogrupo telefone (enviado dentro do grupo)
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #removerdogrupo telefone (envie dentro do grupo)" };
        }
        const cleanPhoneRemove = params[0].replace(/\D/g, "");
        const groupForRemove = currentGroupJid?.includes("@g.us")
          ? currentGroupJid
          : `${currentGroupJid}@g.us`;
        
        console.log("Removing participant from group:", {
          url: `${baseUrl}/group/updateParticipants`,
          groupjid: groupForRemove,
          action: "remove",
          participants: [cleanPhoneRemove],
        });
        
        const removeRes = await fetch(`${baseUrl}/group/updateParticipants`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ 
            groupjid: groupForRemove, 
            action: "remove",
            participants: [cleanPhoneRemove] 
          }),
        });
        const removeText = await removeRes.text();
        console.log("Remove participant response:", { status: removeRes.status, body: removeText.substring(0, 500) });
        
        if (!removeRes.ok) {
          return { isCommand: true, success: false, command, message: `Erro ao remover membro: ${removeText.substring(0, 100)}` };
        }
        
        return { isCommand: true, success: true, command, message: `Membro ${params[0]} removido do grupo` };
      }
      
      case "#addnogrupo": {
        // Formato: #addnogrupo telefone (enviado dentro do grupo)
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #addnogrupo telefone (envie dentro do grupo)" };
        }
        const cleanPhoneAdd = params[0].replace(/\D/g, "");
        const groupForAdd = currentGroupJid?.includes("@g.us")
          ? currentGroupJid
          : `${currentGroupJid}@g.us`;
        
        console.log("Adding participant to group:", {
          url: `${baseUrl}/group/updateParticipants`,
          groupjid: groupForAdd,
          action: "add",
          participants: [cleanPhoneAdd],
        });
        
        const addRes = await fetch(`${baseUrl}/group/updateParticipants`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ 
            groupjid: groupForAdd, 
            action: "add",
            participants: [cleanPhoneAdd] 
          }),
        });
        const addText = await addRes.text();
        console.log("Add participant response:", { status: addRes.status, body: addText.substring(0, 500) });
        
        if (!addRes.ok) {
          return { isCommand: true, success: false, command, message: `Erro ao adicionar membro: ${addText.substring(0, 100)}` };
        }
        
        return { isCommand: true, success: true, command, message: `Membro ${params[0]} adicionado ao grupo` };
      }
      
      case "#promoveradmin": {
        // Formato: #promoveradmin telefone (enviado dentro do grupo)
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #promoveradmin telefone (envie dentro do grupo)" };
        }
        const cleanPhone = params[0].replace(/\D/g, "");
        const currentGroup = currentGroupJid?.includes("@g.us")
          ? currentGroupJid
          : `${currentGroupJid}@g.us`;
        
        // PRIMARY: n8n confirmed working endpoint - POST /group/updateParticipants with groupjid (lowercase)
        // This is the UAZAPI v2 style that works
        let promoteSuccess = false;
        
        try {
          console.log("Trying primary promote endpoint (updateParticipants):", {
            url: `${baseUrl}/group/updateParticipants`,
            groupjid: currentGroup,
            action: "promote",
            participants: [cleanPhone],
          });
          
          const res = await fetch(`${baseUrl}/group/updateParticipants`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: instanceToken },
            body: JSON.stringify({
              groupjid: currentGroup,
              action: "promote",
              participants: [cleanPhone],
            }),
          });
          const text = await res.text();
          console.log("Primary promote response:", { status: res.status, body: text.substring(0, 500) });
          
          if (res.ok) {
            promoteSuccess = true;
          }
        } catch (e) {
          console.log("Primary promote error:", e);
        }
        
        // FALLBACK: Try legacy endpoints if primary fails
        if (!promoteSuccess) {
          const participantJid = `${cleanPhone}@s.whatsapp.net`;
          
          const fallbackEndpoints = [
            `${baseUrl}/group/promoteParticipant`,
            `${baseUrl}/group/promote`,
            instanceName ? `${baseUrl}/group/promoteParticipant/${instanceName}` : null,
          ].filter(Boolean) as string[];
          
          const fallbackPayloads = [
            { groupjid: currentGroup, participants: [cleanPhone] },
            { groupId: currentGroup, participants: [participantJid] },
            { groupJid: currentGroup, participants: [participantJid] },
          ];
          
          for (const url of fallbackEndpoints) {
            for (const payload of fallbackPayloads) {
              try {
                const res = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", token: instanceToken },
                  body: JSON.stringify(payload),
                });
                const text = await res.text();
                console.log("Fallback promote attempt:", {
                  endpoint: url.replace(baseUrl, ""),
                  payloadKeys: Object.keys(payload),
                  status: res.status,
                  body: text.substring(0, 200),
                });
                
                if (res.ok) {
                  promoteSuccess = true;
                  break;
                }
              } catch (e) {
                console.log("Fallback promote error:", e);
              }
            }
            if (promoteSuccess) break;
          }
        }
        
        if (!promoteSuccess) {
          return { isCommand: true, success: false, command, message: `❌ Erro ao promover ${params[0]} a admin` };
        }
        
        return { isCommand: true, success: true, command, message: `Membro ${params[0]} promovido a admin` };
      }
      
      case "#revogaradmin": {
        // Formato: #revogaradmin telefone (enviado dentro do grupo)
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #revogaradmin telefone (envie dentro do grupo)" };
        }
        const cleanPhoneDemote = params[0].replace(/\D/g, "");
        const currentGroupDemote = currentGroupJid?.includes("@g.us")
          ? currentGroupJid
          : `${currentGroupJid}@g.us`;
        
        // PRIMARY: n8n confirmed working endpoint - POST /group/updateParticipants with groupjid (lowercase)
        let demoteSuccess = false;
        
        try {
          console.log("Trying primary demote endpoint (updateParticipants):", {
            url: `${baseUrl}/group/updateParticipants`,
            groupjid: currentGroupDemote,
            action: "demote",
            participants: [cleanPhoneDemote],
          });
          
          const res = await fetch(`${baseUrl}/group/updateParticipants`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: instanceToken },
            body: JSON.stringify({
              groupjid: currentGroupDemote,
              action: "demote",
              participants: [cleanPhoneDemote],
            }),
          });
          const text = await res.text();
          console.log("Primary demote response:", { status: res.status, body: text.substring(0, 500) });
          
          if (res.ok) {
            demoteSuccess = true;
          }
        } catch (e) {
          console.log("Primary demote error:", e);
        }
        
        // FALLBACK: Try legacy endpoints if primary fails
        if (!demoteSuccess) {
          const demoteJid = `${cleanPhoneDemote}@s.whatsapp.net`;
          
          const fallbackEndpoints = [
            `${baseUrl}/group/demoteParticipant`,
            `${baseUrl}/group/demote`,
            instanceName ? `${baseUrl}/group/demoteParticipant/${instanceName}` : null,
          ].filter(Boolean) as string[];
          
          const fallbackPayloads = [
            { groupjid: currentGroupDemote, participants: [cleanPhoneDemote] },
            { groupId: currentGroupDemote, participants: [demoteJid] },
            { groupJid: currentGroupDemote, participants: [demoteJid] },
          ];
          
          for (const url of fallbackEndpoints) {
            for (const payload of fallbackPayloads) {
              try {
                const res = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", token: instanceToken },
                  body: JSON.stringify(payload),
                });
                const text = await res.text();
                console.log("Fallback demote attempt:", {
                  endpoint: url.replace(baseUrl, ""),
                  payloadKeys: Object.keys(payload),
                  status: res.status,
                  body: text.substring(0, 200),
                });
                
                if (res.ok) {
                  demoteSuccess = true;
                  break;
                }
              } catch (e) {
                console.log("Fallback demote error:", e);
              }
            }
            if (demoteSuccess) break;
          }
        }
        
        if (!demoteSuccess) {
          return { isCommand: true, success: false, command, message: `❌ Erro ao revogar admin de ${params[0]}` };
        }
        
        return { isCommand: true, success: true, command, message: `Admin ${params[0]} rebaixado a membro` };
      }
      
      case "#attfotogrupo": {
        // Formato: #attfotogrupo url (enviado dentro do grupo)
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #attfotogrupo url_da_foto (envie dentro do grupo)" };
        }
        const imageUrl = params[0];
        console.log("Updating group photo (contextual):", { groupJid: currentGroupJid, imageUrl });
        
        // 1. Update WhatsApp group photo
        await updateGroupPictureBestEffort(baseUrl, instanceToken, currentGroupJid!, imageUrl, instanceName);
        
        // 2. Also update GHL contact photo (syncs immediately)
        if (ghlContext) {
          await updateGhlContactPhoto(ghlContext, imageUrl);
        }
        
        return { isCommand: true, success: true, command, message: `Foto do grupo atualizada!` };
      }
      
      case "#attnomegrupo": {
        // Formato: #attnomegrupo novo_nome (enviado dentro do grupo)
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #attnomegrupo novo_nome (envie dentro do grupo)" };
        }
        const newSubject = params.join("|"); // Allow | in name
        await updateGroupSubjectBestEffort(baseUrl, instanceToken, currentGroupJid!, newSubject, instanceName);
        return { isCommand: true, success: true, command, message: `Nome do grupo alterado para "${newSubject}"` };
      }
      
      case "#attdescricao": {
        // Formato: #attdescricao nova_descricao (enviado dentro do grupo)
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #attdescricao nova_descricao (envie dentro do grupo)" };
        }
        const newDescription = params.join("|"); // Allow | in description
        
        // Try multiple endpoint/payload combinations (UAZAPI v2 style)
        let descUpdateSuccess = false;
        const descEndpoints = [
          { url: `${baseUrl}/group/updateDescription`, body: { groupjid: currentGroupJid, description: newDescription } },
          { url: `${baseUrl}/group/updateDescription`, body: { groupId: currentGroupJid, description: newDescription } },
          { url: `${baseUrl}/group/updateGroupDescription`, body: { groupjid: currentGroupJid, description: newDescription } },
          { url: `${baseUrl}/group/updateGroupDescription`, body: { groupId: currentGroupJid, description: newDescription } },
        ];
        
        for (const attempt of descEndpoints) {
          if (descUpdateSuccess) break;
          for (const method of ["POST", "PUT"] as const) {
            try {
              console.log("Trying description update:", { url: attempt.url, method, body: attempt.body });
              const res = await fetch(attempt.url, {
                method,
                headers: { "Content-Type": "application/json", token: instanceToken },
                body: JSON.stringify(attempt.body),
              });
              const resText = await res.text();
              console.log("Description update response:", { status: res.status, body: resText.substring(0, 200) });
              if (res.ok) {
                descUpdateSuccess = true;
                break;
              }
            } catch (e) {
              console.log("Description update error:", e);
            }
          }
        }
        
        if (descUpdateSuccess) {
          return { isCommand: true, success: true, command, message: `Descrição do grupo atualizada` };
        } else {
          return { isCommand: true, success: false, command, message: `Falha ao atualizar descrição do grupo` };
        }
      }
      
      case "#somenteadminmsg": {
        // Formato: #somenteadminmsg (enviado dentro do grupo)
        // UAZAPI v2: POST /group/updateAnnounce with { groupjid, announce: true }
        console.log("Executing #somenteadminmsg with updateAnnounce endpoint");
        const announceRes = await fetch(`${baseUrl}/group/updateAnnounce`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupjid: currentGroupJid, announce: true }),
        });
        const announceText = await announceRes.text();
        console.log("updateAnnounce response:", { status: announceRes.status, body: announceText.substring(0, 200) });
        if (announceRes.ok) {
          return { isCommand: true, success: true, command, message: `Apenas admins podem enviar mensagens neste grupo` };
        } else {
          return { isCommand: true, success: false, command, message: `Falha ao restringir mensagens (${announceRes.status})` };
        }
      }
      
      case "#msgliberada": {
        // Formato: #msgliberada (enviado dentro do grupo)
        // UAZAPI v2: POST /group/updateAnnounce with { groupjid, announce: false }
        console.log("Executing #msgliberada with updateAnnounce endpoint");
        const unannounceRes = await fetch(`${baseUrl}/group/updateAnnounce`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupjid: currentGroupJid, announce: false }),
        });
        const unannounceText = await unannounceRes.text();
        console.log("updateAnnounce (false) response:", { status: unannounceRes.status, body: unannounceText.substring(0, 200) });
        if (unannounceRes.ok) {
          return { isCommand: true, success: true, command, message: `Todos podem enviar mensagens neste grupo` };
        } else {
          return { isCommand: true, success: false, command, message: `Falha ao liberar mensagens (${unannounceRes.status})` };
        }
      }
      
      case "#somenteadminedit": {
        // Formato: #somenteadminedit (enviado dentro do grupo)
        // UAZAPI v2: POST /group/updateLocked with { groupjid, locked: true }
        console.log("Executing #somenteadminedit with updateLocked endpoint");
        const lockRes = await fetch(`${baseUrl}/group/updateLocked`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupjid: currentGroupJid, locked: true }),
        });
        const lockText = await lockRes.text();
        console.log("updateLocked response:", { status: lockRes.status, body: lockText.substring(0, 200) });
        if (lockRes.ok) {
          return { isCommand: true, success: true, command, message: `Apenas admins podem editar este grupo` };
        } else {
          return { isCommand: true, success: false, command, message: `Falha ao restringir edição (${lockRes.status})` };
        }
      }
      
      case "#editliberado": {
        // Formato: #editliberado (enviado dentro do grupo)
        // UAZAPI v2: POST /group/updateLocked with { groupjid, locked: false }
        console.log("Executing #editliberado with updateLocked endpoint");
        const unlockRes = await fetch(`${baseUrl}/group/updateLocked`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupjid: currentGroupJid, locked: false }),
        });
        const unlockText = await unlockRes.text();
        console.log("updateLocked response:", { status: unlockRes.status, body: unlockText.substring(0, 200) });
        if (unlockRes.ok) {
          return { isCommand: true, success: true, command, message: `Todos podem editar este grupo` };
        } else {
          return { isCommand: true, success: false, command, message: `Falha ao liberar edição (${unlockRes.status})` };
        }
      }
      
      case "#linkgrupo": {
        // Formato: #linkgrupo telefone (enviado dentro do grupo - usa currentGroupJid)
        // Se fora do grupo: #linkgrupo nome_grupo|telefone
        let groupIdForLink = currentGroupJid;
        let phoneParam = params[0];

        if (!currentGroupJid) {
          // Fora do grupo - precisa nome|telefone
          if (params.length < 2) {
            return { isCommand: true, success: false, command, message: "Formato fora do grupo: #linkgrupo nome_grupo|telefone" };
          }
          const group = await findGroupByName(baseUrl, instanceToken, params[0], instanceName);
          if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
          groupIdForLink = group.id;
          phoneParam = params[1];
        } else {
          // Dentro do grupo - só telefone
          if (params.length < 1) {
            return { isCommand: true, success: false, command, message: "Formato: #linkgrupo telefone (envie dentro do grupo)" };
          }
        }
        
        // Ensure groupJid has @g.us suffix
        const normalizedGroupId = groupIdForLink?.includes("@g.us") 
          ? groupIdForLink 
          : `${groupIdForLink}@g.us`;
        
        console.log("Getting invite link for group:", normalizedGroupId);
        
        let inviteCode: string | null = null;

        const extractInviteCodeBestEffort = (raw: string): string | null => {
          // 1) Direct URL in any response
          const urlMatch = raw.match(/https?:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/);
          if (urlMatch?.[1]) return urlMatch[1];

          // 2) Common JSON fields
          try {
            const data = JSON.parse(raw);
            const candidates: unknown[] = [
              data?.code,
              data?.inviteCode,
              data?.invite_link,
              data?.inviteLink,
              data?.inviteUrl,
              data?.invite,
              data?.data?.code,
              data?.data?.inviteCode,
              data?.data?.inviteLink,
              data?.data?.inviteUrl,
              data?.data?.invite,
            ];

            for (const c of candidates) {
              if (typeof c !== "string") continue;
              if (c.startsWith("https://chat.whatsapp.com/")) return c.replace("https://chat.whatsapp.com/", "");
              if (c.length >= 10) return c;
            }

            // 3) Deep scan for any string containing chat.whatsapp.com
            const stack: any[] = [data];
            while (stack.length) {
              const v = stack.pop();
              if (!v) continue;
              if (typeof v === "string") {
                const m = v.match(/https?:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/);
                if (m?.[1]) return m[1];
              } else if (Array.isArray(v)) {
                for (const x of v) stack.push(x);
              } else if (typeof v === "object") {
                for (const k of Object.keys(v)) stack.push(v[k]);
              }
            }
          } catch {
            // ignore
          }

          // 4) Last resort: a long-ish token-like string (avoid matching phone numbers)
          const tokenMatch = raw.match(/\b([A-Za-z0-9]{10,})\b/);
          return tokenMatch?.[1] ?? null;
        };

        // PRIMARY: Try inviteCode endpoint with multiple method/path variants (some APIs return 405 on POST)
        const inviteAttempts: Array<{
          label: string;
          url: string;
          method: "GET" | "POST" | "PUT";
          body?: unknown;
        }> = [
          { label: "inviteCode:POST", url: `${baseUrl}/group/inviteCode`, method: "POST", body: { groupjid: normalizedGroupId } },
          { label: "inviteCode:PUT", url: `${baseUrl}/group/inviteCode`, method: "PUT", body: { groupjid: normalizedGroupId } },
          { label: "inviteCode:GET?groupjid", url: `${baseUrl}/group/inviteCode?groupjid=${encodeURIComponent(normalizedGroupId)}`, method: "GET" },
          { label: "inviteCode:GET?groupJid", url: `${baseUrl}/group/inviteCode?groupJid=${encodeURIComponent(normalizedGroupId)}`, method: "GET" },
        ];

        if (instanceName) {
          inviteAttempts.push(
            { label: "inviteCode:POST:instance", url: `${baseUrl}/group/inviteCode/${instanceName}`, method: "POST", body: { groupjid: normalizedGroupId } },
            { label: "inviteCode:GET:instance", url: `${baseUrl}/group/inviteCode/${instanceName}?groupjid=${encodeURIComponent(normalizedGroupId)}`, method: "GET" },
          );
        }

        for (const attempt of inviteAttempts) {
          if (inviteCode) break;
          try {
            const res = await fetch(attempt.url, {
              method: attempt.method,
              headers: {
                ...(attempt.method !== "GET" ? { "Content-Type": "application/json" } : {}),
                token: instanceToken,
              },
              ...(attempt.method !== "GET" ? { body: JSON.stringify(attempt.body ?? {}) } : {}),
            });
            const text = await res.text();
            console.log("Invite attempt response:", {
              label: attempt.label,
              status: res.status,
              body: text.substring(0, 500),
            });
            if (res.ok) {
              inviteCode = extractInviteCodeBestEffort(text);
            }
          } catch (e) {
            console.log("Invite attempt error:", { label: attempt.label, error: String(e) });
          }
        }
        
        // FALLBACK: Try /group/info with getInviteLink if primary fails
        if (!inviteCode || inviteCode.length < 10) {
          console.log("Trying fallback /group/info with getInviteLink");
          try {
            const infoResponse = await fetch(`${baseUrl}/group/info`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "token": instanceToken },
              body: JSON.stringify({ 
                groupjid: normalizedGroupId, 
                getInviteLink: true,
                getRequestsParticipants: false,
                force: false 
              }),
            });
            
            const infoText = await infoResponse.text();
            console.log("group/info fallback response:", { status: infoResponse.status, body: infoText.substring(0, 500) });
            
            if (infoResponse.ok) {
              inviteCode = extractInviteCodeBestEffort(infoText);
            }
          } catch (e) {
            console.log("group/info fallback error:", e);
          }
        }
        
        if (!inviteCode || inviteCode.length < 10) {
          return { isCommand: true, success: false, command, message: `Não foi possível obter o link do grupo` };
        }
        
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        const cleanPhone = phoneParam.replace(/\D/g, "");
        
        console.log("Sending invite link to:", cleanPhone, "link:", inviteLink);
        await fetch(`${baseUrl}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ number: cleanPhone, text: `📎 Link do grupo:\n${inviteLink}` }),
        });
        
        return { isCommand: true, success: true, command, message: `Link do grupo enviado para ${phoneParam}` };
      }
      
      default:
        return { isCommand: false };
    }
  } catch (e) {
    console.error("Error processing group command:", e);
    return { isCommand: true, success: false, command, message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
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
    
    console.log("GHL Outbound payload:", JSON.stringify(body, null, 2));

    // Extract message data first to check if it's a valid outbound message
    const eventType = String(body.type ?? "");
    const direction = String(body.direction ?? "");
    const source = String(body.source ?? "");
    const messageText: string = String(body.message ?? body.body ?? "");
    const phoneRaw: string = String(body.phone ?? body.to ?? "");
    const attachments: string[] = Array.isArray(body.attachments) ? body.attachments : [];

    // Check for duplicate webhook calls (GHL sometimes sends the same intent twice)
    // Primary key: messageId
    if (dedupeKey && await isDuplicate(supabase, dedupeKey)) {
      console.log("Duplicate webhook ignored (messageId):", { messageId, dedupeKey });
      return; // Already responded
    }

    // Secondary key: signature by content + minute bucket.
    // This prevents double-send when GHL fires two webhooks with different messageIds
    // for effectively the same outbound action.
    // IMPORTANT: bucketed by minute to avoid blocking legitimate repeated messages later.
    try {
      const dateAdded = String(body.dateAdded ?? body.timestamp ?? "");
      const minuteBucket = dateAdded ? Math.floor(new Date(dateAdded).getTime() / 60000) : Math.floor(Date.now() / 60000);
      const signaturePayload = {
        locationId: String(body.locationId ?? ""),
        contactId: String(body.contactId ?? ""),
        conversationId: String(body.conversationId ?? ""),
        direction,
        source,
        phoneRaw,
        messageText,
        attachments,
        minuteBucket,
      };
      const sig = await sha256Hex(JSON.stringify(signaturePayload));
      const sigKey = `ghl_sig:${sig.slice(0, 32)}`;

      if (await isDuplicate(supabase, sigKey)) {
        console.log("Duplicate webhook ignored (signature):", { sigKey, minuteBucket });
        return;
      }
    } catch (e) {
      console.error("Failed to compute signature dedupe:", e);
      // fail-open: don't block message sending
    }
    
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
    // 
    // Source values:
    // - "app" = GHL web interface (user clicked send)
    // - "workflow" = GHL automation (workflow triggered send)
    // - "direct" = direct message from GHL
    // - "api" = created via API (could be our webhook-inbound syncing FROM WhatsApp!)
    // - "" (empty) = legacy SMS webhook format, OR user typed in GHL
    // 
    // We should ONLY process messages that originated from GHL UI or workflows.
    // Messages with source="api" are typically synced from external sources (like our webhook-inbound)
    // and should NOT be re-sent to WhatsApp to avoid duplicates/loops.
    // EXCEPTION: Commands starting with # should ALWAYS be processed regardless of source.
    const status = String(body.status ?? "");
    
    // Check if this is a # command - these should ALWAYS be processed
    const isHashCommand = messageText.startsWith("#");
    
    // Accept messages from GHL user interface, workflows, or legacy SMS format (empty source)
    // Reject "api" source messages - these are typically synced from external systems
    const isFromGhlUserAction = source === "app" || source === "workflow" || source === "direct" || source === "";
    
    if (!isFromGhlUserAction && !isHashCommand) {
      console.log("Ignoring message not from GHL user action:", { 
        source, 
        status, 
        messageId,
        reason: source === "api" ? "API-created (likely synced from WhatsApp)" : "Unknown source" 
      });
      return; // Already responded
    }
    
    // If source is "api" but NOT a command, ignore (synced message from WhatsApp)
    if (source === "api" && !isHashCommand) {
      console.log("Ignoring API-synced message (not a command):", { source, messageId });
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
      .select("id, instance_name, uazapi_instance_token")
      .eq("subaccount_id", subaccount.id)
      .order("created_at", { ascending: true });

    if (instErr || !instances || instances.length === 0) {
      console.error("No instance found for subaccount");
      return; // Already responded
    }

    // Escolha de instância:
    // 1) Preferência mais recente por lead_phone (resolve "espelhamento" quando há múltiplas instâncias)
    // 2) Fallback por contact_id
    // 3) Fallback primeira instância
    let instance = instances[0]; // fallback

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
              const contactData = await fetchGhlContact(token, contactId);
              
              // If email contains @g.us, it's a group JID - use it directly!
              if (contactData.email && contactData.email.includes("@g.us")) {
                targetPhone = contactData.email;
                console.log("Using group JID from contact email field:", { contactId, groupJid: targetPhone });
              } else if (contactData.phone) {
                targetPhone = contactData.phone;
              }
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

    // =======================================================================
    // CRITICAL: Resolver instância preferida do lead por telefone (última escolha vence)
    // Motivo: um mesmo lead pode ter múltiplos contactIds no GHL; se buscarmos só por contactId,
    // caímos no fallback (instances[0]) e a mensagem sai pela instância errada (parece "espelhado").
    // =======================================================================
    if (!isGroup) {
      try {
        const normalizedPhone = targetPhone.replace(/\D/g, "");
        const last10Digits = normalizedPhone.slice(-10);

        if (normalizedPhone.length >= 10) {
          const { data: prefsByPhone, error: prefPhoneErr } = await supabase
            .from("contact_instance_preferences")
            .select("instance_id, lead_phone, updated_at")
            .eq("location_id", locationId)
            .or(
              `lead_phone.eq.${normalizedPhone},lead_phone.like.%${normalizedPhone},lead_phone.like.%${last10Digits}%`
            )
            .order("updated_at", { ascending: false })
            .limit(1);

          if (prefPhoneErr) {
            console.error("[Outbound] Error fetching preference by phone:", prefPhoneErr);
          }

          const pref = prefsByPhone?.[0];
          if (pref?.instance_id) {
            const preferredInstance = instances.find((i) => i.id === pref.instance_id);
            if (preferredInstance) {
              instance = preferredInstance;
              console.log("[Outbound] ✅ Using preferred instance by phone (latest):", {
                instanceId: instance.id,
                leadPhone: pref.lead_phone?.slice(0, 15),
                updatedAt: pref.updated_at,
              });
            }
          }
        }
      } catch (e) {
        console.error("[Outbound] Failed to resolve preference by phone:", e);
      }
    }

    // Fallback por contactId (compat)
    if (contactId && instance === instances[0]) {
      try {
        const { data: preference, error: prefErr } = await supabase
          .from("contact_instance_preferences")
          .select("instance_id")
          .eq("contact_id", contactId)
          .eq("location_id", locationId)
          .maybeSingle();

        if (prefErr) {
          console.error("[Outbound] Error fetching preference by contactId:", prefErr);
        }

        if (preference?.instance_id) {
          const preferredInstance = instances.find((i) => i.id === preference.instance_id);
          if (preferredInstance) {
            instance = preferredInstance;
            console.log("[Outbound] Using preferred instance by contactId:", { instanceId: instance.id, contactId });
          }
        }
      } catch (e) {
        console.error("[Outbound] Failed to resolve preference by contactId:", e);
      }
    }

    // =======================================================================
    // IMPORTANTE: Atualizar/criar preferência com lead_phone para bridge-switcher
    // Isso garante que o dropdown no GHL saiba qual instância usar para este contato
    // =======================================================================
    if (contactId && targetPhone && locationId && !isGroup) {
      try {
        // Normalizar telefone para armazenamento (remover caracteres especiais)
        const normalizedPhone = targetPhone.replace(/\D/g, "");
        
        // Verificar se já existe preferência para este contactId
        const { data: existingPref } = await supabase
          .from("contact_instance_preferences")
          .select("id, lead_phone, instance_id")
          .eq("contact_id", contactId)
          .eq("location_id", locationId)
          .maybeSingle();
        
        if (existingPref) {
          // Atualizar lead_phone se estiver NULL ou diferente
          if (!existingPref.lead_phone || existingPref.lead_phone !== normalizedPhone) {
            console.log("[Outbound] 📱 Atualizando lead_phone na preferência existente:", { 
              contactId: contactId.slice(0, 10), 
              oldPhone: existingPref.lead_phone || "NULL", 
              newPhone: normalizedPhone.slice(0, 10)
            });
            
            await supabase
              .from("contact_instance_preferences")
              .update({ 
                lead_phone: normalizedPhone,
                updated_at: new Date().toISOString()
              })
              .eq("id", existingPref.id);
          }
        } else {
          // Criar novo registro de preferência com a instância padrão
          console.log("[Outbound] 📱 Criando nova preferência com lead_phone:", { 
            contactId: contactId.slice(0, 10), 
            phone: normalizedPhone.slice(0, 10),
            instanceId: instance.id
          });
          
          await supabase
            .from("contact_instance_preferences")
            .insert({
              contact_id: contactId,
              location_id: locationId,
              instance_id: instance.id,
              lead_phone: normalizedPhone,
            });
        }
      } catch (prefError) {
        console.error("[Outbound] ❌ Erro ao atualizar preferência:", prefError);
        // Não falhar o envio por causa disso
      }
    }

    // Check if we have content to send
    if (!messageText && attachments.length === 0) {
      console.log("No message text or attachments provided; acknowledging");
      return; // Already responded
    }

    const base = settings.uazapi_base_url.replace(/\/$/, "");
    const instanceToken = instance.uazapi_instance_token;
    const results: Array<{ type: string; sent: boolean; status: number }> = [];

    // =====================================================================
    // CHECK FOR GROUP MANAGEMENT COMMANDS
    // Commands start with # and are processed instead of being sent as messages
    // =====================================================================
    if (messageText && messageText.trim().startsWith("#")) {
      console.log("Detected potential group command:", messageText.substring(0, 50));
      
      // Se for um grupo, passa o JID para comandos como #attfotogrupo
      const groupJidForCommand = isGroup ? targetPhone : undefined;
      
      const commandResult = await processGroupCommand(
        base,
        instanceToken,
        messageText,
        (instance as any)?.instance_name,
        groupJidForCommand, // Passa o JID do grupo se a mensagem veio de um grupo
        { supabase, subaccount, settings, contactId }, // Context for GHL operations
      );
      
      if (commandResult.isCommand) {
        console.log("Group command processed:", commandResult);
        
        // Optionally send result back to GHL as a note or to the sender
        // For now, just log and return - don't send the command as a message
        return; // Command handled, don't send as regular message
      }
      // If not a recognized command, continue to send as regular message
    }

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
