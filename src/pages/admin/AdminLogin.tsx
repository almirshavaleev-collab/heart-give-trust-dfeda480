import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Mode = 'login' | 'register';

export default function AdminLogin() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // If already logged in as admin, redirect
  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate('/admin');
    }
  }, [authLoading, user, isAdmin, navigate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Safety timeout — 15s max
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Не удалось завершить вход. Попробуйте ещё раз.');
    }, 15000);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Пароли не совпадают');
          return;
        }
        if (password.length < 6) {
          setError('Пароль должен быть не менее 6 символов');
          return;
        }
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        setSuccess('Регистрация прошла успешно! Проверьте email для подтверждения.');
        return;
      }

      // Login flow
      const { error: signInError, isAdmin: adminResult } = await signIn(email, password);
      if (signInError) {
        setError('Неверный email или пароль');
        return;
      }

      if (!adminResult) {
        setError('Нет доступа. Только администраторы могут войти в панель управления.');
        return;
      }

      console.log('[login] redirect to /admin');
      toast.success('Вход выполнен');
      navigate('/admin');
    } catch (err: any) {
      console.error('[login] unexpected error', err);
      setError(err?.message || 'Произошла непредвиденная ошибка');
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            {mode === 'login' ? 'Вход в админку' : 'Регистрация'}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Фонд выпускников лицея</p>
          <div className="flex mt-4 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Регистрация
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {mode === 'register' && (
              <div>
                <Input
                  type="password"
                  placeholder="Подтверждение пароля"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-primary">{success}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? (mode === 'login' ? 'Вход...' : 'Регистрация...')
                : (mode === 'login' ? 'Войти' : 'Зарегистрироваться')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
