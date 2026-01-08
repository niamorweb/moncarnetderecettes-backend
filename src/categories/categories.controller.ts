import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
  Delete,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoryDto } from './dto/category.dto';
import { AuthGuard } from '@nestjs/passport';
import { EmailVerifiedGuard } from 'src/guards/email-verified.guard';

@UseGuards(AuthGuard('jwt'), EmailVerifiedGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async create(@Body() data: CategoryDto, @Request() req) {
    return this.categoriesService.create(data, req.user.userId);
  }

  @Get()
  async findAll(@Request() req) {
    return this.categoriesService.findAll(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.categoriesService.findOne(id, req.user.userId);
  }

  @Delete(':id')
  async deleteOne(@Param('id') id: string, @Request() req) {
    return this.categoriesService.deleteOne(id, req.user.userId);
  }
}
