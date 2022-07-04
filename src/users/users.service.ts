import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateAccountInput,
  CreateAccountOutput,
} from './dtos/create-account.dto';
import { LoginInput, LoginOutput } from './dtos/login.dto';
import { User } from './entities/user.entity';
import { JwtService } from 'src/jwt/jwt.service';
import { EditProfileInput, EditProfileOutput } from './dtos/edit-profile.dto';
import { Verification } from './entities/verification.entity';
import { VerifyEmailOutput } from './dtos/verify-email.dto';
import { UserProfileOutput } from './dtos/user-profile.dto';

export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Verification)
    private readonly verifications: Repository<Verification>,
    private readonly jwtService: JwtService,
  ) {}

  async createAccount({
    email,
    password,
    role,
  }: CreateAccountInput): Promise<CreateAccountOutput> {
    try {
      const exists = await this.users.findOneBy({ email });
      if (exists) {
        return { ok: false, error: '이미 존재하는 계정입니다' };
      }
      const user = await this.users.save(
        this.users.create({ email, password, role }),
      );
      await this.verifications.save(
        this.verifications.create({
          user,
        }),
      );
      return { ok: true };
    } catch (e) {
      //make error
      return { ok: false, error: '계정을 생성할 수 없습니다' };
    }
    //create user & hash the password
  }

  async login({ email, password }: LoginInput): Promise<LoginOutput> {
    try {
      const user = await this.users.findOne({
        where: { email },
        select: ['id', 'password'],
      });
      if (!user) {
        return { ok: false, error: '유저를 찾지못했습니다' };
      }

      //jwt의 중요점은 정보의 은닉이 아닌 정보가 변경됐는지를 파악하기 위해 사용하는것
      //만약 정보가 변경됐다면 백엔드에서 발급한 토큰 값이랑 다르기때문에 토큰의 변경 진위여부를 파악할수있다
      const passwordCorrect = await user.checkPassword(password);
      if (!passwordCorrect) {
        return { ok: passwordCorrect, error: '로그인 실패했습니다' };
      }
      //sign에 user.id만 넘겨주는것은 이 프로젝트에서만 사용 할것이기때문에
      //만약 다른 프로젝트에서 더 크게 사용한다면 object형태로 넘겨주면된다
      const token = this.jwtService.sign(user.id);
      return { ok: passwordCorrect, error: '로그인 성공했습니다', token };
    } catch (error) {
      return { ok: false, error };
    }
  }

  async findById(id: number): Promise<UserProfileOutput> {
    const user = await this.users.findOneBy({ id });
    return { ok: true, user };
  }

  async editProfile(
    id: number,
    { email, password }: EditProfileInput,
  ): Promise<EditProfileOutput> {
    //update()를 사용하면 단순히 query만 보내는거라 entity에 있는 데코레이터 사용불가능
    const user = await this.users.findOneBy({ id });
    try {
      if (email) {
        user.email = email;
        user.verified = false;
        await this.verifications.save(this.verifications.create({ user }));
      }
      if (password) {
        user.password = password;
      }
      this.users.save(user);
      return { ok: true };
    } catch (error) {
      console.log(error);
      return { ok: false, error };
    }
  }

  async verifyEmail(code: string): Promise<VerifyEmailOutput> {
    try {
      //Join(RelationShip의 경우 따로 호출코드를 불러와야함)
      const verification = await this.verifications.findOne({
        where: { code },
        relations: ['user'],
      });

      if (verification) {
        verification.user.verified = true;
        console.log(verification.user);
        this.users.save(verification.user);
        return { ok: true };
      }

      return { ok: false };
    } catch (e) {
      console.log(e);
      return { ok: false, error: e };
    }
  }
}
