import { useState } from "react";
import { Copy, Check, AlertTriangle, Skull, X } from "lucide-react";
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
  const whatsappLink = `https://wa.me/5547984951601`;

  const handleCopy = async (text: string, type: "discord" | "whatsapp") => {
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
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 2147483647,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="relative w-full max-w-lg"
        style={{
          backgroundColor: "#121212",
          borderRadius: "15px",
          border: "2px solid #FF4D4D",
          boxShadow: "0 0 30px rgba(255, 77, 77, 0.5), 0 0 60px rgba(255, 77, 77, 0.3), inset 0 0 20px rgba(255, 77, 77, 0.1)",
        }}
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-full transition-all hover:bg-white/10"
            style={{ color: "#FF4D4D" }}
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Header with Warning Icons */}
          <div className="flex items-center justify-center gap-3">
            <AlertTriangle className="h-8 w-8 animate-pulse" style={{ color: "#FF4D4D" }} />
            <Skull className="h-6 w-6" style={{ color: "#FF4D4D" }} />
            <AlertTriangle className="h-8 w-8 animate-pulse" style={{ color: "#FF4D4D" }} />
          </div>

          {/* Title */}
          <h1
            className="text-center text-xl font-bold leading-tight"
            style={{ color: "#FF4D4D", textShadow: "0 0 10px rgba(255, 77, 77, 0.5)" }}
          >
            ⚠️ Você está usando uma extensão pirateada!
            <br />
            <span className="text-lg">(seus projetos correm perigo)</span>
          </h1>

          {/* Subtitle with Discount */}
          <p className="text-center text-gray-300 text-sm">
            Adquira sua versão oficial com{" "}
            <span
              className="font-bold text-lg"
              style={{ color: "#00FF88", textShadow: "0 0 8px rgba(0, 255, 136, 0.5)" }}
            >
              50% de desconto
            </span>{" "}
            e fuja da pirataria!
          </p>

          {/* Plans Image Placeholder */}
          <div
            className="rounded-lg p-4 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(255, 77, 77, 0.1) 0%, rgba(88, 101, 242, 0.1) 100%)",
              border: "1px dashed rgba(255, 255, 255, 0.2)",
              minHeight: "100px",
            }}
          >
            <p className="text-gray-500 text-sm text-center italic">
              📋 Imagem dos Planos Alt Community #2026
            </p>
          </div>

          {/* Buttons Section */}
          <div className="space-y-4">
            {/* Discord Button */}
            <div className="space-y-2">
              <a
                href={discordLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{
                  backgroundColor: "#5865F2",
                  boxShadow: "0 4px 15px rgba(88, 101, 242, 0.4)",
                }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Entrar no Discord
              </a>
              <button
                onClick={() => handleCopy(discordLink, "discord")}
                className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-md text-sm transition-all hover:bg-white/5"
                style={{ color: "#5865F2" }}
              >
                {copiedDiscord ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="font-mono text-xs">{discordLink}</span>
              </button>
            </div>

            {/* WhatsApp Button */}
            <div className="space-y-2">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg font-semibold transition-all hover:bg-green-500/10 hover:scale-[1.02]"
                style={{
                  border: "2px solid #25D366",
                  color: "#25D366",
                }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Falar no WhatsApp
              </a>
              <button
                onClick={() => handleCopy(whatsappNumber, "whatsapp")}
                className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-md text-sm transition-all hover:bg-white/5"
                style={{ color: "#25D366" }}
              >
                {copiedWhatsapp ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="font-mono text-xs">{whatsappNumber}</span>
              </button>
            </div>
          </div>

          {/* Warning Footer */}
          <div
            className="rounded-lg p-3 flex items-center justify-center gap-3"
            style={{
              backgroundColor: "rgba(255, 77, 77, 0.15)",
              border: "1px solid rgba(255, 77, 77, 0.3)",
            }}
          >
            <Skull className="h-5 w-5 flex-shrink-0" style={{ color: "#FF4D4D" }} />
            <p
              className="text-center text-sm font-semibold"
              style={{ color: "#FF4D4D" }}
            >
              Quem te enviou essa extensão é um GOLPISTA!
            </p>
            <Skull className="h-5 w-5 flex-shrink-0" style={{ color: "#FF4D4D" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
