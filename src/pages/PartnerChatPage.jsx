import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createPartnerInvite,
  getCurrentVaultUser,
  getPartnerChat,
  respondToPartnerInvite,
  searchChatUsers,
  sendPartnerMessage,
} from "../memoryVaultApi";

const emptyChat = {
  partners: [],
  partner: null,
  receivedInvites: [],
  sentInvites: [],
  messages: [],
};

const chatEmojis = ["❤️", "🥰", "😍", "😘", "😊", "😂", "😭", "🫶", "💕", "🌹"];
const chatMediaTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/ogg",
]);
const maxChatMediaSize = 15 * 1024 * 1024;

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function PartnerChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [chat, setChat] = useState(emptyChat);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [usernameQuery, setUsernameQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMedia, setChatMedia] = useState(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const messageInputRef = useRef(null);
  const mediaInputRef = useRef(null);

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
    const refresh = async () => {
      try {
        const result = await getPartnerChat(selectedPartnerId || undefined);
        if (active) {
          setChat(result);
          if (!selectedPartnerId && result.partner) {
            setSelectedPartnerId(result.partner.id);
          }
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
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser, selectedPartnerId]);

  const refreshChat = async (partnerId = selectedPartnerId) => {
    try {
      const result = await getPartnerChat(partnerId || undefined);
      setChat(result);
      if (!partnerId && result.partner) {
        setSelectedPartnerId(result.partner.id);
      }
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh partner chat.");
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setSearchStatus("");
    setSearchResults([]);
    setIsSearching(true);

    try {
      const { users } = await searchChatUsers(usernameQuery.trim());
      setSearchResults(users);
      setSearchStatus(users.length ? "" : "No users found. Check the username and try again.");
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : "Could not search usernames.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleInvite = async (username) => {
    setIsActionPending(true);
    setSearchStatus("");

    try {
      await createPartnerInvite(username);
      await refreshChat();
      setSearchResults((currentResults) =>
        currentResults.map((user) =>
          user.username === username ? { ...user, hasPendingInvite: 1 } : user
        )
      );
      setSearchStatus(`Invitation sent to @${username}.`);
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : "Could not send invitation.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleInviteResponse = async (inviteId, response, partnerId) => {
    setIsActionPending(true);
    setStatus("");

    try {
      await respondToPartnerInvite(inviteId, response);
      await refreshChat(response === "accept" ? partnerId : selectedPartnerId);
      if (response === "accept") {
        setSelectedPartnerId(partnerId);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update invitation.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if ((!chatMessage.trim() && !chatMedia) || !chat.partner) {
      return;
    }

    setIsActionPending(true);
    setStatus("");

    try {
      await sendPartnerMessage(chat.partner.id, {
        text: chatMessage,
        mediaData: chatMedia?.data || "",
        mediaFileName: chatMedia?.fileName || "",
        mediaType: chatMedia?.type || "text",
      });
      setChatMessage("");
      setChatMedia(null);
      setIsEmojiPickerOpen(false);
      await refreshChat(chat.partner.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setIsActionPending(false);
    }
  };

  const attachChatMedia = async (file) => {
    if (!chatMediaTypes.has(file.type)) {
      setStatus("Choose a PNG, JPEG, WebP, GIF, MP4, WebM, or OGG file.");
      return;
    }

    if (file.size > maxChatMediaSize) {
      setStatus("Keep chat attachments under 15 MB.");
      return;
    }

    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read the selected attachment."));
        reader.readAsDataURL(file);
      });
      setChatMedia({
        data,
        fileName: file.name || "chat-attachment",
        type: file.type.startsWith("video/") ? "video" : "image",
      });
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read the attachment.");
    }
  };

  const handleMediaChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      void attachChatMedia(file);
    }
    event.target.value = "";
  };

  const handlePasteMessage = (event) => {
    const mediaItem = Array.from(event.clipboardData?.items || []).find(
      (item) => item.kind === "file" && chatMediaTypes.has(item.type)
    );
    const file = mediaItem?.getAsFile();

    if (file) {
      event.preventDefault();
      void attachChatMedia(file);
    }
  };

  const insertEmoji = (emoji) => {
    const input = messageInputRef.current;
    const cursor = input?.selectionStart ?? chatMessage.length;
    const nextMessage = `${chatMessage.slice(0, cursor)}${emoji}${chatMessage.slice(cursor)}`;
    setChatMessage(nextMessage);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(cursor + emoji.length, cursor + emoji.length);
    });
  };

  const handleCopyMessage = async (text) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Copy is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(text);
      setStatus("Message copied.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not copy the message.");
    }
  };

  return (
    <section className="page-stack section-block">
      <div className="section-heading">
        <p className="section-tag">Partner chat</p>
        <h2>{chat.partner ? `Chat with ${chat.partner.displayName || chat.partner.username}` : "Your chats"}</h2>
        <p className="copy-status">
          Search by username and add chats with as many partners as you need.
        </p>
      </div>

      <article className="memory-letter-card partner-chat-card">
        {isLoadingUser || isLoadingChat ? <p>Loading chats...</p> : null}

        {currentUser ? (
          <p className="chat-account-note">
            Using your Memories account: <strong>@{currentUser.username}</strong>. No separate
            account is needed.
          </p>
        ) : null}

        {!isLoadingUser && !currentUser ? (
          <p>
            Sign in to your Memories account to use chat. <Link to="/memories">Go to Memories</Link>
          </p>
        ) : null}

        {currentUser ? (
          <>
            <section className="chat-search-section" aria-label="Find and add chat partners">
              <h3>Find people</h3>
              <form className="vault-form chat-search-form" onSubmit={handleSearch}>
                <label>
                  Search username
                  <input
                    type="search"
                    value={usernameQuery}
                    minLength={2}
                    maxLength={32}
                    onChange={(event) => setUsernameQuery(event.target.value)}
                    placeholder="Type at least 2 username characters"
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={isSearching}>
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </form>

              {searchResults.length ? (
                <div className="chat-search-results">
                  {searchResults.map((user) => {
                    const connected = Boolean(user.isPartner);
                    const pending = Boolean(user.hasPendingInvite);
                    return (
                      <article className="chat-search-result" key={user.userId}>
                        <div>
                          <strong>{user.displayName || user.username}</strong>
                          <span>@{user.username}</span>
                        </div>
                        {connected ? (
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => setSelectedPartnerId(user.userId)}
                          >
                            Open chat
                          </button>
                        ) : (
                          <button
                            className="primary-button"
                            type="button"
                            disabled={pending || isActionPending}
                            onClick={() => void handleInvite(user.username)}
                          >
                            {pending ? "Invitation pending" : "Add chat"}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : null}
              {searchStatus ? <p className="copy-status" role="status">{searchStatus}</p> : null}
            </section>

            {chat.receivedInvites.length || chat.sentInvites.length ? (
              <section className="partner-invite-list" aria-label="Chat invitations">
                {chat.receivedInvites.length ? (
                  <>
                    <h3>Invitations for you</h3>
                    {chat.receivedInvites.map((invite) => (
                      <div className="partner-invite-row chat-invite-card" key={invite.id}>
                        <p>
                          <strong>{invite.displayName || invite.username}</strong> (@{invite.username})
                          {" "}wants to chat.
                        </p>
                        <div>
                          <button
                            className="primary-button"
                            type="button"
                            disabled={isActionPending}
                            onClick={() =>
                              void handleInviteResponse(invite.id, "accept", invite.userId)
                            }
                          >
                            Accept
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={isActionPending}
                            onClick={() =>
                              void handleInviteResponse(invite.id, "decline", invite.userId)
                            }
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}
                {chat.sentInvites.length ? (
                  <>
                    <h3>Waiting for a response</h3>
                    {chat.sentInvites.map((invite) => (
                      <p key={invite.id}>
                        Invitation sent to {invite.displayName || invite.username} (@
                        {invite.username}).
                      </p>
                    ))}
                  </>
                ) : null}
              </section>
            ) : null}

            <div className="chat-workspace">
              <aside className="chat-partner-list" aria-label="Your chats">
                <h3>Your chats ({chat.partners.length})</h3>
                {chat.partners.length ? (
                  chat.partners.map((partner) => (
                    <button
                      className={`chat-partner-button ${
                        chat.partner?.id === partner.id ? "is-selected" : ""
                      }`}
                      type="button"
                      key={partner.id}
                      aria-pressed={chat.partner?.id === partner.id}
                      onClick={() => setSelectedPartnerId(partner.id)}
                    >
                      <strong>{partner.displayName || partner.username}</strong>
                      <span>@{partner.username}</span>
                    </button>
                  ))
                ) : (
                  <p>No chats yet. Search for a username to add one.</p>
                )}
              </aside>

              <section className="chat-conversation" aria-label="Conversation">
                {chat.partner ? (
                  <>
                    <h3>{chat.partner.displayName || chat.partner.username}</h3>
                    <div className="partner-chat-messages" aria-live="polite">
                      {chat.messages.length ? (
                        chat.messages.map((message) => (
                          <article
                            className={`partner-chat-message ${
                              message.senderId === currentUser.id ? "is-mine" : ""
                            }`}
                            key={message.id}
                          >
                            {message.mediaUrl ? (
                              message.mediaType === "video" ? (
                                <video
                                  className="partner-chat-media"
                                  controls
                                  preload="metadata"
                                  src={message.mediaUrl}
                                >
                                  Your browser cannot play this video.
                                </video>
                              ) : (
                                <img
                                  className="partner-chat-media"
                                  src={message.mediaUrl}
                                  alt={message.mediaFileName || "Image shared in chat"}
                                  loading="lazy"
                                />
                              )
                            ) : null}
                            {message.text ? <p>{message.text}</p> : null}
                            {message.text ? (
                              <button
                                className="chat-copy-button"
                                type="button"
                                onClick={() => void handleCopyMessage(message.text)}
                              >
                                Copy
                              </button>
                            ) : null}
                            <time dateTime={message.createdAt}>
                              {formatDate(message.createdAt)}
                            </time>
                          </article>
                        ))
                      ) : (
                        <p>No messages yet. Send your first hello.</p>
                      )}
                    </div>
                    <form className="vault-form partner-message-form" onSubmit={handleSendMessage}>
                      <div className="chat-composer">
                        {isEmojiPickerOpen ? (
                          <div className="chat-emoji-picker" role="group" aria-label="Choose an emoji">
                            {chatEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => insertEmoji(emoji)}
                                aria-label={`Insert ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {chatMedia ? (
                          <div className="chat-attachment-preview">
                            {chatMedia.type === "video" ? (
                              <video src={chatMedia.data} muted preload="metadata" />
                            ) : (
                              <img src={chatMedia.data} alt="Attachment preview" />
                            )}
                            <span>
                              {chatMedia.type === "video" ? "Video ready" : "Image ready"}:{" "}
                              {chatMedia.fileName}
                            </span>
                            <button
                              type="button"
                              className="chat-copy-button"
                              onClick={() => setChatMedia(null)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                        <div className="chat-input-bar">
                          <button
                            className="chat-input-icon"
                            type="button"
                            aria-label="Choose an emoji"
                            aria-expanded={isEmojiPickerOpen}
                            onClick={() => setIsEmojiPickerOpen((open) => !open)}
                          >
                            😊
                          </button>
                          <textarea
                            ref={messageInputRef}
                            rows={2}
                            maxLength={5000}
                            value={chatMessage}
                            onChange={(event) => setChatMessage(event.target.value)}
                            onPaste={handlePasteMessage}
                            placeholder={`Message @${chat.partner.username}...`}
                            aria-label="Message"
                          />
                          <button
                            className="chat-input-icon"
                            type="button"
                            onClick={() => mediaInputRef.current?.click()}
                            aria-label="Attach an image or video"
                            title="Attach an image or video"
                          >
                            📎
                          </button>
                          <input
                            ref={mediaInputRef}
                            className="chat-media-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg"
                            onChange={handleMediaChange}
                            aria-label="Choose an image or video to send"
                          />
                          <button
                            className="primary-button chat-send-button"
                            type="submit"
                            disabled={isActionPending || (!chatMessage.trim() && !chatMedia)}
                            aria-label={isActionPending ? "Sending message" : "Send message"}
                            title={isActionPending ? "Sending..." : "Send message"}
                          >
                            {isActionPending ? "…" : "➤"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </>
                ) : (
                  <p>Select a chat or search for a username to start one.</p>
                )}
              </section>
            </div>
          </>
        ) : null}

        {status ? <p className="copy-status" role="status">{status}</p> : null}
      </article>
    </section>
  );
}

export default PartnerChatPage;
