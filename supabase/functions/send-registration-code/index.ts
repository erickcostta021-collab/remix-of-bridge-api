import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Email do administrador que recebe os códigos de aprovação
const ADMIN_EMAIL = "erickcostta021@gmail.com";

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

    // Enviar email para o administrador
    const emailResponse = await resend.emails.send({
      from: "Instance Manager Hub <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: `🔐 Código de Aprovação para: ${email}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #22c55e;">Nova Solicitação de Registro</h1>
          <p>Alguém está tentando criar uma conta no Instance Manager Hub:</p>
          
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0 0 0;"><strong>Data:</strong> ${new Date().toLocaleString("pt-BR")}</p>
          </div>
          
          <p>Se você deseja aprovar este registro, forneça o código abaixo:</p>
          
          <div style="background: #22c55e; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0; font-size: 32px; letter-spacing: 4px;">${code}</h2>
          </div>
          
          <p style="color: #666; font-size: 14px;">Este código expira em 24 horas.</p>
          <p style="color: #666; font-size: 14px;">Se você não reconhece esta solicitação, ignore este email.</p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Código de aprovação enviado para o administrador" 
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
