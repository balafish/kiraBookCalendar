interface Props {
  user: { photoURL: string | null; displayName: string | null };
  logout: () => void;
}

export default function AuthBar({ user, logout }: Props) {
  return (
    <div className="rc-auth-bar">
      <img
        src={user.photoURL || undefined}
        alt=""
        className="rc-avatar"
        referrerPolicy="no-referrer"
      />
      <span className="rc-auth-name">{user.displayName}</span>
      <button className="rc-auth-btn" onClick={logout}>
        登出
      </button>
    </div>
  );
}
