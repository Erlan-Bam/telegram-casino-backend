import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminCaseService } from './admin-case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { AdminGuard } from '../../shared/guards/admin.guard';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('admin/cases')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminCaseController {
  constructor(private readonly adminCaseService: AdminCaseService) {}

  @Post()
  create(@Body() createCaseDto: CreateCaseDto) {
    return this.adminCaseService.create(createCaseDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.adminCaseService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminCaseService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCaseDto: UpdateCaseDto,
  ) {
    return this.adminCaseService.update(id, updateCaseDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminCaseService.remove(id);
  }
}
