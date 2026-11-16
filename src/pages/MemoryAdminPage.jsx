import { useEffect, useState } from "react";
import {
  getCurrentAdminAccount,
  getCloudAdminUserDetails,
  getCloudAdminUsers,
  signInAdminAccount,
  signOutAdminAccount,
} from "../memoryVaultApi";

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function MemoryAdminPage() {
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
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
      setSelectedDetails(null);
      setIsAuthorized(false);
      setStatus(error instanceof Error ? error.message : "Could not load users.");
    }
  };

  const handleViewDetails = async (userId) => {
    setIsLoadingDetails(true);
    setStatus("");

    try {
      setSelectedDetails(await getCloudAdminUserDetails(userId));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load private account details.");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const admin = await getCurrentAdminAccount();
        setCurrentAdmin(admin);

        if (admin) {
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
      const admin = await signInAdminAccount({ username, password });
      setCurrentAdmin(admin);
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
      await signOutAdminAccount();
      setCurrentAdmin(null);
      setUsers([]);
      setSelectedDetails(null);
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
          Sign in with the separate admin username and password configured on the server.
          Memory account credentials are not used for admin access.
        </p>
      </div>

      {isLoading ? (
        <article className="memory-letter-card">
          <p>Loading admin panel...</p>
        </article>
      ) : !currentAdmin ? (
        <article className="memory-letter-card">
          <p className="section-tag">Admin sign in</p>
          <h3>Sign in to your separate admin account</h3>
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
              <h3>{currentAdmin.username}</h3>
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
                <p>
                  Admin access includes private memory text, attachments, and partner chat
                  messages. Passwords and session credentials are never exposed.
                </p>
              </article>
              <div className="vault-admin-grid">
                {users.map((user) => (
                  <article className="memory-letter-card" key={user.id}>
                    <p className="section-tag">Memory account</p>
                    <h3>{user.displayName || user.username}</h3>
                    <p>Username: {user.username}</p>
                    <p>Saved memories: {user.memoryCount}</p>
                    <p>Chat messages: {user.messageCount}</p>
                    <p>Partners: {user.partnerUsernames || "None"}</p>
                    <p>Joined: {formatDate(user.createdAt)}</p>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isLoadingDetails}
                      onClick={() => handleViewDetails(user.id)}
                    >
                      View private details
                    </button>
                  </article>
                ))}
              </div>
              {isLoadingDetails ? (
                <article className="memory-letter-card">
                  <p>Loading private account details...</p>
                </article>
              ) : null}
              {selectedDetails ? (
                <>
                  <article className="memory-letter-card admin-private-notice">
                    <p className="section-tag">Private account details</p>
                    <h3>
                      {selectedDetails.user.displayName || selectedDetails.user.username} (@
                      {selectedDetails.user.username})
                    </h3>
                    <p>Account ID: {selectedDetails.user.id}</p>
                    <p>
                      Account created {formatDate(selectedDetails.user.createdAt)}.
                      {selectedDetails.partners.length
                        ? ` Partners: ${selectedDetails.partners.map((partner) => `@${partner.username}`).join(", ")}.`
                        : " This account has no connected partners."}
                    </p>
                  </article>

                  <section className="admin-content-section">
                    <div className="section-heading">
                      <p className="section-tag">Saved content</p>
                      <h2>{selectedDetails.memories.length} memories</h2>
                    </div>
                    {selectedDetails.memories.length ? (
                      <div className="vault-memory-grid">
                        {selectedDetails.memories.map((memory) => (
                          <article className="gallery-card vault-memory-card" key={memory.id}>
                            {memory.mediaData ? (
                              memory.mediaType === "video" ? (
                                <video controls src={memory.mediaData} />
                              ) : (
                                <img src={memory.mediaData} alt={memory.title} loading="lazy" />
                              )
                            ) : memory.mediaUrl ? (
                              memory.mediaType === "video" ? (
                                <video controls src={memory.mediaUrl} />
                              ) : (
                                <img src={memory.mediaUrl} alt={memory.title} loading="lazy" />
                              )
                            ) : null}
                            <div className="gallery-copy">
                              <p className="section-tag">{formatDate(memory.createdAt)}</p>
                              <h3>{memory.title}</h3>
                              <p>{memory.text || "Media-only memory saved."}</p>
                              {memory.mediaFileName ? <p>File: {memory.mediaFileName}</p> : null}
                              {memory.mediaUrl ? (
                                <a href={memory.mediaUrl} target="_blank" rel="noreferrer">
                                  Open media link
                                </a>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <article className="memory-letter-card"><p>No saved memories.</p></article>
                    )}
                  </section>

                  <section className="admin-content-section">
                    <div className="section-heading">
                      <p className="section-tag">Partner invitations</p>
                      <h2>{selectedDetails.invites.length} invitations</h2>
                    </div>
                    {selectedDetails.invites.length ? (
                      <div className="vault-admin-grid">
                        {selectedDetails.invites.map((invite) => (
                          <article className="memory-letter-card" key={invite.id}>
                            <p>
                              @{invite.senderUsername} invited @{invite.recipientUsername}
                            </p>
                            <p>Status: {invite.status}</p>
                            <p>Created: {formatDate(invite.createdAt)}</p>
                            <p>Updated: {formatDate(invite.updatedAt)}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <article className="memory-letter-card"><p>No partner invitations.</p></article>
                    )}
                  </section>

                  <section className="admin-content-section">
                    <div className="section-heading">
                      <p className="section-tag">Partner conversation</p>
                      <h2>{selectedDetails.messages.length} messages</h2>
                    </div>
                    {selectedDetails.messages.length ? (
                      <div className="partner-chat-messages admin-chat-messages">
                        {selectedDetails.messages.map((message) => (
                          <article className="partner-chat-message" key={message.id}>
                            <strong>@{message.senderUsername}</strong>
                            <p>{message.text}</p>
                            <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <article className="memory-letter-card"><p>No partner chat messages.</p></article>
                    )}
                  </section>
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

export default MemoryAdminPage;
