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
import { MailService } from 'src/mail/mail.service';

export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,

    @InjectRepository(Verification)
    private readonly verifications: Repository<Verification>,

    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async createAccount({
    email,
    password,
    role,
  }: CreateAccountInput): Promise<CreateAccountOutput> {
    try {
      const exists = await this.users.findOne({ where: { email } });
      if (exists) {
        return { ok: false, error: '이미 존재하는 계정입니다' };
      }
      const user = await this.users.save(
        this.users.create({ email, password, role }),
      );
      const verification = await this.verifications.save(
        this.verifications.create({
          user,
        }),
      );
      this.mailService.sendVerificationEmail(user.email, verification.code);
      return { ok: true };
    } catch (e) {
      console.log(e);
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
        return { ok: false, error: '비밀번호가 틀립니다.' };
      }
      //sign에 user.id만 넘겨주는것은 이 프로젝트에서만 사용 할것이기때문에
      //만약 다른 프로젝트에서 더 크게 사용한다면 object형태로 넘겨주면된다
      const token = this.jwtService.sign(user.id);
      return { ok: true, error: '로그인 성공했습니다', token };
    } catch (error) {
      return { ok: false, error: '로그인 실패했습니다' };
    }
  }

  async findById(id: number): Promise<UserProfileOutput> {
    try {
      const user = await this.users.findOneOrFail({ where: { id } });
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: '유저를 찾을 수 없습니다' };
    }
  }

  async editProfile(
    id: number,
    { email, password }: EditProfileInput,
  ): Promise<EditProfileOutput> {
    //update()를 사용하면 단순히 query만 보내는거라 entity에 있는 데코레이터 사용불가능
    try {
      const user = await this.users.findOne({ where: { id } });
      if (email) {
        user.email = email;
        user.verified = false;
        await this.verifications.delete({ user: { id: user.id } });
        const verification = await this.verifications.save(
          this.verifications.create({ user }),
        );
        this.mailService.sendVerificationEmail(user.email, verification.code);
      }
      if (password) {
        user.password = password;
      }
      this.users.save(user);
      return { ok: true };
    } catch (error) {
      console.log(error);
      return { ok: false, error: '변경 할 수 없습니다' };
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
        await this.users.save(verification.user);
        await this.verifications.delete(verification.id);

        return { ok: true };
      }

      return { ok: false, error: '인증실패했습니다' };
    } catch (e) {
      return { ok: false, error: '실패했습니다' };
    }
  }
}
