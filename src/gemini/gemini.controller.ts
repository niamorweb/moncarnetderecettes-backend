import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipeBuilder,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GeminiService } from './gemini.service';
import { AuthGuard } from '@nestjs/passport';
import { EmailVerifiedGuard } from 'src/guards/email-verified.guard';
import { IsPremiumGuard } from 'src/guards/is-premium.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@UseGuards(AuthGuard('jwt'), EmailVerifiedGuard, IsPremiumGuard)
@Controller('gemini')
export class GeminiController {
  constructor(private geminiService: GeminiService) {}

  @Post('extract')
  @UseInterceptors(FileInterceptor('image'))
  async extractRecipe(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.geminiService.extractRecipeFromImage(file);
  }
}
