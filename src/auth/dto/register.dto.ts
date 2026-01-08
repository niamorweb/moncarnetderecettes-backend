import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit faire au moins 6 caractères' })
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @MinLength(3, {
    message: "Le nom d'utilisateur doit faire au moins 3 caractères",
  })
  @MaxLength(30, {
    message: "Le nom d'utilisateur ne doit pas dépasser 30 caractères",
  })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message:
      "Le nom d'utilisateur ne peut contenir que des lettres et des chiffres (pas d'espaces ni de caractères spéciaux)",
  })
  username: string;
}
