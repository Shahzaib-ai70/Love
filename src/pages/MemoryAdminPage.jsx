import { useEffect, useMemo, useState } from "react";
import {
  deleteUserMemory,
  deleteVaultAccount,
  getAdminConfig,
  getVaultAccounts,
  getVaultMemories,
  saveAdminConfig,
} from "../localMemoryVault";
import {
  getCloudAdminUsers,
  getCurrentVaultUser,
  getMemoryStorageMode,
  signInVaultAccount,
  signOutVaultAccount,
} from "../memoryVaultApi";

function LocalMemoryAdminPage() {
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

function CloudMemoryAdminPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [status, setStatus] = useState("");

  const loadCloudUsers = async () => {
    try {
      const result = await getCloudAdminUsers();
      setUsers(result.users || []);
      setIsAuthorized(true);
      setStatus("");
    } catch (error) {
      setUsers([]);
      setIsAuthorized(false);
      setStatus(error instanceof Error ? error.message : "Could not load cloud users.");
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const user = await getCurrentVaultUser();
        setCurrentUser(user);

        if (user) {
          await loadCloudUsers();
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not load the admin session.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSession();
  }, []);

  const handleSignIn = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setStatus("");

    try {
      const user = await signInVaultAccount({ username, password });
      setCurrentUser(user);
      setPassword("");
      await loadCloudUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutVaultAccount();
      setCurrentUser(null);
      setUsers([]);
      setIsAuthorized(false);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign out.");
    }
  };

  return (
    <section className="page-stack section-block">
      <div className="section-heading">
        <p className="section-tag">Cloud admin</p>
        <h2>Memory account users</h2>
        <p className="copy-status">
          Only accounts explicitly authorized in Supabase can view this user list.
        </p>
      </div>

      {isLoading ? (
        <article className="memory-letter-card">
          <p>Loading cloud admin...</p>
        </article>
      ) : !currentUser ? (
        <article className="memory-letter-card">
          <p className="section-tag">Admin sign in</p>
          <h3>Sign in with your memory account</h3>
          <form className="vault-form" onSubmit={handleSignIn}>
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="primary-button" type="submit" disabled={isLoading}>
              Sign in
            </button>
          </form>
          <p className="copy-status">{status}</p>
        </article>
      ) : (
        <>
          <div className="vault-toolbar">
            <div>
              <p className="section-tag">Signed in as</p>
              <h3>{currentUser.displayName || currentUser.username}</h3>
            </div>
            <button className="secondary-button" type="button" onClick={handleSignOut}>
              Log out
            </button>
          </div>

          {status ? <p className="copy-status">{status}</p> : null}

          {isAuthorized ? (
            <>
              <article className="memory-letter-card">
                <p className="section-tag">Accounts</p>
                <h3>{users.length} users</h3>
                <p>Memory totals are shown; private memory contents and passwords are not exposed.</p>
              </article>
              <div className="vault-admin-grid">
                {users.map((user) => (
                  <article className="memory-letter-card" key={user.id}>
                    <p className="section-tag">Memory account</p>
                    <h3>{user.displayName || user.username}</h3>
                    <p>Username: {user.username}</p>
                    <p>Saved memories: {user.memoryCount}</p>
                    <p>Joined: {new Date(user.createdAt).toLocaleDateString()}</p>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

function MemoryAdminPage() {
  return getMemoryStorageMode() === "cloud" ? (
    <CloudMemoryAdminPage />
  ) : (
    <LocalMemoryAdminPage />
  );
}

export default MemoryAdminPage;
