import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createPartnerInvite,
  getCurrentVaultUser,
  getPartnerChat,
  respondToPartnerInvite,
  sendPartnerMessage,
} from "../memoryVaultApi";

const emptyChat = {
  partner: null,
  receivedInvites: [],
  sentInvites: [],
  messages: [],
};

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function PartnerChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [chat, setChat] = useState(emptyChat);
  const [chatUsername, setChatUsername] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      try {
        const user = await getCurrentVaultUser();
        if (active) {
          setCurrentUser(user);
        }
      } catch (error) {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Could not load your account.");
        }
      } finally {
        if (active) {
          setIsLoadingUser(false);
        }
      }
    };

    void loadCurrentUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setChat(emptyChat);
      return undefined;
    }

    let active = true;
    const refreshChat = async () => {
      try {
        const result = await getPartnerChat();
        if (active) {
          setChat(result);
          setStatus("");
        }
      } catch (error) {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Could not load partner chat.");
        }
      } finally {
        if (active) {
          setIsLoadingChat(false);
        }
      }
    };

    setIsLoadingChat(true);
    void refreshChat();
    const timer = window.setInterval(() => {
      void refreshChat();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser]);

  const refreshChat = async () => {
    try {
      setChat(await getPartnerChat());
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh partner chat.");
    }
  };

  const handleCreateInvite = async (event) => {
    event.preventDefault();
    setIsActionPending(true);
    setStatus("");

    try {
      await createPartnerInvite(chatUsername.trim());
      setChatUsername("");
      setStatus("Invitation sent. Chat will open when they accept.");
      await refreshChat();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send invitation.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleInviteResponse = async (inviteId, response) => {
    setIsActionPending(true);
    setStatus("");

    try {
      await respondToPartnerInvite(inviteId, response);
      await refreshChat();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update invitation.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!chatMessage.trim()) {
      return;
    }

    setIsActionPending(true);
    setStatus("");

    try {
      await sendPartnerMessage(chatMessage);
      setChatMessage("");
      await refreshChat();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setIsActionPending(false);
    }
  };

  return (
    <section className="page-stack section-block">
      <div className="section-heading">
        <p className="section-tag">Partner chat</p>
        <h2>
          {chat.partner
            ? `Chat with ${chat.partner.displayName || chat.partner.username}`
            : "Connect with your partner"}
        </h2>
        <p className="copy-status">
          Send a username invitation, accept your partner’s invite, and chat privately.
        </p>
      </div>

      <article className="memory-letter-card partner-chat-card">
        {isLoadingUser || isLoadingChat ? <p>Loading partner chat...</p> : null}

        {currentUser ? (
          <p className="copy-status">
            Using your Memories account: @{currentUser.username}. Chat needs no separate account.
          </p>
        ) : null}

        {!isLoadingUser && !currentUser ? (
          <p>
            Create or sign in to a memory account to connect with your partner.{" "}
            <Link to="/memories">Go to Memories</Link>
          </p>
        ) : null}

        {currentUser && !chat.partner ? (
          <>
            <p>
              Share usernames and send an invitation. Chat becomes available after the other person
              accepts.
            </p>
            <form className="vault-form partner-invite-form" onSubmit={handleCreateInvite}>
              <label>
                Partner username
                <input
                  type="text"
                  value={chatUsername}
                  required
                  onChange={(event) => setChatUsername(event.target.value)}
                  placeholder="Enter their username"
                />
              </label>
              <button className="primary-button" type="submit" disabled={isActionPending}>
                Send chat invitation
              </button>
            </form>

            {chat.receivedInvites.length ? (
              <div className="partner-invite-list">
                <h4>Invitations for you</h4>
                {chat.receivedInvites.map((invite) => (
                  <div className="partner-invite-row" key={invite.id}>
                    <p>
                      <strong>{invite.displayName || invite.username}</strong> (@{invite.username})
                      {" "}wants to chat.
                    </p>
                    <div>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={isActionPending}
                        onClick={() => handleInviteResponse(invite.id, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={isActionPending}
                        onClick={() => handleInviteResponse(invite.id, "decline")}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {chat.sentInvites.length ? (
              <div className="partner-invite-list">
                <h4>Waiting for a response</h4>
                {chat.sentInvites.map((invite) => (
                  <p key={invite.id}>
                    Invitation sent to {invite.displayName || invite.username} (@{invite.username}).
                  </p>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {currentUser && chat.partner ? (
          <>
            <div className="partner-chat-messages" aria-live="polite">
              {chat.messages.length ? (
                chat.messages.map((message) => (
                  <article
                    className={`partner-chat-message ${
                      message.senderId === currentUser.id ? "is-mine" : ""
                    }`}
                    key={message.id}
                  >
                    <p>{message.text}</p>
                    <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                  </article>
                ))
              ) : (
                <p>No messages yet. Send your first hello.</p>
              )}
            </div>
            <form className="vault-form partner-message-form" onSubmit={handleSendMessage}>
              <label>
                Message
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={chatMessage}
                  onChange={(event) => setChatMessage(event.target.value)}
                  placeholder="Write a message..."
                  required
                />
              </label>
              <button className="primary-button" type="submit" disabled={isActionPending}>
                Send message
              </button>
            </form>
          </>
        ) : null}

        {status ? <p className="copy-status" role="status">{status}</p> : null}
      </article>
    </section>
  );
}

export default PartnerChatPage;
