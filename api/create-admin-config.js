import bcrypt from "bcryptjs";
import { stdin, stdout } from "node:process";

function readHiddenPassword() {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command directly in an interactive VPS terminal.");
  }

  return new Promise((resolve, reject) => {
    let password = "";
    stdout.write("Admin password (hidden): ");
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
          reject(new Error("Admin setup cancelled."));
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

if (!stdin.isTTY) {
  console.error("Run this command directly in an interactive VPS terminal.");
  process.exit(1);
}

try {
  const username = (process.env.ADMIN_USERNAME || "SHAHZAIBKS").trim();

  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/i.test(username)) {
    throw new Error("Use a username with 3-32 letters, numbers, dots, underscores, or hyphens.");
  }

  console.log(`Creating a separate admin password for ${username}.`);
  const password = await readHiddenPassword();

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Use a password with at least 8 characters and no more than 72 bytes.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  console.log("\nAdd these lines to /etc/love-memories-api.env:");
  console.log(`ADMIN_USERNAME=${username}`);
  console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not configure admin account.");
  process.exitCode = 1;
}
