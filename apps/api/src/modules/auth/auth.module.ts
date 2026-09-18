import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { TokenService } from './token.service';
import { GoogleVerifierService } from './google-verifier.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService, SmsService, TokenService, GoogleVerifierService],
  exports: [TokenService, OtpService],
})
export class AuthModule {}
