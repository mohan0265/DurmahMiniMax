import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, logout } = useAuth() || {};
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Profile</h1>
      <div className="space-y-2">
        <div><b>Name:</b> {user?.name || 'Guest'}</div>
        <div><b>Email:</b> {user?.email || 'guest@local'}</div>
        <button className="px-4 py-2 rounded bg-black text-white" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
};

export default Profile;
