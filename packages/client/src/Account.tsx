import { type ReactElement } from 'react';
import { useAuth } from './auth';

export function Account(): ReactElement {
  const user = useAuth((s) => s.user);
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);

  if (user) {
    return (
      <div className="account">
        {user.picture && <img className="avatar" src={user.picture} alt="" />}
        <span className="accountName">{user.name}</span>
        <button className="btn sm ghost" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }
  return (
    <div className="account">
      <div className="muted">Sign in to save squads across devices.</div>
      <div className="grid">
        <button className="btn sm" onClick={() => login('google')}>
          Sign in with Google
        </button>
        <button className="btn sm" onClick={() => login('discord')}>
          Sign in with Discord
        </button>
      </div>
    </div>
  );
}
