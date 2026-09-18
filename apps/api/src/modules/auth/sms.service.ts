import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../../config/env';

/**
 * SMS delivery.
 *
 * In development `SMS_PROVIDER=console` prints the code to the API log, which
 * is what makes the whole auth flow testable without an SMS account or a real
 * Armenian number. The provider adapters below are deliberately thin: the code
 * that matters — issuing, hashing, counting attempts — lives in OtpService and
 * does not change when the carrier does.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly env = loadEnv();

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    const body = `Zal: ${code} — your verification code. It expires in ${Math.round(
      this.env.OTP_TTL_SECONDS / 60,
    )} minutes.`;
    await this.send(phone, body);
  }

  async send(phone: string, body: string): Promise<void> {
    switch (this.env.SMS_PROVIDER) {
      case 'console':
        // Loud and unmissable in a dev log; never reached in production because
        // the environment schema requires a real provider there.
        this.logger.log(`\n┌─ SMS → ${phone}\n│ ${body}\n└────────────────────────────`);
        return;

      case 'twilio':
      case 'vonage':
        // Wire the carrier SDK here. Kept unimplemented rather than faked so a
        // misconfigured production deploy fails loudly instead of silently
        // swallowing every code.
        throw new Error(
          `SMS_PROVIDER=${this.env.SMS_PROVIDER} is selected but no credentials adapter is wired yet`,
        );

      default:
        throw new Error(`Unknown SMS provider: ${this.env.SMS_PROVIDER}`);
    }
  }
}
