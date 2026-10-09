import { useEffect, useMemo, useState } from "react";
import {
  deleteUserMemory,
  deleteVaultAccount,
  getAdminConfig,
  getVaultAccounts,
  getVaultMemories,
  saveAdminConfig,
} from "../localMemoryVault";

function MemoryAdminPage() {
  const [adminReady, setAdminReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [status, setStatus] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [memories, setMemories] = useState([]);

  const refreshData = () => {
    setAccounts(getVaultAccounts());
    setMemories(getVaultMemories());
  };

  useEffect(() => {
    const config = getAdminConfig();

    if (config?.password) {
      setAdminReady(true);
    }

    refreshData();
  }, []);

  const memoryCountByUser = useMemo(() => {
    return memories.reduce((counts, memory) => {
      counts[memory.userId] = (counts[memory.userId] || 0) + 1;
      return counts;
    }, {});
  }, [memories]);

  const handleCreateAdmin = (event) => {
    event.preventDefault();

    if (adminPassword.trim().length < 4) {
      setStatus("Use an admin password with at least 4 characters.");
      return;
    }

    saveAdminConfig({ password: adminPassword.trim() });
    setAdminReady(true);
    setIsUnlocked(true);
    setAdminPassword("");
    setStatus("Local admin access is ready in this browser.");
  };

  const handleUnlock = (event) => {
    event.preventDefault();
    const config = getAdminConfig();

    if (!config?.password || config.password !== passwordInput.trim()) {
      setStatus("Wrong admin password.");
      return;
    }

    setIsUnlocked(true);
    setPasswordInput("");
    setStatus("Admin panel unlocked.");
  };

  const handleDeleteAccount = (accountId) => {
    deleteVaultAccount(accountId);
    refreshData();
  };

  const handleDeleteMemory = (memoryId) => {
    deleteUserMemory(memoryId);
    refreshData();
  };

  return (
    <section className="page-stack section-block">
      <div className="section-heading">
        <p className="section-tag">Local admin</p>
        <h2>Browser memory admin panel</h2>
        <p className="copy-status">
          This admin page only manages accounts and memories saved in this browser.
        </p>
      </div>

      {!adminReady ? (
        <article className="memory-letter-card">
          <p className="section-tag">Create admin access</p>
          <h3>Set local admin password</h3>
          <form className="vault-form" onSubmit={handleCreateAdmin}>
            <label>
              Admin password
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="Create admin password"
              />
            </label>
            <button className="primary-button" type="submit">
              Save Admin Password
            </button>
          </form>
          <p className="copy-status">{status || "Create one password to unlock admin tools."}</p>
        </article>
      ) : !isUnlocked ? (
        <article className="memory-letter-card">
          <p className="section-tag">Admin login</p>
          <h3>Unlock local admin panel</h3>
          <form className="vault-form" onSubmit={handleUnlock}>
            <label>
              Admin password
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="Enter admin password"
              />
            </label>
            <button className="primary-button" type="submit">
              Unlock Admin
            </button>
          </form>
          <p className="copy-status">{status || "Only the browser admin password can open this page."}</p>
        </article>
      ) : (
        <>
          <div className="vault-admin-grid">
            <article className="memory-letter-card">
              <p className="section-tag">Accounts</p>
              <h3>{accounts.length} local users</h3>
              <p>All of these users exist only in this browser storage.</p>
            </article>

            <article className="memory-letter-card">
              <p className="section-tag">Memories</p>
              <h3>{memories.length} saved items</h3>
              <p>Messages, photos, and videos stored by local users.</p>
            </article>
          </div>

          <div className="vault-admin-grid">
            {accounts.map((account) => (
              <article className="memory-letter-card" key={account.id}>
                <p className="section-tag">User account</p>
                <h3>{account.displayName || account.username}</h3>
                <p>Username: {account.username}</p>
                <p>Saved memories: {memoryCountByUser[account.id] || 0}</p>
                <button type="button" onClick={() => handleDeleteAccount(account.id)}>
                  Delete User
                </button>
              </article>
            ))}
          </div>

          <div className="vault-memory-grid">
            {memories.map((memory) => (
              <article className="gallery-card vault-memory-card" key={memory.id}>
                {memory.mediaData ? (
                  memory.mediaType === "video" ? (
                    <video controls src={memory.mediaData} />
                  ) : (
                    <img src={memory.mediaData} alt={memory.title} loading="lazy" />
                  )
                ) : null}

                <div className="gallery-copy">
                  <p className="section-tag">{memory.userId}</p>
                  <h3>{memory.title}</h3>
                  <p>{memory.text || "Media memory"}</p>
                  <button type="button" onClick={() => handleDeleteMemory(memory.id)}>
                    Delete Entry
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default MemoryAdminPage;
