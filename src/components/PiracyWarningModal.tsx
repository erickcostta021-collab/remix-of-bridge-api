import React from "react";

interface PiracyWarningModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

const PiracyWarningModal: React.FC<PiracyWarningModalProps> = ({ isOpen }) => {
  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        zIndex: 2147483647,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#121212",
          borderRadius: "15px",
          border: "2px solid #FF4D4D",
          boxShadow: "0 0 30px rgba(255, 77, 77, 0.5), 0 0 60px rgba(255, 77, 77, 0.3), inset 0 0 20px rgba(255, 77, 77, 0.1)",
          padding: "32px",
          maxWidth: "520px",
          width: "90%",
          textAlign: "center",
          animation: "pulse 2s ease-in-out infinite",
        }}
      >
        {/* Warning Icon */}
        <div style={{ marginBottom: "16px" }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            style={{ filter: "drop-shadow(0 0 10px rgba(255, 77, 77, 0.8))" }}
          >
            <path
              d="M12 2L1 21h22L12 2z"
              fill="#FF4D4D"
              stroke="#FF4D4D"
              strokeWidth="1"
            />
            <path d="M12 9v5" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="#121212" />
          </svg>
        </div>

        {/* Title */}
        <h1
          style={{
            color: "#FF4D4D",
            fontSize: "22px",
            fontWeight: "bold",
            marginBottom: "16px",
            textShadow: "0 0 10px rgba(255, 77, 77, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span>⚠️</span>
          Você está usando uma extensão pirateada!
          <span>⚠️</span>
        </h1>

        <p
          style={{
            color: "#FF4D4D",
            fontSize: "14px",
            marginBottom: "20px",
            opacity: 0.9,
          }}
        >
          (seus projetos correm perigo)
        </p>

        {/* Main Text */}
        <p
          style={{
            color: "#E0E0E0",
            fontSize: "16px",
            marginBottom: "24px",
            lineHeight: 1.6,
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

        {/* Plans Image Placeholder */}
        <div
          style={{
            backgroundColor: "#1a1a1a",
            border: "1px dashed #444",
            borderRadius: "10px",
            padding: "40px 20px",
            marginBottom: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#666" strokeWidth="1.5" />
            <circle cx="8.5" cy="8.5" r="1.5" stroke="#666" strokeWidth="1.5" />
            <path d="M21 15l-5-5L5 21" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ color: "#666", fontSize: "14px" }}>Imagem dos Planos Bora</span>
        </div>

        {/* Buttons Container */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
          {/* Discord Button */}
          <div>
            <a
              href="https://discord.gg/altcommunity"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                backgroundColor: "#5865F2",
                color: "#FFFFFF",
                padding: "14px 32px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                width: "100%",
                boxSizing: "border-box",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 15px rgba(88, 101, 242, 0.4)",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(88, 101, 242, 0.6)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(88, 101, 242, 0.4)";
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Entrar no Discord
            </a>
            <p
              style={{
                color: "#888",
                fontSize: "12px",
                marginTop: "8px",
                cursor: "pointer",
              }}
              onClick={() => copyToClipboard("https://discord.gg/altcommunity")}
              title="Clique para copiar"
            >
              https://discord.gg/altcommunity
            </p>
          </div>

          {/* WhatsApp Button */}
          <div>
            <a
              href="https://wa.me/5547984951601"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                backgroundColor: "transparent",
                color: "#25D366",
                padding: "14px 32px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                width: "100%",
                boxSizing: "border-box",
                border: "2px solid #25D366",
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(37, 211, 102, 0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Falar no WhatsApp
            </a>
            <p
              style={{
                color: "#888",
                fontSize: "12px",
                marginTop: "8px",
                cursor: "pointer",
              }}
              onClick={() => copyToClipboard("+55 47 98495-1601")}
              title="Clique para copiar"
            >
              +55 47 98495-1601
            </p>
          </div>
        </div>

        {/* Footer Warning */}
        <div
          style={{
            backgroundColor: "rgba(255, 77, 77, 0.15)",
            border: "1px solid rgba(255, 77, 77, 0.4)",
            borderRadius: "10px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "24px" }}>💀</span>
          <span
            style={{
              color: "#FF4D4D",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            Quem te enviou essa extensão é um GOLPISTA!
          </span>
          <span style={{ fontSize: "24px" }}>💀</span>
        </div>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              box-shadow: 0 0 30px rgba(255, 77, 77, 0.5), 0 0 60px rgba(255, 77, 77, 0.3), inset 0 0 20px rgba(255, 77, 77, 0.1);
            }
            50% {
              box-shadow: 0 0 40px rgba(255, 77, 77, 0.7), 0 0 80px rgba(255, 77, 77, 0.4), inset 0 0 30px rgba(255, 77, 77, 0.15);
            }
          }
        `}
      </style>
    </div>
  );
};

export default PiracyWarningModal;
