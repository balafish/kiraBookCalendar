interface Props {
  loading: boolean;
  login: () => void;
}

export default function AuthGate({ loading, login }: Props) {
  if (loading) {
    return (
      <div className="rc-root">
        <div className="rc-login-screen">
          <div className="rc-login-loading">載入中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rc-root">
      <div className="rc-login-screen">
        <h1 className="rc-login-title">{"📚 Kira 愛讀冊"}</h1>
        <p className="rc-login-subtitle">{"每日一書 · track your daily reads"}</p>
        <button className="rc-login-btn" onClick={login}>
          Google 帳號登入
        </button>
        <p className="rc-login-hint">登入後即可使用所有功能並同步資料</p>
      </div>
    </div>
  );
}
