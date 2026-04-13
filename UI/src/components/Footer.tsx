import { Link, useNavigate } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-surface-container-low pt-20 pb-10 px-6 mt-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="col-span-1 md:col-span-2">
          <h2 className="font-headline font-bold text-2xl mb-5">CHAMPS CLOSET.</h2>
          <p className="text-on-surface-variant max-w-sm mb-6">
            Premium men's essentials delivered across Nairobi. Quality guaranteed, every single time.
          </p>
          <p className="text-sm text-on-surface-variant">Need help? Visit our FAQ for delivery, payment, and sizing guidance.</p>
        </div>
        <div>
          <h4 className="font-medium mb-5">Shop</h4>
          <ul className="space-y-3 text-on-surface-variant text-sm">
            <li><button onClick={() => navigate('/catalog/all')} className="hover:text-primary">All Products</button></li>
            <li><button className="hover:text-primary" onClick={() => navigate('/catalog/shirts')}>Shirts</button></li>
            <li><button className="hover:text-primary" onClick={() => navigate('/catalog/shoes')}>Shoes</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-5">Support</h4>
          <ul className="space-y-3 text-on-surface-variant text-sm">
            <li><Link className="hover:text-primary" to="/faq">FAQ</Link></li>
            <li><button className="hover:text-primary" onClick={() => navigate('/checkout')}>Delivery & Payment</button></li>
            <li>
              <Link to="/admin/login" className="hover:text-primary">Admin Login</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-outline-variant/20 flex flex-col items-center">
        <p className="text-sm text-on-surface-variant text-center">2026 Champs Closet. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
