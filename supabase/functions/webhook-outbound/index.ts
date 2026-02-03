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
  instanceName?: string,
) {
  const urls = (
    [
      // Instance-in-path variants
      instanceName ? `${baseUrl}/group/updateGroupPicture/${instanceName}` : null,
      instanceName ? `${baseUrl}/group/updatePicture/${instanceName}` : null,
      instanceName ? `${baseUrl}/group/profilePicture/${instanceName}` : null,
      // Non-instance variants
      `${baseUrl}/group/updateGroupPicture`,
      `${baseUrl}/group/updatePicture`,
      `${baseUrl}/group/profilePicture`,
    ].filter(Boolean) as string[]
  );
  const payloads: Array<Record<string, unknown>> = [
    { groupJid: groupIdOrJid, image: imageUrl },
    { groupId: groupIdOrJid, image: imageUrl },
    { groupJid: groupIdOrJid, picture: imageUrl },
    { groupId: groupIdOrJid, picture: imageUrl },
  ];

  for (const url of urls) {
    for (const payload of payloads) {
      const r = await postJson(url, instanceToken, payload);
      console.log("Picture update attempt:", { endpoint: url.split("/").slice(-2).join("/"), payloadKeys: Object.keys(payload), status: r.status, body: r.text.substring(0, 200) });
      if (r.ok) return;
    }
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
  groupName: string
): Promise<{ id: string; name: string } | null> {
  const url = `${baseUrl}/group/all`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "token": instanceToken,
      },
    });
    
    if (!response.ok) {
      console.error("Failed to list groups:", await response.text());
      return null;
    }
    
    const groups = await response.json();
    if (!Array.isArray(groups)) return null;
    
    const targetName = groupName.toLowerCase();
    const found = groups.find((g: any) => {
      const name = (g.subject || g.name || g.groupName || "").toLowerCase();
      return name === targetName;
    });
    
    if (found) {
      return {
        id: found.id || found.jid || found.groupId,
        name: found.subject || found.name || found.groupName,
      };
    }
    
    return null;
  } catch (e) {
    console.error("Error finding group:", e);
    return null;
  }
}

