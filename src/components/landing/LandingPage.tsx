import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
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

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Bridge API" className="h-10 w-10" />
            <span className="text-xl font-semibold text-gray-900">Bridge API</span>
          </div>
          <Link to="/login">
            <Button className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              Entrar
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-blue-light text-brand-blue text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            Integração WhatsApp + GHL
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Conecte o WhatsApp ao GoHighLevel{" "}
            <span className="text-brand-blue">Como Nunca Antes</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Liberte o Potencial Total da Sua Comunicação. Gerencie Múltiplas Instâncias, 
            Otimize Interações e Automatize seu Atendimento Direto do GHL.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" className="bg-brand-green hover:bg-brand-green/90 text-white px-8 py-6 text-lg">
                Comece Agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg border-gray-300 text-gray-700 hover:bg-gray-50">
              Saiba Mais
            </Button>
          </div>

          {/* Visual Element */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-blue/10 via-transparent to-brand-green/10 rounded-3xl blur-3xl" />
            <div className="relative bg-white rounded-2xl shadow-2xl shadow-gray-200/50 border border-gray-100 p-8 md:p-12">
              <div className="flex items-center justify-center gap-8 md:gap-16">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-brand-green-light flex items-center justify-center">
                    <MessageCircle className="h-8 w-8 md:h-10 md:w-10 text-brand-green" />
                  </div>
                  <span className="mt-3 text-sm font-medium text-gray-600">WhatsApp</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-brand-blue rounded-full" />
                  <RefreshCw className="h-6 w-6 text-brand-blue animate-spin" style={{ animationDuration: '3s' }} />
                  <div className="w-8 h-1 bg-brand-green rounded-full" />
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-brand-blue-light flex items-center justify-center">
                    <Shield className="h-8 w-8 md:h-10 md:w-10 text-brand-blue" />
                  </div>
                  <span className="mt-3 text-sm font-medium text-gray-600">GoHighLevel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Funcionalidades Poderosas
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Tudo o que você precisa para gerenciar suas conversas do WhatsApp diretamente do GoHighLevel.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-brand-blue-light flex items-center justify-center mb-6">
                <MessageCircle className="h-7 w-7 text-brand-blue" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Reaja, Edite e Responda Mensagens
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Tenha controle total sobre suas conversas. Reaja com emojis, edite textos enviados, 
                responda a mensagens específicas e apague o que foi dito, tudo dentro do GoHighLevel.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-brand-green-light flex items-center justify-center mb-6">
                <Mic className="h-7 w-7 text-brand-green" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Envie e Receba Áudios e Mídias
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Comunicação rica e completa. Envie e receba mensagens de áudio, fotos e vídeos 
                diretamente da interface do GHL, como se estivesse no WhatsApp nativo.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-brand-blue-light flex items-center justify-center mb-6">
                <Smartphone className="h-7 w-7 text-brand-blue" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Múltiplos Números, Uma Só Subconta
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Conecte diversas instâncias do WhatsApp à mesma subconta do GHL. O Switcher automático 
                troca o número de envio conforme a conversa, garantindo que você sempre responda pelo número certo.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-brand-green-light flex items-center justify-center mb-6">
                <Users className="h-7 w-7 text-brand-green" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Atualização de Perfil e Gestão de Grupos
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Mantenha o perfil da sua instância sempre atualizado e gerencie seus grupos de WhatsApp 
                diretamente do GoHighLevel, facilitando campanhas e comunicações em massa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Secondary CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-brand-blue to-brand-green rounded-3xl p-12 md:p-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Pronto para Transformar sua Gestão de WhatsApp?
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-8">
              Otimize seu tempo, melhore a experiência do cliente e escale seu atendimento com a Bridge API.
            </p>
            <Link to="/login">
              <Button size="lg" className="bg-white text-brand-blue hover:bg-white/90 px-8 py-6 text-lg font-semibold">
                Quero Conectar Minha Conta
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Bridge API" className="h-8 w-8" />
            <span className="text-gray-600">Bridge API © {new Date().getFullYear()} - Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-700 transition-colors">Termos de Serviço</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
