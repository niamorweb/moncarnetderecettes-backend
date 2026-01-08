import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { Resend } from 'resend';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    @Inject('RESEND_CLIENT') private readonly resend: Resend,
  ) {}
  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      username: user.username,
      isPremium: user.isPremium,
      premiumEndsAt: user.premiumEndsAt,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_ACCESS_SECRET,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET,
    });

    await this.updateRefreshToken(user.id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isPremium: user.isPremium,
        isEmailVerified: user.isEmailVerified,
        premiumEndsAt: user.premiumEndsAt,
      },
    };
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: hashedToken },
    });
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.hashedRefreshToken)
        throw new ForbiddenException('Accès refusé');

      const rtMatches = await bcrypt.compare(
        refreshToken,
        user.hashedRefreshToken,
      );
      if (!rtMatches) throw new ForbiddenException('Accès refusé');

      const newAt = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          username: user.username,
          isPremium: user.isPremium,
          premiumEndsAt: user.premiumEndsAt,
        },
        { expiresIn: '15m', secret: process.env.JWT_ACCESS_SECRET },
      );

      return { access_token: newAt };
    } catch (e) {
      throw new ForbiddenException('Session expirée');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.jwtService.decode(refreshToken) as any;
      if (payload && payload.sub) {
        await this.prisma.user.update({
          where: { id: payload.sub },
          data: { hashedRefreshToken: null },
        });
      }
    } catch (e) {
      return null;
    }
  }

  async register(data: RegisterDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    const usernameExists = await this.prisma.user.findUnique({
      where: { username: data.username },
    });

    if (usernameExists) {
      throw new BadRequestException("Ce nom d'utilisateur est déjà utilisé");
    }

    if (userExists) {
      throw new BadRequestException('Cet email est déjà utilisé');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const newUser = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        username: data.username,
        verificationToken: verificationToken,
        isEmailVerified: true, // To skip email verification
        profile: {
          create: {
            name: data.name,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    return this.login(newUser);
    // try {
    //   const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    //   const verificationLink = `${frontendUrl}/auth/verify?token=${verificationToken}`;

    //   console.log(`📧 Tentative d'envoi d'email à : ${newUser.email}...`);

    //   const { data, error } = await this.resend.emails.send({
    //     from: 'onboarding@resend.dev',
    //     to: [newUser.email],
    //     subject: '🍳 Bienvenue sur MonCarnetDeRecettes ! Confirmez votre email',
    //     html: this.getEmailTemplate(
    //       newUser.profile?.name || 'Chef',
    //       verificationLink,
    //       `Merci de rejoindre <strong>MonCarnetDeRecettes</strong>. Pour commencer à créer et organiser vos meilleures recettes, veuillez confirmer votre adresse email.`,
    //     ),
    //     text: `Bienvenue ! Confirmez votre email ici : ${verificationLink}`,
    //   });

    //   if (error) {
    //     console.error('❌ Échec Resend :', error);
    //   } else {
    //     console.log(`✅ Email envoyé avec succès ! ID: ${data?.id}`);
    //   }
    // } catch (error) {
    //   console.error("💥 Erreur critique lors de l'envoi de mail :", error);
    // }

    // return {
    //   sub: newUser.id,
    //   email: newUser.email,
    //   isEmailVerified: newUser.isEmailVerified,
    //   username: newUser.username,
    //   isPremium: newUser.isPremium,
    //   premiumEndsAt: newUser.premiumEndsAt,
    // };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Lien de vérification invalide ou expiré.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
      },
    });

    const loginResult = await this.login(updatedUser);

    return {
      ...loginResult,
      message: 'Email vérifié avec succès ! Vous êtes maintenant connecté.',
    };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Cet email est déjà vérifié.');
    }

    const newToken = crypto.randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: newToken },
    });

    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify?token=${newToken}`;

    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [user.email],
      subject: '🍳 Nouveau lien de confirmation',
      html: this.getEmailTemplate(
        user.profile?.name || 'Chef',
        verificationLink,
        `Vous avez demandé un nouveau lien de confirmation pour votre compte <strong>${user.email}</strong>. L'ancien lien n'est désormais plus valide.`,
      ),
    });
    return { message: 'Un nouveau lien a été envoyé.' };
  }

  private getEmailTemplate(
    chefName: string,
    verificationLink: string,
    introText: string,
  ) {
    const colorOrange = '#ea580c';
    const colorDark = '#171717';
    const colorGray = '#737373';
    const colorBg = '#fafafa';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: ${colorBg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <div style="margin-bottom: 24px; text-align: center;">
              <span style="font-size: 24px; font-weight: 900; color: ${colorDark}; letter-spacing: -1px;">
                MonCarnetDeRecettes
              </span>
            </div>
            <table role="presentation" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 40px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.05);">
              <tr>
                <td style="width: 100%; height: 160px; background-color: #fff7ed; text-align: center; vertical-align: middle;">
                  <div style="font-size: 60px;">👨‍🍳</div>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <h1 style="margin: 0 0 16px 0; color: ${colorDark}; font-size: 24px; font-weight: 800;">
                    Bienvenue en cuisine, <br/> ${chefName} !
                  </h1>
                  <p style="margin: 0 0 32px 0; color: ${colorGray}; font-size: 16px; line-height: 1.6;">
                    ${introText}
                  </p>
                  <a href="${verificationLink}" style="display: inline-block; background-color: ${colorOrange}; color: #ffffff; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.3);">
                    Valider mon compte
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 40px 40px; text-align: center;">
                  <p style="margin-top: 24px; color: #a3a3a3; font-size: 12px; line-height: 1.5;">
                    Si le bouton ne fonctionne pas, copiez-collez ce lien :<br/>
                    <a href="${verificationLink}" style="color: ${colorOrange}; text-decoration: none;">${verificationLink}</a>
                  </p>
                </td>
              </tr>
            </table>
            <div style="margin-top: 32px; text-align: center; color: #a3a3a3; font-size: 12px;">
              <p>&copy; ${new Date().getFullYear()} MonCarnetDeRecettes. Tous droits réservés.</p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  }
}
