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
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { Request, Response } from 'express';
import { updatePasswordDto } from './dto/update-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
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

    // Check if request is from mobile client
    const isMobile = req.headers['x-client-type'] === 'mobile';

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return refresh_token in body for mobile clients
    return {
      access_token,
      user: userData,
      ...(isMobile && { refresh_token }),
    };
  }

  @Post('refresh')
  async refresh(
    @Body('refresh_token') bodyRefreshToken: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Accept refresh token from body (mobile) or cookies (web)
    const refreshToken = bodyRefreshToken || req.cookies['refresh_token'];
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Méthode avec envoi mail
    const result = await this.authService.register(registerDto);

    // Check if request is from mobile client
    const isMobile = req.headers['x-client-type'] === 'mobile';

    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return refresh_token in body for mobile clients
    return {
      access_token: result.access_token,
      user: result.user,
      ...(isMobile && { refresh_token: result.refresh_token }),
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
      // secure: process.env.NODE_ENV === 'production',
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      access_token: data.access_token,
      user: data.user,
      message: data.message,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('update-password')
  async updatePassword(@Req() req: Request, @Body() data: updatePasswordDto) {
    if (!req.user) throw new BadRequestException('Accès refusé');
    const userId = req.user['userId'];
    return this.authService.updatePassword(userId, data);
  }

  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email requis');
    return this.authService.resendVerificationEmail(email);
  }
}
