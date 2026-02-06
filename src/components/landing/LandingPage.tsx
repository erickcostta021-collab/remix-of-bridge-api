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
  RefreshCw
} from "lucide-react";
import logo from "@/assets/logo.png";
import bridgeImage from "@/assets/bridge.png";
import whatsappLogo from "@/assets/whatsapp-logo.svg";

const LandingPage = () => {
  const [instanceCount, setInstanceCount] = useState(1);
  const pricePerInstance = 35;
  const totalPrice = instanceCount * pricePerInstance;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Futuristic Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-blue/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-green/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-[200px]" />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--brand-blue)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--brand-blue)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-brand-blue/20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="relative">
              <img src={logo} alt="Bridge API" className="h-10 w-10 relative z-10" />
              <div className="absolute inset-0 bg-brand-green/50 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            <span className="text-xl font-semibold text-foreground bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Bridge API</span>
          </div>
          
          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a 
              href="#" 
              className="text-muted-foreground hover:text-brand-blue transition-all duration-300 font-medium relative group"
            >
              Início
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-brand-blue to-brand-green group-hover:w-full transition-all duration-300" />
            </a>
            <a 
              href="#precos" 
              className="text-muted-foreground hover:text-brand-green transition-all duration-300 font-medium relative group"
            >
              Preços
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-brand-green to-brand-blue group-hover:w-full transition-all duration-300" />
            </a>
          </nav>
          
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="outline" className="border-brand-blue/30 text-foreground hover:bg-brand-blue/10 hover:border-brand-blue/50 transition-all duration-300">
                Entrar
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-gradient-to-r from-brand-green to-brand-green/80 hover:from-brand-green/90 hover:to-brand-green text-white shadow-lg shadow-brand-green/25 hover:shadow-brand-green/40 transition-all duration-300">
                Inicie Agora
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-blue/10 border border-brand-blue/30 text-brand-blue text-sm font-medium mb-6 backdrop-blur-sm shadow-lg shadow-brand-blue/10">
            <Zap className="h-4 w-4 animate-pulse" />
            Integração WhatsApp + GHL
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">Conecte o WhatsApp ao GoHighLevel</span>{" "}
            <span className="bg-gradient-to-r from-brand-green via-brand-green to-brand-blue bg-clip-text text-transparent">Como Nunca Antes</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Liberte o Potencial Total da Sua Comunicação. Gerencie Múltiplas Instâncias, 
            Otimize Interações e Automatize seu Atendimento Direto do GHL.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-gradient-to-r from-brand-green to-brand-green/80 hover:from-brand-green hover:to-brand-green/90 text-white px-8 py-6 text-lg shadow-xl shadow-brand-green/30 hover:shadow-brand-green/50 transition-all duration-300 group">
                Inicie Agora
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg border-brand-blue/30 text-foreground hover:bg-brand-blue/10 hover:border-brand-blue/50 backdrop-blur-sm transition-all duration-300">
              Saiba Mais
            </Button>
          </div>

          {/* Visual Element - Bridge with logos */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-blue/30 via-accent/20 to-brand-green/30 rounded-3xl blur-[100px]" />
            <div className="relative flex items-end justify-center">
              {/* WhatsApp Logo - Left Side */}
              <div className="flex flex-col items-center z-20 group">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-card/80 backdrop-blur-xl shadow-xl shadow-brand-green/20 flex items-center justify-center border border-brand-green/30 group-hover:border-brand-green/60 transition-all duration-500 group-hover:scale-110">
                  <img src={whatsappLogo} alt="WhatsApp" className="h-10 w-10 md:h-12 md:w-12" />
                </div>
                <span className="mt-2 text-sm font-medium text-muted-foreground">WhatsApp</span>
              </div>
              
              {/* Bridge Image - Center */}
              <div className="relative z-10 -mb-2 md:-mb-3 -mx-2 md:-mx-4">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-20 pointer-events-none" />
                <img 
                  src={bridgeImage} 
                  alt="Bridge connecting WhatsApp and GoHighLevel" 
                  className="h-64 md:h-80 lg:h-96 xl:h-[28rem] w-auto object-contain drop-shadow-2xl"
                />
              </div>
              
              {/* GoHighLevel Logo - Right Side */}
              <div className="flex flex-col items-center z-20 group">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-card/80 backdrop-blur-xl shadow-xl shadow-orange-500/20 flex items-center justify-center border border-orange-500/30 group-hover:border-orange-500/60 transition-all duration-500 group-hover:scale-110 overflow-hidden">
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
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/30 to-transparent" />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Funcionalidades </span>
              <span className="bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">Poderosas</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tudo o que você precisa para gerenciar suas conversas do WhatsApp diretamente do GoHighLevel.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="group bg-card/50 backdrop-blur-xl rounded-2xl p-8 border border-brand-blue/20 hover:border-brand-blue/50 transition-all duration-500 hover:shadow-xl hover:shadow-brand-blue/10 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-brand-blue/10 border border-brand-blue/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <MessageCircle className="h-7 w-7 text-brand-blue" />
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
            <div className="group bg-card/50 backdrop-blur-xl rounded-2xl p-8 border border-brand-green/20 hover:border-brand-green/50 transition-all duration-500 hover:shadow-xl hover:shadow-brand-green/10 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
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
            <div className="group bg-card/50 backdrop-blur-xl rounded-2xl p-8 border border-brand-blue/20 hover:border-brand-blue/50 transition-all duration-500 hover:shadow-xl hover:shadow-brand-blue/10 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-brand-blue/10 border border-brand-blue/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Smartphone className="h-7 w-7 text-brand-blue" />
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
            <div className="group bg-card/50 backdrop-blur-xl rounded-2xl p-8 border border-brand-green/20 hover:border-brand-green/50 transition-all duration-500 hover:shadow-xl hover:shadow-brand-green/10 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Planos e </span>
              <span className="bg-gradient-to-r from-brand-green to-brand-blue bg-clip-text text-transparent">Preços</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para o tamanho do seu negócio.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Flexible Plan */}
            <div className="group bg-card/50 backdrop-blur-xl rounded-2xl p-8 border border-brand-green/20 hover:border-brand-green/50 transition-all duration-500 flex flex-col hover:shadow-xl hover:shadow-brand-green/10">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">Flexível</h3>
                <p className="text-muted-foreground text-sm">Escolha a quantidade ideal</p>
              </div>
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold bg-gradient-to-r from-brand-green to-brand-blue bg-clip-text text-transparent">R${totalPrice}</span>
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
                <Button className="w-full bg-gradient-to-r from-brand-green to-brand-green/80 hover:from-brand-green hover:to-brand-green/90 text-white shadow-lg shadow-brand-green/20 hover:shadow-brand-green/40 transition-all duration-300">
                  Começar Agora
                </Button>
              </Link>
            </div>

            {/* 50 Instances Plan */}
            <div className="group bg-card/50 backdrop-blur-xl rounded-2xl p-8 border border-brand-blue/20 hover:border-brand-blue/50 transition-all duration-500 flex flex-col hover:shadow-xl hover:shadow-brand-blue/10">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">50 Instâncias</h3>
                <p className="text-muted-foreground text-sm">Para negócios em crescimento</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">R$798</span>
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
                <Button className="w-full bg-gradient-to-r from-brand-blue to-brand-blue/80 hover:from-brand-blue hover:to-brand-blue/90 text-white shadow-lg shadow-brand-blue/20 hover:shadow-brand-blue/40 transition-all duration-300">
                  Começar Agora
                </Button>
              </Link>
            </div>

            {/* 100 Instances Plan */}
            <div className="group relative bg-card/50 backdrop-blur-xl rounded-2xl p-8 border-2 border-brand-green/50 flex flex-col shadow-xl shadow-brand-green/20 hover:shadow-brand-green/30 transition-all duration-500">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-green to-brand-blue text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg">
                Mais Popular
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">100 Instâncias</h3>
                <p className="text-muted-foreground text-sm">Para agências e equipes</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold bg-gradient-to-r from-brand-green to-brand-blue bg-clip-text text-transparent">R$1.298</span>
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
                <Button className="w-full bg-gradient-to-r from-brand-green to-brand-blue hover:from-brand-green/90 hover:to-brand-blue/90 text-white shadow-lg shadow-brand-green/30 hover:shadow-brand-green/50 transition-all duration-300">
                  Começar Agora
                </Button>
              </Link>
            </div>

            {/* 300 Instances Plan */}
            <div className="group bg-card/50 backdrop-blur-xl rounded-2xl p-8 border border-brand-blue/20 hover:border-brand-blue/50 transition-all duration-500 flex flex-col hover:shadow-xl hover:shadow-brand-blue/10">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">300 Instâncias</h3>
                <p className="text-muted-foreground text-sm">Para grandes operações</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">R$2.998</span>
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
                <Button className="w-full bg-gradient-to-r from-brand-blue to-brand-blue/80 hover:from-brand-blue hover:to-brand-blue/90 text-white shadow-lg shadow-brand-blue/20 hover:shadow-brand-blue/40 transition-all duration-300">
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
          <div className="relative bg-gradient-to-br from-brand-blue via-accent/50 to-brand-green rounded-3xl p-12 md:p-16 overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 left-0 w-40 h-40 bg-white/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-0 right-0 w-60 h-60 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Pronto para ir para o próximo Level?
              </h2>
              <p className="text-lg text-white/90 max-w-2xl mx-auto mb-8">
                Otimize seu tempo, melhore a experiência do cliente e escale seu atendimento com a Bridge API.
              </p>
              <Link to="/register">
                <Button size="lg" className="bg-white text-brand-blue hover:bg-white/90 px-8 py-6 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  Ir para o Próximo Level 🚀
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-brand-blue/20 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 group">
            <div className="relative">
              <img src={logo} alt="Bridge API" className="h-8 w-8 relative z-10" />
              <div className="absolute inset-0 bg-brand-green/50 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            <span className="text-muted-foreground">Bridge API © {new Date().getFullYear()} - Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-brand-blue transition-colors duration-300">Termos de Serviço</a>
            <a href="#" className="hover:text-brand-green transition-colors duration-300">Política de Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
