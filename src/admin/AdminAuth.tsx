import { useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { maskPhone } from '../utils/format';

interface AdminAuthProps {
  onAuthenticated: (token: string, admin: { name: string; phone: string }) => void;
  onBackToStore: () => void;
}

export function AdminAuth({ onAuthenticated, onBackToStore }: AdminAuthProps) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [envOverride, setEnvOverride] = useState(false);
  const [phone, setPhone] = useState('(11) 99945-0305');
  const [name, setName] = useState('Mariê Administradora');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => r.json())
      .then((d) => {
        setNeedsSetup(Boolean(d.needs_setup));
        setEnvOverride(Boolean(d.env_override));
        if (d.admin_phone_display) setPhone(d.admin_phone_display);
      })
      .catch(() => setNeedsSetup(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (needsSetup) {
      if (password.length < 6) {
        setError('A senha deve possuir no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas digitadas não coincidem.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = needsSetup ? '/api/admin/auth/setup' : '/api/admin/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Falha na autenticação.');
        return;
      }
      onAuthenticated(data.token, data.admin);
    } catch {
      setError('Erro de comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F6] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-[#E6D9D1] p-8 space-y-6">
        <div className="text-center space-y-2 pb-4 border-b border-[#F2EAE4]">
          <div className="w-10 h-10 mx-auto bg-[#F9EFF0] border border-[#EAD4D8] flex items-center justify-center text-[#8E4F59]">
            {needsSetup ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <h1 className="font-display text-3xl font-semibold text-[#231A18]">
            Painel Administrativo
          </h1>
          <p className="text-xs text-[#7A635D]">
            {needsSetup
              ? 'Primeiro acesso: defina a senha da conta administrativa da Mariê Semi Joias.'
              : 'Acesso restrito à administração da Mariê Semi Joias.'}
          </p>
        </div>

        {needsSetup === null ? (
          <p className="text-center text-sm text-[#7A635D] py-6">Verificando acesso...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5D4742] mb-1">
                Telefone administrativo
              </label>
              <input
                required
                type="text"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99945-0305"
                className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:border-[#B76E79]"
              />
            </div>

            {needsSetup && (
              <div>
                <label className="block text-xs font-medium text-[#5D4742] mb-1">
                  Nome da responsável
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#5D4742] mb-1">
                {needsSetup ? 'Criar senha de acesso' : 'Senha'}
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
              />
            </div>

            {needsSetup && (
              <div>
                <label className="block text-xs font-medium text-[#5D4742] mb-1">
                  Confirmar senha
                </label>
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
            )}

            {envOverride && (
              <p className="text-[11px] text-[#7A635D]">
                Autenticação protegida por senha configurada nas variáveis do servidor.
              </p>
            )}

            {error && (
              <div className="p-3 bg-[#FDF2F2] border border-[#F2C6C6] text-xs text-[#A32929]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#231A18] text-white text-sm font-medium hover:bg-[#8E4F59] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading
                ? 'Validando...'
                : needsSetup
                  ? 'Definir senha e entrar'
                  : 'Entrar no painel'}
            </button>
          </form>
        )}

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onBackToStore}
            className="text-xs text-[#7A635D] hover:text-[#231A18] cursor-pointer"
          >
            Voltar para a loja pública
          </button>
        </div>
      </div>
    </div>
  );
}
