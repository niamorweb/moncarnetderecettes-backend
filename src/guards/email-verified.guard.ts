import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        "Votre adresse email n'est pas vérifiée. Veuillez consulter vos emails pour valider votre compte.",
      );
    }

    return true;
  }
}