async function processGroupCommand(
  baseUrl: string,
  instanceToken: string,
  messageText: string,
  instanceName?: string,
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
  
  try {
    switch (command) {
      case "#criargrupo": {
        if (params.length < 4) {
          return { isCommand: true, success: false, command, message: "Formato: #criargrupo nome|descrição|urldafoto|telefone" };
        }
        const [name, description, photoUrl, ...phones] = params;
        // UAZAPI/Evolution expects just clean phone numbers without @s.whatsapp.net
        const formattedParticipants = phones.map(p => p.replace(/\D/g, ""));
        
        console.log("Creating group with:", { name, description, photoUrl, formattedParticipants });
        
        // Create group with name (not subject) - per n8n successful test
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
        
        // Extract JID from response - API returns it in group.JID
        const groupJid = createData.group?.JID || createData.id || createData.jid || createData.gid || createData.groupId || createData.group?.id;
        console.log("Group created with JID:", groupJid);
        
        // Group name is set at creation time with "name" field, no need for updateSubject
        if (!groupJid) {
          return { isCommand: true, success: true, command, message: `⚠️ Grupo criado mas JID não encontrado para aplicar configurações` };
        }
        
        // Some providers need a short delay before metadata updates
        await sleep(500);
        
        // Update group description
        if (description) {
          console.log("Updating group description to:", description);
          const descResponse = await fetch(`${baseUrl}/group/updateDescription`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": instanceToken },
            body: JSON.stringify({ groupJid, description }),
          });
          console.log("Description update response:", descResponse.status, await descResponse.text());
        }
        
         // Update group photo - try multiple payload shapes and fallback endpoint
         if (photoUrl) {
           console.log("Updating group photo to:", photoUrl);
            await updateGroupPictureBestEffort(baseUrl, instanceToken, groupJid, photoUrl, instanceName);
         }
        
        return { isCommand: true, success: true, command, message: `Grupo "${name}" criado com sucesso!` };
      }
      
      case "#removerdogrupo": {
        if (params.length < 2) {
          return { isCommand: true, success: false, command, message: "Formato: #removerdogrupo nome_grupo|telefone" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        const cleanPhone = params[1].replace(/\D/g, "");
        await fetch(`${baseUrl}/group/removeParticipant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, participants: [`${cleanPhone}@s.whatsapp.net`] }),
        });
        
        return { isCommand: true, success: true, command, message: `Membro ${params[1]} removido do grupo "${params[0]}"` };
      }
      
      case "#addnogrupo": {
        if (params.length < 2) {
          return { isCommand: true, success: false, command, message: "Formato: #addnogrupo nome_grupo|telefone" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        const cleanPhone = params[1].replace(/\D/g, "");
        await fetch(`${baseUrl}/group/addParticipant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, participants: [`${cleanPhone}@s.whatsapp.net`] }),
        });
        
        return { isCommand: true, success: true, command, message: `Membro ${params[1]} adicionado ao grupo "${params[0]}"` };
      }
      
      case "#promoveradmin": {
        if (params.length < 2) {
          return { isCommand: true, success: false, command, message: "Formato: #promoveradmin nome_grupo|telefone" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        const cleanPhone = params[1].replace(/\D/g, "");
        await fetch(`${baseUrl}/group/promoteParticipant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, participants: [`${cleanPhone}@s.whatsapp.net`] }),
        });
        
        return { isCommand: true, success: true, command, message: `Membro ${params[1]} promovido a admin` };
      }
      
      case "#revogaradmin": {
        if (params.length < 2) {
          return { isCommand: true, success: false, command, message: "Formato: #revogaradmin nome_grupo|telefone" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        const cleanPhone = params[1].replace(/\D/g, "");
        await fetch(`${baseUrl}/group/demoteParticipant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, participants: [`${cleanPhone}@s.whatsapp.net`] }),
        });
        
        return { isCommand: true, success: true, command, message: `Admin ${params[1]} rebaixado a membro` };
      }
      
      case "#attfotogrupo": {
        if (params.length < 2) {
          return { isCommand: true, success: false, command, message: "Formato: #attfotogrupo nome_grupo|url_foto" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        await fetch(`${baseUrl}/group/updatePicture`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, image: params[1] }),
        });
        
        return { isCommand: true, success: true, command, message: `Foto do grupo "${params[0]}" atualizada` };
      }
      
      case "#attnomegrupo": {
        if (params.length < 2) {
          return { isCommand: true, success: false, command, message: "Formato: #attnomegrupo nome_atual|nome_novo" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        await fetch(`${baseUrl}/group/updateSubject`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, subject: params[1] }),
        });
        
        return { isCommand: true, success: true, command, message: `Nome do grupo alterado para "${params[1]}"` };
      }
      
      case "#attdescricao": {
        if (params.length < 2) {
          return { isCommand: true, success: false, command, message: "Formato: #attdescricao nome_grupo|nova_descricao" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        await fetch(`${baseUrl}/group/updateDescription`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, description: params[1] }),
        });
        
        return { isCommand: true, success: true, command, message: `Descrição do grupo "${params[0]}" atualizada` };
      }
      
      case "#somenteadminmsg": {
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #somenteadminmsg nome_grupo" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        await fetch(`${baseUrl}/group/updateSetting`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, action: "announcement" }),
        });
        
        return { isCommand: true, success: true, command, message: `Apenas admins podem enviar mensagens no grupo "${params[0]}"` };
      }
      
      case "#msgliberada": {
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #msgliberada nome_grupo" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        await fetch(`${baseUrl}/group/updateSetting`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, action: "not_announcement" }),
        });
        
        return { isCommand: true, success: true, command, message: `Todos podem enviar mensagens no grupo "${params[0]}"` };
      }
      
      case "#somenteadminedit": {
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #somenteadminedit nome_grupo" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        await fetch(`${baseUrl}/group/updateSetting`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, action: "locked" }),
        });
        
        return { isCommand: true, success: true, command, message: `Apenas admins podem editar o grupo "${params[0]}"` };
      }
      
      case "#editliberado": {
        if (params.length < 1) {
          return { isCommand: true, success: false, command, message: "Formato: #editliberado nome_grupo" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        await fetch(`${baseUrl}/group/updateSetting`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id, action: "unlocked" }),
        });
        
        return { isCommand: true, success: true, command, message: `Todos podem editar o grupo "${params[0]}"` };
      }
      
      case "#linkgrupo": {
        if (params.length < 2) {
          return { isCommand: true, success: false, command, message: "Formato: #linkgrupo nome_grupo|telefone" };
        }
        const group = await findGroupByName(baseUrl, instanceToken, params[0]);
        if (!group) return { isCommand: true, success: false, command, message: `Grupo "${params[0]}" não encontrado` };
        
        const inviteResponse = await fetch(`${baseUrl}/group/inviteCode`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ groupId: group.id }),
        });
        
        const inviteData = await inviteResponse.json();
        const inviteCode = inviteData.code || inviteData.inviteCode || inviteData.invite;
        
        if (!inviteCode) {
          return { isCommand: true, success: false, command, message: "Não foi possível obter o link do grupo" };
        }
        
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        const cleanPhone = params[1].replace(/\D/g, "");
        
        await fetch(`${baseUrl}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ number: cleanPhone, text: `📎 Link do grupo "${params[0]}":\n${inviteLink}` }),
        });
        
        return { isCommand: true, success: true, command, message: `Link do grupo "${params[0]}" enviado para ${params[1]}` };
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
      
      const commandResult = await processGroupCommand(
        base,
        instanceToken,
        messageText,
        (instance as any)?.instance_name,
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
