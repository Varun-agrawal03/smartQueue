import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db/index";
import { ENV } from "../config/env";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export const registerUser = async (input: RegisterInput) => {
  const { name, email, password } = input;

  // check if user already exists
  const existing = await query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rows.length > 0) {
    throw new Error("Email already registered");
  }

  // hash password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  // insert user
  const result = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, password_hash]
  );

  const user = result.rows[0];

  // generate token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    ENV.JWT.secret,
    { expiresIn: "7d" }
  );

  return { user, token };
};

export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  // find user
  const result = await query(
    "SELECT id, name, email, password_hash FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = result.rows[0];

  // verify password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  // generate token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    ENV.JWT.secret,
    { expiresIn: "7d" }
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    token,
  };
};