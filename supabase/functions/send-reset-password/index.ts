import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const trimmed = email.trim().toLowerCase();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user exists
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", trimmed)
      .limit(1);

    if (!profile || profile.length === 0) {
      return new Response(
        JSON.stringify({ error: "Este email não está cadastrado no sistema" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a password reset link using Supabase Admin API
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://bridgeapi.chat";

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: trimmed,
      options: {
        redirectTo: `${frontendUrl}/reset-password`,
      },
    });

    if (linkError) {
      console.error("Error generating recovery link:", linkError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // The generated link contains the token - we need to extract and build the proper URL
    // linkData.properties.action_link contains the full Supabase auth link
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      console.error("No action link returned");
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Bridge API <noreply@bridgeapi.chat>",
      to: [trimmed],
      subject: "🔑 Redefinição de senha — Bridge API",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22c55e; margin: 0;">Bridge API</h1>
            <p style="color: #666; margin-top: 5px;">Instance Manager</p>
          </div>
          
          <h2 style="color: #333; text-align: center;">Redefinir sua senha</h2>
          
          <p style="color: #555; text-align: center;">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}" 
               style="display: inline-block; background: #22c55e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Redefinir Senha
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center;">Este link expira em 1 hora.</p>
          <p style="color: #666; font-size: 14px; text-align: center;">Se você não solicitou esta redefinição, ignore este e-mail.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">Bridge API — Instance Manager Hub</p>
        </div>
      `,
    });

    console.log("Recovery email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Email de recuperação enviado" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("Error in send-reset-password:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
