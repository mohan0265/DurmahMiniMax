import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  MessageCircle, 
  BookOpen, 
  Heart, 
  User, 
  LogOut,
  Menu,
  X 
} from 'lucide-react';

const Layout = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Chat', href: '/chat', icon: MessageCircle },
    { name: 'Study', href: '/study', icon: BookOpen },
    { name: 'Wellbeing', href: '/wellbeing', icon: Heart },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex flex-grow flex-col overflow-y-auto bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-gradient-to-r from-purple-600 to-indigo-600">
            <span className="text-2xl mr-2">🦅</span>
            <span className="text-xl font-bold text-white">Durmah</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md
                    ${isActive(item.href)
                      ? 'bg-purple-100 text-purple-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon
                    className={`
                      mr-3 h-5 w-5
                      ${isActive(item.href)
                        ? 'text-purple-600'
                        : 'text-gray-400 group-hover:text-gray-500'
                      }
                    `}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {user?.user_metadata?.preferred_name || 'Student'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={signOut}
                className="ml-3 text-gray-400 hover:text-gray-500"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center">
              <span className="text-2xl mr-2">🦅</span>
              <span className="text-xl font-bold text-purple-600">Durmah</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-500"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 bg-white pt-16">
            <nav className="px-4 py-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center px-3 py-3 text-base font-medium rounded-md
                      ${isActive(item.href)
                        ? 'bg-purple-100 text-purple-900'
                        : 'text-gray-600'
                      }
                    `}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
              <button
                onClick={signOut}
                className="flex items-center w-full px-3 py-3 text-base font-medium text-red-600 rounded-md hover:bg-red-50"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="md:pl-64">
        <main className="flex-1">
          <div className="py-6 md:py-0 md:pt-0">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
              <div className="py-4 md:py-6">
                <Outlet />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;