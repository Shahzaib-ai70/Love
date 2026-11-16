import bcrypt from "bcryptjs";
import { parse } from "dotenv";
import {
  chmodSync,
  chownSync,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { stdin, stdout } from "node:process";

const environmentPath = "/etc/love-memories-api.env";
const require = createRequire(import.meta.url);

function readInput(prompt, hidden = false) {
  if (!stdin.isTTY || (hidden && typeof stdin.setRawMode !== "function")) {
    throw new Error("Run this command directly in an interactive VPS terminal.");
  }

  if (!hidden) {
    return new Promise((resolveInput, reject) => {
      stdout.write(prompt);
      let value = "";
      stdin.setEncoding("utf8");
      const handleInput = (input) => {
        value += input;
        if (value.includes("\n")) {
          stdin.removeListener("data", handleInput);
          resolveInput(value.split(/\r?\n/, 1)[0].trim());
        }
      };
      stdin.on("data", handleInput);
      stdin.once("error", reject);
      stdin.resume();
    });
  }

  return new Promise((resolveInput, reject) => {
    let value = "";
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
          reject(new Error("Password reset cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          stdout.write("\n");
          resolveInput(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };

    stdin.on("data", handleInput);
  });
}

async function resetMemoryPassword(username, password) {
  const environment = parse(readFileSync(environmentPath, "utf8"));
  const databasePath = resolve(environment.DB_PATH || "/var/lib/love-memories/love-memories.sqlite");
  if (!existsSync(databasePath)) {
    throw new Error(`Memory database not found at ${databasePath}.`);
  }

  const { default: initSqlJs } = await import("sql.js");
  const SQL = await initSqlJs({
    locateFile: (file) => resolve(dirname(require.resolve("sql.js")), file),
  });
  const database = new SQL.Database(readFileSync(databasePath));

  try {
    database.run("PRAGMA foreign_keys = ON");
    const statement = database.prepare(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE"
    );
    statement.bind([username]);
    const found = statement.step();
    const user = found ? statement.getAsObject() : null;
    statement.free();

    if (!user) {
      throw new Error(`No memory account exists for username "${username}".`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    database.run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
    database.run("DELETE FROM sessions WHERE user_id = ?", [user.id]);

    const fileInfo = statSync(databasePath);
    const temporaryPath = `${databasePath}.reset.tmp`;
    writeFileSync(temporaryPath, Buffer.from(database.export()), {
      mode: fileInfo.mode & 0o777,
    });
    chownSync(temporaryPath, fileInfo.uid, fileInfo.gid);
    chmodSync(temporaryPath, fileInfo.mode & 0o777);
    renameSync(temporaryPath, databasePath);
  } finally {
    database.close();
  }
}

try {
  if (process.platform !== "linux" || process.getuid?.() !== 0) {
    throw new Error("Run this command on the VPS as root, for example with sudo.");
  }

  const username = (await readInput("Memory account username: ")).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error("Use a valid 3-32 character memory account username.");
  }

  const password = await readInput("New memory account password (hidden): ", true);
  const confirmation = await readInput("Confirm new memory account password: ", true);
  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Use a password with at least 8 characters and no more than 72 bytes.");
  }

  execFileSync("systemctl", ["stop", "love-memories-api"], { stdio: "inherit" });
  try {
    await resetMemoryPassword(username, password);
  } catch (error) {
    try {
      execFileSync("systemctl", ["start", "love-memories-api"], { stdio: "inherit" });
    } catch {
      throw new Error(
        `Password reset failed and the API could not be restarted. Check the service status. ${error instanceof Error ? error.message : ""}`
      );
    }
    throw error;
  }

  execFileSync("systemctl", ["start", "love-memories-api"], { stdio: "inherit" });
  execFileSync("systemctl", ["is-active", "--quiet", "love-memories-api"]);
  console.log(`Password reset successfully for memory account "${username}". Existing memories are kept.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not reset the memory account password.");
  process.exitCode = 1;
}
