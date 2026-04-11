import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import { auth } from '../../firebase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center px-6">
      <div className="w-full max-w-md bg-surface-container-low p-8 rounded-3xl shadow-sm">
        <div className="text-center mb-8">
          <h1 className="font-headline font-bold text-3xl tracking-tight mb-2">CHAMPS ADMIN</h1>
          <p className="text-on-surface-variant">Sign in to manage your store</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/20"
              placeholder="admin@champs.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/20"
              placeholder=""
              required
            />
          </div>

          <Button className="w-full py-3" type="submit">
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Store
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
