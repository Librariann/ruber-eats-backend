import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { CreateAccountInput } from './dtos/create-account.dto';
import { LoginInput } from './dtos/login.dto';
import { User } from './entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { JwtService } from 'src/jwt/jwt.service';

export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwtService: JwtService,
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

      //jwt의 중요점은 정보의 은닉이 아닌 정보가 변경됐는지를 파악하기 위해 사용하는것
      //만약 정보가 변경됐다면 백엔드에서 발급한 토큰 값이랑 다르기때문에 토큰의 변경 진위여부를 파악할수있다
      const passwordCorrect = await user.checkPassword(password);
      if (!passwordCorrect) {
        return [passwordCorrect, '로그인 실패했습니다'];
      }
      //sign에 user.id만 넘겨주는것은 이 프로젝트에서만 사용 할것이기때문에
      //만약 다른 프로젝트에서 더 크게 사용한다면 object형태로 넘겨주면된다
      const token = this.jwtService.sign(user.id);
      return [passwordCorrect, '로그인 성공했습니다', token];
    } catch (error) {
      return [false, error];
    }
  }

  async findById(id: number): Promise<User> {
    return this.users.findOneBy({ id });
  }
}
