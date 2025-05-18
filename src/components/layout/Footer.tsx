import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-gray-100 dark:bg-[#181a1b] text-gray-600 dark:text-gray-300 py-8 border-t border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-gray-100">ECG Outage Management System</h3>
            <p className="text-sm">
              A comprehensive fault management system for the Electricity Company of Ghana,
              streamlining fault reporting and resolution across the nation.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-gray-100">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:text-ecg-blue dark:hover:text-ecg-gold transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-ecg-blue dark:hover:text-ecg-gold transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/report-fault" className="hover:text-ecg-blue dark:hover:text-ecg-gold transition-colors">
                  Report Fault
                </Link>
              </li>
              <li>
                <Link to="/analytics" className="hover:text-ecg-blue dark:hover:text-ecg-gold transition-colors">
                  Analytics
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-gray-100">Contact</h3>
            <address className="not-italic text-sm space-y-2">
              <p>Electricity Company of Ghana</p>
              <p>P.O. Box 521, Accra</p>
              <p>Ghana, West Africa</p>
              <p className="pt-2">
                <a href="mailto:info@ecgoperations.com" className="hover:text-ecg-blue dark:hover:text-ecg-gold transition-colors">
                  info@ecgoperations.com
                </a>
              </p>
              <p>
                <a href="tel:+233302611611" className="hover:text-ecg-blue dark:hover:text-ecg-gold transition-colors">
                  +233 302 611 611
                </a>
              </p>
            </address>
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-4 text-center text-sm">
          <p>© {new Date().getFullYear()} Electricity Company of Ghana. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
