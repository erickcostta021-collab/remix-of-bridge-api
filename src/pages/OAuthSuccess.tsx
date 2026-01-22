import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";

const OAuthSuccess = () => {
  const { locationId } = useParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Conexão realizada com sucesso!
        </h1>
        
        <p className="text-muted-foreground mb-6">
          Sua conta foi conectada com sucesso. Você será redirecionado automaticamente.
        </p>

        {locationId && (
          <p className="text-xs text-muted-foreground/60 mb-4">
            Location ID: {locationId}
          </p>
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
            {countdown}
          </div>
          <span>Redirecionando...</span>
        </div>
      </div>
    </div>
  );
};

export default OAuthSuccess;
