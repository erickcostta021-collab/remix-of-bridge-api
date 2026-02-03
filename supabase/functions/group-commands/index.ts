import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommandResult {
  success: boolean;
  command: string;
  message: string;
  data?: unknown;
}

// Parse command from message text
// Format: #command param1|param2|param3
function parseCommand(text: string): { command: string; params: string[] } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("#")) return null;
  
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) {
    // Command without params (e.g., #somenteadminmsg grupox)
    const parts = trimmed.split(" ");
    return { command: parts[0].toLowerCase(), params: parts.slice(1) };
  }
  
  const command = trimmed.substring(0, firstSpace).toLowerCase();
  const paramsStr = trimmed.substring(firstSpace + 1);
  const params = paramsStr.split("|").map(p => p.trim());
  
  return { command, params };
}

// Helper to find group by name via UAZAPI
async function findGroupByName(
  baseUrl: string,
  instanceToken: string,
  groupName: string
): Promise<{ id: string; name: string } | null> {
  const url = `${baseUrl}/group/all`;
  console.log("Searching for group:", { groupName, url });
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
    });
    
    if (!response.ok) {
      console.error("Failed to list groups:", await response.text());
      return null;
    }
    
    const groups = await response.json();
    if (!Array.isArray(groups)) {
      console.error("Unexpected groups response:", groups);
      return null;
    }
    
    // Find group by exact name match (case-insensitive)
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
    
    console.log("Group not found by name:", groupName);
    return null;
  } catch (e) {
    console.error("Error finding group:", e);
    return null;
  }
}

