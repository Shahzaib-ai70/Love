import { useEffect, useMemo, useState } from "react";
import {
  createVaultAccount,
  deleteUserMemory,
  getMemoryStorageMode,
  getCurrentVaultUser,
  getUserMemories,
  importLocalMemories,
  saveUserMemory,
  signInVaultAccount,
  signOutVaultAccount,
} from "../memoryVaultApi";

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
  const isSqlMode = getMemoryStorageMode() === "sql";
  const maxUploadSizeMb = 15;
  const [mode, setMode] = useState("signin");
  const [currentUser, setCurrentUser] = useState(null);
  const [memories, setMemories] = useState([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [authError, setAuthError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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

  const loadCurrentUser = async () => {
    setIsLoadingUser(true);

    try {
      const user = await getCurrentVaultUser();
      setCurrentUser(user);
      setMemories(user ? await getUserMemories(user.id) : []);
    } catch (error) {
      setCurrentUser(null);
      setMemories([]);
      setAuthError(error instanceof Error ? error.message : "Could not load your memory account.");
    } finally {
      setIsLoadingUser(false);
    }
  };

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  const memoryCountLabel = useMemo(() => {
    if (isLoadingUser) {
      return "Loading your private memory vault.";
    }

    if (!currentUser) {
      return "Create a private account or sign in to save and open your memories.";
    }

    return `${memories.length} private memories saved for ${
      currentUser.displayName || currentUser.username
    }.`;
  }, [currentUser, isLoadingUser, memories.length]);

  const handleSignIn = async (event) => {
    event.preventDefault();
    setAuthError("");

    try {
      await signInVaultAccount(signInForm);
      setSignInForm({ username: "", password: "" });
      await loadCurrentUser();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign in.");
    }
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    setAuthError("");

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    if (signUpForm.password.length < 8) {
      setAuthError(
        "Use a password with at least 8 characters."
      );
      return;
    }

    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/i.test(signUpForm.username.trim())) {
      setAuthError("Use a username with 3-32 letters, numbers, dots, underscores, or hyphens.");
      return;
    }

    try {
      await createVaultAccount(signUpForm);
      setSignUpForm({
        displayName: "",
        username: "",
        password: "",
        confirmPassword: "",
      });
      await loadCurrentUser();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not create account.");
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > maxUploadSizeMb * 1024 * 1024) {
      setSaveError(
        `Keep uploads under ${maxUploadSizeMb} MB for reliable saving.`
      );
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

      await saveUserMemory({
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
      setSaveSuccess(
        "Memory saved to your private account."
      );
      await loadCurrentUser();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this memory.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    try {
      await deleteUserMemory(memoryId);
      await loadCurrentUser();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not delete this memory.");
    }
  };

  const handleLogout = async () => {
    await signOutVaultAccount();
    setSaveSuccess("");
    setSaveError("");
    await loadCurrentUser();
  };

  const handleImportLocalMemories = async () => {
    setIsImporting(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const { importedCount, totalCount } = await importLocalMemories();
      setSaveSuccess(
        totalCount
          ? `Imported ${importedCount} of ${totalCount} browser memories into your account.`
          : "No browser memories were found for this username on this device."
      );
      await loadCurrentUser();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not import browser memories.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="page-stack section-block">
      <div className="section-heading">
        <p className="section-tag">Private memories</p>
        <h2>Save your own memory vault</h2>
        <p className="copy-status">
          {memoryCountLabel} Your account and memories are securely stored online and can be
          accessed from any device.
        </p>
      </div>

      {isLoadingUser ? (
        <article className="memory-letter-card">
          <p>Loading your memory vault...</p>
        </article>
      ) : !currentUser ? (
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
                    required
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
                    required
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
                    required
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
                    minLength={8}
                    required
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
                    minLength={8}
                    required
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

            <p className="copy-status">
              {authError ||
                "Create an account to save your memories securely and open them from any device."}
            </p>
          </article>

          <article className="memory-letter-card">
            <p className="section-tag">How it works</p>
            <h3>Private vault access</h3>
            <p>
              Your account works on every device. Sign in with the same username and password to
              see the memories saved in your private account.
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

            {isSqlMode ? (
              <button
                className="secondary-button"
                type="button"
                onClick={handleImportLocalMemories}
                disabled={isImporting}
              >
                {isImporting ? "Importing..." : "Import memories from this device"}
              </button>
            ) : null}

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
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg"
                  onChange={handleFileChange}
                />
              </label>

              <p className="copy-status">
                {`Uploads are stored with your account. Keep files under ${maxUploadSizeMb} MB.`}{" "}
                Selected file: {memoryForm.mediaFileName || "none"}
              </p>

              <button className="primary-button" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Memory"}
              </button>
            </form>

            <p className="copy-status">
              {saveError ||
                saveSuccess ||
                "Your saved memories stay private and are available whenever you sign in."}
            </p>
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
