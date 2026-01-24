import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ChevronRight, Settings, Zap, Loader2 } from "lucide-react";
import { Subaccount } from "@/hooks/useSubaccounts";
import { useInstances } from "@/hooks/useInstances";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CANONICAL_APP_ORIGIN } from "@/lib/canonicalOrigin";

interface SubaccountCardProps {
  subaccount: Subaccount;
  onClick: () => void;
}

export function SubaccountCard({ subaccount, onClick }: SubaccountCardProps) {
  const { instances } = useInstances(subaccount.id);
  const navigate = useNavigate();
  const [generatingLink, setGeneratingLink] = useState(false);

  const connectedCount = instances.filter(i => i.instance_status === "connected").length;
  const totalCount = instances.length;

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/subaccount/${subaccount.id}/settings`);
  };

  const handleCopyGHLLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setGeneratingLink(true);

    try {
      let embedToken = subaccount.embed_token;

      // Generate token if not exists
      if (!embedToken) {
        const { data, error } = await supabase.rpc("generate_embed_token");
        
        if (error) {
          // Fallback: generate client-side
          embedToken = btoa(crypto.randomUUID().replace(/-/g, "")).slice(0, 20);
        } else {
          embedToken = data;
        }

        // Save the token
        const { error: updateError } = await supabase
          .from("ghl_subaccounts")
          .update({ embed_token: embedToken })
          .eq("id", subaccount.id);

        if (updateError) {
          console.error("Error saving embed token:", updateError);
          toast.error("Erro ao gerar link");
          return;
        }
      }

      // Build the embed URL
      // IMPORTANT: use the published/canonical domain. The in-editor preview domain
      // requires Lovable login, which breaks public embeds inside GHL.
      const baseUrl = CANONICAL_APP_ORIGIN;
      const embedUrl = `${baseUrl}/embed/${embedToken}?iframe=true`;

      // Copy to clipboard
      await navigator.clipboard.writeText(embedUrl);
      toast.success("Link copiado! Cole no GHL para exibir as instâncias.");
    } catch (error) {
      console.error("Error generating GHL link:", error);
      toast.error("Erro ao copiar link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const isAppInstalled = !!subaccount.ghl_access_token;

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 bg-card border-border group"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-card-foreground line-clamp-1">
                {subaccount.account_name}
              </CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {subaccount.location_id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyGHLLink}
              disabled={generatingLink}
              className="h-8 px-3 text-xs border-border/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {generatingLink ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Copiar Link p/ GHL
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSettingsClick}
              className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {!isAppInstalled && (
            <Badge variant="outline" className="border-warning text-warning">
              App não instalado
            </Badge>
          )}
          {totalCount > 0 ? (
            <>
              <Badge
                variant={connectedCount > 0 ? "default" : "secondary"}
                className={connectedCount > 0 ? "bg-success text-success-foreground" : ""}
              >
                {connectedCount} conectada{connectedCount !== 1 ? "s" : ""}
              </Badge>
              {totalCount > connectedCount && (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {totalCount - connectedCount} offline
                </Badge>
              )}
            </>
          ) : isAppInstalled ? (
            <Badge variant="outline" className="border-border text-muted-foreground">
              Sem instâncias
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
