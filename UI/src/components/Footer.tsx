import Button from './Button';
import { Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();
  return (
    <footer className="bg-surface-container-low pt-24 pb-12 px-6 mt-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <h2 className="font-headline font-bold text-2xl mb-6">CHAMPS CLOSET.</h2>
          <p className="text-on-surface-variant max-w-sm mb-8">Premium men's essentials delivered across Nairobi. Quality guaranteed, every single time.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <input type="email" placeholder="Enter your email" className="bg-surface px-4 py-3 rounded-full flex-1 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full" />
            <Button className="w-full sm:w-auto" onClick={() => alert('Thanks for subscribing!')}>Subscribe</Button>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-6">Shop</h4>
          <ul className="space-y-4 text-on-surface-variant text-sm">
            <li><button onClick={() => navigate('/catalog/shirts')} className="hover:text-primary">All Shirts</button></li>
            <li><button className="hover:text-primary" onClick={() => navigate('/catalog/all')}>New Arrivals</button></li>
            <li><button className="hover:text-primary" onClick={() => navigate('/catalog/all')}>Best Sellers</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-6">Support</h4>
          <ul className="space-y-4 text-on-surface-variant text-sm">
            <li><button className="hover:text-primary" onClick={() => alert('FAQ coming soon.')}>FAQ</button></li>
            <li><button className="hover:text-primary" onClick={() => alert('Shipping & Returns details coming soon.')}>Shipping & Returns</button></li>
            <li>
              <Link to="/admin/login" className="hover:text-primary flex items-center gap-1">Admin Login <Lock className="w-3 h-3"/></Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-24 pt-12 border-t border-outline-variant/20 flex flex-col items-center">
        <img src="https://res.cloudinary.com/dxmbodsmj/image/upload/v1773990059/champs-closet-logo_o3rtck.png" alt="Champs Closet Logo" className="w-64 md:w-96 lg:w-[32rem] h-auto object-contain mb-8 opacity-90 hover:opacity-100 transition-opacity drop-shadow-sm" referrerPolicy="no-referrer" />
        <p className="text-sm text-on-surface-variant text-center">� 2026 Champs Closet. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
