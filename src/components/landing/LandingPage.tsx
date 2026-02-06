import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { 
  MessageCircle, 
  Mic, 
  Smartphone, 
  Users, 
  ArrowRight,
  Zap,
  Shield,
  RefreshCw,
  Gift
} from "lucide-react";
import logo from "@/assets/logo.png";
import whatsappLogo from "@/assets/whatsapp-logo.svg";

const LandingPage = () => {
  const [instanceCount, setInstanceCount] = useState(1);
  const pricePerInstance = 35;
  const totalPrice = instanceCount * pricePerInstance;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Single subtle orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-muted/30 rounded-full blur-[200px]" />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Bridge API" className="h-10 w-10 rounded-full" />
            <span className="text-xl font-semibold text-foreground">Bridge API</span>
          </div>
          
          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a 
              href="#" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-300 font-medium"
            >
              Início
            </a>
            <a 
              href="#precos" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-300 font-medium"
            >
              Preços
            </a>
          </nav>
          
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="outline" className="border-border text-foreground hover:bg-secondary transition-all duration-300">
                Entrar
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-brand-green hover:bg-brand-green/90 text-white transition-all duration-300">
                Inicie Agora
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border text-brand-green text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            Integração WhatsApp + GHL
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-foreground">
            Conecte o WhatsApp ao GoHighLevel{" "}
            <span className="text-brand-green">Como Nunca Antes</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Liberte o Potencial Total da Sua Comunicação. Gerencie Múltiplas Instâncias, 
            Otimize Interações e Automatize seu Atendimento Direto do GHL.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-brand-green hover:bg-brand-green/90 text-white px-8 py-6 text-lg transition-all duration-300 group">
                Inicie Agora
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg border-border text-foreground hover:bg-secondary transition-all duration-300">
              Saiba Mais
            </Button>
          </div>

          {/* Visual Element - Logos */}
          <div className="mt-16 relative">
            <div className="relative flex items-center justify-center gap-6 md:gap-12">
              {/* WhatsApp Logo */}
              <div className="flex flex-col items-center z-20 group">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-card shadow-lg flex items-center justify-center border border-border group-hover:border-muted-foreground/50 transition-all duration-500 group-hover:scale-105">
                  <img src={whatsappLogo} alt="WhatsApp" className="h-10 w-10 md:h-12 md:w-12" />
                </div>
                <span className="mt-2 text-sm font-medium text-muted-foreground">WhatsApp</span>
              </div>

              {/* Connection Lines with animated signals */}
              <div className="relative w-24 md:w-40 h-12 flex flex-col justify-center gap-4">
                {/* Line 1 - Signal going right (WhatsApp to GHL) */}
                <div className="relative h-0.5 w-full bg-border/50 rounded-full overflow-hidden">
                  <div 
                    className="absolute h-full w-8 bg-gradient-to-r from-transparent via-brand-blue to-transparent"
                    style={{
                      animation: 'signalRight 2s ease-in-out infinite',
                      boxShadow: '0 0 12px 4px hsl(var(--brand-blue))',
                    }}
                  />
                </div>
                
                {/* Line 2 - Signal going left (GHL to WhatsApp) */}
                <div className="relative h-0.5 w-full bg-border/50 rounded-full overflow-hidden">
                  <div 
                    className="absolute h-full w-8 bg-gradient-to-r from-transparent via-brand-blue to-transparent"
                    style={{
                      animation: 'signalLeft 2s ease-in-out infinite',
                      animationDelay: '1s',
                      boxShadow: '0 0 12px 4px hsl(var(--brand-blue))',
                    }}
                  />
                </div>
              </div>
              
              {/* GoHighLevel Logo */}
              <div className="flex flex-col items-center z-20 group">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-card shadow-lg flex items-center justify-center border border-border group-hover:border-muted-foreground/50 transition-all duration-500 group-hover:scale-105 overflow-hidden">
                  <svg viewBox="0 0 100 100" className="h-10 w-10 md:h-12 md:w-12">
                    <defs>
                      <linearGradient id="ghl-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F97316" />
                        <stop offset="100%" stopColor="#EA580C" />
                      </linearGradient>
                    </defs>
                    <rect width="100" height="100" rx="20" fill="url(#ghl-gradient)" />
                    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="48" fontWeight="bold" fontFamily="Arial, sans-serif">G</text>
                  </svg>
                </div>
                <span className="mt-2 text-sm font-medium text-muted-foreground">GoHighLevel</span>
              </div>
            </div>
          </div>

          {/* CSS Keyframes for signal animations */}
          <style>{`
            @keyframes signalRight {
              0% { left: 0; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { left: calc(100% - 12px); opacity: 0; }
            }
            @keyframes signalLeft {
              0% { right: 0; left: auto; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { right: calc(100% - 12px); left: auto; opacity: 0; }
            }
          `}</style>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 relative z-10 bg-secondary/30">
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Funcionalidades Poderosas
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tudo o que você precisa para gerenciar suas conversas do WhatsApp diretamente do GoHighLevel.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="group bg-card rounded-2xl p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                <MessageCircle className="h-7 w-7 text-brand-green" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Reaja, Edite e Responda Mensagens
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Tenha controle total sobre suas conversas. Reaja com emojis, edite textos enviados, 
                responda a mensagens específicas e apague o que foi dito, tudo dentro do GoHighLevel.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-card rounded-2xl p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                <Mic className="h-7 w-7 text-brand-green" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Envie e Receba Áudios e Mídias
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Comunicação rica e completa. Envie e receba mensagens de áudio, fotos e vídeos 
                diretamente da interface do GHL, como se estivesse no WhatsApp nativo.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-card rounded-2xl p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                <Smartphone className="h-7 w-7 text-brand-green" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Múltiplos Números, Uma Só Subconta
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Conecte diversas instâncias do WhatsApp à mesma subconta do GHL. O Switcher automático 
                troca o número de envio conforme a conversa, garantindo que você sempre responda pelo número certo.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group bg-card rounded-2xl p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                <Users className="h-7 w-7 text-brand-green" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Atualização de Perfil e Gestão de Grupos
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Mantenha o perfil da sua instância sempre atualizado e gerencie seus grupos de WhatsApp 
                diretamente do GoHighLevel, facilitando campanhas e comunicações em massa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-20 px-6 scroll-mt-20 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Planos e Preços
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para o tamanho do seu negócio.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Flexible Plan */}
            <div className="group bg-card rounded-2xl p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300 flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">Flexível</h3>
                <p className="text-muted-foreground text-sm">Escolha a quantidade ideal</p>
              </div>
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">R${totalPrice}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm text-brand-green font-medium mt-1">R$35 por instância</p>
              </div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Instâncias</span>
                  <span className="text-lg font-bold text-brand-green">{instanceCount}</span>
                </div>
                <Slider
                  value={[instanceCount]}
                  onValueChange={(value) => setInstanceCount(value[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  {instanceCount} Instância{instanceCount > 1 ? 's' : ''} WhatsApp
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Subcontas ilimitadas
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Mensagens ilimitadas
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Switcher automático
                </li>
              </ul>
              <Link to={`/checkout?plan=flexible&quantity=${instanceCount}`} className="w-full">
                {instanceCount === 1 ? (
                  <Button className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white transition-all duration-300">
                    <Gift className="mr-2 h-4 w-4" />
                    Testar Grátis
                  </Button>
                ) : (
                  <Button className="w-full bg-brand-green hover:bg-brand-green/90 text-white transition-all duration-300">
                    Começar Agora
                  </Button>
                )}
              </Link>
            </div>

            {/* 50 Instances Plan */}
            <div className="group bg-card rounded-2xl p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300 flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">50 Instâncias</h3>
                <p className="text-muted-foreground text-sm">Para negócios em crescimento</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">R$798</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  50 Instâncias WhatsApp
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Subcontas ilimitadas
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Mensagens ilimitadas
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Switcher automático
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Suporte prioritário
                </li>
              </ul>
              <Link to="/checkout?plan=plan_50" className="w-full">
                <Button className="w-full bg-brand-green hover:bg-brand-green/90 text-white transition-all duration-300">
                  Começar Agora
                </Button>
              </Link>
            </div>

            {/* 100 Instances Plan */}
            <div className="group relative bg-card rounded-2xl p-8 border-2 border-brand-green flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-green text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                Mais Popular
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">100 Instâncias</h3>
                <p className="text-muted-foreground text-sm">Para agências e equipes</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">R$1.298</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  100 Instâncias WhatsApp
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Subcontas ilimitadas
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Mensagens ilimitadas
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Switcher automático
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Suporte prioritário
                </li>
              </ul>
              <Link to="/checkout?plan=plan_100" className="w-full">
                <Button className="w-full bg-brand-green hover:bg-brand-green/90 text-white transition-all duration-300">
                  Começar Agora
                </Button>
              </Link>
            </div>

            {/* 300 Instances Plan */}
            <div className="group bg-card rounded-2xl p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300 flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">300 Instâncias</h3>
                <p className="text-muted-foreground text-sm">Para grandes operações</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">R$2.998</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  300 Instâncias WhatsApp
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Subcontas ilimitadas
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Mensagens ilimitadas
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Switcher automático
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-brand-green" />
                  Suporte prioritário
                </li>
              </ul>
              <Link to="/checkout?plan=plan_300" className="w-full">
                <Button className="w-full bg-brand-green hover:bg-brand-green/90 text-white transition-all duration-300">
                  Começar Agora
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-brand-green rounded-3xl p-12 md:p-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Pronto para ir para o próximo Level?
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-8">
              Otimize seu tempo, melhore a experiência do cliente e escale seu atendimento com a Bridge API.
            </p>
            <Link to="/register">
              <Button size="lg" className="bg-white text-brand-green hover:bg-white/90 px-8 py-6 text-lg font-semibold transition-all duration-300">
                Ir para o Próximo Level 🚀
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Bridge API" className="h-8 w-8" />
            <span className="text-muted-foreground">Bridge API © {new Date().getFullYear()} - Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors duration-300">Termos de Serviço</a>
            <a href="#" className="hover:text-foreground transition-colors duration-300">Política de Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
