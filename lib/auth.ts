import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const usersFile = path.join(process.cwd(), "data/users.json");

function loadUsers() {
  if (!fs.existsSync(usersFile)) {
    fs.mkdirSync(path.dirname(usersFile), { recursive: true });
    fs.writeFileSync(usersFile, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

function saveUsers(users: any[]) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

export async function signupUser(email: string, password: string) {
  const users = loadUsers();
  if (users.find((u: any) => u.email === email)) {
    throw new Error("User already exists");
  }
  const hashed = await bcrypt.hash(password, 10);
  users.push({ email, password: hashed });
  saveUsers(users);
}

export async function loginUser(email: string, password: string) {
  const users = loadUsers();
  const user = users.find((u: any) => u.email === email);
  if (!user) throw new Error("User not found");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid credentials");

  return { email };
}
