import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronRight } from "lucide-react";
import { Subaccount } from "@/hooks/useSubaccounts";
import { useInstances } from "@/hooks/useInstances";

interface SubaccountCardProps {
  subaccount: Subaccount;
  onClick: () => void;
}

export function SubaccountCard({ subaccount, onClick }: SubaccountCardProps) {
  const { instances } = useInstances(subaccount.id);

  const connectedCount = instances.filter(i => i.instance_status === "connected").length;
  const totalCount = instances.length;

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
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
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
          ) : (
            <Badge variant="outline" className="border-border text-muted-foreground">
              Sem instâncias
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
