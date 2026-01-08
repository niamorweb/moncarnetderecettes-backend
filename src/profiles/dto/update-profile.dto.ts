import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  public_name?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
