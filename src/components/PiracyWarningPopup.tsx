import { useState } from "react";
import { AlertTriangle, Skull, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";

interface PiracyWarningPopupProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function PiracyWarningPopup({ isOpen = true, onClose }: PiracyWarningPopupProps) {
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  if (!isOpen) return null;

  const discordLink = "https://discord.gg/altcommunity";
  const whatsappNumber = "+55 47 98495-1601";
  const whatsappLink = "https://wa.me/5547984951601";

  const copyToClipboard = async (text: string, type: "discord" | "whatsapp") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "discord") {
        setCopiedDiscord(true);
        setTimeout(() => setCopiedDiscord(false), 2000);
      } else {
        setCopiedWhatsapp(true);
        setTimeout(() => setCopiedWhatsapp(false), 2000);
      }
      toast.success("Copiado para a área de transferência!");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        padding: "16px",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "520px",
          width: "100%",
          backgroundColor: "#121212",
          borderRadius: "15px",
          border: "2px solid #FF4D4D",
          boxShadow: "0 0 30px rgba(255, 77, 77, 0.5), 0 0 60px rgba(255, 77, 77, 0.3), inset 0 0 20px rgba(255, 77, 77, 0.1)",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "transparent",
              border: "none",
              color: "#666",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#FF4D4D")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >
            <X size={20} />
          </button>
        )}

        {/* Header with Warning Icons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "16px" }}>
          <AlertTriangle size={28} color="#FF4D4D" style={{ filter: "drop-shadow(0 0 8px rgba(255, 77, 77, 0.8))" }} />
          <Skull size={24} color="#FF4D4D" style={{ filter: "drop-shadow(0 0 8px rgba(255, 77, 77, 0.8))" }} />
          <AlertTriangle size={28} color="#FF4D4D" style={{ filter: "drop-shadow(0 0 8px rgba(255, 77, 77, 0.8))" }} />
        </div>

        {/* Title */}
        <h2
          style={{
            color: "#FF4D4D",
            fontSize: "20px",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: "12px",
            textShadow: "0 0 10px rgba(255, 77, 77, 0.6)",
            lineHeight: 1.3,
          }}
        >
          Você está usando uma extensão pirateada!
          <br />
          <span style={{ fontSize: "16px", fontWeight: 500 }}>(seus projetos correm perigo)</span>
        </h2>

        {/* Description */}
        <p
          style={{
            color: "#E0E0E0",
            fontSize: "15px",
            textAlign: "center",
            marginBottom: "20px",
            lineHeight: 1.5,
          }}
        >
          Adquira sua versão oficial com{" "}
          <span style={{ color: "#00FF88", fontWeight: 700, textShadow: "0 0 8px rgba(0, 255, 136, 0.5)" }}>
            50% de desconto
          </span>{" "}
          e fuja da pirataria!
        </p>

        {/* Plans Image Placeholder */}
        <div
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #252525 100%)",
            borderRadius: "10px",
            border: "1px solid #333",
            padding: "32px 16px",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          <div style={{ color: "#666", fontSize: "13px", marginBottom: "8px" }}>📦</div>
          <div style={{ color: "#888", fontSize: "14px", fontWeight: 500 }}>Imagem dos Planos</div>
          <div style={{ color: "#555", fontSize: "12px", marginTop: "4px" }}>Alt Community #2026</div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
          {/* Discord Button */}
          <div>
            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                backgroundColor: "#5865F2",
                color: "#FFFFFF",
                padding: "12px 20px",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "all 0.2s",
                boxShadow: "0 4px 15px rgba(88, 101, 242, 0.4)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#4752C4";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#5865F2";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Entrar no Discord
            </a>
            <button
              onClick={() => copyToClipboard(discordLink, "discord")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                marginTop: "6px",
                padding: "6px",
                background: "transparent",
                border: "none",
                color: "#888",
                fontSize: "12px",
                cursor: "pointer",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#5865F2")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
            >
              {copiedDiscord ? <Check size={14} color="#00FF88" /> : <Copy size={14} />}
              {discordLink}
            </button>
          </div>

          {/* WhatsApp Button */}
          <div>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                backgroundColor: "transparent",
                color: "#25D366",
                padding: "12px 20px",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
                border: "2px solid #25D366",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#25D366";
                e.currentTarget.style.color = "#FFFFFF";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#25D366";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Falar no WhatsApp
            </a>
            <button
              onClick={() => copyToClipboard(whatsappNumber, "whatsapp")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                marginTop: "6px",
                padding: "6px",
                background: "transparent",
                border: "none",
                color: "#888",
                fontSize: "12px",
                cursor: "pointer",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#25D366")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
            >
              {copiedWhatsapp ? <Check size={14} color="#00FF88" /> : <Copy size={14} />}
              {whatsappNumber}
            </button>
          </div>
        </div>

        {/* Footer Warning */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            backgroundColor: "rgba(255, 77, 77, 0.15)",
            border: "1px solid rgba(255, 77, 77, 0.3)",
            borderRadius: "8px",
            padding: "12px 16px",
          }}
        >
          <Skull size={20} color="#FF4D4D" style={{ filter: "drop-shadow(0 0 4px rgba(255, 77, 77, 0.8))" }} />
          <span
            style={{
              color: "#FF4D4D",
              fontSize: "13px",
              fontWeight: 600,
              textAlign: "center",
              textShadow: "0 0 8px rgba(255, 77, 77, 0.4)",
            }}
          >
            Quem te enviou essa extensão é um GOLPISTA!
          </span>
          <Skull size={20} color="#FF4D4D" style={{ filter: "drop-shadow(0 0 4px rgba(255, 77, 77, 0.8))" }} />
        </div>
      </div>
    </div>
  );
}
