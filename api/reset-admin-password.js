import bcrypt from "bcryptjs";
import { chmodSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { stdin, stdout } from "node:process";

const environmentPath = "/etc/love-memories-api.env";

function readHiddenPassword(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command directly in an interactive VPS terminal.");
  }

  return new Promise((resolve, reject) => {
    let password = "";
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", handleInput);
    };

    const handleInput = (input) => {
      for (const character of input.toString()) {
        if (character === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Admin password reset cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(password);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
        } else if (character >= " ") {
          password += character;
        }
      }
    };

    stdin.on("data", handleInput);
  });
}

function updateEnvironmentFile(username, passwordHash) {
  const contents = readFileSync(environmentPath, "utf8");
  const lines = contents.split(/\r?\n/);
  const values = new Map([
    ["ADMIN_USERNAME", username],
    ["ADMIN_PASSWORD_HASH", passwordHash],
  ]);
  const found = new Set();
  const updatedLines = lines.map((line) => {
    const match = line.match(/^(ADMIN_USERNAME|ADMIN_PASSWORD_HASH)=/);
    if (!match) {
      return line;
    }

    found.add(match[1]);
    return `${match[1]}=${values.get(match[1])}`;
  });

  for (const [key, value] of values) {
    if (!found.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  const temporaryPath = `${environmentPath}.tmp`;
  writeFileSync(temporaryPath, `${updatedLines.join("\n").trimEnd()}\n`, {
    mode: 0o600,
  });
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, environmentPath);
}

try {
  if (process.platform !== "linux" || process.getuid?.() !== 0) {
    throw new Error("Run this command on the VPS as root, for example with sudo.");
  }

  const username = "SHAHZAIBKS";
  const password = await readHiddenPassword("New admin password (hidden): ");
  const confirmation = await readHiddenPassword("Confirm new admin password: ");

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Use a password with at least 8 characters and no more than 72 bytes.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  updateEnvironmentFile(username, passwordHash);

  try {
    execFileSync("systemctl", ["restart", "love-memories-api"], { stdio: "inherit" });
    execFileSync("systemctl", ["is-active", "--quiet", "love-memories-api"]);
  } catch {
    throw new Error(
      "Admin credentials were updated, but the API did not restart successfully. Check `sudo systemctl status love-memories-api --no-pager -l`."
    );
  }

  console.log("Admin password reset successfully. Sign in as SHAHZAIBKS with the new password.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not reset the admin password.");
  process.exitCode = 1;
}
