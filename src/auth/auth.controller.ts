import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) throw new UnauthorizedException('Identifiants incorrects');

    const {
      access_token,
      refresh_token,
      user: userData,
    } = await this.authService.login(user);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      access_token,
      user: userData,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException();

    return this.authService.refreshTokens(refreshToken);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    await this.authService.logout(refreshToken);

    res.clearCookie('refresh_token');
    return { message: 'Déconnecté avec succès' };
  }
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Méthode avec envoi mail
    // return this.authService.register(registerDto);

    const result = await this.authService.register(registerDto);

    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Get('verify')
  async verify(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('Token manquant');
    }

    const data = await this.authService.verifyEmail(token);

    res.cookie('refresh_token', data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      access_token: data.access_token,
      user: data.user,
      message: data.message,
    };
  }

  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email requis');
    return this.authService.resendVerificationEmail(email);
  }
}
