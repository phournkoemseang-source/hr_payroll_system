import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/UserRepository";
import { CreateUserRequest, LoginRequest, LoginResponse } from "../models/Auth";
import { PublicUser, User } from "../models/User";
import { JwtUtil } from "../utils/JwtUtil";

export class AuthService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly jwtUtil = new JwtUtil(),
  ) {}

  public async login(data: LoginRequest): Promise<LoginResponse | null> {
    const userRecord = await this.userRepository.findByEmail(
      data.email.trim().toLowerCase(),
    );
    if (!userRecord) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(data.password, userRecord.password);
    if (!isPasswordValid) {
      return null;
    }

    const user = new User(userRecord).toPublicUser();
    return {
      token: this.jwtUtil.sign(user),
      user,
    };
  }

  public async createUser(data: CreateUserRequest): Promise<PublicUser> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.userRepository.create({
      ...data,
      email: data.email.trim().toLowerCase(),
      name: data.name.trim(),
      password: hashedPassword,
      loginPassword: data.role === "staff" ? data.password : undefined,
    });
  }

  public async emailExists(email: string): Promise<boolean> {
    return Boolean(await this.userRepository.findByEmail(email.trim().toLowerCase()));
  }
}
