import { useEffect, useMemo, useState } from "react";
import {
  createVaultAccount,
  deleteUserMemory,
  getCurrentVaultUser,
  getUserMemories,
  saveUserMemory,
  signInVaultAccount,
  signOutVaultAccount,
} from "../localMemoryVault";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function formatDate(dateString) {
  try {
    return new Date(dateString).toLocaleString();
  } catch (error) {
    return dateString;
  }
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg)$/i.test(url);
}

function MemoriesPage() {
  const [mode, setMode] = useState("signin");
  const [currentUser, setCurrentUser] = useState(null);
  const [memories, setMemories] = useState([]);
  const [authError, setAuthError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [signInForm, setSignInForm] = useState({ username: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({
    displayName: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [memoryForm, setMemoryForm] = useState({
    title: "",
    text: "",
    mediaUrl: "",
    mediaFileName: "",
    mediaType: "text",
    mediaData: "",
  });

  const loadCurrentUser = () => {
    const user = getCurrentVaultUser();
    setCurrentUser(user);
    setMemories(user ? getUserMemories(user.id) : []);
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const memoryCountLabel = useMemo(() => {
    if (!currentUser) {
      return "Create a private account or sign in to open your memories.";
    }

    return `${memories.length} private memories saved for ${currentUser.displayName || currentUser.username}.`;
  }, [currentUser, memories.length]);

  const handleSignIn = (event) => {
    event.preventDefault();
    setAuthError("");

    try {
      signInVaultAccount(signInForm);
      setSignInForm({ username: "", password: "" });
      loadCurrentUser();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign in.");
    }
  };

  const handleSignUp = (event) => {
    event.preventDefault();
    setAuthError("");

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    if (signUpForm.password.length < 4) {
      setAuthError("Use a password with at least 4 characters.");
      return;
    }

    try {
      createVaultAccount(signUpForm);
      setSignUpForm({
        displayName: "",
        username: "",
        password: "",
        confirmPassword: "",
      });
      loadCurrentUser();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not create account.");
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      setSaveError("For browser local storage, keep files under 2.5 MB.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const detectedType = file.type.startsWith("video/") ? "video" : "image";

      setSaveError("");
      setMemoryForm((currentForm) => ({
        ...currentForm,
        mediaData: dataUrl,
        mediaType: detectedType,
        mediaFileName: file.name,
      }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save selected file.");
    }
  };

  const handleSaveMemory = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setSaveError("Sign in first to save a private memory.");
      return;
    }

    if (!memoryForm.title.trim()) {
      setSaveError("Add a title for this memory.");
      return;
    }

    if (
      !memoryForm.text.trim() &&
      !memoryForm.mediaUrl.trim() &&
      !memoryForm.mediaData.trim()
    ) {
      setSaveError("Add text, upload a file, or paste a media URL.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const memoryType =
        memoryForm.mediaData || memoryForm.mediaUrl
          ? memoryForm.mediaType
          : "text";

      saveUserMemory({
        userId: currentUser.id,
        title: memoryForm.title.trim(),
        text: memoryForm.text.trim(),
        mediaUrl: memoryForm.mediaUrl.trim(),
        mediaData: memoryForm.mediaData,
        mediaFileName: memoryForm.mediaFileName,
        mediaType: memoryType,
      });

      setMemoryForm({
        title: "",
        text: "",
        mediaUrl: "",
        mediaFileName: "",
        mediaType: "text",
        mediaData: "",
      });
      setSaveSuccess("Memory saved in this browser vault.");
      loadCurrentUser();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this memory.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMemory = (memoryId) => {
    deleteUserMemory(memoryId);
    loadCurrentUser();
  };

  const handleLogout = () => {
    signOutVaultAccount();
    setSaveSuccess("");
    setSaveError("");
    loadCurrentUser();
  };

  return (
    <section className="page-stack section-block">
      <div className="section-heading">
        <p className="section-tag">Private memories</p>
        <h2>Save your own memory vault</h2>
        <p className="copy-status">
          {memoryCountLabel} This version is browser-local, so each browser keeps its
          own accounts, passwords, and memories.
        </p>
      </div>

      {!currentUser ? (
        <div className="vault-auth-layout">
          <article className="vault-auth-card">
            <div className="vault-switcher">
              <button
                className={mode === "signin" ? "is-active" : ""}
                type="button"
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                className={mode === "signup" ? "is-active" : ""}
                type="button"
                onClick={() => setMode("signup")}
              >
                Create account
              </button>
            </div>

            {mode === "signin" ? (
              <form className="vault-form" onSubmit={handleSignIn}>
                <label>
                  Username
                  <input
                    type="text"
                    value={signInForm.username}
                    onChange={(event) =>
                      setSignInForm((currentForm) => ({
                        ...currentForm,
                        username: event.target.value,
                      }))
                    }
                    placeholder="Enter your username"
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    value={signInForm.password}
                    onChange={(event) =>
                      setSignInForm((currentForm) => ({
                        ...currentForm,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Enter your password"
                  />
                </label>

                <button className="primary-button" type="submit">
                  Open Memories
                </button>
              </form>
            ) : (
              <form className="vault-form" onSubmit={handleSignUp}>
                <label>
                  Display name
                  <input
                    type="text"
                    value={signUpForm.displayName}
                    onChange={(event) =>
                      setSignUpForm((currentForm) => ({
                        ...currentForm,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Khadija and Shahzaib"
                  />
                </label>

                <label>
                  Username
                  <input
                    type="text"
                    value={signUpForm.username}
                    onChange={(event) =>
                      setSignUpForm((currentForm) => ({
                        ...currentForm,
                        username: event.target.value,
                      }))
                    }
                    placeholder="Create a username"
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    value={signUpForm.password}
                    onChange={(event) =>
                      setSignUpForm((currentForm) => ({
                        ...currentForm,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Create a password"
                  />
                </label>

                <label>
                  Confirm password
                  <input
                    type="password"
                    value={signUpForm.confirmPassword}
                    onChange={(event) =>
                      setSignUpForm((currentForm) => ({
                        ...currentForm,
                        confirmPassword: event.target.value,
                      }))
                    }
                    placeholder="Write the same password again"
                  />
                </label>

                <button className="primary-button" type="submit">
                  Create Memory Account
                </button>
              </form>
            )}

            <p className="copy-status">{authError || "Each browser keeps its own private memory login."}</p>
          </article>

          <article className="memory-letter-card">
            <p className="section-tag">How it works</p>
            <h3>Private vault access</h3>
            <p>
              When someone opens the Memories page, they first create an account or
              sign in with a password. After that, they can save text messages,
              images, and short videos in their own private browser vault.
            </p>
          </article>
        </div>
      ) : (
        <>
          <div className="vault-toolbar">
            <div>
              <p className="section-tag">Logged in</p>
              <h3>{currentUser.displayName || currentUser.username}</h3>
            </div>

            <button className="secondary-button" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>

          <article className="memory-letter-card">
            <p className="section-tag">Add new memory</p>
            <h3>Upload or paste your memories</h3>

            <form className="vault-form" onSubmit={handleSaveMemory}>
              <label>
                Memory title
                <input
                  type="text"
                  value={memoryForm.title}
                  onChange={(event) =>
                    setMemoryForm((currentForm) => ({
                      ...currentForm,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Our first long message"
                />
              </label>

              <label>
                Paste message or note
                <textarea
                  rows={5}
                  value={memoryForm.text}
                  onChange={(event) =>
                    setMemoryForm((currentForm) => ({
                      ...currentForm,
                      text: event.target.value,
                    }))
                  }
                  placeholder="Paste your loving message here..."
                />
              </label>

              <label>
                Paste image or video URL
                <input
                  type="url"
                  value={memoryForm.mediaUrl}
                  onChange={(event) =>
                    setMemoryForm((currentForm) => ({
                      ...currentForm,
                      mediaUrl: event.target.value,
                      mediaType: isDirectVideoUrl(event.target.value) ? "video" : "image",
                    }))
                  }
                  placeholder="https://..."
                />
              </label>

              <label>
                Upload image or short video
                <input type="file" accept="image/*,video/*" onChange={handleFileChange} />
              </label>

              <p className="copy-status">
                Local browser storage has limited space, so keep uploads small. Selected
                file: {memoryForm.mediaFileName || "none"}
              </p>

              <button className="primary-button" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Memory"}
              </button>
            </form>

            <p className="copy-status">{saveError || saveSuccess || "Saved memories stay in this browser."}</p>
          </article>

          <div className="section-heading">
            <p className="section-tag">Saved vault</p>
            <h2>Your private memories</h2>
          </div>

          {memories.length ? (
            <div className="vault-memory-grid">
              {memories.map((memory) => (
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
                    <button type="button" onClick={() => handleDeleteMemory(memory.id)}>
                      Delete Memory
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <article className="memory-letter-card">
              <p>No memories saved yet. Add your first private memory above.</p>
            </article>
          )}
        </>
      )}
    </section>
  );
}

export default MemoriesPage;
