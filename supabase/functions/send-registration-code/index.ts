import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegistrationRequest {
  email: string;
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: RegistrationRequest = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se já existe uma solicitação pendente para este email
    const { data: existingRequest } = await supabase
      .from("registration_requests")
      .select("*")
      .eq("email", email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    let code: string;

    if (existingRequest) {
      // Usar código existente
      code = existingRequest.code;
    } else {
      // Gerar novo código
      code = generateCode();

      // Remover solicitações antigas deste email
      await supabase
        .from("registration_requests")
        .delete()
        .eq("email", email);

      // Criar nova solicitação
      const { error: insertError } = await supabase
        .from("registration_requests")
        .insert({
          email,
          code,
          status: "pending",
        });

      if (insertError) {
        console.error("Error inserting registration request:", insertError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar solicitação de registro" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Enviar código de verificação para o próprio usuário
    const emailResponse = await resend.emails.send({
      from: "Bridge API <noreply@bridgeapi.chat>",
      to: [email],
      subject: `🔐 Seu código de verificação: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; border-radius: 12px; overflow: hidden;">
          <div style="width: 100%; text-align: center;">
            <img src="https://jsupvprudyxyiyxwqxuq.supabase.co/storage/v1/object/public/email-assets/email-banner.png" alt="Bridge API" style="width: 100%; display: block;" />
          </div>
          <div style="padding: 30px 24px;">
            <h2 style="color: #ffffff; text-align: center; margin-top: 0;">Confirme seu cadastro</h2>
            
            <p style="color: #a1a1aa; text-align: center;">Use o código abaixo para verificar seu e-mail e finalizar a criação da sua conta:</p>
            
            <div style="background: #22c55e; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
              <h2 style="margin: 0; font-size: 36px; letter-spacing: 6px; font-family: monospace;">${code}</h2>
            </div>
            
            <p style="color: #71717a; font-size: 14px; text-align: center;">Este código expira em 24 horas.</p>
            <p style="color: #71717a; font-size: 14px; text-align: center;">Se você não solicitou este código, ignore este e-mail.</p>
            
            <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;" />
            <p style="color: #52525b; font-size: 12px; text-align: center;">Bridge API — Instance Manager Hub</p>
          </div>
        </div>
      `,
    });

    console.log("Verification email sent to user:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Código de verificação enviado para seu e-mail" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-registration-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
