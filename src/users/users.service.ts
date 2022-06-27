import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAccountInput } from './dtos/create-account.dto';
import { LoginInput } from './dtos/login.dto';
import { User } from './entities/user.entity';

export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async createAccount({
    email,
    password,
    role,
  }: CreateAccountInput): Promise<[boolean, string?]> {
    try {
      const exists = await this.users.findOneBy({ email });
      if (exists) {
        return [false, '이미 존재하는 계정입니다'];
      }
      await this.users.save(this.users.create({ email, password, role }));
      return [true];
    } catch (e) {
      //make error
      return [false, '계정을 생성할 수 없습니다'];
    }
    //create user & hash the password
  }

  async login({
    email,
    password,
  }: LoginInput): Promise<[boolean, string?, string?]> {
    try {
      const user = await this.users.findOneBy({ email });
      if (!user) {
        return [false, '유저를 찾이못했습니다'];
      }

      const passwordCorrect = await user.checkPassword(password);
      if (!passwordCorrect) {
        return [passwordCorrect, '로그인 실패했습니다'];
      }
      return [passwordCorrect, '로그인 성공했습니다', 'lalalala'];
    } catch (error) {
      return [false, error];
    }
  }
}