// Create group
async function createGroup(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  description: string,
  photoUrl: string,
  participants: string[]
): Promise<CommandResult> {
  console.log("Creating group:", { groupName, description, photoUrl, participants });
  
  try {
    // Format participants as WhatsApp JIDs
    const formattedParticipants = participants.map(p => {
      const clean = p.replace(/\D/g, "");
      return clean.includes("@") ? clean : `${clean}@s.whatsapp.net`;
    });
    
    // Create group
    const createUrl = `${baseUrl}/group/create`;
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        subject: groupName,
        participants: formattedParticipants,
        description,
      }),
    });
    
    const createData = await createResponse.json();
    console.log("Create group response:", createData);
    
    if (!createResponse.ok) {
      return { success: false, command: "criargrupo", message: `Erro ao criar grupo: ${createData.message || createResponse.status}` };
    }
    
    const groupId = createData.id || createData.jid || createData.gid;
    
    // Update group photo if provided
    if (photoUrl && groupId) {
      const photoResponse = await fetch(`${baseUrl}/group/updatePicture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          groupId,
          image: photoUrl,
        }),
      });
      
      if (!photoResponse.ok) {
        console.error("Failed to set group photo:", await photoResponse.text());
      }
    }
    
    return { 
      success: true, 
      command: "criargrupo", 
      message: `✅ Grupo "${groupName}" criado com sucesso!`,
      data: createData 
    };
  } catch (e) {
    console.error("Error creating group:", e);
    return { success: false, command: "criargrupo", message: `Erro: ${e instanceof Error ? e.message : "Falha ao criar grupo"}` };
  }
}

// Remove member from group
async function removeMember(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  phone: string
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, groupName);
  if (!group) {
    return { success: false, command: "removerdogrupo", message: `❌ Grupo "${groupName}" não encontrado` };
  }
  
  const cleanPhone = phone.replace(/\D/g, "");
  const participantJid = `${cleanPhone}@s.whatsapp.net`;
  
  try {
    const response = await fetch(`${baseUrl}/group/removeParticipant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
        participants: [participantJid],
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: "removerdogrupo", message: `❌ Erro ao remover: ${data.message || response.status}` };
    }
    
    return { success: true, command: "removerdogrupo", message: `✅ Membro ${phone} removido do grupo "${groupName}"` };
  } catch (e) {
    return { success: false, command: "removerdogrupo", message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Add member to group
async function addMember(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  phone: string
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, groupName);
  if (!group) {
    return { success: false, command: "addnogrupo", message: `❌ Grupo "${groupName}" não encontrado` };
  }
  
  const cleanPhone = phone.replace(/\D/g, "");
  const participantJid = `${cleanPhone}@s.whatsapp.net`;
  
  try {
    const response = await fetch(`${baseUrl}/group/addParticipant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
        participants: [participantJid],
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: "addnogrupo", message: `❌ Erro ao adicionar: ${data.message || response.status}` };
    }
    
    return { success: true, command: "addnogrupo", message: `✅ Membro ${phone} adicionado ao grupo "${groupName}"` };
  } catch (e) {
    return { success: false, command: "addnogrupo", message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Promote member to admin
async function promoteToAdmin(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  phone: string
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, groupName);
  if (!group) {
    return { success: false, command: "promoveradmin", message: `❌ Grupo "${groupName}" não encontrado` };
  }
  
  const cleanPhone = phone.replace(/\D/g, "");
  const participantJid = `${cleanPhone}@s.whatsapp.net`;
  
  try {
    const response = await fetch(`${baseUrl}/group/promoteParticipant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
        participants: [participantJid],
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: "promoveradmin", message: `❌ Erro ao promover: ${data.message || response.status}` };
    }
    
    return { success: true, command: "promoveradmin", message: `✅ Membro ${phone} promovido a admin no grupo "${groupName}"` };
  } catch (e) {
    return { success: false, command: "promoveradmin", message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Demote admin to member
async function demoteAdmin(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  phone: string
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, groupName);
  if (!group) {
    return { success: false, command: "revogaradmin", message: `❌ Grupo "${groupName}" não encontrado` };
  }
  
  const cleanPhone = phone.replace(/\D/g, "");
  const participantJid = `${cleanPhone}@s.whatsapp.net`;
  
  try {
    const response = await fetch(`${baseUrl}/group/demoteParticipant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
        participants: [participantJid],
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: "revogaradmin", message: `❌ Erro ao revogar: ${data.message || response.status}` };
    }
    
    return { success: true, command: "revogaradmin", message: `✅ Admin ${phone} rebaixado a membro no grupo "${groupName}"` };
  } catch (e) {
    return { success: false, command: "revogaradmin", message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Update group photo
async function updateGroupPhoto(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  photoUrl: string
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, groupName);
  if (!group) {
    return { success: false, command: "attfotogrupo", message: `❌ Grupo "${groupName}" não encontrado` };
  }
  
  try {
    const response = await fetch(`${baseUrl}/group/updatePicture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
        image: photoUrl,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: "attfotogrupo", message: `❌ Erro ao atualizar foto: ${data.message || response.status}` };
    }
    
    return { success: true, command: "attfotogrupo", message: `✅ Foto do grupo "${groupName}" atualizada` };
  } catch (e) {
    return { success: false, command: "attfotogrupo", message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Update group name (subject)
async function updateGroupName(
  baseUrl: string,
  instanceToken: string,
  currentName: string,
  newName: string
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, currentName);
  if (!group) {
    return { success: false, command: "attnomegrupo", message: `❌ Grupo "${currentName}" não encontrado` };
  }
  
  try {
    const response = await fetch(`${baseUrl}/group/updateSubject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
        subject: newName,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: "attnomegrupo", message: `❌ Erro ao atualizar nome: ${data.message || response.status}` };
    }
    
    return { success: true, command: "attnomegrupo", message: `✅ Nome do grupo alterado de "${currentName}" para "${newName}"` };
  } catch (e) {
    return { success: false, command: "attnomegrupo", message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Update group description
async function updateGroupDescription(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  description: string
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, groupName);
  if (!group) {
    return { success: false, command: "attdescricao", message: `❌ Grupo "${groupName}" não encontrado` };
  }
  
  try {
    const response = await fetch(`${baseUrl}/group/updateDescription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
        description,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: "attdescricao", message: `❌ Erro ao atualizar descrição: ${data.message || response.status}` };
    }
    
    return { success: true, command: "attdescricao", message: `✅ Descrição do grupo "${groupName}" atualizada` };
  } catch (e) {
    return { success: false, command: "attdescricao", message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Set group settings (announcement/restrict mode)
async function updateGroupSettings(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  setting: "announcement" | "not_announcement" | "locked" | "unlocked"
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, groupName);
  if (!group) {
    const cmdName = setting.includes("announcement") ? "somenteadminmsg" : "somenteadminedit";
    return { success: false, command: cmdName, message: `❌ Grupo "${groupName}" não encontrado` };
  }
  
  try {
    const response = await fetch(`${baseUrl}/group/updateSetting`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
        action: setting,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: setting, message: `❌ Erro ao alterar configuração: ${data.message || response.status}` };
    }
    
    const messages: Record<string, string> = {
      announcement: `✅ Agora apenas admins podem enviar mensagens no grupo "${groupName}"`,
      not_announcement: `✅ Agora todos podem enviar mensagens no grupo "${groupName}"`,
      locked: `✅ Agora apenas admins podem editar o grupo "${groupName}"`,
      unlocked: `✅ Agora todos podem editar o grupo "${groupName}"`,
    };
    
    return { success: true, command: setting, message: messages[setting] };
  } catch (e) {
    return { success: false, command: setting, message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Get group invite link and send to a phone
async function getGroupLink(
  baseUrl: string,
  instanceToken: string,
  groupName: string,
  targetPhone: string
): Promise<CommandResult> {
  const group = await findGroupByName(baseUrl, instanceToken, groupName);
  if (!group) {
    return { success: false, command: "linkgrupo", message: `❌ Grupo "${groupName}" não encontrado` };
  }
  
  try {
    // Get invite code
    const response = await fetch(`${baseUrl}/group/inviteCode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        groupId: group.id,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, command: "linkgrupo", message: `❌ Erro ao buscar link: ${data.message || response.status}` };
    }
    
    const inviteCode = data.code || data.inviteCode || data.invite;
    if (!inviteCode) {
      return { success: false, command: "linkgrupo", message: `❌ Não foi possível obter o link do grupo` };
    }
    
    const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
    
    // Send link to the target phone
    const cleanPhone = targetPhone.replace(/\D/g, "");
    const sendResponse = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": instanceToken,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: `📎 Link do grupo "${groupName}":\n${inviteLink}`,
      }),
    });
    
    if (!sendResponse.ok) {
      return { success: true, command: "linkgrupo", message: `✅ Link do grupo: ${inviteLink}\n(Não foi possível enviar para ${targetPhone})` };
    }
    
    return { success: true, command: "linkgrupo", message: `✅ Link do grupo "${groupName}" enviado para ${targetPhone}` };
  } catch (e) {
    return { success: false, command: "linkgrupo", message: `Erro: ${e instanceof Error ? e.message : "Falha"}` };
  }
}

// Main command processor
async function processCommand(
  command: string,
  params: string[],
  baseUrl: string,
  instanceToken: string
): Promise<CommandResult | null> {
  console.log("Processing command:", { command, params });
  
  switch (command) {
    case "#criargrupo": {
      // #criargrupo grupox|descrição|urldafoto|+5527999999999
      if (params.length < 4) {
        return { success: false, command: "criargrupo", message: "❌ Formato: #criargrupo nome|descrição|urldafoto|telefone" };
      }
      const [name, description, photoUrl, ...phones] = params;
      return createGroup(baseUrl, instanceToken, name, description, photoUrl, phones);
    }
    
    case "#removerdogrupo": {
      // #removerdogrupo grupox|+5527999999999
      if (params.length < 2) {
        return { success: false, command: "removerdogrupo", message: "❌ Formato: #removerdogrupo nome_grupo|telefone" };
      }
      return removeMember(baseUrl, instanceToken, params[0], params[1]);
    }
    
    case "#addnogrupo": {
      // #addnogrupo grupox|+5527999999999
      if (params.length < 2) {
        return { success: false, command: "addnogrupo", message: "❌ Formato: #addnogrupo nome_grupo|telefone" };
      }
      return addMember(baseUrl, instanceToken, params[0], params[1]);
    }
    
    case "#promoveradmin": {
      // #promoveradmin grupox|+5527999999999
      if (params.length < 2) {
        return { success: false, command: "promoveradmin", message: "❌ Formato: #promoveradmin nome_grupo|telefone" };
      }
      return promoteToAdmin(baseUrl, instanceToken, params[0], params[1]);
    }
    
    case "#revogaradmin": {
      // #revogaradmin grupox|+5527999999999
      if (params.length < 2) {
        return { success: false, command: "revogaradmin", message: "❌ Formato: #revogaradmin nome_grupo|telefone" };
      }
      return demoteAdmin(baseUrl, instanceToken, params[0], params[1]);
    }
    
    case "#attfotogrupo": {
      // #attfotogrupo grupox|urldafoto
      if (params.length < 2) {
        return { success: false, command: "attfotogrupo", message: "❌ Formato: #attfotogrupo nome_grupo|url_foto" };
      }
      return updateGroupPhoto(baseUrl, instanceToken, params[0], params[1]);
    }
    
    case "#attnomegrupo": {
      // #attnomegrupo grupox|grupoy
      if (params.length < 2) {
        return { success: false, command: "attnomegrupo", message: "❌ Formato: #attnomegrupo nome_atual|nome_novo" };
      }
      return updateGroupName(baseUrl, instanceToken, params[0], params[1]);
    }
    
    case "#attdescricao": {
      // #attdescricao grupox|nova descrição
      if (params.length < 2) {
        return { success: false, command: "attdescricao", message: "❌ Formato: #attdescricao nome_grupo|nova_descricao" };
      }
      return updateGroupDescription(baseUrl, instanceToken, params[0], params[1]);
    }
    
    case "#somenteadminmsg": {
      // #somenteadminmsg grupox
      if (params.length < 1) {
        return { success: false, command: "somenteadminmsg", message: "❌ Formato: #somenteadminmsg nome_grupo" };
      }
      return updateGroupSettings(baseUrl, instanceToken, params[0], "announcement");
    }
    
    case "#msgliberada": {
      // #msgliberada grupox
      if (params.length < 1) {
        return { success: false, command: "msgliberada", message: "❌ Formato: #msgliberada nome_grupo" };
      }
      return updateGroupSettings(baseUrl, instanceToken, params[0], "not_announcement");
    }
    
    case "#somenteadminedit": {
      // #somenteadminedit grupox
      if (params.length < 1) {
        return { success: false, command: "somenteadminedit", message: "❌ Formato: #somenteadminedit nome_grupo" };
      }
      return updateGroupSettings(baseUrl, instanceToken, params[0], "locked");
    }
    
    case "#editliberado": {
      // #editliberado grupox
      if (params.length < 1) {
        return { success: false, command: "editliberado", message: "❌ Formato: #editliberado nome_grupo" };
      }
      return updateGroupSettings(baseUrl, instanceToken, params[0], "unlocked");
    }
    
    case "#linkgrupo": {
      // #linkgrupo grupox|+5527999999999
      if (params.length < 2) {
        return { success: false, command: "linkgrupo", message: "❌ Formato: #linkgrupo nome_grupo|telefone" };
      }
      return getGroupLink(baseUrl, instanceToken, params[0], params[1]);
    }
    
    default:
      return null; // Not a recognized command
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, messageText } = await req.json();

    if (!instanceId || !messageText) {
      return new Response(
        JSON.stringify({ error: "instanceId and messageText are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a command
    const parsed = parseCommand(messageText);
    if (!parsed) {
      return new Response(
        JSON.stringify({ isCommand: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from("instances")
      .select("uazapi_instance_token, instance_name, user_id")
      .eq("id", instanceId)
      .limit(1);

    if (instanceError || !instance || instance.length === 0) {
      return new Response(
        JSON.stringify({ error: "Instance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instanceData = instance[0];

    // Get user settings for UAZAPI base URL
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("uazapi_base_url")
      .eq("user_id", instanceData.user_id)
      .limit(1);

    if (settingsError || !settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ error: "User settings not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = settings[0].uazapi_base_url?.replace(/\/+$/, "");
    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: "UAZAPI base URL not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process the command
    const result = await processCommand(
      parsed.command,
      parsed.params,
      baseUrl,
      instanceData.uazapi_instance_token
    );

    if (!result) {
      return new Response(
        JSON.stringify({ isCommand: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        isCommand: true,
        ...result 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error processing command:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
