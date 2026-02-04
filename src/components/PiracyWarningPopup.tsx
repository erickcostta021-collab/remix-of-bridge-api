import { useState } from "react";
import { X, AlertTriangle, Skull, Copy, Check } from "lucide-react";

interface PiracyWarningPopupProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function PiracyWarningPopup({ isOpen, onClose }: PiracyWarningPopupProps) {
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async (text: string, type: "discord" | "whatsapp") => {
    await navigator.clipboard.writeText(text);
    if (type === "discord") {
      setCopiedDiscord(true);
      setTimeout(() => setCopiedDiscord(false), 2000);
    } else {
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        zIndex: 2147483647,
        padding: "16px",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          backgroundColor: "#121212",
          borderRadius: "15px",
          border: "2px solid #FF4D4D",
          boxShadow: "0 0 30px rgba(255, 77, 77, 0.5), 0 0 60px rgba(255, 77, 77, 0.3), inset 0 0 20px rgba(255, 77, 77, 0.1)",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
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
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#FF4D4D")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >
            <X size={24} />
          </button>
        )}

        <div style={{ padding: "24px" }}>
          {/* Header with warning icons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <AlertTriangle size={32} color="#FF4D4D" style={{ filter: "drop-shadow(0 0 8px rgba(255, 77, 77, 0.8))" }} />
            <AlertTriangle size={32} color="#FF4D4D" style={{ filter: "drop-shadow(0 0 8px rgba(255, 77, 77, 0.8))" }} />
            <AlertTriangle size={32} color="#FF4D4D" style={{ filter: "drop-shadow(0 0 8px rgba(255, 77, 77, 0.8))" }} />
          </div>

          {/* Title */}
          <h2
            style={{
              color: "#FF4D4D",
              fontSize: "22px",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "16px",
              textShadow: "0 0 20px rgba(255, 77, 77, 0.6)",
              lineHeight: 1.3,
            }}
          >
            🚨 Você está usando uma extensão pirateada!
            <br />
            <span style={{ fontSize: "16px", opacity: 0.9 }}>(seus projetos correm perigo)</span>
          </h2>

          {/* Subtitle */}
          <p
            style={{
              color: "#E0E0E0",
              textAlign: "center",
              fontSize: "16px",
              marginBottom: "24px",
              lineHeight: 1.5,
            }}
          >
            Adquira sua versão oficial com{" "}
            <span
              style={{
                color: "#00FF88",
                fontWeight: "bold",
                textShadow: "0 0 10px rgba(0, 255, 136, 0.5)",
              }}
            >
              50% de desconto
            </span>{" "}
            e fuja da pirataria!
          </p>

          {/* Image Placeholder */}
          <div
            style={{
              background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
              borderRadius: "12px",
              border: "1px solid #333",
              padding: "40px 20px",
              marginBottom: "24px",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 77, 77, 0.03) 10px, rgba(255, 77, 77, 0.03) 20px)",
              }}
            />
            <div style={{ position: "relative" }}>
              <span style={{ color: "#666", fontSize: "14px", display: "block", marginBottom: "8px" }}>
                📸 Imagem dos Planos
              </span>
              <span
                style={{
                  color: "#5865F2",
                  fontSize: "18px",
                  fontWeight: "bold",
                  textShadow: "0 0 15px rgba(88, 101, 242, 0.5)",
                }}
              >
                Alt Community #2026
              </span>
            </div>
          </div>

          {/* Discord Button */}
          <div style={{ marginBottom: "16px" }}>
            <a
              href="https://discord.gg/altcommunity"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                backgroundColor: "#5865F2",
                color: "white",
                padding: "14px 24px",
                borderRadius: "10px",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                boxShadow: "0 0 20px rgba(88, 101, 242, 0.4)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.02)";
                e.currentTarget.style.boxShadow = "0 0 30px rgba(88, 101, 242, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(88, 101, 242, 0.4)";
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Entrar no Discord
            </a>
            <button
              onClick={() => handleCopy("https://discord.gg/altcommunity", "discord")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                marginTop: "8px",
                padding: "8px",
                backgroundColor: "transparent",
                border: "none",
                color: "#888",
                fontSize: "13px",
                cursor: "pointer",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#5865F2")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
            >
              {copiedDiscord ? <Check size={14} color="#00FF88" /> : <Copy size={14} />}
              {copiedDiscord ? "Copiado!" : "https://discord.gg/altcommunity"}
            </button>
          </div>

          {/* WhatsApp Button */}
          <div style={{ marginBottom: "24px" }}>
            <a
              href="https://wa.me/5547984951601"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                backgroundColor: "transparent",
                color: "#25D366",
                padding: "14px 24px",
                borderRadius: "10px",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                border: "2px solid #25D366",
                transition: "background-color 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(37, 211, 102, 0.1)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(37, 211, 102, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Falar no WhatsApp
            </a>
            <button
              onClick={() => handleCopy("+55 47 98495-1601", "whatsapp")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                marginTop: "8px",
                padding: "8px",
                backgroundColor: "transparent",
                border: "none",
                color: "#888",
                fontSize: "13px",
                cursor: "pointer",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#25D366")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
            >
              {copiedWhatsapp ? <Check size={14} color="#00FF88" /> : <Copy size={14} />}
              {copiedWhatsapp ? "Copiado!" : "+55 47 98495-1601"}
            </button>
          </div>

          {/* Footer Warning */}
          <div
            style={{
              background: "rgba(255, 77, 77, 0.15)",
              border: "1px solid rgba(255, 77, 77, 0.4)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <Skull size={24} color="#FF4D4D" style={{ flexShrink: 0, filter: "drop-shadow(0 0 5px rgba(255, 77, 77, 0.6))" }} />
            <span
              style={{
                color: "#FF4D4D",
                fontWeight: "bold",
                fontSize: "14px",
                textAlign: "center",
                textShadow: "0 0 10px rgba(255, 77, 77, 0.4)",
              }}
            >
              Quem te enviou essa extensão é um GOLPISTA!
            </span>
            <Skull size={24} color="#FF4D4D" style={{ flexShrink: 0, filter: "drop-shadow(0 0 5px rgba(255, 77, 77, 0.6))" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
